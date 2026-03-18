/**
 * Bootstrap API — One-click Mac dev setup token management.
 *
 * POST /v1/bootstrap/create   — Admin-authenticated: generate a single-use bootstrap token
 * POST /v1/bootstrap/exchange — Token-authenticated: exchange token for app credentials
 */

import crypto from 'crypto';
import { sql } from '../lib/db';
import { requireEnv } from '../lib/require-env';
import type { AdminContext } from '../lib/admin-auth';
import {
  buildBaseEnvVars,
  buildDatabaseEnvVars,
  buildCustomEnvVars,
  buildEncryptedEnvVars,
  buildStorageEnvVars,
  buildPlatformKeyEnvVars,
  resolveGitToken,
} from '../services/deploy-env-builder';
import { generateClaudeMdContent, getAgentMemory, getAgentRoles, type Framework } from '../services/app-templates';
import { getBootstrapSkills } from '../services/bootstrap-skills';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Handle bootstrap routes. Returns null if route not matched.
 */
export async function handleBootstrapRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext | null,
): Promise<Response | null> {
  // POST /v1/bootstrap/create — requires admin auth
  if (pathname === '/v1/bootstrap/create' && req.method === 'POST') {
    if (!ctx) {
      return Response.json({ error: 'Admin auth required' }, { status: 401 });
    }
    return handleCreate(req, ctx);
  }

  // POST /v1/bootstrap/exchange — public (token-authenticated)
  if (pathname === '/v1/bootstrap/exchange' && req.method === 'POST') {
    return handleExchange(req);
  }

  // GET /v1/bootstrap/setup?token=X — public, returns executable bash script
  if (pathname === '/v1/bootstrap/setup' && req.method === 'GET') {
    return handleSetup(req);
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /v1/bootstrap/create
// ---------------------------------------------------------------------------

async function handleCreate(req: Request, ctx: AdminContext): Promise<Response> {
  let body: { appId?: string; envName?: string; userId?: string; userEmail?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { appId, envName, userId, userEmail } = body;
  if (!appId || !envName || !userId || !userEmail) {
    return Response.json({ error: 'Missing required fields: appId, envName, userId, userEmail' }, { status: 400 });
  }

  // Verify app belongs to org
  const appResult = await sql`
    SELECT id, org_id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appResult.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Verify environment exists
  const envResult = await sql`
    SELECT id FROM app_environments WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const envId = envResult[0].id as string;
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await sql`
    INSERT INTO bootstrap_tokens (org_id, app_id, env_id, user_id, user_email, token_hash, expires_at)
    VALUES (${ctx.orgId}, ${appId}, ${envId}, ${userId}, ${userEmail}, ${tokenHash}, ${expiresAt})
  `;

  return Response.json({ token, expiresAt: expiresAt.toISOString() });
}

// ---------------------------------------------------------------------------
// Shared: exchange token and gather credentials
// ---------------------------------------------------------------------------

interface BootstrapCredentials {
  orgSlug: string;
  appName: string;
  appSlug: string;
  framework: string;
  gitRepo: string | null;
  gitBranch: string;
  envVars: Record<string, string>;
  claudeMd: string;
  consoleUrl: string;
}

async function exchangeTokenAndGatherCredentials(
  rawToken: string,
): Promise<{ credentials: BootstrapCredentials } | { error: string; status: number }> {
  const tokenHash = hashToken(rawToken);

  // Look up and atomically mark as used
  const result = await sql`
    UPDATE bootstrap_tokens
    SET used_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING org_id, app_id, env_id, user_id, user_email
  `;

  if (result.length === 0) {
    return { error: 'Invalid or expired token. Generate a new setup command from the Console.', status: 401 };
  }

  const { org_id: orgId, app_id: appId, env_id: envId } = result[0];

  // Gather app details
  const appResult = await sql`
    SELECT a.name, a.slug, a.framework, a.git_repo, a.git_branch,
           o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId}
  `;
  if (appResult.length === 0) {
    return { error: 'App not found', status: 404 };
  }

  const app = appResult[0];
  const orgSlug = app.org_slug as string;
  const appSlug = app.slug as string;
  const appName = app.name as string;
  const framework = (app.framework || 'react-router') as string;
  const gitRepo = app.git_repo as string | null;
  const gitBranch = (app.git_branch || 'main') as string;

  // Resolve environment-specific git branch
  const envBranchResult = await sql`
    SELECT name, git_branch, port, project_id, settings
    FROM app_environments WHERE id = ${envId}
  `;
  const envRow = envBranchResult[0] || {};
  const envName = (envRow.name as string) || 'prod';
  const effectiveBranch = (envRow.git_branch as string) || gitBranch;
  const port = (envRow.port as number) || 3000;
  const linkedProjectId = envRow.project_id as string | null;
  const settings = envRow.settings as Record<string, unknown> | undefined;

  // Build env vars (same as deploy)
  const envVars: Record<string, string> = {
    ...buildBaseEnvVars(port),
  };

  // App metadata for deploy skill and CI
  envVars.SIGNALDB_APP_ID = appId as string;
  envVars.SIGNALDB_APP_SLUG = appSlug;
  envVars.SIGNALDB_ENV_NAME = envName;
  envVars.SIGNALDB_ORG_SLUG = orgSlug;
  envVars.SIGNALDB_API_URL = 'https://api.signaldb.live';

  // Database env vars
  if (linkedProjectId) {
    const dbVars = await buildDatabaseEnvVars(linkedProjectId, 'container', ENCRYPTION_KEY);
    Object.assign(envVars, dbVars);
  }

  // Custom env vars from settings
  Object.assign(envVars, buildCustomEnvVars(settings));

  // Encrypted env vars
  const encVars = await buildEncryptedEnvVars(envId as string, ENCRYPTION_KEY);
  Object.assign(envVars, encVars);

  // Storage env vars
  const storageVars = await buildStorageEnvVars(orgId as string, orgSlug);
  Object.assign(envVars, storageVars);

  // Platform key
  const platformVars = await buildPlatformKeyEnvVars(orgId as string);
  Object.assign(envVars, platformVars);

  // Override NODE_ENV for local dev
  envVars.NODE_ENV = 'development';

  // Build git clone URL with token if applicable
  let cloneUrl = gitRepo;
  if (gitRepo) {
    try {
      const gitToken = await resolveGitToken(gitRepo, orgId as string);
      if (gitToken) {
        const url = new URL(gitRepo);
        url.username = 'x-access-token';
        url.password = gitToken;
        cloneUrl = url.toString();
      }
    } catch {
      // Non-fatal: clone without token
    }
  }

  // Generate CLAUDE.md content
  let claudeMd = '';
  try {
    claudeMd = generateClaudeMdContent(
      framework as any,
      orgSlug,
      appSlug,
      appName,
    );
  } catch {
    // Non-fatal
  }

  return {
    credentials: {
      orgSlug,
      appName,
      appSlug,
      framework,
      gitRepo: cloneUrl,
      gitBranch: effectiveBranch,
      envVars,
      claudeMd,
      consoleUrl: `https://${orgSlug}.console.signaldb.app`,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /v1/bootstrap/exchange
// ---------------------------------------------------------------------------

async function handleExchange(req: Request): Promise<Response> {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 400 });
  }

  const result = await exchangeTokenAndGatherCredentials(token);
  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const c = result.credentials;
  return Response.json({
    orgSlug: c.orgSlug,
    appName: c.appName,
    appSlug: c.appSlug,
    framework: c.framework,
    gitRepo: c.gitRepo,
    gitBranch: c.gitBranch,
    envVars: c.envVars,
    claudeMd: c.claudeMd,
    signaldbApiUrl: 'https://api.signaldb.live',
    consoleUrl: c.consoleUrl,
  });
}

// ---------------------------------------------------------------------------
// GET /v1/bootstrap/setup?token=X — returns executable bash script
// ---------------------------------------------------------------------------

async function handleSetup(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('#!/bin/bash\necho "Error: missing token parameter"\nexit 1\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const result = await exchangeTokenAndGatherCredentials(token);
  if ('error' in result) {
    return new Response(`#!/bin/bash\necho "Error: ${result.error}"\nexit 1\n`, {
      status: result.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const c = result.credentials;

  // Build the env vars block for the script
  const envLines: string[] = [];
  for (const [k, v] of Object.entries(c.envVars)) {
    // Escape single quotes in values
    const escaped = String(v).replace(/'/g, "'\\''");
    envLines.push(`${k}='${escaped}'`);
  }

  // Escape CLAUDE.md content for heredoc (no escaping needed inside heredoc)
  const claudeMdContent = c.claudeMd || '';

  // Load bootstrap skills
  const skills = await getBootstrapSkills();

  // Load agent memory templates for this framework
  const agentMemory: Record<string, string> = {};
  const roles = getAgentRoles(c.framework as Framework);
  for (const role of roles) {
    const memory = getAgentMemory(c.framework as Framework, role);
    if (memory) {
      agentMemory[role] = memory;
    }
  }

  // Build the complete setup script with credentials pre-embedded
  const script = buildSetupScript({
    orgSlug: c.orgSlug,
    appSlug: c.appSlug,
    appName: c.appName,
    framework: c.framework,
    gitRepo: c.gitRepo,
    gitBranch: c.gitBranch,
    envContent: envLines.join('\n'),
    claudeMd: claudeMdContent,
    consoleUrl: c.consoleUrl,
    skills,
    agentMemory,
  });

  return new Response(script, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ---------------------------------------------------------------------------
// Build the setup bash script with credentials already embedded
// ---------------------------------------------------------------------------

function buildSetupScript(opts: {
  orgSlug: string;
  appSlug: string;
  appName: string;
  framework: string;
  gitRepo: string | null;
  gitBranch: string;
  envContent: string;
  claudeMd: string;
  consoleUrl: string;
  skills: Record<string, string>;
  agentMemory: Record<string, string>;
}): string {
  // Use a string array to avoid esbuild/Vite parsing bash ${} as JS interpolation
  const lines: string[] = [
    '#!/bin/bash',
    '# SignalDB Local Dev Setup',
    '# This script sets up your local development environment.',
    '',
    'set -euo pipefail',
    '',
    '# Color helpers',
    "GREEN='\\033[0;32m'",
    "YELLOW='\\033[1;33m'",
    "RED='\\033[0;31m'",
    "BLUE='\\033[0;34m'",
    "NC='\\033[0m'",
    '',
    'step() { echo -e "\\n${GREEN}> $1${NC}"; }',
    'warn() { echo -e "${YELLOW}! $1${NC}"; }',
    'fail() { echo -e "${RED}x $1${NC}"; exit 1; }',
    'info() { echo -e "${BLUE}  $1${NC}"; }',
    '',
    'echo ""',
    'echo "==========================================="',
    `echo "  SignalDB Local Dev Setup"`,
    `echo "  App: ${opts.appName} (${opts.orgSlug})"`,
    'echo "==========================================="',
    'echo ""',
    '',
    '# --- 1. Xcode Command Line Tools ---',
    'step "Checking Xcode Command Line Tools..."',
    'if ! xcode-select -p &>/dev/null; then',
    '  echo "Installing Xcode CLT (this may take a few minutes)..."',
    '  xcode-select --install',
    '  echo ""',
    '  echo "Press Enter after Xcode CLT installation completes..."',
    '  read -r',
    'fi',
    'echo "  Xcode CLT installed"',
    '',
    '# --- 2. Homebrew ---',
    'step "Checking Homebrew..."',
    'if ! command -v brew &>/dev/null; then',
    '  echo "Installing Homebrew..."',
    '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
    '  if [ -d "/opt/homebrew/bin" ]; then',
    '    eval "$(/opt/homebrew/bin/brew shellenv)"',
    '    echo \'eval "$(/opt/homebrew/bin/brew shellenv)"\' >> ~/.zprofile',
    '  fi',
    'fi',
    'echo "  Homebrew installed"',
    '',
    '# --- 3. Git ---',
    'step "Checking Git..."',
    'if ! command -v git &>/dev/null; then',
    '  brew install git',
    'fi',
    "echo \"  Git $(git --version | cut -d' ' -f3)\"",
    '',
    '# --- 4. Bun ---',
    'step "Checking Bun..."',
    'if ! command -v bun &>/dev/null; then',
    '  curl -fsSL https://bun.sh/install | bash',
    '  export PATH="$HOME/.bun/bin:$PATH"',
    '  echo \'export PATH="$HOME/.bun/bin:$PATH"\' >> ~/.zprofile',
    'fi',
    'echo "  Bun $(bun --version)"',
    '',
    'echo "  Credentials received from server"',
    '',
    '# --- 5. Set up project directory ---',
    `PROJECT_DIR="$HOME/Projects/${opts.orgSlug}/${opts.appSlug}"`,
    'step "Setting up project at ${PROJECT_DIR}..."',
    '',
    'mkdir -p "$(dirname "$PROJECT_DIR")"',
    '',
  ];

  // Git clone section
  if (opts.gitRepo) {
    lines.push(
      'if [ -d "$PROJECT_DIR/.git" ]; then',
      '  warn "Git repo exists - pulling latest changes"',
      '  cd "$PROJECT_DIR"',
      `  git pull origin "${opts.gitBranch}" 2>/dev/null || true`,
      'else',
      '  echo "  Cloning repository..."',
      `  git clone -b "${opts.gitBranch}" "${opts.gitRepo}" "$PROJECT_DIR" 2>&1 | while IFS= read -r line; do echo "    $line"; done`,
      '  cd "$PROJECT_DIR"',
      'fi',
    );
  } else {
    lines.push(
      'mkdir -p "$PROJECT_DIR"',
      'cd "$PROJECT_DIR"',
      'warn "No git repo configured - created empty project directory"',
    );
  }

  lines.push(
    '',
    'echo "  Project directory ready"',
    '',
    '# --- 6. Write .env ---',
    'step "Writing .env file..."',
    'if [ -f ".env" ]; then',
    '  cp .env ".env.backup.$(date +%s)"',
    '  info "Existing .env backed up"',
    'fi',
  );

  // Write env vars using heredoc (safe for special chars)
  lines.push("cat > .env << 'SIGNALDB_ENV_EOF'");
  lines.push(opts.envContent);
  lines.push('SIGNALDB_ENV_EOF');

  // Count vars
  const varCount = opts.envContent.split('\n').filter(l => l.includes('=')).length;
  lines.push(`echo "  .env written (${varCount} variables)"`);

  // Write CLAUDE.md using heredoc
  if (opts.claudeMd) {
    lines.push(
      '',
      '# --- 7. Write CLAUDE.md ---',
      'step "Writing CLAUDE.md..."',
    );
    // Use a unique delimiter that won't appear in CLAUDE.md content
    lines.push("cat > CLAUDE.md << 'SIGNALDB_CLAUDE_EOF'");
    lines.push(opts.claudeMd);
    lines.push('SIGNALDB_CLAUDE_EOF');
    lines.push('echo "  CLAUDE.md written (AI development context)"');
  }

  // --- 8. Download transcript binary (shared across projects) ---
  lines.push(
    '',
    '# --- 8. Install transcript CLI (AI session memory) ---',
    'step "Installing transcript CLI..."',
    'TRANSCRIPT_BIN="$HOME/.claude/bin/transcript"',
    'if [ -f "$TRANSCRIPT_BIN" ]; then',
    '  echo "  transcript CLI already installed"',
    'else',
    '  mkdir -p "$HOME/.claude/bin"',
    '  echo "  Downloading transcript CLI..."',
    '  curl -fsSL https://s3.signaldb.live/signaldb-tools/transcript-darwin-arm64 -o "$TRANSCRIPT_BIN"',
    '  chmod +x "$TRANSCRIPT_BIN"',
    '  echo "  transcript CLI installed at $TRANSCRIPT_BIN"',
    'fi',
  );

  // --- 9. Write skill files ---
  const skillNames = Object.keys(opts.skills).sort();
  if (skillNames.length > 0) {
    lines.push(
      '',
      `# --- 9. Write Claude Code skills (${skillNames.length} skills) ---`,
      `step "Writing ${skillNames.length} Claude Code skills..."`,
      'mkdir -p ".claude/skills"',
    );

    for (const name of skillNames) {
      const content = opts.skills[name];
      const delimiter = `SIGNALDB_SKILL_${name.toUpperCase().replace(/-/g, '_')}_EOF`;
      lines.push(
        `mkdir -p ".claude/skills/${name}"`,
        `cat > ".claude/skills/${name}/SKILL.md" << '${delimiter}'`,
        content,
        delimiter,
      );
    }

    lines.push(`echo "  ${skillNames.length} skills written to .claude/skills/"`);
  }

  // --- 10. Write agent memory templates ---
  const memoryRoles = Object.keys(opts.agentMemory).sort();
  if (memoryRoles.length > 0) {
    lines.push(
      '',
      `# --- 10. Write agent memory templates (${memoryRoles.length} roles) ---`,
      `step "Writing agent memory templates..."`,
      'mkdir -p ".claude/agent-memory"',
    );

    for (const role of memoryRoles) {
      const content = opts.agentMemory[role];
      const delimiter = `SIGNALDB_MEMORY_${role.toUpperCase().replace(/-/g, '_')}_EOF`;
      lines.push(
        `mkdir -p ".claude/agent-memory/${role}"`,
        `cat > ".claude/agent-memory/${role}/MEMORY.md" << '${delimiter}'`,
        content,
        delimiter,
      );
    }

    lines.push(`echo "  ${memoryRoles.length} agent memory templates written"`);
  }

  lines.push(
    '',
    '# --- 11. Install dependencies ---',
    'step "Installing dependencies..."',
    'if [ -f "package.json" ]; then',
    '  bun install 2>&1 | tail -3',
    '  echo "  Dependencies installed"',
    'else',
    '  warn "No package.json found - skipping dependency install"',
    'fi',
    '',
    '# --- 12. Install Claude Code (AI dev tool) ---',
    'step "Checking Claude Code..."',
    'if ! command -v claude &>/dev/null; then',
    '  echo "  Installing Claude Code..."',
    '  bun install -g @anthropic-ai/claude-code 2>&1 | tail -1',
    'fi',
    'echo "  Claude Code $(claude --version 2>/dev/null || echo installed)"',
    '',
    '# --- Done ---',
    'echo ""',
    'echo "==========================================="',
    'echo -e "  ${GREEN}Setup complete!${NC}"',
    'echo "==========================================="',
    'echo ""',
    'echo "  Project: ${PROJECT_DIR}"',
    `echo "  Console: ${opts.consoleUrl}"`,
    'echo ""',
    'echo "  To start developing:"',
    'echo "    cd ${PROJECT_DIR}"',
    'echo "    bun dev       # Start dev server"',
    'echo "    claude        # Start AI-powered development"',
    'echo ""',
    'echo "  Available AI skills:"',
    'echo "    /recall       # Search past session memory"',
    'echo "    /forge-ideate # Transform ideas into stories"',
    'echo "    /wrap-up      # Session closing ceremony"',
    'echo ""',
    'echo "  Or open in your editor:"',
    'echo "    code ${PROJECT_DIR}      # VS Code"',
    'echo "    cursor ${PROJECT_DIR}    # Cursor"',
    'echo ""',
  );

  return lines.join('\n') + '\n';
}
