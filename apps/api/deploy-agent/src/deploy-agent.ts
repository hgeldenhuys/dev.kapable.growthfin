#!/usr/bin/env bun
/**
 * Generic Deployment Agent for SignalDB Connect
 *
 * A lightweight HTTP server that executes deployment commands for ANY Connect app.
 * Runs on the production server and receives deploy webhooks from SignalDB API.
 *
 * Features:
 *   - Git pull, install, build (framework-aware)
 *   - systemd service restart with health check
 *   - Status callbacks to SignalDB API
 *   - Deployment logging
 *
 * Port: 4100 (internal, not exposed)
 *
 * Endpoints:
 *   POST /deploy - Execute deployment
 *   GET /health  - Agent health check
 *   GET /status/:id - Deployment status
 */

import { spawn, execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync, chmodSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import {
  parseSignalDBConfig,
  resolveAppConfig,
  isMonorepoConfig,
  getAppConfig,
  type ResolvedAppConfig,
} from '../../src/services/signaldb-config';
import * as incus from '../../src/services/incus-manager';

const AGENT_PORT = parseInt(process.env.AGENT_PORT || '4100');
const DEPLOY_SECRET = process.env.DEPLOY_SECRET;
if (!DEPLOY_SECRET) throw new Error('DEPLOY_SECRET environment variable is required');
const MAX_CONCURRENT_DEPLOYMENTS = 3;

// Base directory for all Connect apps
const APPS_BASE_DIR = process.env.APPS_BASE_DIR || '/opt/signaldb/user-apps';

/**
 * Framework-specific build configurations
 */
const FRAMEWORK_CONFIGS: Record<string, {
  installCmd: string[];
  buildCmd: string[];
  frontendInstallCmd?: string[];
  frontendBuildCmd?: string[];
  entryPoint: string;
}> = {
  'bun-server': {
    installCmd: ['bun', 'install'],
    buildCmd: ['bun', 'build', 'src/cli.ts', '--outdir', 'dist', '--target', 'bun'],
    frontendInstallCmd: ['bun', 'install'],
    frontendBuildCmd: ['bun', 'run', 'build'],
    entryPoint: 'dist/cli.js',
  },
  'react-router': {
    installCmd: ['bun', 'install'],
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'build/server/index.js',
  },
  'nextjs': {
    installCmd: ['bun', 'install'],
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: '.next/standalone/server.js',
  },
  'sveltekit': {
    installCmd: ['bun', 'install'],
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'build/index.js',
  },
  'hono': {
    installCmd: ['bun', 'install'],
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'dist/index.js',
  },
};

// =============================================================================
// Terminal Session Management
// =============================================================================

const MAX_TERMINAL_SESSIONS_PER_CONTAINER = 2;
const TERMINAL_HARD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TERMINAL_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CONTAINER_NAME_REGEX = /^sdb-(app|dev)-[a-z0-9-]+$/;

interface TerminalSession {
  id: string;
  containerName: string;
  backend: 'orbstack' | 'incus';
  proc: ReturnType<typeof Bun.spawn>;
  ptySocket: any; // Bun TCP socket connected to socat via Unix domain socket
  unixServer: any; // Bun Unix socket server
  sockPath: string; // Path to Unix socket file
  ws: any; // Bun ServerWebSocket
  hardTimer: ReturnType<typeof setTimeout>;
  idleTimer: ReturnType<typeof setTimeout>;
  createdAt: Date;
}

const terminalSessions = new Map<string, TerminalSession>();

// Dev container creation locks to prevent concurrent ensure operations
const devContainerLocks = new Map<string, Promise<void>>();

/** Count active terminal sessions for a given container */
function countTerminalSessions(containerName: string): number {
  let count = 0;
  for (const [, session] of terminalSessions) {
    if (session.containerName === containerName) count++;
  }
  return count;
}

/** Clean up a terminal session */
function cleanupTerminalSession(sessionId: string) {
  const session = terminalSessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.hardTimer);
  clearTimeout(session.idleTimer);

  // Close the Unix socket connection to socat
  try { if (session.ptySocket) session.ptySocket.end(); } catch {}
  // Stop the Unix socket server
  try { if (session.unixServer) session.unixServer.stop(); } catch {}
  // Kill the socat process
  try { session.proc.kill(); } catch {}
  // Remove socket file
  try { require('fs').unlinkSync(session.sockPath); } catch {}

  try {
    if (session.ws.readyState <= 1) {
      session.ws.send(JSON.stringify({ type: 'exit', code: 0, reason: 'cleanup' }));
      session.ws.close(1000, 'Session ended');
    }
  } catch {}

  terminalSessions.delete(sessionId);
  console.log(`[terminal] Session ${sessionId} cleaned up (container: ${session.containerName})`);
}

/**
 * Resize the terminal for a session. Three-layer approach:
 * 1. ioctl(TIOCSWINSZ) on socat's PTY master via /proc/{pid}/fd/ — outer PTY
 * 2. ioctl(TIOCSWINSZ) on the inner PTY inside the container — incus exec's PTY
 *    (incus exec --force-interactive creates its own PTY that doesn't forward SIGWINCH)
 * 3. Signal the foreground process to re-read terminal size
 *
 * For dev containers (tmux): ioctl inner PTY + SIGWINCH tmux client
 * For app containers (bash): stty on the app user's PTY + SIGWINCH
 */
function resizeTerminal(socatPid: number, containerName: string, rows: number, cols: number): boolean {
  // Step 1: Resize socat's outer PTY via procfs ioctl
  try {
    execSync(`python3 -c '
import os, fcntl, struct, sys
pid = ${socatPid}
for name in os.listdir(f"/proc/{pid}/fd"):
    try:
        link = os.readlink(f"/proc/{pid}/fd/{name}")
        if "ptmx" in link:
            fd = os.open(f"/proc/{pid}/fd/{name}", os.O_RDWR | os.O_NOCTTY)
            fcntl.ioctl(fd, 0x5414, struct.pack("HHHH", ${rows}, ${cols}, 0, 0))
            os.close(fd)
            sys.exit(0)
    except Exception:
        pass
sys.exit(1)
'`, { timeout: 3000 });
  } catch {
    // Outer PTY resize failed — continue to try inner resize anyway
  }

  // Step 2: Resize the inner PTY inside the container + signal processes
  try {
    const isDevContainer = containerName.startsWith('sdb-dev-');
    if (isDevContainer) {
      // Dev container: tmux client's PTY needs ioctl + SIGWINCH.
      // tmux resize-window alone doesn't work because tmux renders based on
      // the CLIENT's terminal size, not the window size. We must:
      // a) ioctl the inner PTY (the one tmux's client is connected to)
      // b) SIGWINCH the tmux client process so it re-reads the terminal size
      // Uses perl since python3 isn't available in dev containers.
      execSync(
        `incus exec ${containerName} -- bash -c '
          # Find the tmux client PID and its PTY (match comm name, not cmdline)
          CLIENT_PID=$(pgrep "tmux: client" -u app 2>/dev/null | head -1)
          if [ -z "$CLIENT_PID" ]; then exit 0; fi
          CLIENT_TTY=$(readlink /proc/$CLIENT_PID/fd/0 2>/dev/null)
          if [ -z "$CLIENT_TTY" ]; then exit 0; fi
          # ioctl TIOCSWINSZ on the inner PTY via perl
          perl -e "
            use constant TIOCSWINSZ => 0x5414;
            my \\$ws = pack(q{SSSS}, ${rows}, ${cols}, 0, 0);
            open(my \\$fd, q{+<}, q{$CLIENT_TTY}) or exit 1;
            ioctl(\\$fd, TIOCSWINSZ, \\$ws) or exit 1;
            close(\\$fd);
          " 2>/dev/null
          # Signal tmux client to re-read terminal size
          kill -WINCH $CLIENT_PID 2>/dev/null
          exit 0
        '`,
        { timeout: 5000 }
      );
    } else {
      // App container — find the app user's PTY and stty resize it
      execSync(
        `incus exec ${containerName} -- bash -c 'for pts in /dev/pts/[0-9]*; do owner=$(stat -c %U "$pts" 2>/dev/null); if [ "$owner" = "app" ]; then stty -F "$pts" rows ${rows} cols ${cols} 2>/dev/null; pkill -WINCH -t "$(basename "$pts")" 2>/dev/null; fi; done; exit 0'`,
        { timeout: 5000 }
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resize only the outer PTY (socat's pty master) via ioctl.
 * For OrbStack sessions, SSH propagates SIGWINCH automatically to the inner
 * terminal — we only need to resize the socat-facing PTY.
 */
function resizeTerminalOuter(socatPid: number, rows: number, cols: number): boolean {
  try {
    // Opening /proc/PID/fd/N for ptmx creates a NEW PTY pair (kernel behavior),
    // so ioctl on it does nothing to the actual terminal. Instead, find the SSH
    // child process's pts slave device and use stty to resize it.
    //
    // Steps: pgrep -P finds SSH child → readlink fd/0 gets pts → stty resizes → SIGWINCH
    execSync(
      `SSH_PID=$(pgrep -P ${socatPid} | head -1) && ` +
      `PTS=$(readlink /proc/$SSH_PID/fd/0) && ` +
      `stty -F "$PTS" rows ${rows} cols ${cols} && ` +
      `kill -WINCH $SSH_PID`,
      { timeout: 3000 }
    );
    return true;
  } catch {
    return false;
  }
}

/** Reset idle timer for a session */
function resetIdleTimer(sessionId: string) {
  const session = terminalSessions.get(sessionId);
  if (!session) return;
  clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    console.log(`[terminal] Session ${sessionId} idle timeout`);
    try {
      session.ws.send(JSON.stringify({ type: 'timeout', reason: 'idle' }));
    } catch {}
    cleanupTerminalSession(sessionId);
  }, TERMINAL_IDLE_TIMEOUT_MS);
}

/**
 * Filter out mode-request escape sequences that crash xterm.js 6.0.0's requestMode handler.
 * xterm.js 6.0.0 has a bug: ReferenceError: i is not defined in requestMode(),
 * which crashes _innerWrite and silently drops ALL subsequent terminal data.
 *
 * Sequences filtered:
 * - DECRQM (DEC private): ESC [ ? <Ps> $ p    (1b 5b 3f <digits> 24 70)
 * - ANSI DECRQM:          ESC [ <Ps> $ p      (1b 5b <digits> 24 70)
 * - DECRPM responses:     ESC [ ? <Ps> ; <Pm> $ y  (shouldn't appear from app but just in case)
 */
function filterModeRequests(data: Buffer | Uint8Array): Uint8Array {
  const len = data.length;
  if (len < 5) return new Uint8Array(data);

  // Quick check: does the data contain $ (0x24) at all? All target sequences contain it.
  let hasDollar = false;
  for (let i = 0; i < len; i++) {
    if (data[i] === 0x24) { hasDollar = true; break; }
  }
  if (!hasDollar) return new Uint8Array(data);

  const result: number[] = [];
  let i = 0;
  let filtered = 0;
  while (i < len) {
    // Check for ESC [ at current position
    if (i + 4 < len && data[i] === 0x1b && data[i + 1] === 0x5b) {
      let j = i + 2;
      // Skip optional '?' for DEC private mode
      if (j < len && data[j] === 0x3f) j++;
      // Scan digits and semicolons (parameter bytes)
      const paramStart = j;
      while (j < len && ((data[j] >= 0x30 && data[j] <= 0x39) || data[j] === 0x3b)) {
        j++;
      }
      // Check if we found $ followed by p or y (0x24 0x70 or 0x24 0x79)
      if (j + 1 < len && j > paramStart && data[j] === 0x24 && (data[j + 1] === 0x70 || data[j + 1] === 0x79)) {
        // Found mode request/response sequence — skip it
        filtered++;
        i = j + 2;
        continue;
      }
    }
    result.push(data[i]);
    i++;
  }

  if (filtered > 0) {
    console.log(`[terminal] Filtered ${filtered} mode-request sequence(s) from ${len}b → ${result.length}b`);
    return new Uint8Array(result);
  }
  // No sequences found — return a copy (Bun may reuse the socket buffer)
  return new Uint8Array(data);
}

/** Verify an HMAC-signed terminal token */
function verifyTerminalToken(token: string): {
  containerName: string;
  orgId: string;
  userId: string;
  appId: string;
  envName: string;
  exp: number;
  backend?: 'orbstack' | 'incus';
  vmName?: string;
  workDir?: string;
  apps?: Array<{ repo: string; dir: string; containerName: string; service: string; port: number; framework: string; dbUrl?: string; branch?: string }>;
} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', DEPLOY_SECRET!).update(encoded).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    if (!data.containerName || !data.orgId) return null;
    return data;
  } catch {
    return null;
  }
}

// =============================================================================
// Deployment Types
// =============================================================================

interface DeployRequest {
  // Required
  deploymentId: string;
  callbackUrl: string;

  // App info
  appId: string;
  appSlug: string;
  orgSlug: string;
  envName: string;

  // Deployment config
  framework: string;
  gitBranch: string;
  commitSha?: string;  // Optional: specific commit to deploy

  // Paths and naming
  appDir?: string;      // Override: full path to app directory
  buildDir?: string;    // Subdirectory containing the app (e.g., 'apps/api/loom-notifications')
  frontendDir?: string; // Subdirectory containing frontend (e.g., 'app')
  serviceName?: string;  // Override systemd service instance name
  port: number;         // Port the app runs on

  // Custom build commands (override framework defaults)
  installCmd?: string[];
  buildCmd?: string[];
  frontendInstallCmd?: string[];
  frontendBuildCmd?: string[];

  // Scaffold support
  skipGitPull?: boolean;       // Skip git pull for scaffolded apps (no remote)
  envVars?: Record<string, string>;  // Environment variables to write to .env

  // Git authentication for private repos
  gitToken?: string;           // Ephemeral installation token (1h lifetime)
  gitRepo?: string;            // Original repo URL (for URL reconstruction)

  // Safety options
  forceOverwrite?: boolean;    // If true, overwrite local changes without warning

  // Container deployment (Incus)
  deploymentMode?: 'systemd' | 'container';  // Default: 'container' (all apps use container mode since Feb 2026)
  containerName?: string;       // Incus container name (sdb-app-{org}-{app}[-{env}])
  containerIP?: string;         // Static IP on incusbr0
  tierProfile?: string;         // Incus profile for resource limits (e.g., 'sdb-app-pro')
  bridgeName?: string;          // Per-org Incus bridge network (e.g., 'sdb-br-acme')
}

type DeployStage = 'init' | 'git_pull' | 'install' | 'build' | 'frontend_build' | 'restart' | 'health_check';

interface DeploymentState {
  deploymentId: string;
  status: 'building' | 'deploying' | 'success' | 'failed';
  stage: DeployStage;
  logs: string[];
  pendingLogs: string[];
  startedAt: Date;
  callbackUrl: string;
}

// Track active deployments
const activeDeployments = new Map<string, DeploymentState>();

/**
 * Compute the app directory path from org/app/env slugs.
 * Checks monorepo layout first ({orgSlug}/signaldb.yaml), falls back to legacy.
 */
function computeAppDir(orgSlug: string, appSlug: string, envName: string): { appDir: string; buildDir?: string; isMonorepo: boolean } {
  // Check monorepo layout first
  const orgDir = join(APPS_BASE_DIR, orgSlug);
  if (existsSync(join(orgDir, 'signaldb.yaml'))) {
    return { appDir: orgDir, buildDir: appSlug, isMonorepo: true };
  }
  // Legacy layout
  if (envName === 'production') {
    return { appDir: join(APPS_BASE_DIR, `${orgSlug}-${appSlug}`), isMonorepo: false };
  }
  return { appDir: join(APPS_BASE_DIR, `${orgSlug}-${appSlug}-${envName}`), isMonorepo: false };
}

/**
 * Legacy computeAppDir for backward compatibility (returns string)
 */
function computeAppDirLegacy(orgSlug: string, appSlug: string, envName: string): string {
  if (envName === 'production') {
    return join(APPS_BASE_DIR, `${orgSlug}-${appSlug}`);
  }
  return join(APPS_BASE_DIR, `${orgSlug}-${appSlug}-${envName}`);
}

/**
 * Try to read and parse signaldb.yaml from a directory.
 * Returns null if not found or invalid.
 */
function tryReadSignalDBConfig(dir: string): ReturnType<typeof parseSignalDBConfig> | null {
  const yamlPath = join(dir, 'signaldb.yaml');
  if (!existsSync(yamlPath)) return null;
  try {
    const content = readFileSync(yamlPath, 'utf-8');
    return parseSignalDBConfig(content);
  } catch (err) {
    console.warn(`[deploy-agent] Failed to parse ${yamlPath}:`, err);
    return null;
  }
}

/**
 * Compute systemd service instance name from org/app/env slugs.
 * Used as the %i parameter in signaldb-app@.service template.
 */
function computeInstanceName(orgSlug: string, appSlug: string, envName: string): string {
  // Convention: {org}-{app}-{env}
  // For production, just {org}-{app}
  if (envName === 'production') {
    return `${orgSlug}-${appSlug}`;
  }
  return `${orgSlug}-${appSlug}-${envName}`;
}


/**
 * Execute a shell command and capture output
 */
function exec(
  cmd: string,
  args: string[],
  cwd: string,
  onLog?: (line: string) => void,
  extraEnv?: Record<string, string>
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.bun/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin:${process.env.PATH || ''}`,
        ...extraEnv,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onLog) {
        for (const line of text.split('\n').filter(Boolean)) {
          onLog(`[stdout] ${line}`);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (onLog) {
        for (const line of text.split('\n').filter(Boolean)) {
          onLog(`[stderr] ${line}`);
        }
      }
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Sanitize org slug to a valid Linux username: sdb_{orgSlug}
 * Linux usernames: lowercase, alphanumeric + underscores, max 32 chars
 */
function getOrgUsername(orgSlug: string): string {
  const sanitized = orgSlug.replace(/[^a-z0-9_]/g, '_').slice(0, 27);
  return `sdb_${sanitized}`;
}

/**
 * Ensure a Linux user exists for the org. Creates if missing, adds deploy to group.
 * Requires sudoers: deploy ALL=(root) NOPASSWD: /usr/sbin/useradd sdb_*, /usr/sbin/usermod -aG sdb_* deploy
 */
async function ensureOrgUser(
  orgSlug: string,
  onLog?: (line: string) => void
): Promise<string> {
  const username = getOrgUsername(orgSlug);

  const homeDir = `/home/${username}`;
  const sshDir = `${homeDir}/.ssh`;
  const authKeysFile = `${sshDir}/authorized_keys`;

  // Check if user already exists
  const idResult = await exec('id', [username], '/');
  if (idResult.code === 0) {
    onLog?.(`Linux user ${username} already exists`);

    // Upgrade shell from nologin to bash if needed (for SSH dev access)
    const shellCheck = await exec('getent', ['passwd', username], '/');
    if (shellCheck.code === 0 && shellCheck.stdout.includes('/usr/sbin/nologin')) {
      onLog?.(`Upgrading shell for ${username} from nologin to /bin/bash`);
      await exec('sudo', ['usermod', '--shell', '/bin/bash', username], '/', onLog);
    }

    // Ensure .ssh directory exists
    if (!existsSync(sshDir)) {
      onLog?.(`Creating .ssh directory for ${username}`);
      await exec('sudo', ['mkdir', '-p', sshDir], '/', onLog);
      await exec('sudo', ['chmod', '700', sshDir], '/', onLog);
      await exec('sudo', ['touch', authKeysFile], '/', onLog);
      await exec('sudo', ['chmod', '600', authKeysFile], '/', onLog);
      await exec('sudo', ['chown', '-R', `${username}:${username}`, sshDir], '/', onLog);
    }

    return username;
  }

  // Create system user with home directory and bash shell for SSH dev access
  // Home dir: /home/sdb_{org}
  onLog?.(`Creating Linux user: ${username}`);
  const createResult = await exec(
    'sudo', ['useradd', '--system', '--create-home', '--home-dir', homeDir, '--shell', '/bin/bash', username],
    '/',
    onLog
  );
  if (createResult.code !== 0) {
    // Handle stale group from previous cleanup (userdel removes user but can leave group)
    if (createResult.stderr.includes('group') && createResult.stderr.includes('exists')) {
      onLog?.(`Stale group detected, retrying useradd with -g ${username}`);
      const retryResult = await exec(
        'sudo', ['useradd', '--system', '--create-home', '--home-dir', homeDir, '--shell', '/bin/bash', '-g', username, username],
        '/',
        onLog
      );
      if (retryResult.code !== 0) {
        throw new Error(`Failed to create Linux user ${username}: ${retryResult.stderr}`);
      }
    } else {
      throw new Error(`Failed to create Linux user ${username}: ${createResult.stderr}`);
    }
  }

  // Add deploy to the org group so it can read files for deployments
  onLog?.(`Adding deploy to group ${username}`);
  const groupResult = await exec(
    'sudo', ['usermod', '-aG', username, 'deploy'],
    '/',
    onLog
  );
  if (groupResult.code !== 0) {
    onLog?.(`Warning: failed to add deploy to group ${username}: ${groupResult.stderr}`);
  }

  // Create .ssh directory for SSH dev access
  onLog?.(`Creating .ssh directory for ${username}`);
  await exec('sudo', ['mkdir', '-p', sshDir], '/', onLog);
  await exec('sudo', ['chmod', '700', sshDir], '/', onLog);
  await exec('sudo', ['touch', authKeysFile], '/', onLog);
  await exec('sudo', ['chmod', '600', authKeysFile], '/', onLog);

  // Create .claude directory structure for AI Dev
  const claudeDir = `${homeDir}/.claude`;
  onLog?.(`Creating Claude directory: ${claudeDir}`);
  await exec('sudo', ['mkdir', '-p', `${claudeDir}/projects`], '/', onLog);
  await exec('sudo', ['chown', '-R', `${username}:${username}`, homeDir], '/', onLog);
  await exec('sudo', ['chmod', '750', homeDir], '/', onLog);

  // systemd services pick up group membership on next restart — no daemon refresh needed

  return username;
}

/**
 * Ensure Claude home directory exists for an org user (for AI Dev).
 * Creates /home/sdb_{org}/.claude/projects/ structure.
 * Called when AI Dev is enabled for an org.
 */
export async function ensureClaudeHomeDir(
  orgSlug: string,
  onLog?: (line: string) => void
): Promise<string> {
  const username = getOrgUsername(orgSlug);
  const homeDir = `/home/${username}`;
  const claudeDir = `${homeDir}/.claude`;

  // Check if user exists
  const idResult = await exec('id', [username], '/');
  if (idResult.code !== 0) {
    throw new Error(`User ${username} does not exist. Run ensureOrgUser first.`);
  }

  // Create .claude directory structure
  onLog?.(`Ensuring Claude directory: ${claudeDir}`);
  await exec('sudo', ['mkdir', '-p', `${claudeDir}/projects`], '/', onLog);
  await exec('sudo', ['chown', '-R', `${username}:${username}`, claudeDir], '/', onLog);
  await exec('sudo', ['chmod', '750', claudeDir], '/', onLog);

  return claudeDir;
}

/**
 * Execute a command as a specific Linux user via sudo -u.
 * Used to run git, bun install, and build commands as the org user.
 */
function execAsUser(
  username: string,
  cmd: string,
  args: string[],
  cwd: string,
  onLog?: (line: string) => void,
  extraEnv?: Record<string, string>
): Promise<{ stdout: string; stderr: string; code: number }> {
  // Build env string for sudo
  const envArgs: string[] = [];
  if (extraEnv) {
    for (const [key, value] of Object.entries(extraEnv)) {
      envArgs.push(`${key}=${value}`);
    }
  }
  // Always pass PATH and HOME for bun to work
  envArgs.push(`PATH=${process.env.HOME}/.bun/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin:${process.env.PATH || ''}`);
  envArgs.push(`HOME=/tmp/sdb-home-${username}`);

  return exec(
    'sudo',
    ['-u', username, 'env', ...envArgs, cmd, ...args],
    cwd,
    onLog
  );
}

/**
 * Set ownership of a path to the org user recursively
 */
async function chownToOrgUser(
  username: string,
  path: string,
  onLog?: (line: string) => void
): Promise<void> {
  const result = await exec('sudo', ['chown', '-R', `${username}:${username}`, path], '/', onLog);
  if (result.code !== 0) {
    onLog?.(`Warning: chown failed for ${path}: ${result.stderr}`);
  }
}

/**
 * Set directory permissions to 0750 (owner rwx, group rx, others nothing)
 */
async function setDirPermissions(
  path: string,
  mode: string = '750',
  onLog?: (line: string) => void
): Promise<void> {
  const result = await exec('sudo', ['chmod', mode, path], '/', onLog);
  if (result.code !== 0) {
    onLog?.(`Warning: chmod failed for ${path}: ${result.stderr}`);
  }
}

/**
 * Generate a start.sh wrapper script for systemd.
 *
 * File-level isolation: app files are owned by sdb_{org} with 0750/0640.
 * Process-level: systemd runs the service as deploy user with EnvironmentFile
 * loading env vars from /etc/signaldb/apps/{instance}.env.
 *
 * For react-router apps: uses ./node_modules/.bin/react-router-serve (has #!/usr/bin/env node shebang)
 * For other frameworks: uses bun directly
 */
function generateStartScript(
  appDir: string,
  workDir: string,
  entryPoint: string,
  username: string,
  port: number,
  framework?: string,
  envVars?: Record<string, string>
): string {
  const bunPath = '/home/deploy/.bun/bin/bun';
  const entryPath = join(workDir, entryPoint);

  let script = `#!/bin/bash
# Auto-generated start script for systemd (signaldb-app@.service)
# Org user: ${username} | Port: ${port} | Framework: ${framework || 'unknown'}
# Environment loaded by systemd via EnvironmentFile
set -e
cd ${workDir}
`;

  // Export PORT explicitly (also set via EnvironmentFile, but explicit is safer)
  script += `export PORT=\${PORT:-${port}}\n`;

  // Framework-specific exec command
  if (framework === 'react-router') {
    // react-router-serve has #!/usr/bin/env node shebang — runs via node, not bun
    // (Bun has SSR compatibility issues with renderToPipeableStream)
    script += `exec ./node_modules/.bin/react-router-serve ./build/server/index.js\n`;
  } else {
    script += `exec ${bunPath} ${entryPath}\n`;
  }

  return script;
}

/**
 * Write systemd EnvironmentFile for an app instance.
 * Written to /etc/signaldb/apps/{instance}.env with mode 600.
 */
async function writeSystemdEnvFile(
  instanceName: string,
  port: number,
  envVars: Record<string, string>,
  onLog?: (line: string) => void,
): Promise<void> {
  const envDir = '/etc/signaldb/apps';
  const envFilePath = `${envDir}/${instanceName}.env`;

  // Ensure directory exists
  await exec('sudo', ['mkdir', '-p', envDir], '/', onLog);

  // Build env file content
  const lines: string[] = [`PORT=${port}`];
  for (const [key, value] of Object.entries(envVars)) {
    // Escape values with spaces/special chars
    if (value.includes(' ') || value.includes('"') || value.includes("'") || value.includes('$')) {
      lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  // Write to temp file then move with sudo
  const tmpPath = `/tmp/.env-systemd-${instanceName}-${Date.now()}`;
  writeFileSync(tmpPath, lines.join('\n') + '\n');
  await exec('sudo', ['cp', tmpPath, envFilePath], '/', onLog);
  await exec('sudo', ['chmod', '600', envFilePath], '/', onLog);
  await exec('sudo', ['rm', tmpPath], '/', onLog);

  onLog?.(`Wrote systemd env file: ${envFilePath} (${Object.keys(envVars).length + 1} vars)`);
}

/**
 * Report deployment status to the API
 */
async function reportStatus(
  callbackUrl: string,
  deploymentId: string,
  status: 'building' | 'deploying' | 'success' | 'failed',
  options: {
    buildLog?: string;
    deployLog?: string;
    error?: string;
    commitSha?: string;
    stage?: DeployStage;
    logLines?: string[];
    schedules?: Record<string, unknown> | null;
    auth?: Record<string, unknown> | false | null;
  } = {}
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    };
    // Mark log-only flushes so the API can skip heavy DB updates
    if (options.logLines && !options.buildLog && !options.deployLog && !options.error && !options.commitSha) {
      headers['X-Log-Flush'] = 'true';
    }

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deploymentId,
        status,
        ...options,
      }),
    });

    if (!response.ok) {
      console.error(`[deploy-agent] Failed to report status: ${response.status}`);
    }
  } catch (err) {
    console.error('[deploy-agent] Failed to report status:', err);
  }
}

/**
 * Flush pending log lines to the API callback (lightweight, every ~2s)
 */
async function flushLogs(state: DeploymentState): Promise<void> {
  if (state.pendingLogs.length === 0) return;

  const lines = state.pendingLogs.splice(0, state.pendingLogs.length);
  await reportStatus(state.callbackUrl, state.deploymentId, state.status, {
    stage: state.stage,
    logLines: lines,
  });
}

/**
 * Push file content to a container via base64 encoding.
 * Works around `incus file push` failing on UID-mapped containers
 * (sticky-bit /tmp + UID mapping = permission denied for overwriting).
 */
async function pushFileViaBase64(
  containerName: string,
  content: string,
  destPath: string,
  addLog: (m: string) => void
): Promise<void> {
  const b64 = Buffer.from(content).toString('base64');
  // Use bash heredoc-style to avoid shell quoting issues with large base64 strings
  await incus.execInContainer(
    containerName,
    ['bash', '-c', `printf '%s' '${b64}' | base64 -d > ${destPath}`],
    addLog,
  );
}

/**
 * Wait for the app to become healthy
 */
async function waitForHealth(
  port: number,
  healthPath: string = '/health',
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${healthPath}`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

/**
 * Execute the deployment process
 */
async function executeDeployment(req: DeployRequest): Promise<void> {
  const { deploymentId, callbackUrl, orgSlug, appSlug, envName, framework, port } = req;

  // Compute paths (use overrides if provided, or detect monorepo layout)
  let appDir: string;
  let detectedBuildDir: string | undefined;
  let isMonorepoLayout = false;

  if (req.appDir) {
    appDir = req.appDir;
    detectedBuildDir = req.buildDir;
  } else {
    const resolved = computeAppDir(orgSlug, appSlug, envName);
    appDir = resolved.appDir;
    detectedBuildDir = req.buildDir || resolved.buildDir;
    isMonorepoLayout = resolved.isMonorepo;
  }

  const instanceName = req.serviceName || computeInstanceName(orgSlug, appSlug, envName);
  const serviceName = `signaldb-app@${instanceName}`;

  // Compute working directory (may be a subdirectory in monorepo)
  const workDir = detectedBuildDir ? join(appDir, detectedBuildDir) : appDir;

  // Try to read signaldb.yaml for build config
  let yamlConfig: ResolvedAppConfig | null = null;
  const signaldbConfig = tryReadSignalDBConfig(appDir);
  if (signaldbConfig) {
    yamlConfig = resolveAppConfig(signaldbConfig, appSlug, framework as any);
  } else if (detectedBuildDir) {
    // Also check in the app subdirectory (single-app mode in subdirectory)
    const subConfig = tryReadSignalDBConfig(workDir);
    if (subConfig) {
      yamlConfig = resolveAppConfig(subConfig, appSlug, framework as any);
    }
  }

  // Resolve framework: explicit request > YAML config > default
  // This is critical for start.sh generation (react-router needs react-router-serve, not bun)
  const resolvedFramework = framework || yamlConfig?.framework || 'bun-server';

  // Resolve build commands: explicit request > YAML > FRAMEWORK_CONFIGS defaults
  const frameworkConfig = FRAMEWORK_CONFIGS[resolvedFramework] || FRAMEWORK_CONFIGS['bun-server'];

  const installCmd = req.installCmd || yamlConfig?.installCmd || frameworkConfig.installCmd;
  const buildCmd = req.buildCmd || yamlConfig?.buildCmd || frameworkConfig.buildCmd;
  const frontendInstallCmd = req.frontendInstallCmd ||
    (yamlConfig?.frontendInstallCmd) ||
    frameworkConfig.frontendInstallCmd;
  const frontendBuildCmd = req.frontendBuildCmd ||
    (yamlConfig?.frontendBuildCmd) ||
    frameworkConfig.frontendBuildCmd;

  const frontendDir = req.frontendDir
    ? join(workDir, req.frontendDir)
    : yamlConfig?.frontendDir
      ? join(workDir, yamlConfig.frontendDir)
      : null;

  // Resolve health check config from YAML
  const healthPath = yamlConfig?.healthPath || '/health';
  const healthTimeout = yamlConfig?.healthTimeout || 30000;
  const healthInterval = yamlConfig?.healthInterval || 1000;

  // Resolve entry point from YAML
  const yamlEntryPoint = yamlConfig?.entryPoint;

  // Check if directory exists — create it for first-time git-imported apps
  if (!existsSync(appDir)) {
    if (req.gitRepo) {
      mkdirSync(appDir, { recursive: true });
      console.log(`[deploy-agent] Created app directory for first-time git clone: ${appDir}`);
    } else {
      await reportStatus(callbackUrl, deploymentId, 'failed', {
        error: `App directory not found: ${appDir}. For git-imported apps, provide gitRepo in deploy request.`,
      });
      return;
    }
  }

  // Initialize deployment state
  const state: DeploymentState = {
    deploymentId,
    status: 'building',
    stage: 'init',
    logs: [],
    pendingLogs: [],
    startedAt: new Date(),
    callbackUrl,
  };
  activeDeployments.set(deploymentId, state);

  const addLog = (line: string) => {
    const logLine = `[${new Date().toISOString()}] ${line}`;
    state.logs.push(logLine);
    state.pendingLogs.push(logLine);
    console.log(logLine);
  };

  const setStage = (stage: DeployStage) => {
    state.stage = stage;
    addLog(`--- Stage: ${stage} ---`);
  };

  // Start periodic log flush (every 2 seconds)
  const flushInterval = setInterval(() => {
    flushLogs(state).catch(err => {
      console.error('[deploy-agent] Log flush error:', err);
    });
  }, 2000);

  try {
    // Report: building
    await reportStatus(callbackUrl, deploymentId, 'building', { stage: 'init' });
    addLog(`Starting deployment for ${orgSlug}/${appSlug}/${envName}`);
    addLog(`App directory: ${appDir}`);
    addLog(`Work directory: ${workDir}`);
    addLog(`Service: ${serviceName} (instance: ${instanceName})`);
    addLog(`Framework: ${resolvedFramework}`);
    addLog(`Layout: ${isMonorepoLayout ? 'monorepo' : 'legacy'}${detectedBuildDir ? ` (buildDir: ${detectedBuildDir})` : ''}`);
    if (yamlConfig) {
      addLog(`Config source: signaldb.yaml (entry_point: ${yamlConfig.entryPoint}, health: ${yamlConfig.healthPath})`);
    } else {
      addLog('Config source: FRAMEWORK_CONFIGS defaults (no signaldb.yaml found)');
    }

    // Ensure per-org Linux user exists for process isolation
    const orgUser = await ensureOrgUser(orgSlug, addLog);
    addLog(`Org Linux user: ${orgUser}`);

    // Ensure app directory is owned by org user before build/install
    // (scaffold creates files as deploy user; install/build run as org user)
    // Use 755 during build so deploy process can still access the directory
    // Final 750 is applied after build completes
    addLog(`Ensuring ${appDir} ownership is ${orgUser} before build...`);
    await chownToOrgUser(orgUser, appDir, addLog);
    await setDirPermissions(appDir, '755', addLog);

    // Write env vars to .env (app-level) and systemd EnvironmentFile
    if (req.envVars && Object.keys(req.envVars).length > 0) {
      addLog('Writing environment variables...');
      const envDir = req.buildDir ? join(appDir, req.buildDir) : appDir;
      const envLines: string[] = [];
      for (const [key, value] of Object.entries(req.envVars)) {
        envLines.push(`${key}=${value}`);
      }
      const envFilePath = join(envDir, '.env');
      // Write .env to app directory (for local dev / fallback)
      const tmpEnvPath = `/tmp/.env-${deploymentId}`;
      writeFileSync(tmpEnvPath, envLines.join('\n') + '\n');
      await exec('sudo', ['cp', tmpEnvPath, envFilePath], '/', addLog);
      await exec('sudo', ['rm', tmpEnvPath], '/', addLog);

      // Secure .env: owned by org user, mode 0640
      await chownToOrgUser(orgUser, envFilePath, addLog);
      await setDirPermissions(envFilePath, '640', addLog);

      // Write systemd EnvironmentFile (primary source for service env vars)
      await writeSystemdEnvFile(instanceName, port, req.envVars, addLog);

      addLog(`Wrote ${Object.keys(req.envVars).length} env vars to .env and systemd EnvironmentFile`);
    }

    // Git pull (or checkout specific commit) — skip for scaffolded apps
    // Git runs as org user to maintain file ownership
    setStage('git_pull');

    // Check for local uncommitted or unpushed changes before pulling
    if (!req.skipGitPull && existsSync(join(appDir, '.git'))) {
      // Check for uncommitted changes
      const statusResult = await execAsUser(orgUser, 'git', ['status', '--porcelain'], appDir);
      const hasUncommittedChanges = statusResult.stdout.trim().length > 0;

      // Check for unpushed commits
      const unpushedResult = await execAsUser(orgUser, 'git', ['log', '@{u}..HEAD', '--oneline'], appDir);
      const hasUnpushedCommits = unpushedResult.stdout.trim().length > 0;

      if (hasUncommittedChanges || hasUnpushedCommits) {
        if (hasUncommittedChanges) {
          addLog('⚠️  WARNING: Local uncommitted changes detected:');
          addLog(statusResult.stdout);
        }
        if (hasUnpushedCommits) {
          addLog('⚠️  WARNING: Local commits not pushed to remote:');
          addLog(unpushedResult.stdout);
        }

        if (!req.forceOverwrite) {
          addLog('');
          addLog('These changes will be LOST after git pull.');
          addLog('Options:');
          addLog('  1. Push your changes before deploying');
          addLog('  2. Set forceOverwrite=true to proceed anyway');
          addLog('');
          throw new Error('Deploy aborted: local changes would be lost. Use forceOverwrite=true to override.');
        } else {
          addLog('⚠️  forceOverwrite=true - proceeding despite local changes');
        }
      }
    }

    // Helper: inject/strip token from git remote for private repo access
    const injectGitToken = async () => {
      if (!req.gitToken || !req.gitRepo) return;
      let authUrl = req.gitRepo;
      // Convert SSH to HTTPS
      if (authUrl.startsWith('git@github.com:')) {
        authUrl = authUrl.replace('git@github.com:', 'https://github.com/');
      }
      if (!authUrl.endsWith('.git')) authUrl += '.git';
      authUrl = authUrl.replace('https://', `https://x-access-token:${req.gitToken}@`);
      addLog('Injecting ephemeral git token for private repo access');
      await execAsUser(orgUser, 'git', ['remote', 'set-url', 'origin', authUrl], appDir);
    };

    const stripGitToken = async () => {
      if (!req.gitToken || !req.gitRepo) return;
      let cleanUrl = req.gitRepo;
      if (!cleanUrl.endsWith('.git')) cleanUrl += '.git';
      addLog('Stripping git token from remote URL');
      await execAsUser(orgUser, 'git', ['remote', 'set-url', 'origin', cleanUrl], appDir);
    };

    if (req.skipGitPull) {
      addLog('Skipping git pull (scaffolded app, no remote)');
    } else if (!existsSync(join(appDir, '.git')) && req.gitRepo) {
      // First-time clone for git-based apps (directory exists but no .git)
      addLog(`Cloning repository: ${req.gitRepo}`);
      let cloneUrl = req.gitRepo;
      if (!cloneUrl.endsWith('.git')) cloneUrl += '.git';
      if (req.gitToken) {
        cloneUrl = cloneUrl.replace('https://', `https://x-access-token:${req.gitToken}@`);
        addLog('Using authenticated clone URL');
      }
      // Clone into a temp dir, then move contents
      const tmpCloneDir = `${appDir}/.git-clone-tmp`;
      try {
        const cloneResult = await execAsUser(orgUser, 'git', ['clone', '--branch', req.gitBranch || 'main', cloneUrl, tmpCloneDir], appDir, addLog);
        if (cloneResult.code !== 0) {
          throw new Error(`Git clone failed: ${cloneResult.stderr}`);
        }
        // Move .git and working tree from temp to appDir
        await execAsUser(orgUser, 'bash', ['-c', `shopt -s dotglob && mv ${tmpCloneDir}/* ${appDir}/ && rmdir ${tmpCloneDir}`], appDir, addLog);
        // Strip token from remote URL
        await stripGitToken();
      } catch (err) {
        // Clean up temp dir on failure
        await exec('sudo', ['rm', '-rf', tmpCloneDir], '/', addLog);
        throw err;
      }
    } else if (req.commitSha) {
      addLog('Pulling latest code...');
      try {
        await injectGitToken();
        await execAsUser(orgUser, 'git', ['fetch', 'origin'], appDir, addLog);
        const checkoutResult = await execAsUser(orgUser, 'git', ['checkout', req.commitSha], appDir, addLog);
        if (checkoutResult.code !== 0) {
          throw new Error(`Git checkout failed: ${checkoutResult.stderr}`);
        }
      } finally {
        await stripGitToken();
      }
    } else {
      // Check if a remote origin exists before attempting git pull
      const remoteResult = await execAsUser(orgUser, 'git', ['remote', 'get-url', 'origin'], appDir);
      if (remoteResult.code !== 0 || !remoteResult.stdout.trim()) {
        addLog('Skipping git pull (no remote origin configured — scaffolded or local-only app)');
      } else {
        addLog('Pulling latest code...');
        try {
          await injectGitToken();
          const pullResult = await execAsUser(orgUser, 'git', ['pull', 'origin', req.gitBranch || 'main'], appDir, addLog);
          if (pullResult.code !== 0) {
            throw new Error(`Git pull failed: ${pullResult.stderr}`);
          }
        } finally {
          await stripGitToken();
        }
      }
    }

    // Get current commit SHA
    const gitLogResult = await execAsUser(orgUser, 'git', ['rev-parse', 'HEAD'], appDir);
    const currentCommit = gitLogResult.stdout.trim();
    addLog(`Current commit: ${currentCommit}`);

    // Install dependencies with org-isolated cache (security: prevent cross-org cache poisoning)
    // Runs as org user for file ownership consistency
    setStage('install');
    const orgCacheDir = join(APPS_BASE_DIR, '.cache', orgSlug);
    // Ensure cache dir exists and is owned by org user
    await exec('sudo', ['mkdir', '-p', orgCacheDir], '/', addLog);
    await chownToOrgUser(orgUser, orgCacheDir, addLog);

    addLog(`Installing dependencies: ${installCmd.join(' ')}`);
    addLog(`Using isolated cache: ${orgCacheDir}`);
    const installResult = await execAsUser(
      orgUser,
      installCmd[0],
      installCmd.slice(1),
      workDir,
      addLog,
      { BUN_INSTALL_CACHE_DIR: orgCacheDir }
    );
    if (installResult.code !== 0) {
      throw new Error(`Install failed: ${installResult.stderr}`);
    }

    // Build backend (as org user)
    setStage('build');
    addLog(`Building: ${buildCmd.join(' ')}`);
    const buildResult = await execAsUser(orgUser, buildCmd[0], buildCmd.slice(1), workDir, addLog);
    if (buildResult.code !== 0) {
      throw new Error(`Build failed: ${buildResult.stderr}`);
    }

    // Build frontend (if configured, as org user)
    if (frontendDir && existsSync(frontendDir) && frontendInstallCmd && frontendBuildCmd) {
      setStage('frontend_build');
      addLog(`Installing frontend dependencies: ${frontendInstallCmd.join(' ')}`);
      const frontendInstallResult = await execAsUser(
        orgUser,
        frontendInstallCmd[0],
        frontendInstallCmd.slice(1),
        frontendDir,
        addLog,
        { BUN_INSTALL_CACHE_DIR: orgCacheDir }
      );
      if (frontendInstallResult.code !== 0) {
        throw new Error(`Frontend install failed: ${frontendInstallResult.stderr}`);
      }

      addLog(`Building frontend: ${frontendBuildCmd.join(' ')}`);
      const frontendBuildResult = await execAsUser(
        orgUser,
        frontendBuildCmd[0],
        frontendBuildCmd.slice(1),
        frontendDir,
        addLog
      );
      if (frontendBuildResult.code !== 0) {
        throw new Error(`Frontend build failed: ${frontendBuildResult.stderr}`);
      }
    }

    // Ensure app directory ownership is correct after build
    // Use 755 so deploy user (systemd) can read entry points and start.sh
    addLog(`Setting ownership of ${appDir} to ${orgUser}`);
    await chownToOrgUser(orgUser, appDir, addLog);
    await setDirPermissions(appDir, '755', addLog);

    // Capture build log
    const buildLog = state.logs.join('\n');

    // Report: deploying
    state.status = 'deploying';
    setStage('restart');
    await reportStatus(callbackUrl, deploymentId, 'deploying', { buildLog, stage: 'restart' });
    addLog('Build complete, restarting service...');

    // Generate start.sh wrapper for systemd
    // File isolation: app owned by org user; systemd runs via signaldb-app@.service template
    // Precedence: YAML entry_point > FRAMEWORK_CONFIGS default
    const entryPoint = yamlEntryPoint || frameworkConfig.entryPoint;
    const startScriptContent = generateStartScript(appDir, workDir, entryPoint, orgUser, port, resolvedFramework);
    const startScriptPath = join(workDir, 'start.sh');
    // start.sh must be owned by deploy (systemd service runs as deploy)
    // Write to temp then sudo cp (app dir is owned by org user)
    const tmpStartPath = `/tmp/start-${deploymentId}.sh`;
    writeFileSync(tmpStartPath, startScriptContent);
    await exec('sudo', ['cp', tmpStartPath, startScriptPath], '/', addLog);
    await exec('sudo', ['chown', 'deploy:deploy', startScriptPath], '/', addLog);
    await exec('sudo', ['chmod', '755', startScriptPath], '/', addLog);
    await exec('sudo', ['rm', tmpStartPath], '/', addLog);
    addLog(`Generated start.sh wrapper (file isolation via ${orgUser})`);

    // For monorepo apps, create a symlink so systemd template can resolve the working directory.
    // systemd-app@.service uses WorkingDirectory=/opt/signaldb/user-apps/%i where %i = instanceName.
    // For monorepo layout, workDir is /opt/signaldb/user-apps/{orgSlug}/{appSlug}, not /opt/signaldb/user-apps/{instanceName}.
    // Create symlink: /opt/signaldb/user-apps/{instanceName} -> workDir (app subdir containing start.sh)
    if (isMonorepoLayout) {
      const symlinkPath = join(APPS_BASE_DIR, instanceName);
      await exec('sudo', ['ln', '-sfn', workDir, symlinkPath], '/', addLog);
      addLog(`Created systemd symlink: ${symlinkPath} -> ${workDir}`);
    }

    // Verify entry point exists (use sudo test since dir may be owned by org user)
    const entryFullPath = join(workDir, entryPoint);
    const testResult = await exec('sudo', ['test', '-f', entryFullPath], '/', addLog);
    if (testResult.code !== 0) {
      throw new Error(`Entry point not found: ${entryFullPath}`);
    }

    // systemd restart (or enable+start for first-time apps)
    addLog(`Restarting systemd service: ${serviceName}`);
    const restartResult = await exec('sudo', ['systemctl', 'restart', serviceName], '/', addLog);
    if (restartResult.code !== 0) {
      // Service may not be enabled yet (first-time deploy) — enable and start
      addLog(`Restart failed, enabling and starting new systemd service: ${serviceName}`);
      const enableResult = await exec('sudo', ['systemctl', 'enable', '--now', serviceName], '/', addLog);
      if (enableResult.code !== 0) {
        throw new Error(`systemd enable+start failed: ${enableResult.stderr}`);
      }
      addLog(`systemd service enabled and started: ${serviceName}`);
    }

    // Wait for health check (use YAML-derived config)
    setStage('health_check');
    const maxAttempts = Math.ceil(healthTimeout / healthInterval);
    addLog(`Waiting for health check on port ${port}${healthPath} (timeout: ${healthTimeout}ms, interval: ${healthInterval}ms)...`);
    const healthy = await waitForHealth(port, healthPath, maxAttempts, healthInterval);

    if (!healthy) {
      throw new Error(`Health check failed - app not responding on port ${port}${healthPath}`);
    }

    addLog('Health check passed!');

    // Auto-commit after successful deploy (for monorepo layout with local git)
    if (isMonorepoLayout && !req.commitSha) {
      try {
        await execAsUser(orgUser, 'git', ['add', '-A'], appDir, addLog);
        const commitMsg = `Deploy ${appSlug} (${envName}) - ${new Date().toISOString()}`;
        await execAsUser(orgUser, 'git', ['commit', '-m', commitMsg, '--allow-empty'], appDir, addLog);
        addLog(`Auto-committed: ${commitMsg}`);
      } catch (commitErr) {
        addLog(`Warning: auto-commit failed: ${commitErr}`);
      }
    }

    // Success
    state.status = 'success';
    const deployLog = state.logs.slice(buildLog.split('\n').length).join('\n');

    // Extract schedules and auth from signaldb.yaml if present
    const rawConfig0 = signaldbConfig || tryReadSignalDBConfig(workDir);
    const appCfg0 = rawConfig0 ? getAppConfig(rawConfig0, appSlug) : null;
    const yamlSchedules0 = appCfg0?.schedules || null;
    // Auth: send false if explicitly disabled, or roles object if present
    const yamlAuth0 = appCfg0?.auth;
    const authPayload0: Record<string, unknown> | false | null =
      yamlAuth0 === false ? false :
      (yamlAuth0 && typeof yamlAuth0 === 'object' && 'roles' in yamlAuth0) ? yamlAuth0 as Record<string, unknown> : null;

    await reportStatus(callbackUrl, deploymentId, 'success', {
      buildLog,
      deployLog,
      commitSha: currentCommit,
      stage: 'health_check',
      schedules: yamlSchedules0,
      auth: authPayload0,
    });

    addLog('Deployment successful!');
  } catch (error) {
    state.status = 'failed';
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog(`Deployment failed: ${errorMessage}`);

    await reportStatus(callbackUrl, deploymentId, 'failed', {
      buildLog: state.logs.join('\n'),
      error: errorMessage,
      stage: state.stage,
    });
  } finally {
    // Stop periodic flush and do a final flush
    clearInterval(flushInterval);
    await flushLogs(state).catch(() => {});

    // Clean up after 5 minutes
    setTimeout(() => {
      activeDeployments.delete(deploymentId);
    }, 5 * 60 * 1000);
  }
}

// ─── Socat Forwarder Management ──────────────────────────────────

/**
 * Create or update a socat systemd forwarder unit.
 * Reuses the existing socat pattern from socat-pg-hobbyist.service etc.
 */
async function createSocatForwarder(
  instanceName: string,
  hostPort: number,
  containerIP: string,
  containerPort: number = 3000,
  onLog?: (line: string) => void,
): Promise<void> {
  const serviceName = `socat-app-${instanceName}`;
  const unitContent = `[Unit]
Description=Socat forwarder for Connect app ${instanceName}
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socat TCP-LISTEN:${hostPort},fork,reuseaddr TCP:${containerIP}:${containerPort}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

  const tmpPath = `/tmp/socat-${instanceName}-${Date.now()}.service`;
  writeFileSync(tmpPath, unitContent);
  await exec('sudo', ['cp', tmpPath, `/etc/systemd/system/${serviceName}.service`], '/', onLog);
  await exec('sudo', ['rm', tmpPath], '/', onLog);
  await exec('sudo', ['systemctl', 'daemon-reload'], '/', onLog);
  await exec('sudo', ['systemctl', 'enable', '--now', serviceName], '/', onLog);
  onLog?.(`Socat forwarder created: ${serviceName} (host:${hostPort} -> ${containerIP}:${containerPort})`);
}

/**
 * Update socat target IP (for blue-green swap).
 */
async function updateSocatTarget(
  instanceName: string,
  newContainerIP: string,
  hostPort: number,
  containerPort: number = 3000,
  onLog?: (line: string) => void,
): Promise<void> {
  // Recreate with new IP
  await createSocatForwarder(instanceName, hostPort, newContainerIP, containerPort, onLog);
  onLog?.(`Socat target updated: ${instanceName} -> ${newContainerIP}:${containerPort}`);
}

/**
 * Verify socat forwarder target IP matches the container's current IP.
 * If mismatched, updates the unit file and restarts the service.
 * Returns true if IP was corrected, false if already correct.
 */
function verifySocatTarget(
  instanceName: string,
  currentContainerIP: string,
  results: string[],
): boolean {
  const servicePath = `/etc/systemd/system/socat-app-${instanceName}.service`;
  try {
    if (!existsSync(servicePath)) {
      results.push(`Socat service file not found: ${servicePath}`);
      return false;
    }
    const currentUnit = readFileSync(servicePath, 'utf-8');
    const ipMatch = currentUnit.match(/TCP:(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (!ipMatch) {
      results.push('Warning: could not parse socat target IP from unit file');
      return false;
    }
    const [, socatIP, socatPort] = ipMatch;
    if (socatIP === currentContainerIP) {
      results.push(`Socat IP verified: ${currentContainerIP}:${socatPort}`);
      return false;
    }
    // IP drift detected — update the unit file
    results.push(`IP drift detected: socat targets ${socatIP}, container now at ${currentContainerIP}`);
    const updatedUnit = currentUnit.replace(
      /TCP:\d+\.\d+\.\d+\.\d+:(\d+)/,
      `TCP:${currentContainerIP}:$1`
    );
    const tmpPath = `/tmp/socat-fix-${instanceName}-${Date.now()}.service`;
    writeFileSync(tmpPath, updatedUnit);
    execSync(`sudo cp ${tmpPath} ${servicePath} && sudo rm ${tmpPath}`, { timeout: 5000 });
    execSync('sudo systemctl daemon-reload', { timeout: 10000 });
    results.push(`Updated socat target: ${socatIP} -> ${currentContainerIP}`);
    return true;
  } catch (err: any) {
    results.push(`Warning: socat IP verification failed: ${err.message}`);
    return false;
  }
}

/**
 * Remove a socat forwarder.
 */
async function removeSocatForwarder(
  instanceName: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const serviceName = `socat-app-${instanceName}`;
  await exec('sudo', ['systemctl', 'stop', serviceName], '/', onLog);
  await exec('sudo', ['systemctl', 'disable', serviceName], '/', onLog);
  await exec('sudo', ['rm', '-f', `/etc/systemd/system/${serviceName}.service`], '/', onLog);
  await exec('sudo', ['systemctl', 'daemon-reload'], '/', onLog);
  onLog?.(`Socat forwarder removed: ${serviceName}`);
}

// ─── Container Deployment ────────────────────────────────────────

/**
 * Execute a container-based deployment.
 *
 * Key design: Bind-mount app source from host.
 * The Forge daemon writes to /opt/signaldb/user-apps/{org}/{app}/ on the host.
 * The container sees changes instantly via the bind mount.
 * Same pattern as the app-platform container uses.
 */
async function executeContainerDeployment(req: DeployRequest): Promise<void> {
  const { deploymentId, callbackUrl, orgSlug, appSlug, envName, framework, port } = req;
  const containerName = req.containerName || incus.containerName(orgSlug, appSlug, envName);
  const tierProf = req.tierProfile || 'sdb-app-hobbyist';

  // Compute paths (same as systemd deployment)
  let appDir: string;
  let detectedBuildDir: string | undefined;

  if (req.appDir) {
    appDir = req.appDir;
    detectedBuildDir = req.buildDir;
  } else {
    const resolved = computeAppDir(orgSlug, appSlug, envName);
    appDir = resolved.appDir;
    detectedBuildDir = req.buildDir || resolved.buildDir;
  }

  const instanceName = req.serviceName || computeInstanceName(orgSlug, appSlug, envName);
  const workDir = detectedBuildDir ? join(appDir, detectedBuildDir) : appDir;

  // Try to read signaldb.yaml for build config (same as systemd path)
  let yamlConfig: ResolvedAppConfig | null = null;
  const signaldbConfig = tryReadSignalDBConfig(appDir);
  if (signaldbConfig) {
    yamlConfig = resolveAppConfig(signaldbConfig, appSlug, framework as any);
  } else if (detectedBuildDir) {
    const subConfig = tryReadSignalDBConfig(workDir);
    if (subConfig) {
      yamlConfig = resolveAppConfig(subConfig, appSlug, framework as any);
    }
  }

  // Resolve framework config: explicit request > YAML > FRAMEWORK_CONFIGS defaults
  const resolvedFramework = framework || yamlConfig?.framework || 'bun-server';
  const frameworkConfig = FRAMEWORK_CONFIGS[resolvedFramework] || FRAMEWORK_CONFIGS['bun-server'];
  const installCmd = req.installCmd || yamlConfig?.installCmd || frameworkConfig.installCmd;
  const buildCmd = req.buildCmd || yamlConfig?.buildCmd || frameworkConfig.buildCmd;

  // Check if directory exists
  if (!existsSync(appDir)) {
    if (req.gitRepo) {
      mkdirSync(appDir, { recursive: true });
    } else {
      await reportStatus(callbackUrl, deploymentId, 'failed', {
        error: `App directory not found: ${appDir}`,
      });
      return;
    }
  }

  // Initialize deployment state
  const state: DeploymentState = {
    deploymentId,
    status: 'building',
    stage: 'init',
    logs: [],
    pendingLogs: [],
    startedAt: new Date(),
    callbackUrl,
  };
  activeDeployments.set(deploymentId, state);

  const addLog = (line: string) => {
    const logLine = `[${new Date().toISOString()}] ${line}`;
    state.logs.push(logLine);
    state.pendingLogs.push(logLine);
    console.log(logLine);
  };

  const setStage = (stage: DeployStage) => {
    state.stage = stage;
    addLog(`--- Stage: ${stage} ---`);
  };

  // Start periodic log flush
  const flushInterval = setInterval(() => {
    flushLogs(state).catch(err => {
      console.error('[deploy-agent] Log flush error:', err);
    });
  }, 2000);

  try {
    await reportStatus(callbackUrl, deploymentId, 'building', { stage: 'init' });
    addLog(`Starting CONTAINER deployment for ${orgSlug}/${appSlug}/${envName}`);
    addLog(`Container: ${containerName}`);
    addLog(`Profile: ${tierProf}`);
    addLog(`App directory (host): ${appDir}`);
    addLog(`Work directory: ${workDir}`);
    addLog(`Framework: ${resolvedFramework}`);

    // ── Step 1: Ensure container exists ──
    const exists = await incus.containerExists(containerName);
    let containerIP = req.containerIP;

    if (!exists) {
      addLog('Container does not exist, creating from golden image...');
      const goldenImage = incus.goldenImageAlias(resolvedFramework);

      // Check if golden image exists
      const hasImage = await incus.imageExists(goldenImage);
      const createOpts: { profile: string; network?: string } = { profile: tierProf };
      if (req.bridgeName) {
        createOpts.network = req.bridgeName;
        addLog(`Using org bridge network: ${req.bridgeName}`);
      }
      if (!hasImage) {
        // Fallback: use plain Debian 12
        addLog(`Golden image ${goldenImage} not found, using debian/12`);
        await incus.createContainer(containerName, 'images:debian/12', createOpts, addLog);
      } else {
        await incus.createContainer(containerName, goldenImage, createOpts, addLog);
      }

      // Bind-mount app source from host
      addLog(`Adding bind mount: ${appDir} -> /app`);
      await incus.addDiskDevice(containerName, 'app-source', appDir, '/app', addLog);

      // Set UID/GID mapping so container app user (1000) maps to host org user
      const orgUser = getOrgUsername(orgSlug);
      const idOutput = await exec('id', ['-u', orgUser], '/');
      const gidOutput = await exec('id', ['-g', orgUser], '/');
      const hostUid = parseInt(idOutput.stdout.trim(), 10);
      const hostGid = parseInt(gidOutput.stdout.trim(), 10);
      if (hostUid && hostGid) {
        addLog(`Setting raw.idmap: host ${orgUser} (${hostUid}:${hostGid}) -> container app (1000:1000)`);
        await incus.setIdMap(containerName, hostUid, hostGid, addLog);
      }

      // Start the container
      await incus.startContainer(containerName, addLog);

      // Wait for container to get an IP
      addLog('Waiting for container IP...');
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        containerIP = await incus.getContainerIP(containerName, addLog) || undefined;
        if (containerIP) break;
      }

      if (!containerIP) {
        throw new Error('Container did not receive an IP address after 30s');
      }

      // Set static IP if one was provided
      if (req.containerIP) {
        addLog(`Setting static IP: ${req.containerIP}`);
        await incus.setStaticIP(containerName, req.containerIP, addLog);
        // Restart to apply
        await incus.stopContainer(containerName, addLog);
        await incus.startContainer(containerName, addLog);
        containerIP = req.containerIP;
      }

      addLog(`Container IP: ${containerIP}`);
    } else {
      addLog('Container already exists');
      const status = await incus.getContainerStatus(containerName, addLog);
      if (status !== 'Running') {
        addLog(`Container status: ${status}, starting...`);
        await incus.startContainer(containerName, addLog);
      }
      // Get existing IP
      containerIP = await incus.getContainerIP(containerName, addLog) || req.containerIP || undefined;
      addLog(`Container IP: ${containerIP}`);
    }

    if (!containerIP) {
      throw new Error('Could not determine container IP');
    }

    // ── Step 2: Pre-deploy snapshot ──
    const snapshotName = `pre-deploy-${deploymentId.slice(0, 8)}`;
    addLog(`Creating pre-deploy snapshot: ${snapshotName}`);
    try {
      await incus.snapshotCreate(containerName, snapshotName, addLog);
    } catch (snapErr) {
      addLog(`Warning: snapshot creation failed (non-fatal): ${snapErr}`);
    }

    // ── Step 3: Write env vars ──
    if (req.envVars && Object.keys(req.envVars).length > 0) {
      addLog('Writing environment variables to container...');
      const envLines: string[] = [`PORT=3000`]; // Container always listens on 3000 internally
      for (const [key, value] of Object.entries(req.envVars)) {
        if (key === 'PORT') continue; // Override: container internal port is always 3000
        envLines.push(`${key}=${value}`);
      }
      const envContent = envLines.join('\n') + '\n';

      // Push via base64 to avoid incus file push UID-mapping failures
      await pushFileViaBase64(containerName, envContent, '/app/.env', addLog);

      // Also push to containerWorkDir/.env if it differs (monorepo: /app/{appSlug}/.env)
      if (detectedBuildDir) {
        const containerWorkDir = `/app/${detectedBuildDir}`;
        await pushFileViaBase64(containerName, envContent, `${containerWorkDir}/.env`, addLog);
        addLog(`Wrote ${envLines.length} env vars to /app/.env and ${containerWorkDir}/.env`);
      } else {
        addLog(`Wrote ${envLines.length} env vars to /app/.env`);
      }
    }

    // ── Step 4: Git pull (runs on host since app is bind-mounted) ──
    setStage('git_pull');
    if (!req.skipGitPull && existsSync(join(appDir, '.git'))) {
      const orgUser = getOrgUsername(orgSlug);
      const remoteResult = await execAsUser(orgUser, 'git', ['remote', 'get-url', 'origin'], appDir);
      if (remoteResult.code === 0 && remoteResult.stdout.trim()) {
        addLog('Pulling latest code (host-side, bind mount syncs to container)...');
        const pullResult = await execAsUser(orgUser, 'git', ['pull', 'origin', req.gitBranch || 'main'], appDir, addLog);
        if (pullResult.code !== 0) {
          throw new Error(`Git pull failed: ${pullResult.stderr}`);
        }
      } else {
        addLog('No remote origin, skipping git pull');
      }
    } else {
      addLog('Skipping git pull');
    }

    // ── Step 5: Install + build inside container ──
    // In monorepo mode, bind mount maps org dir -> /app, app code is at /app/{buildDir}
    const containerWorkDir = detectedBuildDir ? `/app/${detectedBuildDir}` : '/app';

    setStage('install');
    addLog(`Installing dependencies inside container (workdir: ${containerWorkDir}): ${installCmd.join(' ')}`);
    const installResult = await incus.execInContainer(
      containerName,
      ['bash', '-c', `cd ${containerWorkDir} && export PATH=/root/.bun/bin:/usr/local/bin:$PATH && ${installCmd.join(' ')}`],
      addLog,
      300_000,
    );
    if (installResult.code !== 0) {
      throw new Error(`Install failed inside container: ${installResult.stderr}`);
    }

    setStage('build');
    addLog(`Building inside container: ${buildCmd.join(' ')}`);
    const buildResult = await incus.execInContainer(
      containerName,
      ['bash', '-c', `cd ${containerWorkDir} && export PATH=/root/.bun/bin:/usr/local/bin:$PATH && export NODE_OPTIONS="--max-old-space-size=2048" && ${buildCmd.join(' ')}`],
      addLog,
      300_000,
    );
    if (buildResult.code !== 0) {
      throw new Error(`Build failed inside container: ${buildResult.stderr}`);
    }

    // ── Step 6: Generate start-container.sh inside container ──
    const entryPoint = frameworkConfig.entryPoint;
    let startCmd: string;
    if (resolvedFramework === 'react-router') {
      // Use real Node.js explicitly — Bun's react-dom/server.bun.js lacks renderToPipeableStream
      startCmd = `exec /usr/bin/node ./node_modules/.bin/react-router-serve ./build/server/index.js`;
    } else {
      startCmd = `exec /root/.bun/bin/bun ${containerWorkDir}/${entryPoint}`;
    }

    const startScript = `#!/bin/bash
set -a
source /app/.env 2>/dev/null || true
set +a
cd ${containerWorkDir}
export PORT=\${PORT:-3000}
${startCmd}
`;
    // Push via base64 to avoid incus file push UID-mapping failures
    // Must be start-container.sh to match golden image systemd unit (ExecStart=/bin/bash /app/start-container.sh)
    await pushFileViaBase64(containerName, startScript, '/app/start-container.sh', addLog);
    await incus.execInContainer(containerName, ['chmod', '+x', '/app/start-container.sh'], addLog);

    // Fix ownership: install/build run as root, but app service runs as 'app' user
    addLog('Setting file ownership to app user...');
    await incus.execInContainer(
      containerName,
      ['chown', '-R', 'app:app', containerWorkDir],
      addLog,
    );

    // Capture build log
    const buildLog = state.logs.join('\n');

    // ── Step 7: Restart app inside container ──
    state.status = 'deploying';
    setStage('restart');
    await reportStatus(callbackUrl, deploymentId, 'deploying', { buildLog, stage: 'restart' });
    addLog('Restarting app inside container...');

    await incus.execInContainer(
      containerName,
      ['systemctl', 'restart', 'signaldb-app'],
      addLog,
    );

    // ── Step 8: Create/update socat forwarder ──
    addLog(`Setting up socat forwarder: host:${port} -> ${containerIP}:3000`);
    await createSocatForwarder(instanceName, port, containerIP, 3000, addLog);

    // ── Step 9: Health check via host port ──
    setStage('health_check');
    addLog(`Waiting for health check on host port ${port}...`);
    const healthy = await waitForHealth(port, '/health', 30, 1000);

    if (!healthy) {
      throw new Error(`Health check failed — container app not responding on host port ${port}`);
    }

    addLog('Health check passed!');

    // P6: Test DB connectivity from inside container (non-blocking diagnostic)
    try {
      const dbTestResult = await incus.execInContainer(containerName, [
        'bash', '-c',
        `set -a; for f in ${containerWorkDir}/.env /app/.env; do [ -f "$f" ] && source "$f"; done; set +a; ` +
        'if [ -n "$DATABASE_URL" ]; then ' +
        'bun -e "const p=require(\'pg\');const c=new p.Client(process.env.DATABASE_URL);await c.connect();const r=await c.query(\'SELECT 1 as ok\');console.log(JSON.stringify({ok:r.rows[0].ok}));await c.end()" 2>/dev/null || echo "DB_CHECK_FAILED"; ' +
        'else echo "NO_DATABASE_URL"; fi',
      ], undefined, 10000);
      const dbOutput = dbTestResult.stdout.trim();
      if (dbOutput === 'NO_DATABASE_URL') {
        addLog('DB check: no DATABASE_URL configured (skipped)');
      } else if (dbOutput.includes('DB_CHECK_FAILED') || dbTestResult.code !== 0) {
        addLog('WARNING: DB connectivity check failed — app may have database connection issues');
      } else {
        addLog('DB connectivity check passed');
      }
    } catch (dbCheckErr) {
      addLog(`DB check skipped: ${dbCheckErr instanceof Error ? dbCheckErr.message : String(dbCheckErr)}`);
    }

    // Get current commit SHA from host
    const gitLogResult = await exec('git', ['rev-parse', 'HEAD'], appDir);
    const currentCommit = gitLogResult.stdout.trim();

    // Success
    state.status = 'success';
    const deployLog = state.logs.slice(buildLog.split('\n').length).join('\n');

    // Extract schedules and auth from signaldb.yaml if present
    const rawConfig = signaldbConfig || tryReadSignalDBConfig(workDir);
    const appCfg = rawConfig ? getAppConfig(rawConfig, appSlug) : null;
    const yamlSchedules = appCfg?.schedules || null;
    // Auth: send false if explicitly disabled, or roles object if present
    const yamlAuth = appCfg?.auth;
    const authPayload: Record<string, unknown> | false | null =
      yamlAuth === false ? false :
      (yamlAuth && typeof yamlAuth === 'object' && 'roles' in yamlAuth) ? yamlAuth as Record<string, unknown> : null;

    await reportStatus(callbackUrl, deploymentId, 'success', {
      buildLog,
      deployLog,
      commitSha: currentCommit,
      stage: 'health_check',
      schedules: yamlSchedules,
      auth: authPayload,
    });

    addLog('Container deployment successful!');
  } catch (error) {
    state.status = 'failed';
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog(`Container deployment failed: ${errorMessage}`);

    await reportStatus(callbackUrl, deploymentId, 'failed', {
      buildLog: state.logs.join('\n'),
      error: errorMessage,
      stage: state.stage,
    });
  } finally {
    clearInterval(flushInterval);
    await flushLogs(state).catch(() => {});

    setTimeout(() => {
      activeDeployments.delete(deploymentId);
    }, 5 * 60 * 1000);
  }
}

/**
 * Mark stale deployments as failed on startup.
 * Any deployment stuck in 'building' or 'deploying' for >10 minutes
 * was likely interrupted by an agent restart.
 */
async function recoverStaleDeployments(): Promise<void> {
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3003';
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  try {
    // Query the API for stale deployments
    const res = await fetch(`${API_URL}/v1/deployments/stale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify({ thresholdMs: STALE_THRESHOLD_MS }),
    });

    if (res.ok) {
      const data = await res.json() as { recovered: number };
      if (data.recovered > 0) {
        console.log(`[deploy-agent] Recovered ${data.recovered} stale deployments on startup`);
      }
    } else {
      // Stale recovery endpoint may not exist yet — that's OK
      console.log('[deploy-agent] Stale deployment recovery not available (endpoint may not exist yet)');
    }
  } catch (err) {
    console.warn('[deploy-agent] Stale recovery failed (non-critical):', err);
  }
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Deploy-Secret',
  };

  // Handle preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (method === 'GET' && path === '/health') {
    let activeCount = 0;
    for (const [, state] of activeDeployments) {
      if (state.status === 'building' || state.status === 'deploying') {
        activeCount++;
      }
    }
    return Response.json(
      {
        status: 'ok',
        version: '3.0.0',
        activeDeployments: activeCount,
        maxConcurrent: MAX_CONCURRENT_DEPLOYMENTS,
        totalTracked: activeDeployments.size,
        uptime: process.uptime(),
        supportedFrameworks: Object.keys(FRAMEWORK_CONFIGS),
      },
      { headers: corsHeaders }
    );
  }

  // Get deployment status
  if (method === 'GET' && path.startsWith('/status/')) {
    const deploymentId = path.replace('/status/', '');
    const state = activeDeployments.get(deploymentId);

    if (!state) {
      return Response.json(
        { error: 'Deployment not found or expired' },
        { status: 404, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        deploymentId: state.deploymentId,
        status: state.status,
        logs: state.logs,
        startedAt: state.startedAt.toISOString(),
        duration: Date.now() - state.startedAt.getTime(),
      },
      { headers: corsHeaders }
    );
  }

  // Scaffold endpoint - create app directory from template
  if (method === 'POST' && path === '/scaffold') {
    // Verify secret
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: {
      orgSlug: string;
      appSlug: string;
      appName: string;
      envName: string;
      framework: string;
      port?: number;
      projectId?: string;
      directoryLayout?: 'monorepo' | 'legacy';
    };

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { orgSlug, appSlug, envName } = body;
    const useMonorepo = body.directoryLayout !== 'legacy';

    // Check if app already exists (monorepo: check subdirectory, legacy: check flat dir)
    if (useMonorepo) {
      const orgDir = join(APPS_BASE_DIR, orgSlug);
      const subDir = join(orgDir, appSlug);
      if (existsSync(subDir)) {
        return Response.json(
          { error: `App subdirectory already exists: ${subDir}`, appDir: orgDir, buildDir: appSlug },
          { status: 409, headers: corsHeaders }
        );
      }
    } else {
      const legacyDir = computeAppDirLegacy(orgSlug, appSlug, envName);
      if (existsSync(legacyDir)) {
        return Response.json(
          { error: `Directory already exists: ${legacyDir}`, appDir: legacyDir },
          { status: 409, headers: corsHeaders }
        );
      }
    }

    // Ensure org user exists and org dir is writable by deploy user
    // (org dir may be owned by org user from a previous scaffold — both the
    // directory and files like signaldb.yaml need to be group-writable)
    if (useMonorepo) {
      const orgDir = join(APPS_BASE_DIR, orgSlug);
      if (existsSync(orgDir)) {
        await ensureOrgUser(orgSlug);
        // Make org dir + contents group-writable so scaffold can create subdirs and update yaml
        await exec('sudo', ['chmod', '-R', 'g+w', orgDir], '/');
      }
    }

    // Dynamically import the scaffold service
    try {
      const { scaffoldApp } = await import('../../src/services/app-scaffold');
      const result = await scaffoldApp({
        orgSlug: body.orgSlug,
        appSlug: body.appSlug,
        appName: body.appName,
        envName: body.envName,
        framework: body.framework as any,
        port: body.port,
        projectId: body.projectId,
        directoryLayout: body.directoryLayout || 'monorepo',
      });

      if (result.success) {
        // Set ownership to org Linux user for process isolation
        const scaffoldOrgUser = await ensureOrgUser(orgSlug);
        await chownToOrgUser(scaffoldOrgUser, result.appDir!);
        await setDirPermissions(result.appDir!, '750');
        // Also set cache dir ownership
        const cacheDir = join(APPS_BASE_DIR, '.cache', orgSlug);
        if (existsSync(cacheDir)) {
          await chownToOrgUser(scaffoldOrgUser, cacheDir);
        }

        return Response.json(
          {
            success: true,
            appDir: result.appDir,
            buildDir: result.buildDir,
            logs: result.logs,
            orgUser: scaffoldOrgUser,
          },
          { status: 201, headers: corsHeaders }
        );
      }

      return Response.json(
        { success: false, error: result.error, logs: result.logs },
        { status: 500, headers: corsHeaders }
      );
    } catch (err) {
      // Fallback: create minimal scaffold inline if import fails
      console.error('[deploy-agent] Scaffold import failed, using inline fallback:', err);

      const { mkdirSync } = await import('fs');
      // Compute appDir based on directory layout
      const appDir = useMonorepo
        ? join(APPS_BASE_DIR, orgSlug)
        : computeAppDirLegacy(orgSlug, appSlug, envName);
      const buildDir = useMonorepo ? appSlug : appSlug;
      const workDir = useMonorepo ? join(appDir, appSlug) : appDir;
      mkdirSync(workDir, { recursive: true });

      // Write a minimal index.ts
      const entryContent = `const PORT = parseInt(process.env.PORT || '3000');
Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    return new Response('${body.appName} - SignalDB Connect', { headers: { 'Content-Type': 'text/html' } });
  },
});
console.log('Running on port ' + PORT);
`;
      const pkgContent = JSON.stringify({
        name: body.appSlug,
        version: '0.1.0',
        private: true,
        scripts: { dev: 'bun --watch src/index.ts', build: 'bun build src/index.ts --outdir dist --target bun', start: 'bun dist/index.js' },
      }, null, 2);

      const srcDir = join(workDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'index.ts'), entryContent);
      writeFileSync(join(workDir, 'package.json'), pkgContent);

      // Git init
      await exec('git', ['init'], workDir);
      await exec('git', ['add', '.'], workDir);
      await exec('git', ['commit', '-m', 'Initial scaffold'], workDir);
      // Use org-isolated cache for security
      const scaffoldCacheDir = join(APPS_BASE_DIR, '.cache', body.orgSlug);
      await exec('bun', ['install'], workDir, undefined, { BUN_INSTALL_CACHE_DIR: scaffoldCacheDir });

      // Set ownership to org Linux user for process isolation
      const fallbackOrgUser = await ensureOrgUser(body.orgSlug);
      await chownToOrgUser(fallbackOrgUser, useMonorepo ? appDir : workDir);
      await setDirPermissions(useMonorepo ? appDir : workDir, '750');
      await exec('sudo', ['mkdir', '-p', scaffoldCacheDir], '/');
      await chownToOrgUser(fallbackOrgUser, scaffoldCacheDir);

      return Response.json(
        { success: true, appDir, buildDir, fallback: true, orgUser: fallbackOrgUser },
        { status: 201, headers: corsHeaders }
      );
    }
  }

  // Read config endpoint - returns signaldb.yaml content for Console display
  if (method === 'POST' && path === '/read-config') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: { path: string; appSlug: string };
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body.path) {
      return Response.json(
        { error: 'path is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Security: only allow reading from APPS_BASE_DIR
    if (!body.path.startsWith(APPS_BASE_DIR)) {
      return Response.json(
        { error: 'Path must be within apps base directory' },
        { status: 403, headers: corsHeaders }
      );
    }

    if (!existsSync(body.path)) {
      return Response.json(
        { error: 'File not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    try {
      const yamlContent = readFileSync(body.path, 'utf-8');
      const config = tryReadSignalDBConfig(body.path.replace('/signaldb.yaml', ''));
      let resolvedConfig: Record<string, unknown> = {};
      if (config) {
        const resolved = resolveAppConfig(config, body.appSlug);
        if (resolved) {
          resolvedConfig = resolved as unknown as Record<string, unknown>;
        }
      }
      return Response.json(
        { yaml: yamlContent, resolvedConfig },
        { headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { error: `Failed to read config: ${err}` },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Deploy endpoint
  if (method === 'POST' && path === '/deploy') {
    // Verify secret
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: DeployRequest;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate required fields
    const required = ['deploymentId', 'callbackUrl', 'appSlug', 'orgSlug', 'envName', 'port'];
    const missing = required.filter(field => !(body as Record<string, unknown>)[field]);
    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Enforce max concurrent deployments
    let activeCount = 0;
    for (const [, state] of activeDeployments) {
      if (state.status === 'building' || state.status === 'deploying') {
        activeCount++;
      }
    }
    if (activeCount >= MAX_CONCURRENT_DEPLOYMENTS) {
      return Response.json(
        { error: 'Too many concurrent deployments', maxConcurrent: MAX_CONCURRENT_DEPLOYMENTS, active: activeCount },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '30' } }
      );
    }

    // Route to container or systemd deployment (default: container since Feb 2026)
    const deployFn = body.deploymentMode === 'systemd'
      ? executeDeployment
      : executeContainerDeployment;

    deployFn(body).catch((err) => {
      console.error('[deploy-agent] Unhandled deployment error:', err);
    });

    const resolvedDir = body.appDir
      ? { appDir: body.appDir, buildDir: body.buildDir }
      : computeAppDir(body.orgSlug, body.appSlug, body.envName);
    const resolvedInstance = body.serviceName || computeInstanceName(body.orgSlug, body.appSlug, body.envName);
    return Response.json(
      {
        accepted: true,
        deploymentId: body.deploymentId,
        statusUrl: `/status/${body.deploymentId}`,
        appDir: 'appDir' in resolvedDir ? resolvedDir.appDir : resolvedDir,
        buildDir: 'buildDir' in resolvedDir ? resolvedDir.buildDir : body.buildDir,
        serviceName: resolvedInstance,
      },
      { status: 202, headers: corsHeaders }
    );
  }

  // Clone container endpoint — instant ZFS CoW clone + socat setup
  if (method === 'POST' && path === '/clone-container') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: {
      sourceContainer: string;
      targetContainer: string;
      instanceName: string;
      port: number;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { sourceContainer, targetContainer, instanceName, port } = body;
    if (!sourceContainer || !targetContainer || !instanceName || !port) {
      return Response.json(
        { error: 'sourceContainer, targetContainer, instanceName, and port are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { execSync } = await import('child_process');
    const startTime = Date.now();

    try {
      // 1. Clone container (ZFS CoW — near-instant)
      console.log(`[clone] Copying ${sourceContainer} → ${targetContainer}`);
      execSync(`incus copy ${sourceContainer} ${targetContainer}`, { timeout: 60000 });

      // 2. Start the clone
      console.log(`[clone] Starting ${targetContainer}`);
      execSync(`incus start ${targetContainer}`, { timeout: 30000 });

      // 3. Wait for IP allocation
      let containerIP: string | null = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const ipOutput = execSync(
            `incus list ${targetContainer} --format json | python3 -c "import json,sys; d=json.load(sys.stdin); addrs=d[0].get('state',{}).get('network',{}).get('eth0',{}).get('addresses',[]); [print(a['address']) for a in addrs if a['family']=='inet' and a['scope']=='global']"`,
            { timeout: 10000 }
          ).toString().trim();
          if (ipOutput) {
            containerIP = ipOutput;
            break;
          }
        } catch {
          // Not ready yet
        }
      }

      if (!containerIP) {
        // Cleanup failed clone
        try { execSync(`incus stop ${targetContainer} --force 2>/dev/null`); } catch {}
        try { execSync(`incus delete ${targetContainer} 2>/dev/null`); } catch {}
        return Response.json(
          { error: 'Cloned container did not receive an IP after 20s' },
          { status: 500, headers: corsHeaders }
        );
      }

      // 4. Create socat forwarder
      console.log(`[clone] Setting up socat forwarder on port ${port} → ${containerIP}:3000`);
      const serviceContent = `[Unit]
Description=Socat forwarder for ${instanceName}
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socat TCP-LISTEN:${port},fork,reuseaddr,bind=0.0.0.0 TCP:${containerIP}:3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target`;

      writeFileSync(`/tmp/socat-clone-${instanceName}.service`, serviceContent);
      execSync(`sudo cp /tmp/socat-clone-${instanceName}.service /etc/systemd/system/socat-app-${instanceName}.service`, { timeout: 5000 });
      execSync(`sudo systemctl daemon-reload`, { timeout: 10000 });
      execSync(`sudo systemctl enable --now socat-app-${instanceName}`, { timeout: 10000 });

      const durationMs = Date.now() - startTime;
      console.log(`[clone] Complete: ${targetContainer} (${containerIP}) in ${durationMs}ms`);

      return Response.json(
        {
          success: true,
          containerIP,
          durationMs,
          targetContainer,
        },
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error(`[clone] Failed:`, String(err));
      // Attempt cleanup on failure
      try { execSync(`incus stop ${targetContainer} --force 2>/dev/null`); } catch {}
      try { execSync(`incus delete ${targetContainer} 2>/dev/null`); } catch {}
      return Response.json(
        { error: 'Clone failed', message: String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Cleanup endpoint — stop/delete container and socat forwarder
  if (method === 'POST' && path === '/cleanup') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: { containerName: string; instanceName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { containerName, instanceName } = body;
    if (!containerName || !instanceName) {
      return Response.json(
        { error: 'containerName and instanceName are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const results: string[] = [];
    const { execSync } = await import('child_process');

    // Stop and delete the Incus container
    try {
      execSync(`incus stop ${containerName} --force 2>/dev/null`, { timeout: 30000 });
      results.push(`Stopped container ${containerName}`);
    } catch {
      results.push(`Container ${containerName} was not running or does not exist`);
    }

    try {
      execSync(`incus delete ${containerName} 2>/dev/null`, { timeout: 15000 });
      results.push(`Deleted container ${containerName}`);
    } catch {
      results.push(`Container ${containerName} could not be deleted (may not exist)`);
    }

    // Stop, disable, and remove socat forwarder
    try {
      execSync(`sudo systemctl stop socat-app-${instanceName} 2>/dev/null`, { timeout: 10000 });
      results.push(`Stopped socat-app-${instanceName}`);
    } catch {
      results.push(`Socat service socat-app-${instanceName} was not running`);
    }

    try {
      execSync(`sudo systemctl disable socat-app-${instanceName} 2>/dev/null`, { timeout: 10000 });
      execSync(`sudo rm -f /etc/systemd/system/socat-app-${instanceName}.service`, { timeout: 5000 });
      execSync(`sudo systemctl daemon-reload`, { timeout: 10000 });
      results.push(`Removed socat service file for ${instanceName}`);
    } catch {
      results.push(`Socat service file cleanup skipped (may not exist)`);
    }

    console.log(`[cleanup] ${containerName} / ${instanceName}:`, results.join('; '));

    return Response.json(
      { success: true, results },
      { headers: corsHeaders }
    );
  }

  // Used ports: return all TCP listening ports in the 4000-4999 range on the host
  if (method === 'GET' && path === '/used-ports') {
    const secret = req.headers.get('X-Deploy-Secret') || url.searchParams.get('secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      const proc = Bun.spawnSync(['ss', '-tlnp']);
      const output = proc.stdout.toString();
      const usedPorts: number[] = [];

      for (const line of output.split('\n')) {
        // Match lines like: LISTEN  0  5  0.0.0.0:4007  0.0.0.0:*
        const match = line.match(/:(\d+)\s/);
        if (match) {
          const port = parseInt(match[1]);
          if (port >= 4000 && port <= 4999) {
            usedPorts.push(port);
          }
        }
      }

      // Deduplicate and sort
      const uniquePorts = [...new Set(usedPorts)].sort((a, b) => a - b);

      return Response.json({
        success: true,
        usedPorts: uniquePorts,
      }, { headers: corsHeaders });
    } catch (err) {
      return Response.json({
        error: 'Failed to check ports',
        message: String(err),
      }, { status: 500, headers: corsHeaders });
    }
  }

  // Promote swap: update socat target to point at a different container IP
  if (method === 'POST' && path === '/promote-swap') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: {
      productionContainer: string;
      sourceContainer: string;
      instanceName: string;
      port: number;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { sourceContainer, instanceName, port } = body;
    if (!sourceContainer || !instanceName || !port) {
      return Response.json(
        { error: 'sourceContainer, instanceName, and port are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { execSync } = await import('child_process');

    try {
      // Get source container IP
      const ipOutput = execSync(
        `incus list ${sourceContainer} --format json | python3 -c "import json,sys; d=json.load(sys.stdin); addrs=d[0].get('state',{}).get('network',{}).get('eth0',{}).get('addresses',[]); [print(a['address']) for a in addrs if a['family']=='inet' and a['scope']=='global']"`,
        { timeout: 10000, encoding: 'utf-8' }
      ).trim();

      if (!ipOutput) {
        return Response.json(
          { error: `Could not resolve IP for container ${sourceContainer}` },
          { status: 500, headers: corsHeaders }
        );
      }

      const newTargetIP = ipOutput;
      console.log(`[promote-swap] Updating socat for ${instanceName} to target ${newTargetIP}:3000 on port ${port}`);

      // Rewrite socat service to point at new container IP
      const serviceContent = `[Unit]
Description=Socat forwarder for ${instanceName}
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socat TCP-LISTEN:${port},fork,reuseaddr,bind=0.0.0.0 TCP:${newTargetIP}:3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target`;

      writeFileSync(`/tmp/socat-promote-${instanceName}.service`, serviceContent);
      execSync(`sudo cp /tmp/socat-promote-${instanceName}.service /etc/systemd/system/socat-app-${instanceName}.service`, { timeout: 5000 });
      execSync(`sudo systemctl daemon-reload`, { timeout: 10000 });
      execSync(`sudo systemctl restart socat-app-${instanceName}`, { timeout: 10000 });

      console.log(`[promote-swap] Done: socat-app-${instanceName} → ${newTargetIP}:3000`);

      return Response.json(
        { success: true, newTargetIP },
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error(`[promote-swap] Failed:`, String(err));
      return Response.json(
        { error: 'Promote swap failed', message: String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Snapshot restore: stop container, restore snapshot, start
  if (method === 'POST' && path === '/snapshot-restore') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; snapshotName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, snapshotName } = body;
    if (!containerName || !snapshotName) {
      return Response.json(
        { error: 'containerName and snapshotName are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate container name format
    if (!/^sdb-app-[a-z0-9-]+$/.test(containerName)) {
      return Response.json({ error: 'Invalid container name' }, { status: 400, headers: corsHeaders });
    }

    const { execSync } = await import('child_process');

    try {
      console.log(`[snapshot-restore] Restoring ${containerName} to snapshot ${snapshotName}`);

      // Stop, restore, start
      execSync(`incus stop ${containerName} --force`, { timeout: 30000 });
      execSync(`incus snapshot restore ${containerName} ${snapshotName}`, { timeout: 30000 });
      execSync(`incus start ${containerName}`, { timeout: 30000 });

      // Wait for container to get IP (up to 20s)
      let containerIP: string | null = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const ipOutput = execSync(
            `incus list ${containerName} --format json | python3 -c "import json,sys; d=json.load(sys.stdin); addrs=d[0].get('state',{}).get('network',{}).get('eth0',{}).get('addresses',[]); [print(a['address']) for a in addrs if a['family']=='inet' and a['scope']=='global']"`,
            { timeout: 10000, encoding: 'utf-8' }
          ).trim();
          if (ipOutput) {
            containerIP = ipOutput;
            break;
          }
        } catch {
          // Not ready yet
        }
      }

      console.log(`[snapshot-restore] Done: ${containerName} restored, IP: ${containerIP}`);

      return Response.json(
        { success: true, containerIP },
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error(`[snapshot-restore] Failed:`, String(err));
      return Response.json(
        { error: 'Snapshot restore failed', message: String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Push .env to container and restart app
  if (method === 'POST' && path === '/push-env') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; envContent: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, envContent } = body;
    if (!containerName || !envContent) {
      return Response.json(
        { error: 'containerName and envContent are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate container name format
    if (!/^sdb-app-[a-z0-9-]+$/.test(containerName)) {
      return Response.json({ error: 'Invalid container name' }, { status: 400, headers: corsHeaders });
    }

    try {
      console.log(`[push-env] Writing .env to ${containerName}`);

      const noop = () => {};
      // Push via base64 to avoid incus file push UID-mapping failures
      await pushFileViaBase64(containerName, envContent, '/app/.env', noop);

      // Detect monorepo: check if start-container.sh references a subdirectory
      const detectResult = await incus.execInContainer(
        containerName,
        ['bash', '-c', 'grep "^cd /app/" /app/start-container.sh 2>/dev/null || grep "^cd /app/" /app/start.sh 2>/dev/null || echo "/app"'],
        noop,
      );
      const workDir = detectResult.stdout.trim().replace(/^cd\s+/, '').replace(/\s*$/, '');
      if (workDir && workDir !== '/app') {
        await pushFileViaBase64(containerName, envContent, `${workDir}/.env`, noop);
        console.log(`[push-env] Also wrote .env to ${workDir}/.env`);
      }

      // Restart app inside container
      const { spawnSync } = await import('child_process');
      spawnSync('incus', ['exec', containerName, '--', 'systemctl', 'restart', 'signaldb-app'], { timeout: 30000 });

      console.log(`[push-env] Done: .env pushed and app restarted in ${containerName}`);

      return Response.json(
        { success: true },
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error(`[push-env] Failed:`, String(err));
      return Response.json(
        { error: 'Push env failed', message: String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Stream container logs via SSE: GET /container-logs/stream?container=NAME
  if (method === 'GET' && path === '/container-logs/stream') {
    const authHeader = req.headers.get('X-Deploy-Secret');
    if (authHeader !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const containerName = url.searchParams.get('container');
    if (!containerName) {
      return Response.json({ error: 'Missing container parameter' }, { status: 400, headers: corsHeaders });
    }

    // Validate container name format
    if (!/^sdb-app-[a-z0-9-]+$/.test(containerName)) {
      return Response.json({ error: 'Invalid container name' }, { status: 400, headers: corsHeaders });
    }

    const { spawn } = await import('child_process');
    const encoder = new TextEncoder();
    const signal = req.signal;
    const MAX_STREAM_MS = 5 * 60 * 1000;
    const KEEPALIVE_INTERVAL_MS = 30000;

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        const safeSend = (event: string, data: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
          } catch {
            closed = true;
          }
        };

        safeSend('connected', JSON.stringify({ containerName }));

        // Spawn journalctl -f inside the container
        const proc = spawn('incus', [
          'exec', containerName, '--',
          'journalctl', '-u', 'signaldb-app', '-f', '-o', 'short-iso', '--since', 'now',
        ]);

        let lineBuffer = '';

        proc.stdout.on('data', (data: Buffer) => {
          if (closed) return;
          lineBuffer += data.toString();
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          const completeLines = lines.filter(l => l.length > 0);
          if (completeLines.length > 0) {
            safeSend('log', JSON.stringify({ lines: completeLines, source: 'stdout' }));
          }
        });

        proc.stderr.on('data', (data: Buffer) => {
          if (closed) return;
          const lines = data.toString().split('\n').filter(l => l.length > 0);
          if (lines.length > 0) {
            safeSend('log', JSON.stringify({ lines, source: 'stderr' }));
          }
        });

        proc.on('close', () => {
          if (!closed) {
            if (lineBuffer.trim().length > 0) {
              safeSend('log', JSON.stringify({ lines: [lineBuffer.trim()], source: 'stdout' }));
            }
            closed = true;
            try { controller.close(); } catch {}
          }
        });

        // Keepalive every 30s
        const keepalive = setInterval(() => {
          safeSend('ping', JSON.stringify({ ts: Date.now() }));
        }, KEEPALIVE_INTERVAL_MS);

        // Max lifetime: 5 minutes
        const maxLifetime = setTimeout(() => {
          closed = true;
          proc.kill('SIGTERM');
          clearInterval(keepalive);
          try { controller.close(); } catch {}
        }, MAX_STREAM_MS);

        // Client disconnect
        signal.addEventListener('abort', () => {
          closed = true;
          proc.kill('SIGTERM');
          clearInterval(keepalive);
          clearTimeout(maxLifetime);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // Container logs: GET /container-logs?container=NAME&lines=N
  if (method === 'GET' && path === '/container-logs') {
    const authHeader = req.headers.get('X-Deploy-Secret');
    if (authHeader !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const containerName = url.searchParams.get('container');
    const lines = Math.min(Number(url.searchParams.get('lines')) || 200, 1000);

    if (!containerName) {
      return Response.json({ error: 'Missing container parameter' }, { status: 400, headers: corsHeaders });
    }

    // Validate container name format
    if (!/^sdb-app-[a-z0-9-]+$/.test(containerName)) {
      return Response.json({ error: 'Invalid container name' }, { status: 400, headers: corsHeaders });
    }

    try {
      const { execSync } = await import('child_process');
      const output = execSync(
        `incus exec ${containerName} -- journalctl -u signaldb-app -n ${lines} --no-pager -o short-iso 2>&1`,
        { timeout: 10000, encoding: 'utf-8' }
      );
      return Response.json({ stdout: output.trim(), stderr: '', containerName }, { headers: corsHeaders });
    } catch (err: any) {
      const stderr = err.stderr?.toString() || err.message || 'Unknown error';
      return Response.json({ stdout: '', stderr, containerName, error: stderr }, { headers: corsHeaders });
    }
  }

  // Container stop: stop container + socat forwarder
  if (method === 'POST' && path === '/container-stop') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; instanceName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, instanceName } = body;
    if (!containerName || !instanceName) {
      return Response.json({ error: 'containerName and instanceName are required' }, { status: 400, headers: corsHeaders });
    }

    const results: string[] = [];
    const { execSync } = await import('child_process');

    try {
      execSync(`incus stop ${containerName} 2>/dev/null`, { timeout: 60000 });
      results.push(`Stopped container ${containerName}`);
    } catch (err: any) {
      results.push(`Failed to stop container ${containerName}: ${err.message}`);
    }

    try {
      execSync(`sudo systemctl stop socat-app-${instanceName} 2>/dev/null`, { timeout: 10000 });
      results.push(`Stopped socat-app-${instanceName}`);
    } catch {
      results.push(`Socat service socat-app-${instanceName} was not running`);
    }

    console.log(`[container-stop] ${containerName} / ${instanceName}:`, results.join('; '));
    return Response.json({ success: true, results }, { headers: corsHeaders });
  }

  // Container start: start container + socat forwarder + wait for IP
  if (method === 'POST' && path === '/container-start') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; instanceName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, instanceName } = body;
    if (!containerName || !instanceName) {
      return Response.json({ error: 'containerName and instanceName are required' }, { status: 400, headers: corsHeaders });
    }

    const results: string[] = [];
    const { execSync } = await import('child_process');

    try {
      execSync(`incus start ${containerName} 2>/dev/null`, { timeout: 60000 });
      results.push(`Started container ${containerName}`);
    } catch (err: any) {
      return Response.json({ error: `Failed to start container: ${err.message}`, results }, { status: 500, headers: corsHeaders });
    }

    // Wait for container to get an IP (up to 15 seconds)
    let containerIP = '';
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const output = execSync(
          `incus list ${containerName} --format csv -c 4 2>/dev/null`,
          { timeout: 5000, encoding: 'utf-8' }
        ).trim();
        const ipMatch = output.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          containerIP = ipMatch[1];
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }

    if (containerIP) {
      results.push(`Container IP: ${containerIP}`);
      // Verify socat target matches current container IP (fixes IP drift after restart)
      verifySocatTarget(instanceName, containerIP, results);
    } else {
      results.push('Warning: could not detect container IP within 15s');
    }

    try {
      execSync(`sudo systemctl start socat-app-${instanceName} 2>/dev/null`, { timeout: 10000 });
      results.push(`Started socat-app-${instanceName}`);
    } catch {
      results.push(`Socat service socat-app-${instanceName} failed to start or does not exist`);
    }

    console.log(`[container-start] ${containerName} / ${instanceName}:`, results.join('; '));
    return Response.json({ success: true, results, containerIP }, { headers: corsHeaders });
  }

  // Container restart: restart container + socat forwarder + wait for IP
  if (method === 'POST' && path === '/container-restart') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; instanceName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, instanceName } = body;
    if (!containerName || !instanceName) {
      return Response.json({ error: 'containerName and instanceName are required' }, { status: 400, headers: corsHeaders });
    }

    const results: string[] = [];
    const { execSync } = await import('child_process');

    try {
      execSync(`incus restart ${containerName} 2>/dev/null`, { timeout: 60000 });
      results.push(`Restarted container ${containerName}`);
    } catch (err: any) {
      return Response.json({ error: `Failed to restart container: ${err.message}`, results }, { status: 500, headers: corsHeaders });
    }

    // Wait for container to get an IP (up to 15 seconds)
    let containerIP = '';
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const output = execSync(
          `incus list ${containerName} --format csv -c 4 2>/dev/null`,
          { timeout: 5000, encoding: 'utf-8' }
        ).trim();
        const ipMatch = output.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          containerIP = ipMatch[1];
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }

    if (containerIP) {
      results.push(`Container IP: ${containerIP}`);
      // Verify socat target matches current container IP (fixes IP drift after restart)
      verifySocatTarget(instanceName, containerIP, results);
    } else {
      results.push('Warning: could not detect container IP within 15s');
    }

    try {
      execSync(`sudo systemctl restart socat-app-${instanceName} 2>/dev/null`, { timeout: 10000 });
      results.push(`Restarted socat-app-${instanceName}`);
    } catch {
      results.push(`Socat service socat-app-${instanceName} failed to restart or does not exist`);
    }

    console.log(`[container-restart] ${containerName} / ${instanceName}:`, results.join('; '));
    return Response.json({ success: true, results, containerIP }, { headers: corsHeaders });
  }

  // ─── Container Exec (for Scheduler Worker) ─────────────────────────────────
  // Runs a bash command inside an Incus container and returns stdout/stderr.

  if (method === 'POST' && path === '/container-exec') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; command: string; timeoutMs?: number };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, command, timeoutMs } = body;
    if (!containerName || !command) {
      return Response.json({ error: 'containerName and command are required' }, { status: 400, headers: corsHeaders });
    }

    // Validate container name pattern
    if (!CONTAINER_NAME_REGEX.test(containerName)) {
      return Response.json({ error: 'Invalid container name pattern' }, { status: 400, headers: corsHeaders });
    }

    const timeout = Math.min(timeoutMs || 30000, 300000); // Max 5 minutes

    try {
      const result = execSync(
        `incus exec ${containerName} -- bash -c ${JSON.stringify(command)} 2>&1`,
        { timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );
      return Response.json({ exitCode: 0, stdout: result, stderr: '' }, { headers: corsHeaders });
    } catch (err: any) {
      const exitCode = err.status || 1;
      const stdout = (err.stdout || '').toString();
      const stderr = (err.stderr || err.message || '').toString();
      return Response.json({ exitCode, stdout, stderr }, { headers: corsHeaders });
    }
  }

  // ─── MinIO Admin Operations ─────────────────────────────────────────────────
  // These require `mc` CLI (MinIO Client) available on the host, and the MinIO
  // container accessible at 10.34.154.100:9000.

  if (method === 'POST' && path === '/minio/create-org-account') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { orgSlug: string; accessKey: string; secretKey: string; policyName: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    if (!body.orgSlug || !body.accessKey || !body.secretKey || !body.policyName) {
      return Response.json({ error: 'orgSlug, accessKey, secretKey, policyName required' }, { status: 400, headers: corsHeaders });
    }

    try {
      // Create IAM policy scoped to org's bucket prefix
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:*'],
            Resource: [
              `arn:aws:s3:::sdb-${body.orgSlug}-*`,
              `arn:aws:s3:::sdb-${body.orgSlug}-*/*`,
            ],
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListAllMyBuckets', 's3:GetBucketLocation'],
            Resource: ['arn:aws:s3:::*'],
          },
        ],
      });

      // Write policy to temp file on host
      const policyFile = `/tmp/minio-policy-${body.orgSlug}.json`;
      writeFileSync(policyFile, policy);

      // Ensure mc alias exists (use process.env, not shell vars)
      const minioUser = process.env.MINIO_ROOT_USER || 'signaldb-admin';
      const minioPass = process.env.MINIO_ROOT_PASSWORD || '';
      execSync(`incus exec minio -- mc alias set local http://127.0.0.1:9000 ${minioUser} ${minioPass} 2>/dev/null || true`, { timeout: 10000 });

      // Write policy into container via base64 (avoids incus file push UID mapping issues)
      const policyB64 = Buffer.from(policy).toString('base64');
      execSync(`incus exec minio -- bash -c 'echo ${policyB64} | base64 -d > /tmp/minio-policy-${body.orgSlug}.json'`, { timeout: 10000 });
      execSync(`incus exec minio -- mc admin policy create local ${body.policyName} /tmp/minio-policy-${body.orgSlug}.json`, { timeout: 10000 });

      // Create user and attach policy
      execSync(`incus exec minio -- mc admin user add local ${body.accessKey} ${body.secretKey}`, { timeout: 10000 });
      execSync(`incus exec minio -- mc admin policy attach local ${body.policyName} --user ${body.accessKey}`, { timeout: 10000 });

      console.log(`[minio] Created org account for ${body.orgSlug}: ${body.accessKey}`);
      return Response.json({ success: true }, { headers: corsHeaders });
    } catch (err) {
      console.error(`[minio] Failed to create org account for ${body.orgSlug}:`, err);
      return Response.json(
        { error: 'Failed to create MinIO org account', details: err instanceof Error ? err.message : String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (method === 'POST' && path === '/minio/delete-org-account') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { orgSlug: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    if (!body.orgSlug) {
      return Response.json({ error: 'orgSlug required' }, { status: 400, headers: corsHeaders });
    }

    try {
      const policyName = `sdb-policy-${body.orgSlug}`;

      // List and remove users with the org prefix
      try {
        const usersOutput = execSync(`incus exec minio -- mc admin user list local --json 2>/dev/null || echo '[]'`, { timeout: 10000 }).toString();
        // Try to find users starting with sdb_{orgSlug}_
        const prefix = `sdb_${body.orgSlug}_`;
        for (const line of usersOutput.split('\n')) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.accessKey && parsed.accessKey.startsWith(prefix)) {
              execSync(`incus exec minio -- mc admin user remove local ${parsed.accessKey}`, { timeout: 10000 });
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      } catch {
        // Non-fatal: user might not exist
      }

      // Remove policy
      try {
        execSync(`incus exec minio -- mc admin policy remove local ${policyName}`, { timeout: 10000 });
      } catch {
        // Non-fatal: policy might not exist
      }

      console.log(`[minio] Deleted org account for ${body.orgSlug}`);
      return Response.json({ success: true }, { headers: corsHeaders });
    } catch (err) {
      console.error(`[minio] Failed to delete org account for ${body.orgSlug}:`, err);
      return Response.json(
        { error: 'Failed to delete MinIO org account', details: err instanceof Error ? err.message : String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Dev Container — Lazy ensure (create if not exists)
  // -------------------------------------------------------------------------
  if (method === 'POST' && path === '/dev-container/ensure') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${DEPLOY_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; userId: string; gitRepo?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, userId, gitRepo } = body;
    if (!containerName || !userId) {
      return Response.json({ error: 'Missing containerName or userId' }, { status: 400, headers: corsHeaders });
    }

    // Validate container name pattern
    if (!/^sdb-dev-[a-z0-9-]+$/.test(containerName)) {
      return Response.json({ error: 'Invalid dev container name' }, { status: 400, headers: corsHeaders });
    }

    // Prevent concurrent ensure operations on the same container (race condition protection)
    if (devContainerLocks.has(containerName)) {
      console.log(`[dev-container] Already creating ${containerName}, waiting...`);
      try {
        await devContainerLocks.get(containerName);
        // Creation finished, return ready
        const ip = await incus.getContainerIP(containerName);
        return Response.json({ status: 'ready', ip, containerName }, { headers: corsHeaders });
      } catch (err) {
        return Response.json(
          { error: 'Concurrent creation failed', details: err instanceof Error ? err.message : String(err) },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    try {
      const exists = await incus.containerExists(containerName);

      if (exists) {
        // Ensure it's running
        const status = await incus.getContainerStatus(containerName);
        if (status !== 'RUNNING' && status !== 'Running') {
          console.log(`[dev-container] Starting stopped container: ${containerName}`);
          await incus.startContainer(containerName, (line) => console.log(line));
          // Wait for IP
          let ip: string | null = null;
          for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            ip = await incus.getContainerIP(containerName);
            if (ip) break;
          }
        }
        const ip = await incus.getContainerIP(containerName);
        console.log(`[dev-container] Already exists: ${containerName} (ip=${ip})`);
        return Response.json({ status: 'ready', ip, containerName }, { headers: corsHeaders });
      }

      // Create new dev container from golden image — wrapped in lock
      const createPromise = (async () => {
        console.log(`[dev-container] Creating: ${containerName}`);

        // Use bun-server golden image (has Bun pre-installed)
        const goldenImage = incus.goldenImageAlias('bun-server');

        // Check if golden image exists, fall back to Ubuntu if not
        const hasImage = await incus.imageExists(goldenImage);
        const fromImage = hasImage ? goldenImage : 'ubuntu:22.04';

        // NOTE: Don't pass network: 'incusbr0' — default profile already includes it,
        // and the --network flag causes incus launch to hang indefinitely.
        await incus.createContainer(containerName, fromImage, {
          profile: 'sdb-app-hobbyist', // 1 CPU, 1GB RAM
        }, (line) => console.log(line));

        // Start the container (createContainer uses init, not launch)
        await incus.startContainer(containerName, (line) => console.log(line));

        // Wait for container to get an IP
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 1000));
          const containerIP = await incus.getContainerIP(containerName);
          if (containerIP) break;
        }

        // Install tmux inside the container (may already be in golden image)
        console.log(`[dev-container] Installing tmux in ${containerName}`);
        await incus.execInContainer(containerName, ['bash', '-c', 'apt-get update -qq && apt-get install -y -qq tmux git'], undefined, 120000);

        // Ensure app user exists (golden images have it, Ubuntu base does not)
        await incus.execInContainer(containerName, ['bash', '-c', 'id app 2>/dev/null || useradd -m -s /bin/bash app']);

        // Fix bun: golden images symlink /usr/local/bin/bun -> /root/.bun/bin/bun
        // which the app user can't traverse. Copy the actual binary instead.
        console.log(`[dev-container] Setting up bun + node + claude in ${containerName}`);
        await incus.execInContainer(containerName, ['bash', '-c', [
          // Copy bun binary (replaces symlink that points to /root/.bun/)
          'BUNPATH=$(readlink -f /usr/local/bin/bun 2>/dev/null || echo /root/.bun/bin/bun)',
          'rm -f /usr/local/bin/bun',
          'cp "$BUNPATH" /usr/local/bin/bun',
          'chmod 755 /usr/local/bin/bun',
          // Symlink node -> bun (Claude CLI needs node in PATH)
          'ln -sf /usr/local/bin/bun /usr/local/bin/node',
        ].join(' && ')]);

        // Install Claude CLI for app user
        await incus.execInContainer(containerName, [
          'su', '-l', 'app', '-c', 'bun install -g @anthropic-ai/claude-code',
        ], undefined, 120000);

        // Add bun global bin to app user's PATH
        await incus.execInContainer(containerName, ['bash', '-c', [
          'grep -q ".bun/bin" /home/app/.profile 2>/dev/null || echo \'export PATH=/home/app/.bun/bin:$PATH\' >> /home/app/.profile',
          'grep -q ".bun/bin" /home/app/.bashrc 2>/dev/null || echo \'export PATH=/home/app/.bun/bin:$PATH\' >> /home/app/.bashrc',
        ].join(' && ')]);

        // Clone git repo if provided
        if (gitRepo) {
          console.log(`[dev-container] Cloning ${gitRepo} into ${containerName}:/home/app/project`);
          await incus.execInContainer(containerName, [
            'su', '-l', 'app', '-c', `git clone ${gitRepo} /home/app/project`,
          ], undefined, 120000);
        }
      })();

      devContainerLocks.set(containerName, createPromise);
      try {
        await createPromise;
      } finally {
        devContainerLocks.delete(containerName);
      }

      const ip = await incus.getContainerIP(containerName);
      if (!ip) {
        console.warn(`[dev-container] Container ${containerName} started but no IP assigned`);
      }
      console.log(`[dev-container] Created: ${containerName} (ip=${ip})`);
      return Response.json({ status: 'created', ip, containerName }, { headers: corsHeaders });
    } catch (err) {
      devContainerLocks.delete(containerName);
      console.error(`[dev-container] Failed to ensure ${containerName}:`, err);
      return Response.json(
        { error: 'Failed to ensure dev container', details: err instanceof Error ? err.message : String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Dev Access — SSH key generation + authorized_keys management
  // -------------------------------------------------------------------------

  if (method === 'POST' && path === '/dev-access/generate') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { containerName: string; orgSlug: string; appSlug: string; envName: string; keyName?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { containerName, orgSlug, appSlug, envName, keyName } = body;
    if (!containerName || !orgSlug || !appSlug || !envName) {
      return Response.json({ error: 'Missing required fields: containerName, orgSlug, appSlug, envName' }, { status: 400, headers: corsHeaders });
    }

    try {
      // 1. Resolve the host app directory
      const { appDir } = computeAppDir(orgSlug, appSlug, envName);
      const safeKeyName = (keyName || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

      // 2. Ensure org user exists with SSH dir
      const orgUsername = await ensureOrgUser(orgSlug, (line) => console.log(`[dev-access] ${line}`));

      // 3. Generate ED25519 keypair in temp location
      const keyId = crypto.randomUUID();
      const tmpKeyPath = `/tmp/sdb-devkey-${keyId}`;
      const keyComment = `sdb-dev-${orgSlug}-${appSlug}-${safeKeyName}`;

      const genResult = await exec('ssh-keygen', ['-t', 'ed25519', '-f', tmpKeyPath, '-N', '', '-C', keyComment], '/');
      if (genResult.code !== 0) {
        throw new Error(`ssh-keygen failed: ${genResult.stderr}`);
      }

      // 4. Read the generated keys
      const privateKey = readFileSync(tmpKeyPath, 'utf-8');
      const publicKey = readFileSync(`${tmpKeyPath}.pub`, 'utf-8').trim();

      // 5. Compute fingerprint
      const fpResult = await exec('ssh-keygen', ['-lf', `${tmpKeyPath}.pub`], '/');
      // Output format: "256 SHA256:xxxx comment (ED25519)"
      const fingerprint = fpResult.stdout.trim().split(/\s+/)[1] || '';

      // 6. Build authorized_keys entry for the org user
      const gatewayScript = '/opt/signaldb/scripts/ssh-gateway.sh';
      const authEntry = `# sdb-dev:${keyId}\ncommand="${gatewayScript} ${containerName} ${orgSlug} ${appSlug} ${appDir}",restrict,pty ${publicKey}`;

      // 7. Append to org user's authorized_keys (via sudo since deploy != org user)
      const orgAuthKeysPath = `/home/${orgUsername}/.ssh/authorized_keys`;
      const readResult = await exec('sudo', ['cat', orgAuthKeysPath], '/');
      const existing = readResult.code === 0 ? readResult.stdout : '';
      const newContent = existing.trimEnd() + '\n' + authEntry + '\n';
      // Write via sudo tee (deploy user can't write to org user's home directly)
      const writeResult = await exec('sudo', ['bash', '-c', `cat > ${orgAuthKeysPath} << 'AUTHEOF'\n${newContent}\nAUTHEOF`], '/');
      if (writeResult.code !== 0) {
        throw new Error(`Failed to write authorized_keys for ${orgUsername}: ${writeResult.stderr}`);
      }
      await exec('sudo', ['chown', `${orgUsername}:${orgUsername}`, orgAuthKeysPath], '/');
      await exec('sudo', ['chmod', '600', orgAuthKeysPath], '/');

      // 8. Initialize bare git repo if it doesn't exist
      const bareRepoDir = join(APPS_BASE_DIR, '.git-bare', orgSlug);
      const bareRepoPath = join(bareRepoDir, `${appSlug}.git`);

      if (!existsSync(bareRepoPath)) {
        mkdirSync(bareRepoDir, { recursive: true });
        await execAsUser(orgUsername, 'git', ['init', '--bare', bareRepoPath], '/');

        // Write post-receive hook — embed DEPLOY_SECRET directly (dir is 750, owned by org user)
        const hookPath = join(bareRepoPath, 'hooks', 'post-receive');
        const hookContent = `#!/bin/bash
# Auto-deploy on git push — generated by SignalDB dev-access
set -euo pipefail
APP_DIR="${appDir}"
CONTAINER="${containerName}"
ORG="${orgSlug}"
APP="${appSlug}"
DEPLOY_SECRET="${DEPLOY_SECRET || ''}"

echo ">>> Checking out to \$APP_DIR..."
GIT_WORK_TREE="\$APP_DIR" git checkout -f

echo ">>> Triggering deployment..."
curl -s -X POST http://127.0.0.1:4100/deploy \\
  -H "Content-Type: application/json" \\
  -H "X-Deploy-Secret: \$DEPLOY_SECRET" \\
  -d "{\\"deploymentId\\":\\"git-push-\$(date +%s)\\",\\"callbackUrl\\":\\"http://127.0.0.1:4100/health\\",\\"appSlug\\":\\"\$APP\\",\\"orgSlug\\":\\"\$ORG\\",\\"envName\\":\\"production\\",\\"port\\":3000,\\"containerName\\":\\"\$CONTAINER\\",\\"deploymentMode\\":\\"container\\",\\"skipGit\\":true}"

echo ">>> Deploy triggered. Check status in console."
`;
        writeFileSync(hookPath, hookContent);
        chmodSync(hookPath, '755');

        // Chown bare repo to org user
        await chownToOrgUser(orgUsername, bareRepoPath);
      }

      // 9. If app dir has no .git, init + push to bare
      if (existsSync(appDir) && !existsSync(join(appDir, '.git'))) {
        await execAsUser(orgUsername, 'git', ['init'], appDir);
        await execAsUser(orgUsername, 'git', ['add', '-A'], appDir);
        await execAsUser(orgUsername, 'git', ['commit', '-m', 'Initial commit from dev-access setup', '--allow-empty'], appDir);
        await execAsUser(orgUsername, 'git', ['remote', 'add', 'origin', bareRepoPath], appDir);
        await execAsUser(orgUsername, 'git', ['push', '-u', 'origin', 'HEAD'], appDir);
      } else if (existsSync(appDir) && existsSync(join(appDir, '.git'))) {
        // Ensure bare repo is set as remote
        const remoteResult = await execAsUser(orgUsername, 'git', ['remote', 'get-url', 'origin'], appDir);
        if (remoteResult.code !== 0) {
          await execAsUser(orgUsername, 'git', ['remote', 'add', 'origin', bareRepoPath], appDir);
          await execAsUser(orgUsername, 'git', ['push', '-u', 'origin', 'HEAD'], appDir);
        }
      }

      // 10. Clean up temp key files
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(tmpKeyPath);
        unlinkSync(`${tmpKeyPath}.pub`);
      } catch {}

      console.log(`[dev-access] Generated key for ${containerName} (user: ${orgUsername}): fingerprint=${fingerprint}, keyName=${safeKeyName}`);

      return Response.json({
        privateKey,
        publicKey,
        fingerprint,
        appDir,
        keyId,
        orgUsername,
      }, { headers: corsHeaders });
    } catch (err) {
      console.error('[dev-access] Generate failed:', err);
      return Response.json(
        { error: 'Failed to generate SSH key', details: err instanceof Error ? err.message : String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (method === 'POST' && path === '/dev-access/revoke') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: { fingerprint: string; orgSlug?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const { fingerprint, orgSlug } = body;
    if (!fingerprint) {
      return Response.json({ error: 'Missing fingerprint' }, { status: 400, headers: corsHeaders });
    }
    if (!orgSlug) {
      return Response.json({ error: 'Missing orgSlug' }, { status: 400, headers: corsHeaders });
    }

    try {
      // Read from org user's authorized_keys (not deploy's)
      const orgUsername = getOrgUsername(orgSlug);
      const authKeysPath = `/home/${orgUsername}/.ssh/authorized_keys`;

      const readResult = await exec('sudo', ['cat', authKeysPath], '/');
      if (readResult.code !== 0) {
        return Response.json({ success: true, message: 'No authorized_keys file' }, { headers: corsHeaders });
      }

      const content = readResult.stdout;
      const lines = content.split('\n');
      const filtered: string[] = [];
      let skipNext = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for sdb-dev comment line that precedes the key
        if (line.startsWith('# sdb-dev:') && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // Extract the public key from the authorized_keys entry (after restrict,pty)
          const pubKeyMatch = nextLine.match(/ssh-ed25519\s+\S+/);
          if (pubKeyMatch) {
            // Write the pub key to a temp file and check fingerprint
            const tmpPub = `/tmp/sdb-fp-check-${crypto.randomUUID()}.pub`;
            writeFileSync(tmpPub, pubKeyMatch[0] + ' check\n');
            const fpCheck = await exec('ssh-keygen', ['-lf', tmpPub], '/');
            try { const { unlinkSync } = await import('fs'); unlinkSync(tmpPub); } catch {}
            const fpValue = fpCheck.stdout.trim().split(/\s+/)[1] || '';
            if (fpValue === fingerprint) {
              skipNext = true;
              console.log(`[dev-access] Revoking key with fingerprint: ${fingerprint} for user ${orgUsername}`);
              continue; // Skip comment line
            }
          }
        }
        if (skipNext) {
          skipNext = false;
          continue; // Skip key line
        }
        filtered.push(line);
      }

      // Write back via sudo
      const newContent = filtered.join('\n');
      const writeResult = await exec('sudo', ['bash', '-c', `cat > ${authKeysPath} << 'AUTHEOF'\n${newContent}\nAUTHEOF`], '/');
      if (writeResult.code !== 0) {
        throw new Error(`Failed to write authorized_keys for ${orgUsername}: ${writeResult.stderr}`);
      }
      await exec('sudo', ['chown', `${orgUsername}:${orgUsername}`, authKeysPath], '/');
      await exec('sudo', ['chmod', '600', authKeysPath], '/');

      console.log(`[dev-access] Revoked key: fingerprint=${fingerprint}, user=${orgUsername}`);

      return Response.json({ success: true }, { headers: corsHeaders });
    } catch (err) {
      console.error('[dev-access] Revoke failed:', err);
      return Response.json(
        { error: 'Failed to revoke key', details: err instanceof Error ? err.message : String(err) },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // -------------------------------------------------------------------------
  // WebSocket Terminal - upgrade request
  // -------------------------------------------------------------------------
  if (method === 'GET' && path === '/terminal') {
    const upgrade = req.headers.get('Upgrade');
    if (upgrade?.toLowerCase() !== 'websocket') {
      return Response.json(
        { error: 'WebSocket upgrade required' },
        { status: 426, headers: corsHeaders }
      );
    }

    const token = url.searchParams.get('token');
    if (!token) {
      return Response.json(
        { error: 'Missing token parameter' },
        { status: 401, headers: corsHeaders }
      );
    }

    const payload = verifyTerminalToken(token);
    if (!payload) {
      return Response.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const isOrbstack = payload.backend === 'orbstack';
    const VM_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;

    if (isOrbstack) {
      // OrbStack backend: validate VM name
      if (!payload.vmName || !VM_NAME_REGEX.test(payload.vmName)) {
        return Response.json(
          { error: 'Invalid VM name' },
          { status: 400, headers: corsHeaders }
        );
      }
      // No incus container check needed — OrbStack VMs are always running
    } else {
      // Incus backend: existing validation
      if (!CONTAINER_NAME_REGEX.test(payload.containerName)) {
        return Response.json(
          { error: 'Invalid container name' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify container is running (use exact name match to avoid substring matches)
      try {
        const output = execSync(
          `incus list --format csv -c ns | grep "^${payload.containerName},"`,
          { timeout: 5000, encoding: 'utf-8' }
        ).trim();
        const status = output.split(',')[1];
        if (status !== 'RUNNING') {
          return Response.json(
            { error: `Container is not running (status: ${status})` },
            { status: 409, headers: corsHeaders }
          );
        }
      } catch {
        return Response.json(
          { error: 'Failed to check container status' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Check concurrent session limit
    if (countTerminalSessions(payload.containerName) >= MAX_TERMINAL_SESSIONS_PER_CONTAINER) {
      return Response.json(
        { error: 'Too many terminal sessions for this container (max 2)' },
        { status: 429, headers: corsHeaders }
      );
    }

    // Upgrade to WebSocket (pass initial terminal size from query params)
    const sessionId = crypto.randomUUID();
    const initialCols = Math.max(1, Math.min(500, parseInt(url.searchParams.get('cols') || '80') || 80));
    const initialRows = Math.max(1, Math.min(200, parseInt(url.searchParams.get('rows') || '24') || 24));
    if (!server.upgrade(req, { data: { sessionId, ...payload, initialCols, initialRows } })) {
      return Response.json(
        { error: 'WebSocket upgrade failed' },
        { status: 500, headers: corsHeaders }
      );
    }
    return undefined as any; // Bun handles the response after upgrade
  }

  // 404 for unknown routes
  return Response.json(
    { error: 'Not found' },
    { status: 404, headers: corsHeaders }
  );
}

// Start server
console.log(`
╔═══════════════════════════════════════════════════════════╗
║           SignalDB Connect - Deploy Agent                 ║
╠═══════════════════════════════════════════════════════════╣
║  Port:     ${AGENT_PORT}                                         ║
║  Base Dir: ${APPS_BASE_DIR.padEnd(42)}║
║  Secret:   ${DEPLOY_SECRET.slice(0, 8)}...                                     ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    POST /deploy            - Execute deployment            ║
║    GET  /health            - Agent health check            ║
║    GET  /status/:id        - Deployment status             ║
║    POST /clone-container   - ZFS clone + socat setup       ║
║    POST /cleanup           - Container + socat removal     ║
║    POST /promote-swap      - Update socat target IP        ║
║    POST /snapshot-restore  - Incus snapshot rollback       ║
║    POST /push-env          - Push .env + restart app       ║
║    POST /container-stop    - Stop container + socat        ║
║    POST /container-start   - Start container + socat       ║
║    POST /container-restart - Restart container + socat     ║
║    GET  /container-logs    - Fetch container journal logs   ║
║    GET  /container-logs/stream - SSE stream container logs  ║
║    POST /minio/create-org-account - Create MinIO org user  ║
║    POST /minio/delete-org-account - Delete MinIO org user  ║
║    POST /dev-container/ensure    - Lazy dev container      ║
║    WS   /terminal              - Browser terminal (PTY)   ║
╠═══════════════════════════════════════════════════════════╣
║  Supported Frameworks:                                    ║
║    bun-server, react-router, nextjs, sveltekit, hono     ║
╠═══════════════════════════════════════════════════════════╣
║  Directory Convention:                                    ║
║    Monorepo:   {base}/{org}/{app}/ (signaldb.yaml)       ║
║    Legacy:     {base}/{org}-{app}[-{env}]                ║
║  Config: signaldb.yaml > FRAMEWORK_CONFIGS defaults       ║
╚═══════════════════════════════════════════════════════════╝
`);

const server = Bun.serve({
  port: AGENT_PORT,
  fetch: handleRequest,
  websocket: {
    open(ws) {
      const { sessionId, containerName, initialCols, initialRows, backend, vmName, workDir, apps } = ws.data as any;
      const isOrbstack = backend === 'orbstack';
      console.log(`[terminal] WebSocket opened: session=${sessionId}, container=${containerName}, backend=${backend || 'incus'}, size=${initialCols}x${initialRows}${isOrbstack ? `, vm=${vmName}` : ''}`);

      try {
        // Use Unix domain socket between us and socat to avoid Bun's broken
        // pipe ReadableStream. Both Bun.spawn stdout pipes and Node.js compat
        // child_process.spawn stdout .on('data') stop delivering data after
        // the initial burst. Bun's socket layer (used for HTTP/WS) is reliable.
        const cols = Math.max(1, Math.min(500, initialCols || 80));
        const rows = Math.max(1, Math.min(200, initialRows || 24));
        const sockPath = `/tmp/signaldb-term-${sessionId}.sock`;

        // Track state for async socket connection
        let ptySocket: any = null;
        let dataChunkCount = 0;

        // 1. Create Unix socket server — socat will connect to this
        const unixServer = Bun.listen({
          unix: sockPath,
          socket: {
            open(socket) {
              ptySocket = socket;
              // Update session with the connected socket
              const session = terminalSessions.get(sessionId);
              if (session) {
                session.ptySocket = socket;
              }
              console.log(`[terminal] socat connected via Unix socket: session=${sessionId}`);
              // Now we can tell the browser we're connected
              try {
                ws.send(JSON.stringify({ type: 'connected', sessionId }));
              } catch {}

              // Initial resize: socat PTY defaults to 80x24.
              // Client also sends resize on 'connected' event as a fallback.
              if (proc.pid && (cols !== 80 || rows !== 24)) {
                setTimeout(() => {
                  const ok = isOrbstack
                    ? resizeTerminalOuter(proc.pid, rows, cols)
                    : resizeTerminal(proc.pid, containerName, rows, cols);
                  console.log(`[terminal] Initial resize ${cols}x${rows}: ${ok ? 'ok' : 'failed'}`);
                }, 500);
              }
            },
            data(socket, data) {
              // Forward PTY output to WebSocket as binary
              // Filter DECRQM sequences that crash xterm.js 6.0.0's requestMode handler
              dataChunkCount++;
              if (dataChunkCount <= 3 || dataChunkCount % 500 === 0) {
                console.log(`[terminal] pty→ws #${dataChunkCount}: ${data.byteLength}b`);
              }
              if (ws.readyState <= 1) {
                const filtered = filterModeRequests(data);
                if (filtered.byteLength > 0) {
                  ws.sendBinary(filtered);
                }
              }
            },
            close(socket) {
              console.log(`[terminal] Unix socket closed: session=${sessionId} after ${dataChunkCount} chunks`);
              cleanupTerminalSession(sessionId);
            },
            error(socket, err) {
              console.log(`[terminal] Unix socket error: session=${sessionId}: ${err}`);
            },
          },
        });

        // 2. Spawn socat with PTY — command depends on backend
        let execCmd: string;
        if (isOrbstack) {
          // OrbStack: SSH → Mac Studio → SSH dev@VM@orb → provision → tmux
          const appsB64 = Buffer.from(JSON.stringify(apps || [])).toString('base64');
          execCmd = `/opt/signaldb/scripts/orbstack-terminal.sh ${vmName} ${workDir || '/home/dev'} ${cols} ${rows} ${appsB64}`;
        } else if (containerName.startsWith('sdb-dev-')) {
          // Incus dev containers: tmux for session persistence
          execCmd = `incus exec --force-interactive --env TERM=screen-256color --env COLUMNS=${cols} --env LINES=${rows} ${containerName} -- su -l app -c 'tmux new-session -A -s main'`;
        } else {
          // Incus app containers: plain bash (existing behavior)
          execCmd = `incus exec --force-interactive --env TERM=screen-256color --env COLUMNS=${cols} --env LINES=${rows} ${containerName} -- bash -c 'stty rows ${rows} cols ${cols} 2>/dev/null; exec su -l app'`;
        }
        const proc = Bun.spawn(['socat', `UNIX-CONNECT:${sockPath}`, `EXEC:"${execCmd}",pty,setsid,ctty,raw,echo=0`], {
          stdout: 'inherit', // socat's own diagnostic output (not terminal data)
          stderr: 'inherit',
        });

        console.log(`[terminal] Spawned socat→Unix socket: pid=${proc.pid}, backend=${backend || 'incus'}, size=${cols}x${rows}, sock=${sockPath}`);

        // 2b. Initial PTY resize handled in two places:
        // - Unix socket open handler (800ms after connect) for immediate sizing
        // - Client sends resize on 'connected' WebSocket event for reliable sizing
        // No retry timers needed — stty on the pts slave device works immediately.

        // 3. Monitor process exit
        proc.exited.then((exitCode) => {
          console.log(`[terminal] socat exited: session=${sessionId}, code=${exitCode}`);
          try {
            ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
          } catch {}
          cleanupTerminalSession(sessionId);
        });

        // 4. Set up timeouts (dev/orbstack get longer timeouts)
        const isDevSession = isOrbstack || containerName.startsWith('sdb-dev-');
        const hardTimeoutMs = isDevSession ? 4 * 60 * 60 * 1000 : TERMINAL_HARD_TIMEOUT_MS; // 4h vs 30min
        const idleTimeoutMs = isDevSession ? 60 * 60 * 1000 : TERMINAL_IDLE_TIMEOUT_MS; // 1h vs 10min
        const hardTimer = setTimeout(() => {
          console.log(`[terminal] Session ${sessionId} hard timeout (${isDevSession ? '4h' : '30min'})`);
          try {
            ws.send(JSON.stringify({ type: 'timeout', reason: 'hard_limit' }));
          } catch {}
          cleanupTerminalSession(sessionId);
        }, hardTimeoutMs);

        const idleTimer = setTimeout(() => {
          console.log(`[terminal] Session ${sessionId} idle timeout`);
          try {
            ws.send(JSON.stringify({ type: 'timeout', reason: 'idle' }));
          } catch {}
          cleanupTerminalSession(sessionId);
        }, idleTimeoutMs);

        // 5. Create session (ptySocket will be set when socat connects)
        const session: TerminalSession = {
          id: sessionId,
          containerName,
          backend: isOrbstack ? 'orbstack' : 'incus',
          proc,
          ptySocket: null, // Set when socat connects to our Unix socket
          unixServer,
          sockPath,
          ws,
          hardTimer,
          idleTimer,
          createdAt: new Date(),
        };
        terminalSessions.set(sessionId, session);

      } catch (err) {
        console.error(`[terminal] Failed to spawn shell for ${containerName}:`, err);
        ws.send(JSON.stringify({
          type: 'error',
          message: `Failed to start terminal: ${err instanceof Error ? err.message : String(err)}`,
        }));
        ws.close(1011, 'Shell spawn failed');
      }
    },

    message(ws, message) {
      const { sessionId } = ws.data as any;
      const session = terminalSessions.get(sessionId);
      if (!session || !session.ptySocket) return;

      resetIdleTimer(sessionId);

      try {
        if (typeof message === 'string') {
          // JSON control messages always start with '{'
          if (message.charAt(0) === '{') {
            try {
              const ctrl = JSON.parse(message);
              if (ctrl && typeof ctrl === 'object' && ctrl.type === 'resize') {
                const newCols = Math.max(1, Math.min(500, ctrl.cols || 80));
                const newRows = Math.max(1, Math.min(200, ctrl.rows || 24));
                const session = terminalSessions.get(sessionId);
                if (session?.proc?.pid) {
                  // Debounce: CSS transitions fire many resize events during animation
                  if ((session as any)._resizeTimer) clearTimeout((session as any)._resizeTimer);
                  (session as any)._resizeTimer = setTimeout(() => {
                    const ok = session.backend === 'orbstack'
                      ? resizeTerminalOuter(session.proc.pid, newRows, newCols)
                      : resizeTerminal(session.proc.pid, session.containerName, newRows, newCols);
                    console.log(`[terminal] Resize ${newCols}x${newRows}: ${ok ? 'ok' : 'failed'}`);
                  }, 150);
                }
                return;
              }
            } catch {
              // Not valid JSON despite starting with '{' — fall through to stdin
            }
          }
          // Terminal input — write to Unix socket (socat forwards to PTY)
          const buf = Buffer.from(message, 'binary');
          session.ptySocket.write(buf);
        } else {
          // Binary frame = terminal input (mouse reports etc from onBinary)
          const buf = Buffer.from(message as ArrayBuffer);
          session.ptySocket.write(buf);
        }
      } catch (err) {
        console.error(`[terminal] Error writing to pty socket: ${err}`);
      }
    },

    close(ws) {
      const { sessionId } = ws.data as any;
      console.log(`[terminal] WebSocket closed: session=${sessionId}`);
      cleanupTerminalSession(sessionId);
    },
  },
});

// Recover stale deployments on startup (non-blocking)
recoverStaleDeployments();
