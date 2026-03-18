/**
 * SignalDB Connect - App Deployer Service
 *
 * Handles building and deploying user apps to Docker containers
 * Apps are accessible at: {app}.{org}.connect.signaldb.live
 */

import { sql } from '../lib/db';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const APPS_DIR = process.env.APPS_DIR || '/opt/signaldb/user-apps';
const DOCKER_TEMPLATES_DIR = join(import.meta.dir, '../../docker-templates');

interface DeployOptions {
  environmentId: string;
  gitBranch?: string;
  deployedBy?: string;
  deploymentType?: 'manual' | 'auto' | 'rollback' | 'ai';
}

interface DeployResult {
  success: boolean;
  deploymentId: string;
  error?: string;
  logs?: string;
}

interface AppEnvironment {
  id: string;
  app_id: string;
  name: string;
  project_id: string | null;
  container_name: string | null;
  port: number | null;
  status: string;
}

interface App {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  git_repo: string | null;
  git_branch: string;
  framework: string;
}

interface Organization {
  id: string;
  slug: string;
}

/**
 * Execute a shell command and capture output
 */
function execCommand(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

/**
 * Allocate a port that's free both in the DB and on the host.
 * Queries the deploy agent for ports actually in use on the host,
 * then finds the lowest port in 4000-4999 not used by either.
 */
async function allocatePort(): Promise<number> {
  let hostUsedPorts: number[] = [];
  try {
    const res = await fetch(`${DEPLOY_AGENT_URL}/used-ports`, {
      headers: { 'X-Deploy-Secret': DEPLOY_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as { usedPorts: number[] };
      hostUsedPorts = data.usedPorts || [];
    }
  } catch {
    console.warn('[allocatePort] Deploy agent unreachable, falling back to DB-only');
  }

  const dbPorts = await sql`SELECT port FROM app_environments WHERE port IS NOT NULL`;
  const dbUsedPorts = new Set(dbPorts.map(r => r.port as number));
  const allUsed = new Set([...hostUsedPorts, ...dbUsedPorts]);

  for (let port = 4000; port <= 4999; port++) {
    if (!allUsed.has(port)) {
      return port;
    }
  }
  throw new Error('No available ports in range 4000-4999');
}

/**
 * Generate container name from org/app/env
 */
function generateContainerName(orgSlug: string, appSlug: string, envName: string): string {
  return `signaldb-app-${orgSlug}-${appSlug}-${envName}`;
}

import { requireEnv } from '../lib/require-env';
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');
const DEPLOY_AGENT_HOST = process.env.CONNECT_APP_HOST || '127.0.0.1';
const DEPLOY_AGENT_URL = `http://${DEPLOY_AGENT_HOST}:4100`;
const DEPLOY_SECRET = requireEnv('DEPLOY_SECRET');

/**
 * Get project API key and database URL for the linked project
 * Uses COALESCE to prefer per-project credentials, falling back to instance creds
 */
async function getProjectCredentials(projectId: string): Promise<{ apiKey: string; databaseUrl: string } | null> {
  // Get a live API key for the project
  const keys = await sql<{ key_prefix: string }[]>`
    SELECT key_prefix FROM api_keys
    WHERE project_id = ${projectId}
      AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;

  // Get database connection info with per-project user COALESCE pattern
  const dbInfo = await sql<{
    database_name: string;
    username: string;
    password: string;
    db_port: number;
  }[]>`
    SELECT
      pd.database_name,
      COALESCE(pd.project_user, di.postgres_user) as username,
      COALESCE(
        pgp_sym_decrypt(pd.project_password_encrypted::bytea, ${ENCRYPTION_KEY}),
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY})
      ) as password,
      di.port as db_port
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = ${projectId}
  `;

  if (dbInfo.length === 0) {
    return null;
  }

  const db = dbInfo[0];
  // Use 127.0.0.1 for same-server connections
  const databaseUrl = `postgresql://${db.username}:${db.password}@127.0.0.1:${db.db_port}/${db.database_name}`;

  return {
    apiKey: keys.length > 0 ? keys[0].key_prefix : '',
    databaseUrl,
  };
}

/**
 * Create deployment record
 */
async function createDeployment(
  environmentId: string,
  options: {
    commitSha?: string;
    commitMessage?: string;
    gitBranch?: string;
    deployedBy?: string;
    deploymentType: string;
  }
): Promise<string> {
  const result = await sql<{ id: string }[]>`
    INSERT INTO app_deployments (
      environment_id,
      commit_sha,
      commit_message,
      git_branch,
      deployed_by,
      deployment_type,
      status
    ) VALUES (
      ${environmentId},
      ${options.commitSha || null},
      ${options.commitMessage || null},
      ${options.gitBranch || null},
      ${options.deployedBy || null},
      ${options.deploymentType},
      'pending'
    )
    RETURNING id
  `;
  return result[0].id;
}

/**
 * Update deployment status
 */
async function updateDeployment(
  deploymentId: string,
  updates: {
    status?: string;
    buildLog?: string;
    deployLog?: string;
    errorMessage?: string;
    imageTag?: string;
    completedAt?: Date;
    durationMs?: number;
  }
): Promise<void> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.status) {
    setClauses.push('status = $' + (values.length + 1));
    values.push(updates.status);
  }
  if (updates.buildLog !== undefined) {
    setClauses.push('build_log = $' + (values.length + 1));
    values.push(updates.buildLog);
  }
  if (updates.deployLog !== undefined) {
    setClauses.push('deploy_log = $' + (values.length + 1));
    values.push(updates.deployLog);
  }
  if (updates.errorMessage !== undefined) {
    setClauses.push('error_message = $' + (values.length + 1));
    values.push(updates.errorMessage);
  }
  if (updates.imageTag !== undefined) {
    setClauses.push('image_tag = $' + (values.length + 1));
    values.push(updates.imageTag);
  }
  if (updates.completedAt) {
    setClauses.push('completed_at = $' + (values.length + 1));
    values.push(updates.completedAt);
  }
  if (updates.durationMs !== undefined) {
    setClauses.push('duration_ms = $' + (values.length + 1));
    values.push(updates.durationMs);
  }

  if (setClauses.length > 0) {
    values.push(deploymentId);
    await sql.unsafe(
      `UPDATE app_deployments SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
      values
    );
  }
}

/**
 * Update environment status
 */
async function updateEnvironmentStatus(
  environmentId: string,
  updates: {
    status?: string;
    containerName?: string;
    containerId?: string;
    port?: number;
    lastDeployedAt?: Date;
    lastDeployCommit?: string;
    lastDeployMessage?: string;
    healthStatus?: string;
  }
): Promise<void> {
  await sql`
    UPDATE app_environments
    SET
      status = COALESCE(${updates.status || null}, status),
      container_name = COALESCE(${updates.containerName || null}, container_name),
      container_id = COALESCE(${updates.containerId || null}, container_id),
      port = COALESCE(${updates.port || null}, port),
      last_deployed_at = COALESCE(${updates.lastDeployedAt || null}, last_deployed_at),
      last_deploy_commit = COALESCE(${updates.lastDeployCommit || null}, last_deploy_commit),
      last_deploy_message = COALESCE(${updates.lastDeployMessage || null}, last_deploy_message),
      health_status = COALESCE(${updates.healthStatus || null}, health_status),
      updated_at = now()
    WHERE id = ${environmentId}
  `;
}

/**
 * Deploy an app environment
 */
export async function deployApp(options: DeployOptions): Promise<DeployResult> {
  const startTime = Date.now();
  let deploymentId: string;
  let logs = '';

  try {
    // Get environment details
    const envResult = await sql<(AppEnvironment & App & Organization)[]>`
      SELECT
        ae.*,
        a.id as app_id,
        a.name as app_name,
        a.slug as app_slug,
        a.git_repo,
        a.git_branch as default_branch,
        a.framework,
        o.id as org_id,
        o.slug as org_slug
      FROM app_environments ae
      JOIN apps a ON a.id = ae.app_id
      JOIN organizations o ON o.id = a.org_id
      WHERE ae.id = ${options.environmentId}
    `;

    if (envResult.length === 0) {
      return { success: false, deploymentId: '', error: 'Environment not found' };
    }

    const env = envResult[0];
    const gitBranch = options.gitBranch || env.default_branch || 'main';

    // Create deployment record
    deploymentId = await createDeployment(options.environmentId, {
      gitBranch,
      deployedBy: options.deployedBy,
      deploymentType: options.deploymentType || 'manual',
    });

    // Update status to building
    await updateEnvironmentStatus(options.environmentId, { status: 'building' });
    await updateDeployment(deploymentId, { status: 'building' });

    logs += `[${new Date().toISOString()}] Starting deployment for ${env.app_name} (${env.name})\n`;

    // Allocate port if not already assigned
    let port = env.port;
    if (!port) {
      port = await allocatePort();
      logs += `[${new Date().toISOString()}] Allocated port: ${port}\n`;
    }

    // Generate container name
    const containerName = generateContainerName(env.org_slug, env.app_slug, env.name);
    logs += `[${new Date().toISOString()}] Container name: ${containerName}\n`;

    // Create app directory
    const appDir = join(APPS_DIR, env.org_slug, env.app_slug, env.name);
    if (!existsSync(appDir)) {
      mkdirSync(appDir, { recursive: true });
    }

    // Clone or pull the git repo
    if (env.git_repo) {
      logs += `[${new Date().toISOString()}] Cloning/pulling from ${env.git_repo}\n`;

      const gitDir = join(appDir, 'source');
      if (existsSync(join(gitDir, '.git'))) {
        // Pull latest
        const pullResult = await execCommand('git', ['pull', 'origin', gitBranch], gitDir);
        logs += pullResult.stdout + pullResult.stderr;
        if (pullResult.code !== 0) {
          throw new Error(`Git pull failed: ${pullResult.stderr}`);
        }
      } else {
        // Clone
        const cloneResult = await execCommand('git', ['clone', '-b', gitBranch, env.git_repo, 'source'], appDir);
        logs += cloneResult.stdout + cloneResult.stderr;
        if (cloneResult.code !== 0) {
          throw new Error(`Git clone failed: ${cloneResult.stderr}`);
        }
      }

      // Get commit info
      const commitResult = await execCommand('git', ['log', '-1', '--format=%H|%s'], join(appDir, 'source'));
      const [commitSha, commitMessage] = commitResult.stdout.trim().split('|');
      await updateDeployment(deploymentId, {
        status: 'building',
        buildLog: logs,
      });

      logs += `[${new Date().toISOString()}] Commit: ${commitSha.substring(0, 7)} - ${commitMessage}\n`;
    }

    // Copy Dockerfile
    const dockerfileSrc = join(DOCKER_TEMPLATES_DIR, `${env.framework || 'react-router'}.Dockerfile`);
    const dockerfileDst = join(appDir, 'source', 'Dockerfile');
    if (existsSync(dockerfileSrc)) {
      const dockerfileContent = readFileSync(dockerfileSrc, 'utf-8');
      writeFileSync(dockerfileDst, dockerfileContent);
    }

    // Get project credentials if linked
    let databaseUrl = '';
    let apiKey = '';
    if (env.project_id) {
      const creds = await getProjectCredentials(env.project_id);
      if (creds) {
        databaseUrl = creds.databaseUrl;
        apiKey = creds.apiKey;
      }
    }

    // Build Docker image
    logs += `[${new Date().toISOString()}] Building Docker image...\n`;
    await updateDeployment(deploymentId, { status: 'building', buildLog: logs });

    const imageTag = `signaldb-app/${env.org_slug}/${env.app_slug}:${env.name}`;
    const buildResult = await execCommand('docker', [
      'build',
      '-t', imageTag,
      '--build-arg', `APP_NAME=${env.app_name}`,
      '--build-arg', `GIT_COMMIT=${env.last_deploy_commit || 'unknown'}`,
      '.',
    ], join(appDir, 'source'));

    logs += buildResult.stdout + buildResult.stderr;
    if (buildResult.code !== 0) {
      throw new Error(`Docker build failed: ${buildResult.stderr}`);
    }

    await updateDeployment(deploymentId, { status: 'deploying', buildLog: logs, imageTag });

    // Stop existing container if running
    logs += `[${new Date().toISOString()}] Stopping existing container...\n`;
    await execCommand('docker', ['stop', containerName], appDir);
    await execCommand('docker', ['rm', containerName], appDir);

    // Start new container
    logs += `[${new Date().toISOString()}] Starting new container on port ${port}...\n`;
    await updateEnvironmentStatus(options.environmentId, { status: 'deploying' });

    const runResult = await execCommand('docker', [
      'run', '-d',
      '--name', containerName,
      '--restart', 'unless-stopped',
      '-p', `${port}:3000`,
      '-e', `PORT=3000`,
      '-e', `NODE_ENV=production`,
      '-e', `DATABASE_URL=${databaseUrl}`,
      '-e', `SIGNALDB_API_URL=https://api.signaldb.live`,
      '-e', `SIGNALDB_API_KEY=${apiKey}`,
      '--network', 'signaldb-apps',
      '--label', `signaldb.app=${env.app_slug}`,
      '--label', `signaldb.org=${env.org_slug}`,
      '--label', `signaldb.env=${env.name}`,
      imageTag,
    ], appDir);

    logs += runResult.stdout + runResult.stderr;
    if (runResult.code !== 0) {
      throw new Error(`Docker run failed: ${runResult.stderr}`);
    }

    const containerId = runResult.stdout.trim();

    // Wait for container to be healthy
    logs += `[${new Date().toISOString()}] Waiting for container to be healthy...\n`;
    let healthy = false;
    for (let i = 0; i < 30; i++) { // 30 second timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const healthCheck = await fetch(`http://127.0.0.1:${port}/health`);
        if (healthCheck.ok) {
          healthy = true;
          break;
        }
      } catch {
        // Container not ready yet
      }
    }

    if (!healthy) {
      logs += `[${new Date().toISOString()}] Warning: Health check did not pass within timeout\n`;
    }

    // Update records
    const durationMs = Date.now() - startTime;
    await updateEnvironmentStatus(options.environmentId, {
      status: 'running',
      containerName,
      containerId,
      port,
      lastDeployedAt: new Date(),
      healthStatus: healthy ? 'healthy' : 'unknown',
    });

    await updateDeployment(deploymentId, {
      status: 'success',
      deployLog: logs,
      completedAt: new Date(),
      durationMs,
    });

    logs += `[${new Date().toISOString()}] Deployment completed successfully in ${durationMs}ms\n`;

    return {
      success: true,
      deploymentId,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logs += `[${new Date().toISOString()}] ERROR: ${errorMessage}\n`;

    // Update status to failed
    await updateEnvironmentStatus(options.environmentId, { status: 'failed' });

    if (deploymentId!) {
      await updateDeployment(deploymentId, {
        status: 'failed',
        errorMessage,
        deployLog: logs,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });
    }

    return {
      success: false,
      deploymentId: deploymentId!,
      error: errorMessage,
      logs,
    };
  }
}

/**
 * Stop an app environment
 */
export async function stopApp(environmentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const envResult = await sql<AppEnvironment[]>`
      SELECT * FROM app_environments WHERE id = ${environmentId}
    `;

    if (envResult.length === 0) {
      return { success: false, error: 'Environment not found' };
    }

    const env = envResult[0];
    if (env.container_name) {
      await execCommand('docker', ['stop', env.container_name], '/');
    }

    await updateEnvironmentStatus(environmentId, { status: 'stopped' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get deployment logs
 */
export async function getDeploymentLogs(deploymentId: string): Promise<string | null> {
  const result = await sql<{ build_log: string; deploy_log: string }[]>`
    SELECT build_log, deploy_log FROM app_deployments WHERE id = ${deploymentId}
  `;
  if (result.length === 0) return null;
  return (result[0].build_log || '') + '\n' + (result[0].deploy_log || '');
}

/**
 * Get container logs
 */
export async function getContainerLogs(environmentId: string, lines: number = 100): Promise<string | null> {
  const envResult = await sql<AppEnvironment[]>`
    SELECT * FROM app_environments WHERE id = ${environmentId}
  `;

  if (envResult.length === 0 || !envResult[0].container_name) {
    return null;
  }

  const result = await execCommand('docker', ['logs', '--tail', lines.toString(), envResult[0].container_name], '/');
  return result.stdout + result.stderr;
}
