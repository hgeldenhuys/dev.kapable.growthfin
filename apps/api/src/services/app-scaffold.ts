/**
 * App Scaffold Service
 *
 * Creates app directories on the server from templates.
 * Called when a user creates an app with source='template'.
 *
 * Two layout modes:
 *   - Monorepo (default for template apps):
 *     /opt/signaldb/user-apps/{orgSlug}/
 *       signaldb.yaml (multi-app config)
 *       {appSlug}/     (app subdirectory)
 *
 *   - Legacy (git-imported / existing apps):
 *     /opt/signaldb/user-apps/{org}-{app}[-{env}]
 *
 * Steps:
 *   1. Ensure org-level git repo exists
 *   2. Create app subdirectory with template files
 *   3. Update root signaldb.yaml with new app entry
 *   4. git add + git commit
 *   5. bun install
 */

import { sql } from '../lib/db';
import {
  generateTemplate,
  type Framework,
  generateClaudeMdContent,
  getAgentMemory,
  getAgentRoles,
  getFrameworkSkills,
} from './app-templates';
import {
  generateSignalDBYaml,
  addAppToYaml,
  parseSignalDBConfig,
} from './signaldb-config';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, lstatSync } from 'fs';
import { join, dirname } from 'path';
import crypto from 'crypto';

const APPS_BASE_DIR = process.env.APPS_BASE_DIR || '/opt/signaldb/user-apps';
import { requireEnv } from '../lib/require-env';
import { checkEnvironmentReadiness } from '../routes/deployment-api';
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

interface ScaffoldOptions {
  orgSlug: string;
  appSlug: string;
  appName: string;
  envName: string;
  framework: Framework;
  port?: number;
  projectId?: string;  // Linked project for env vars
  directoryLayout?: 'monorepo' | 'legacy';
}

interface ScaffoldResult {
  success: boolean;
  appDir: string;
  buildDir?: string;  // Subdirectory for monorepo mode
  error?: string;
  logs: string;
}

/**
 * Execute a shell command and capture output
 */
function exec(
  cmd: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.bun/bin:/usr/local/bin:${process.env.PATH}`,
        ...extraEnv,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
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
 * Compute the app directory path (legacy layout)
 */
export function computeAppDir(orgSlug: string, appSlug: string, envName: string): string {
  if (envName === 'production') {
    return join(APPS_BASE_DIR, `${orgSlug}-${appSlug}`);
  }
  return join(APPS_BASE_DIR, `${orgSlug}-${appSlug}-${envName}`);
}

/**
 * Compute the org repo directory (monorepo layout)
 */
export function computeOrgRepoDir(orgSlug: string): string {
  return join(APPS_BASE_DIR, orgSlug);
}

/**
 * Ensure the org-level git repo exists.
 * Creates it with an initial signaldb.yaml if missing.
 */
async function ensureOrgRepo(
  orgSlug: string,
  log: (msg: string) => void,
): Promise<string> {
  const orgDir = computeOrgRepoDir(orgSlug);

  if (existsSync(join(orgDir, '.git'))) {
    log(`Org repo already exists: ${orgDir}`);
    return orgDir;
  }

  log(`Creating org repo: ${orgDir}`);
  mkdirSync(orgDir, { recursive: true });

  // Write initial empty multi-app signaldb.yaml
  const initialYaml = generateSignalDBYaml([
    // Empty apps list — will be populated when first app is added
    // Use a placeholder that will be replaced by addAppToYaml
  ]);
  // Since generateSignalDBYaml needs at least one app, write a minimal version manually
  writeFileSync(join(orgDir, 'signaldb.yaml'), 'version: 1\napps: {}\n');

  // git init + initial commit
  const gitInit = await exec('git', ['init'], orgDir);
  if (gitInit.code !== 0) {
    log(`Warning: git init failed: ${gitInit.stderr}`);
  }

  const gitAdd = await exec('git', ['add', '.'], orgDir);
  if (gitAdd.code !== 0) {
    log(`Warning: git add failed: ${gitAdd.stderr}`);
  }

  const gitCommit = await exec('git', ['commit', '-m', 'Initialize org repo'], orgDir);
  if (gitCommit.code !== 0) {
    log(`Warning: git commit failed: ${gitCommit.stderr}`);
  } else {
    log('Org git repo initialized');
  }

  return orgDir;
}

/**
 * Get per-project credentials for env var injection
 */
async function getProjectEnvVars(projectId: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  try {
    // Get project database info with per-project user COALESCE
    const result = await sql`
      SELECT
        pd.database_name,
        pd.schema_name,
        COALESCE(pd.project_user, di.postgres_user) as username,
        COALESCE(
          pgp_sym_decrypt(decode(pd.project_password_encrypted, 'hex'), ${ENCRYPTION_KEY}),
          pgp_sym_decrypt(decode(di.postgres_password_encrypted, 'hex'), ${ENCRYPTION_KEY})
        ) as password,
        s.host as server_host,
        di.port as db_port,
        di.tier
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      JOIN servers s ON s.id = di.server_id
      WHERE pd.project_id = ${projectId}
    `;

    if (result.length > 0) {
      const info = result[0];
      // Use 127.0.0.1 for same-server connections
      const host = '127.0.0.1';
      const dbName = info.database_name || 'signaldb';
      vars.DATABASE_URL = `postgresql://${info.username}:${info.password}@${host}:${info.db_port}/${dbName}`;
    }

    // Get an active API key for the project
    const keyResult = await sql`
      SELECT key_prefix FROM api_keys
      WHERE project_id = ${projectId}
        AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (keyResult.length > 0) {
      // Note: We can't recover the full key from hash, but prefix identifies it
      vars.SIGNALDB_API_KEY = keyResult[0].key_prefix + '...';
    }
  } catch (err) {
    console.error('[scaffold] Failed to get project env vars:', err);
  }

  return vars;
}

/**
 * Ensure org, app, and environment records exist in the platform DB.
 * This prevents "ghost infrastructure" where apps exist on disk but can't
 * be found by the API routing layer.
 */
async function ensurePlatformRecords(
  orgSlug: string,
  appSlug: string,
  appName: string,
  framework: string,
  port: number,
  log: (msg: string) => void,
  options?: { skipAuth?: boolean },
): Promise<void> {
  try {
    // 1. Ensure org exists
    let orgRows = await sql`SELECT id, plan FROM organizations WHERE slug = ${orgSlug}`;
    let orgId: string;
    let orgPlan = 'hobbyist';
    if (orgRows.length === 0) {
      const newId = crypto.randomUUID();
      const result = await sql`INSERT INTO organizations (id, name, slug, subdomain) VALUES (${newId}, ${orgSlug}, ${orgSlug}, ${orgSlug}) RETURNING id`;
      orgId = result[0].id;
      log(`Created organization record: ${orgSlug} (${orgId})`);
    } else {
      orgId = orgRows[0].id;
      orgPlan = orgRows[0].plan || 'hobbyist';
      log(`Organization exists: ${orgSlug} (${orgId})`);
    }

    // 2. Ensure app exists
    let appRows = await sql`SELECT id FROM apps WHERE org_id = ${orgId} AND slug = ${appSlug}`;
    let appId: string;
    if (appRows.length === 0) {
      const newId = crypto.randomUUID();
      const result = await sql`INSERT INTO apps (id, org_id, name, slug, framework) VALUES (${newId}, ${orgId}, ${appName}, ${appSlug}, ${framework}) RETURNING id`;
      appId = result[0].id;
      log(`Created app record: ${appSlug} (${appId})`);
    } else {
      appId = appRows[0].id;
      log(`App exists: ${appSlug} (${appId})`);
    }

    // 3. Ensure production environment exists
    const containerName = `sdb-app-${orgSlug}-${appSlug}`;
    let envRows = await sql`SELECT id FROM app_environments WHERE app_id = ${appId} AND name = 'production'`;
    if (envRows.length === 0) {
      // Auto-allocate next available host port if none specified or default 3000
      let hostPort = port;
      if (!hostPort || hostPort === 3000) {
        const maxPortResult = await sql`SELECT COALESCE(MAX(port), 4011) as max_port FROM app_environments WHERE port >= 4000`;
        hostPort = (maxPortResult[0]?.max_port || 4011) + 1;
        log(`Auto-allocated host port: ${hostPort}`);
      }
      const newId = crypto.randomUUID();
      await sql`INSERT INTO app_environments (id, app_id, name, container_name, port, status, subdomain, deployment_mode)
        VALUES (${newId}, ${appId}, 'production', ${containerName}, ${hostPort}, 'pending', ${orgSlug}, 'container')`;
      log(`Created environment record: production (${newId})`);
    } else {
      log(`Environment exists: production (${envRows[0].id})`);
    }

    // 4. Ensure project record exists (for auth)
    const schemaName = `project_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const jwtSecret = crypto.randomUUID() + crypto.randomUUID(); // 72-char random secret
    let projectRows = await sql`SELECT id FROM projects WHERE org_id = ${orgId} AND slug = ${appSlug}`;
    let projectId: string;
    if (projectRows.length === 0) {
      const result = await sql`
        INSERT INTO projects (org_id, name, slug, environment, schema_name, jwt_secret)
        VALUES (${orgId}, ${appName}, ${appSlug}, 'production', ${schemaName}, ${jwtSecret})
        ON CONFLICT (org_id, slug) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) {
        projectId = result[0].id;
        log(`Created project record: ${appSlug} (${projectId})`);
      } else {
        // ON CONFLICT hit — re-select
        const existing = await sql`SELECT id FROM projects WHERE org_id = ${orgId} AND slug = ${appSlug}`;
        projectId = existing[0].id;
        log(`Project already exists: ${appSlug} (${projectId})`);
      }
    } else {
      projectId = projectRows[0].id;
      log(`Project exists: ${appSlug} (${projectId})`);
    }

    // 4b. Link project_id to all environments for this app (P2 improvement)
    try {
      await sql`
        UPDATE app_environments
        SET project_id = ${projectId}
        WHERE app_id = ${appId} AND project_id IS NULL
      `;
      log(`Linked project ${projectId} to app environments`);
    } catch (linkErr) {
      log(`Warning: failed to link project to environments: ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`);
    }

    // 5. Ensure project_databases record exists
    try {
      const existingPd = await sql`SELECT id FROM project_databases WHERE project_id = ${projectId}`;
      if (existingPd.length === 0) {
        // Find a database instance matching org tier, fall back to hobbyist
        let instances = await sql`
          SELECT id, tier, postgres_user, port FROM database_instances
          WHERE tier = ${orgPlan} AND status = 'active'
          LIMIT 1
        `;
        if (instances.length === 0) {
          instances = await sql`
            SELECT id, tier, postgres_user, port FROM database_instances
            WHERE tier = 'hobbyist' AND status = 'active'
            LIMIT 1
          `;
        }
        if (instances.length > 0) {
          const inst = instances[0];
          const dbName = inst.tier === 'hobbyist' ? 'signaldb' : `${appSlug}_production`;
          const connStr = `postgresql://${inst.postgres_user}@127.0.0.1:${inst.port || 5440}/${dbName}`;
          await sql`
            INSERT INTO project_databases (
              project_id, instance_id, database_name, schema_name,
              connection_string_encrypted, status
            ) VALUES (
              ${projectId}, ${inst.id}, ${dbName}, ${schemaName},
              pgp_sym_encrypt(${connStr}, ${ENCRYPTION_KEY}), 'active'
            )
            ON CONFLICT (project_id) DO NOTHING
          `;
          log(`Created project_databases record for ${appSlug}`);
        } else {
          log(`Warning: no database_instances found — skipping project_databases`);
        }
      } else {
        log(`Project database already exists for ${appSlug}`);
      }
    } catch (pdErr) {
      const pdMsg = pdErr instanceof Error ? pdErr.message : String(pdErr);
      log(`Warning: failed to create project_databases: ${pdMsg}`);
    }

    // 6-7. Auth setup (skip if auth: false in config)
    if (options?.skipAuth) {
      log(`Auth disabled (auth: false) — skipping auth_configs and auth gate`);
    } else {
      // 6. Ensure auth_configs record exists (enabled by default for zero-config auth)
      await sql`
        INSERT INTO auth_configs (project_id, enabled)
        VALUES (${projectId}, true)
        ON CONFLICT (project_id) DO NOTHING
      `;
      log(`Ensured auth_configs record for project ${projectId}`);

      // 7. Enable auth gate on all environments for this app (if not already set)
      const gateResult = await sql`
        UPDATE app_environments
        SET auth_gate_enabled = true,
            auth_gate_project_id = ${projectId},
            auth_gate_exclude_paths = '["/health"]'::jsonb
        WHERE app_id = ${appId}
          AND auth_gate_project_id IS NULL
      `;
      const gateCount = gateResult.count ?? 0;
      if (gateCount > 0) {
        log(`Enabled auth gate on ${gateCount} environment(s)`);
      } else {
        log(`Auth gate already configured on all environments`);
      }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Warning: failed to ensure platform records: ${errMsg}`);
  }
}

/**
 * Scaffold a new app from a template
 *
 * In monorepo mode (default for template apps):
 *   - Creates org-level repo at /opt/signaldb/user-apps/{orgSlug}/
 *   - Places app in subdirectory {appSlug}/
 *   - Updates root signaldb.yaml with the new app entry
 *   - Returns buildDir = appSlug for deploy agent
 *
 * In legacy mode:
 *   - Creates app at /opt/signaldb/user-apps/{org}-{app}[-{env}]
 *   - Each app has its own git repo
 */
export async function scaffoldApp(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const { orgSlug, appSlug, appName, envName, framework, port, projectId } = options;
  const useMonorepo = options.directoryLayout !== 'legacy';
  let logs = '';

  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    logs += line + '\n';
    console.log(`[scaffold] ${msg}`);
  };

  try {
    let result: ScaffoldResult;
    if (useMonorepo) {
      result = await scaffoldMonorepo(
        { orgSlug, appSlug, appName, envName, framework, port, projectId },
        log,
      );
    } else {
      result = await scaffoldLegacy(
        { orgSlug, appSlug, appName, envName, framework, port, projectId },
        log,
      );
    }

    // Non-blocking readiness check after scaffold
    if (result.success) {
      runPostScaffoldReadiness(orgSlug, appSlug, envName || 'production', log).catch(() => {});
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`ERROR: ${errorMsg}`);

    return {
      success: false,
      appDir: useMonorepo
        ? computeOrgRepoDir(orgSlug)
        : computeAppDir(orgSlug, appSlug, envName),
      error: errorMsg,
      logs,
    };
  }
}

/**
 * Non-blocking readiness check after scaffold.
 * Logs results — does not block scaffold success.
 */
async function runPostScaffoldReadiness(
  orgSlug: string,
  appSlug: string,
  envName: string,
  log: (msg: string) => void,
): Promise<void> {
  try {
    const appRows = await sql`
      SELECT a.id FROM apps a
      JOIN organizations o ON o.id = a.org_id
      WHERE o.slug = ${orgSlug} AND a.slug = ${appSlug}
    `;
    if (appRows.length === 0) {
      log('Readiness: skipped (app not found in DB)');
      return;
    }
    const result = await checkEnvironmentReadiness(appRows[0].id, envName);
    log(`Readiness: ${result.passCount} pass, ${result.failCount} fail, ${result.skipCount} skip`);
    for (let i = 0; i < result.checks.length; i++) {
      const ch = result.checks[i];
      if (ch.status === 'fail') {
        log(`  FAIL: ${ch.name} — ${ch.detail || 'no detail'}`);
      }
    }
  } catch (err) {
    log(`Readiness: error — ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Write CLAUDE.md, agent memory files, and framework skills to an app directory.
 * Called after template files are written.
 */
function writeClaudeArtifacts(
  appDir: string,
  framework: Framework,
  orgSlug: string,
  appSlug: string,
  appName: string,
  log: (msg: string) => void,
): void {
  // Write CLAUDE.md
  const claudeMd = generateClaudeMdContent(framework, orgSlug, appSlug, appName);
  writeFileSync(join(appDir, 'CLAUDE.md'), claudeMd);
  log(`Wrote: CLAUDE.md`);

  // Write agent memory files
  const roles = getAgentRoles(framework);
  for (const role of roles) {
    const memory = getAgentMemory(framework, role);
    if (memory) {
      const memoryDir = join(appDir, '.claude', 'agent-memory', role);
      mkdirSync(memoryDir, { recursive: true });
      writeFileSync(join(memoryDir, 'MEMORY.md'), memory);
      log(`Wrote: .claude/agent-memory/${role}/MEMORY.md`);
    }
  }

  // Write framework skills
  const skills = getFrameworkSkills(framework);
  for (const [filePath, content] of Object.entries(skills)) {
    const fullPath = join(appDir, filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
    log(`Wrote: ${filePath}`);
  }
}

/**
 * Set group-writable permissions with setgid on all directories.
 * This ensures the deploy user (in sdb_{org} group) can write files
 * without sudo, because new files inherit the parent directory's group.
 */
function setGroupWritablePermissions(appDir: string, log: (msg: string) => void): void {
  try {
    // Set setgid on all directories (new files inherit group)
    execSync(`find ${appDir} -type d -exec chmod 2775 {} +`);
    // Set group-writable on all files
    execSync(`find ${appDir} -type f -exec chmod 664 {} +`);
    log(`Set permissions: dirs=2775 (setgid), files=664`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Warning: failed to set permissions: ${errMsg}`);
  }
}

/**
 * Scaffold in monorepo mode (org-level git repo)
 */
async function scaffoldMonorepo(
  opts: Omit<ScaffoldOptions, 'directoryLayout'>,
  log: (msg: string) => void,
): Promise<ScaffoldResult> {
  const { orgSlug, appSlug, appName, framework, port, projectId } = opts;
  let logs = '';
  const origLog = log;
  log = (msg: string) => {
    logs += `[${new Date().toISOString()}] ${msg}\n`;
    origLog(msg);
  };

  // Ensure org-level git repo
  const orgDir = await ensureOrgRepo(orgSlug, log);
  const appDir = join(orgDir, appSlug);

  if (existsSync(appDir)) {
    return {
      success: false,
      appDir: orgDir,
      buildDir: appSlug,
      error: `App subdirectory already exists: ${appDir}`,
      logs,
    };
  }

  log(`Scaffolding ${framework} app: ${appName} (monorepo mode)`);
  log(`Org repo: ${orgDir}`);
  log(`App dir: ${appDir}`);

  // Generate template files
  const ctx = { appName, appSlug, orgSlug, port };
  const files = generateTemplate(framework, ctx);

  // Get project env vars if linked
  let envVars: Record<string, string> = {};
  if (projectId) {
    envVars = await getProjectEnvVars(projectId);
    log(`Linked project: ${projectId}`);
  }

  // Create app subdirectory
  mkdirSync(appDir, { recursive: true });
  log(`Created: ${appSlug}/`);

  // Write template files into the app subdirectory
  // Skip the per-app signaldb.yaml since we use root-level config
  for (const [filePath, content] of Object.entries(files)) {
    if (filePath === 'signaldb.yaml') continue; // root-level only
    const fullPath = join(appDir, filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
    log(`Wrote: ${appSlug}/${filePath}`);
  }

  // Create .forge/ directory structure for Forge AI development
  // Directories must be group-writable (2775) so forge daemon (deploy user) can write files
  const forgeDirs = ['backlog', 'pending-questions', 'archive', 'retrospectives', 'jobs'];
  const forgeRoot = join(appDir, '.forge');
  mkdirSync(forgeRoot, { recursive: true, mode: 0o2775 });
  for (const sub of forgeDirs) {
    const dir = join(forgeRoot, sub);
    mkdirSync(dir, { recursive: true, mode: 0o2775 });
  }
  log(`Created: ${appSlug}/.forge/ (${forgeDirs.join(', ')})`);

  // Write CLAUDE.md, agent memory, and framework skills
  writeClaudeArtifacts(appDir, framework, orgSlug, appSlug, appName, log);

  // Write .env file in app subdirectory
  const envLines: string[] = [
    `PORT=${port || 3000}`,
    `NODE_ENV=production`,
    `SIGNALDB_API_URL=https://api.signaldb.live`,
  ];
  for (const [key, value] of Object.entries(envVars)) {
    envLines.push(`${key}=${value}`);
  }
  writeFileSync(join(appDir, '.env'), envLines.join('\n') + '\n');
  log(`Wrote: ${appSlug}/.env`);

  // Update root signaldb.yaml with this app
  const yamlPath = join(orgDir, 'signaldb.yaml');
  let newYaml: string;
  try {
    const existingYaml = readFileSync(yamlPath, 'utf-8');
    // Check if it's the empty initial config
    if (existingYaml.includes('apps: {}') || existingYaml.trim() === 'version: 1\napps: {}') {
      // First app — generate fresh
      newYaml = generateSignalDBYaml([
        { slug: appSlug, dir: appSlug, framework },
      ]);
    } else {
      newYaml = addAppToYaml(existingYaml, {
        slug: appSlug,
        dir: appSlug,
        framework,
      });
    }
  } catch {
    // No existing YAML — generate new
    newYaml = generateSignalDBYaml([
      { slug: appSlug, dir: appSlug, framework },
    ]);
  }
  writeFileSync(yamlPath, newYaml);
  log('Updated: signaldb.yaml');

  // Git add + commit at org repo level
  log('Committing to org repo...');
  await exec('git', ['add', '.'], orgDir);
  const gitCommit = await exec(
    'git', ['commit', '-m', `Add app: ${appSlug}`], orgDir,
  );
  if (gitCommit.code !== 0) {
    log(`Warning: git commit failed: ${gitCommit.stderr}`);
  } else {
    log(`Committed: Add app: ${appSlug}`);
  }

  // Install dependencies in app subdirectory
  const orgCacheDir = join(APPS_BASE_DIR, '.cache', orgSlug);
  log(`Installing dependencies (bun install) with isolated cache: ${orgCacheDir}`);
  const install = await exec('bun', ['install'], appDir, { BUN_INSTALL_CACHE_DIR: orgCacheDir });
  if (install.code !== 0) {
    log(`Warning: bun install failed: ${install.stderr}`);
  } else {
    log('Dependencies installed');
  }

  // Set group-writable permissions with setgid
  setGroupWritablePermissions(appDir, log);

  // Create compatibility symlink for systemd template service
  // systemd-app@{org}-{app} expects /opt/signaldb/user-apps/{org}-{app}
  const symlinkPath = join(APPS_BASE_DIR, `${orgSlug}-${appSlug}`);
  try {
    if (!existsSync(symlinkPath)) {
      symlinkSync(appDir, symlinkPath);
      log(`Created symlink: ${orgSlug}-${appSlug} -> ${orgSlug}/${appSlug}`);
    } else {
      // Check if it's already a symlink pointing to the right place
      try {
        const stat = lstatSync(symlinkPath);
        if (stat.isSymbolicLink()) {
          log(`Symlink already exists: ${orgSlug}-${appSlug}`);
        } else {
          log(`Warning: ${symlinkPath} exists but is not a symlink`);
        }
      } catch {
        log(`Warning: could not check symlink status for ${symlinkPath}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Warning: failed to create symlink: ${errMsg}`);
  }

  // Ensure platform DB records exist for routing
  await ensurePlatformRecords(orgSlug, appSlug, appName, framework, port || 3000, log);

  log('Scaffold complete (monorepo mode)');

  return {
    success: true,
    appDir: orgDir,
    buildDir: appSlug,
    logs,
  };
}

/**
 * Scaffold in legacy mode (per-app git repo)
 */
async function scaffoldLegacy(
  opts: Omit<ScaffoldOptions, 'directoryLayout'>,
  log: (msg: string) => void,
): Promise<ScaffoldResult> {
  const { orgSlug, appSlug, appName, envName, framework, port, projectId } = opts;
  let logs = '';
  const origLog = log;
  log = (msg: string) => {
    logs += `[${new Date().toISOString()}] ${msg}\n`;
    origLog(msg);
  };

  const appDir = computeAppDir(orgSlug, appSlug, envName);

  if (existsSync(appDir)) {
    return {
      success: false,
      appDir,
      error: `Directory already exists: ${appDir}`,
      logs,
    };
  }

  log(`Scaffolding ${framework} app: ${appName} (legacy mode)`);
  log(`Directory: ${appDir}`);

  // Generate template files
  const ctx = { appName, appSlug, orgSlug, port };
  const files = generateTemplate(framework, ctx);

  // Get project env vars if linked
  let envVars: Record<string, string> = {};
  if (projectId) {
    envVars = await getProjectEnvVars(projectId);
    log(`Linked project: ${projectId}`);
  }

  // Create directory
  mkdirSync(appDir, { recursive: true });
  log(`Created directory: ${appDir}`);

  // Write all template files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(appDir, filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
    log(`Wrote: ${filePath}`);
  }

  // Create .forge/ directory structure for Forge AI development
  const forgeDirs = ['backlog', 'pending-questions', 'archive', 'retrospectives', 'jobs'];
  const forgeRoot = join(appDir, '.forge');
  mkdirSync(forgeRoot, { recursive: true, mode: 0o2775 });
  for (const sub of forgeDirs) {
    const dir = join(forgeRoot, sub);
    mkdirSync(dir, { recursive: true, mode: 0o2775 });
  }
  log(`Created: .forge/ (${forgeDirs.join(', ')})`);

  // Write CLAUDE.md, agent memory, and framework skills
  writeClaudeArtifacts(appDir, framework, orgSlug, appSlug, appName, log);

  // Write .env file with actual values
  const envLines: string[] = [
    `PORT=${port || 3000}`,
    `NODE_ENV=production`,
    `SIGNALDB_API_URL=https://api.signaldb.live`,
  ];
  for (const [key, value] of Object.entries(envVars)) {
    envLines.push(`${key}=${value}`);
  }
  writeFileSync(join(appDir, '.env'), envLines.join('\n') + '\n');
  log('Wrote: .env');

  // Git init
  log('Initializing git repository...');
  const gitInit = await exec('git', ['init'], appDir);
  if (gitInit.code !== 0) {
    log(`Warning: git init failed: ${gitInit.stderr}`);
  }

  const gitAdd = await exec('git', ['add', '.'], appDir);
  if (gitAdd.code !== 0) {
    log(`Warning: git add failed: ${gitAdd.stderr}`);
  }

  const gitCommit = await exec('git', ['commit', '-m', 'Initial scaffold from SignalDB Connect'], appDir);
  if (gitCommit.code !== 0) {
    log(`Warning: git commit failed: ${gitCommit.stderr}`);
  } else {
    log('Git repository initialized with initial commit');
  }

  // Install dependencies with org-isolated cache
  const orgCacheDir = join(APPS_BASE_DIR, '.cache', orgSlug);
  log(`Installing dependencies (bun install) with isolated cache: ${orgCacheDir}`);
  const install = await exec('bun', ['install'], appDir, { BUN_INSTALL_CACHE_DIR: orgCacheDir });
  if (install.code !== 0) {
    log(`Warning: bun install failed: ${install.stderr}`);
  } else {
    log('Dependencies installed');
  }

  // Set group-writable permissions with setgid
  setGroupWritablePermissions(appDir, log);

  // Ensure platform DB records exist for routing
  await ensurePlatformRecords(orgSlug, appSlug, appName, framework, port || 3000, log);

  log('Scaffold complete (legacy mode)');

  return {
    success: true,
    appDir,
    logs,
  };
}
