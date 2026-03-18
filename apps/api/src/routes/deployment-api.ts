/**
 * Deployment API - Blue-Green Deployment for SignalDB Connect Apps
 *
 * Endpoints:
 *   GET    /v1/apps/:appId/environments           - List environments
 *   POST   /v1/apps/:appId/environments/:env/deploy - Deploy to environment
 *   GET    /v1/apps/:appId/environments/:env/status - Get deployment status
 *   GET    /v1/apps/:appId/environments/:env/logs   - Get deployment logs
 *   POST   /v1/apps/:appId/promote                - Promote dev → prod
 *   POST   /v1/apps/:appId/rollback               - Rollback production
 *   POST   /v1/deployments/:id/status             - Callback from deploy agent
 *   GET    /v1/apps/:appId/capabilities           - Get declared capabilities + usage
 */

import { sql } from '../lib/db';
import type { AdminContext } from '../lib/admin-auth';
import { clearEnvironmentCache } from './apps-proxy';
import {
  buildBaseEnvVars,
  buildDatabaseEnvVars,
  buildCustomEnvVars,
  buildEncryptedEnvVars,
  buildSecretProviderSecrets,
  buildStorageEnvVars,
  buildPlatformKeyEnvVars,
  resolveGitToken,
  resolveTierProfile,
  resolveOrgBridge,
  buildCapabilityEnvVars,
} from '../services/deploy-env-builder';

// Connect apps run on the host, not inside the app-platform container
const CONNECT_APP_HOST = process.env.CONNECT_APP_HOST || '127.0.0.1';
import { fetchInfisicalSecrets } from '../lib/infisical-client';
import { detectProvider } from '../lib/git-provider';
import { generateInstallationToken, getAuthenticatedCloneUrl, listInstallationRepos, listRepoBranches, type PermissionsLevel } from '../lib/github-app';

// Deploy agent runs on the host, not inside the app-platform container.
// Use CONNECT_APP_HOST (host bridge IP) so the containerized API can reach it.
const DEPLOY_AGENT_HOST = process.env.CONNECT_APP_HOST || '127.0.0.1';
const DEPLOY_AGENT_URL = `http://${DEPLOY_AGENT_HOST}:4100`;
import { requireEnv } from '../lib/require-env';
const DEPLOY_SECRET = requireEnv('DEPLOY_SECRET');
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

/**
 * Allocate a port that's free both in the DB and on the host.
 * Queries the deploy agent for ports actually in use on the host,
 * then finds the lowest port in 4000-4999 not used by either.
 */
async function allocateVerifiedPort(): Promise<number> {
  // Get ports in use on the host (from deploy agent)
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
    // If deploy agent is unreachable, fall back to DB-only allocation
    console.warn('[allocateVerifiedPort] Deploy agent unreachable, falling back to DB-only');
  }

  // Get ports allocated in DB
  const dbPorts = await sql`SELECT port FROM app_environments WHERE port IS NOT NULL`;
  const dbUsedPorts = new Set(dbPorts.map(r => r.port as number));

  // Combine both sets
  const allUsed = new Set([...hostUsedPorts, ...dbUsedPorts]);

  // Find lowest available port in range
  for (let port = 4000; port <= 4999; port++) {
    if (!allUsed.has(port)) {
      return port;
    }
  }

  throw new Error('No available ports in range 4000-4999');
}

interface Environment {
  id: string;
  app_id: string;
  name: string;
  status: string;
  port: number | null;
  subdomain: string | null;
  container_name: string | null;
  container_ip: string | null;
  deployment_mode: 'systemd' | 'container';
  last_deployed_at: string | null;
  last_deploy_commit: string | null;
  health_status: string;
  visibility: 'public' | 'internal';
  git_branch: string | null;
  settings?: Record<string, unknown>;
}

interface Deployment {
  id: string;
  environment_id: string;
  status: string;
  deployment_type: string;
  started_at: string;
  completed_at: string | null;
  build_log: string | null;
  deploy_log: string | null;
  error_message: string | null;
}

/**
 * List all environments for an app
 */
export async function listEnvironments(
  req: Request,
  params: { appId: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId } = params;

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const environments = await sql<Environment[]>`
    SELECT
      id, app_id, name, status, port, subdomain, container_name,
      last_deployed_at, last_deploy_commit, health_status, visibility
    FROM app_environments
    WHERE app_id = ${appId}
    ORDER BY
      CASE name
        WHEN 'production' THEN 1
        WHEN 'staging' THEN 2
        WHEN 'dev' THEN 3
        ELSE 4
      END
  `;

  return Response.json({ data: environments });
}

/**
 * Get environment details with latest deployment
 */
export async function getEnvironmentStatus(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, env } = params;

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get environment
  const envResult = await sql<Environment[]>`
    SELECT
      id, app_id, name, status, port, subdomain, container_name,
      last_deployed_at, last_deploy_commit, health_status, visibility
    FROM app_environments
    WHERE app_id = ${appId} AND name = ${env}
  `;

  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const environment = envResult[0];

  // Get latest deployment
  const deployments = await sql<Deployment[]>`
    SELECT
      id, environment_id, status, deployment_type,
      started_at, completed_at, error_message
    FROM app_deployments
    WHERE environment_id = ${environment.id}
    ORDER BY created_at DESC
    LIMIT 5
  `;

  // Health check if running
  let health = null;
  if (environment.status === 'running' && environment.port) {
    try {
      const healthUrl = `http://${CONNECT_APP_HOST}:${environment.port}/health`;
      const healthRes = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      health = {
        status: healthRes.ok ? 'healthy' : 'unhealthy',
        statusCode: healthRes.status,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      health = {
        status: 'unreachable',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  return Response.json({
    environment,
    latestDeployment: deployments[0] || null,
    recentDeployments: deployments,
    health,
  });
}

/**
 * Get deployment logs
 */
export async function getDeploymentLogs(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, env } = params;

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get environment
  const envResult = await sql`
    SELECT id FROM app_environments WHERE app_id = ${appId} AND name = ${env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  // Get logs — specific deployment if deploymentId is provided, otherwise latest
  const url = new URL(req.url);
  const deploymentId = url.searchParams.get('deploymentId');

  let logs: Deployment[];
  if (deploymentId) {
    logs = await sql<Deployment[]>`
      SELECT
        id, status, deployment_type, started_at, completed_at,
        build_log, deploy_log, error_message
      FROM app_deployments
      WHERE id = ${deploymentId} AND environment_id = ${envResult[0].id}
      LIMIT 1
    `;
  } else {
    logs = await sql<Deployment[]>`
      SELECT
        id, status, deployment_type, started_at, completed_at,
        build_log, deploy_log, error_message
      FROM app_deployments
      WHERE environment_id = ${envResult[0].id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
  }

  if (logs.length === 0) {
    return Response.json({ error: 'No deployments found' }, { status: 404 });
  }

  return Response.json({
    deployment: logs[0],
    logs: {
      build: logs[0].build_log,
      deploy: logs[0].deploy_log,
      error: logs[0].error_message,
    },
  });
}

/**
 * Trigger deployment to an environment
 */
export async function triggerDeploy(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, env } = params;

  // Verify app belongs to org and get full app info
  const appCheck = await sql`
    SELECT
      a.id, a.slug, a.git_repo, a.git_branch, a.framework, a.settings,
      o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const app = appCheck[0];

  // Get environment with container info
  const envResult = await sql<Environment[]>`
    SELECT id, name, port, status, subdomain, container_name, container_ip, deployment_mode, settings, git_branch
    FROM app_environments
    WHERE app_id = ${appId} AND name = ${env}
  `;

  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const environment = envResult[0];

  // Check if there's already an in-progress deployment
  const activeDeployment = await sql`
    SELECT id FROM app_deployments
    WHERE environment_id = ${environment.id}
      AND status IN ('pending', 'building', 'deploying')
  `;

  if (activeDeployment.length > 0) {
    return Response.json({
      error: 'Deployment already in progress',
      deploymentId: activeDeployment[0].id,
    }, { status: 409 });
  }

  // Create deployment record - use environment branch if set, else app default
  const gitBranch = environment.git_branch || app.git_branch || 'main';
  const deployment = await sql`
    INSERT INTO app_deployments (
      environment_id,
      deployment_type,
      status,
      git_branch
    ) VALUES (
      ${environment.id},
      'ai',
      'pending',
      ${gitBranch}
    )
    RETURNING id, status, started_at
  `;

  const deploymentId = deployment[0].id;

  // Update environment status to building
  await sql`
    UPDATE app_environments
    SET status = 'building', updated_at = now()
    WHERE id = ${environment.id}
  `;

  // Clear routing cache
  if (environment.subdomain) {
    clearEnvironmentCache(environment.subdomain);
  }

  // Build environment variables via extracted builders
  const deploymentMode = ((environment as unknown as { deployment_mode?: string }).deployment_mode || 'container') as 'systemd' | 'container';
  const envProjectResult = await sql`
    SELECT project_id FROM app_environments WHERE id = ${environment.id}
  `;
  const linkedProjectId = envProjectResult[0]?.project_id;
  const envSettings = (environment as unknown as { settings?: Record<string, unknown> }).settings;

  let envVars: Record<string, string> = {
    ...buildBaseEnvVars(environment.port!),
    ...await buildDatabaseEnvVars(linkedProjectId, deploymentMode, ENCRYPTION_KEY),
    ...buildCustomEnvVars(envSettings),
    ...await buildEncryptedEnvVars(environment.id, ENCRYPTION_KEY),
  };

  // Secret provider secrets (highest precedence — deploy fails if fetch errors)
  try {
    const providerVars = await buildSecretProviderSecrets(environment.id, ENCRYPTION_KEY);
    Object.assign(envVars, providerVars);
  } catch (err) {
    console.error('[triggerDeploy] Failed to fetch secret provider secrets:', err);
    await sql`
      UPDATE app_deployments
      SET status = 'failed',
          error_message = ${'Secret provider fetch failed: ' + String(err)},
          completed_at = now()
      WHERE id = ${deploymentId}
    `;
    await sql`
      UPDATE app_environments SET status = 'failed', updated_at = now()
      WHERE id = ${environment.id}
    `;
    return Response.json({
      error: 'Secret provider failed',
      message: `Failed to fetch secrets from provider: ${err instanceof Error ? err.message : String(err)}`,
      deploymentId,
    }, { status: 500 });
  }

  // Inter-app dependencies (deploy fails if required deps missing)
  try {
    const depVars = await resolveDependencies(environment.id, ctx.orgId, environment.name);
    Object.assign(envVars, depVars);
    if (Object.keys(depVars).length > 0) {
      console.log(`[triggerDeploy] Injected ${Object.keys(depVars).length} dependency URLs`);
    }
  } catch (err) {
    console.error('[triggerDeploy] Dependency resolution failed:', err);
    await sql`
      UPDATE app_deployments
      SET status = 'failed',
          error_message = ${'Dependency resolution failed: ' + String(err)},
          completed_at = now()
      WHERE id = ${deploymentId}
    `;
    await sql`
      UPDATE app_environments SET status = 'failed', updated_at = now()
      WHERE id = ${environment.id}
    `;
    return Response.json({
      error: 'Dependency resolution failed',
      message: err instanceof Error ? err.message : String(err),
      deploymentId,
    }, { status: 400 });
  }

  // Non-fatal builders (storage + platform key)
  Object.assign(envVars, await buildStorageEnvVars(ctx.orgId, app.org_slug));
  Object.assign(envVars, await buildPlatformKeyEnvVars(ctx.orgId));

  // Resolve git config
  const skipGitPull = !app.git_repo;
  const gitRepo = app.git_repo || undefined;
  const gitToken = gitRepo ? await resolveGitToken(gitRepo, ctx.orgId) : undefined;

  // Resolve container infrastructure
  const tierProfile = await resolveTierProfile(ctx.orgId);
  const bridgeName = await resolveOrgBridge(ctx.orgId, app.org_slug);

  // Trigger deploy agent (async - don't wait)
  triggerDeployAgent({
    deploymentId,
    app: {
      id: app.id,
      slug: app.slug,
      orgSlug: app.org_slug,
      framework: app.framework || 'bun-server',
      gitBranch, // Uses environment branch if set, else app default
      settings: app.settings || {},
    },
    environment: {
      id: environment.id,
      name: environment.name,
      port: environment.port!,
      containerName: environment.container_name,
      containerIP: (environment as unknown as { container_ip?: string }).container_ip || null,
      deploymentMode,
      bridgeName: bridgeName || null,
      settings: (environment as unknown as { settings?: Record<string, unknown> }).settings || {},
    },
    envVars,
    skipGitPull,
    gitToken,
    gitRepo,
    tierProfile,
  }).catch(err => {
    console.error('[deployment-api] Failed to trigger deploy agent:', err);
    // Update deployment to failed if agent trigger fails
    sql`
      UPDATE app_deployments
      SET status = 'failed', error_message = ${String(err)}, completed_at = now()
      WHERE id = ${deploymentId}
    `.catch(() => {});
    sql`
      UPDATE app_environments SET status = 'failed' WHERE id = ${environment.id}
    `.catch(() => {});
  });

  return Response.json({
    deploymentId,
    status: 'pending',
    environment: env,
    message: 'Deployment triggered',
    statusUrl: `/v1/apps/${appId}/environments/${env}/status`,
    logsUrl: `/v1/apps/${appId}/environments/${env}/logs`,
  });
}

interface DeployAgentRequest {
  deploymentId: string;
  app: {
    id: string;
    slug: string;
    orgSlug: string;
    framework: string;
    gitBranch: string;
    settings: Record<string, unknown>;
  };
  environment: {
    id: string;
    name: string;
    port: number;
    containerName: string | null;
    containerIP: string | null;
    deploymentMode: 'systemd' | 'container';
    bridgeName: string | null;
    settings: Record<string, unknown>;
  };
  envVars?: Record<string, string>;
  skipGitPull?: boolean;
  gitToken?: string;
  gitRepo?: string;
  forceOverwrite?: boolean;
  tierProfile?: string;
}

/**
 * Trigger the deploy agent to execute deployment
 */
async function triggerDeployAgent(config: DeployAgentRequest): Promise<void> {
  const callbackUrl = `http://127.0.0.1:3003/v1/deployments/${config.deploymentId}/status`;

  // Extract build config from app settings if present
  const appSettings = config.app.settings as {
    buildDir?: string;
    frontendDir?: string;
    installCmd?: string[];
    buildCmd?: string[];
    frontendInstallCmd?: string[];
    frontendBuildCmd?: string[];
    directoryLayout?: 'monorepo' | 'legacy';
  };

  // For monorepo apps, set buildDir to the app slug so the deploy agent
  // knows to look for the app subdirectory within the org repo
  const effectiveBuildDir = appSettings.buildDir ||
    (appSettings.directoryLayout === 'monorepo' ? config.app.slug : undefined);

  const response = await fetch(`${DEPLOY_AGENT_URL}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify({
      // Required fields
      deploymentId: config.deploymentId,
      callbackUrl,

      // App info
      appId: config.app.id,
      appSlug: config.app.slug,
      orgSlug: config.app.orgSlug,
      envName: config.environment.name,

      // Deployment config
      framework: config.app.framework,
      gitBranch: config.app.gitBranch,
      port: config.environment.port,

      // Optional overrides from settings
      serviceName: config.environment.containerName,
      buildDir: effectiveBuildDir,
      frontendDir: appSettings.frontendDir,
      installCmd: appSettings.installCmd,
      buildCmd: appSettings.buildCmd,
      frontendInstallCmd: appSettings.frontendInstallCmd,
      frontendBuildCmd: appSettings.frontendBuildCmd,

      // Env vars and scaffold support
      envVars: config.envVars,
      skipGitPull: config.skipGitPull,

      // Git authentication for private repos
      gitToken: config.gitToken,
      gitRepo: config.gitRepo,

      // Safety options
      forceOverwrite: config.forceOverwrite,

      // Container deployment (Incus)
      deploymentMode: config.environment.deploymentMode,
      containerName: config.environment.containerName,
      containerIP: config.environment.containerIP,
      bridgeName: config.environment.bridgeName,
      tierProfile: config.tierProfile,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deploy agent error: ${response.status} - ${text}`);
  }
}

/**
 * Callback endpoint for deploy agent to report status
 */
export async function handleDeploymentCallback(
  req: Request,
  params: { deploymentId: string }
): Promise<Response> {
  // Verify deploy secret
  const secret = req.headers.get('X-Deploy-Secret');
  if (secret !== DEPLOY_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { deploymentId } = params;

  interface CallbackBody {
    status: 'building' | 'deploying' | 'success' | 'failed';
    logs?: string;
    error?: string;
    buildLog?: string;
    deployLog?: string;
    commitSha?: string;
    logLines?: string[];
    stage?: string;
    schedules?: Record<string, unknown>;
    feature_flags?: Record<string, unknown>;
    auth?: { roles?: Record<string, { permissions: string[]; description?: string }> } | false;
  }

  let body: CallbackBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Get deployment to find environment
  const deployment = await sql`
    SELECT id, environment_id FROM app_deployments WHERE id = ${deploymentId}
  `;

  if (deployment.length === 0) {
    return Response.json({ error: 'Deployment not found' }, { status: 404 });
  }

  const envId = deployment[0].environment_id;
  const isLogFlush = req.headers.get('X-Log-Flush') === 'true';

  // For log-only flushes, skip heavy DB updates — just notify
  if (!isLogFlush) {
    // Update deployment record
    await sql`
      UPDATE app_deployments
      SET
        status = ${body.status},
        build_log = COALESCE(${body.buildLog || null}, build_log),
        deploy_log = COALESCE(${body.deployLog || null}, deploy_log),
        error_message = COALESCE(${body.error || null}, error_message),
        commit_sha = COALESCE(${body.commitSha || null}, commit_sha),
        completed_at = ${body.status === 'success' || body.status === 'failed' ? new Date().toISOString() : null}
      WHERE id = ${deploymentId}
    `;

    // Append stage transition to audit trail
    const stageEntry = JSON.stringify([{
      status: body.status,
      stage: body.stage || null,
      timestamp: new Date().toISOString(),
      error: body.error || null,
    }]);
    await sql`
      UPDATE app_deployments
      SET stage_history = COALESCE(stage_history, '[]'::jsonb) || ${stageEntry}::jsonb
      WHERE id = ${deploymentId}
    `;

    // Update environment status
    const envStatus = body.status === 'success' ? 'running' :
                      body.status === 'failed' ? 'failed' :
                      body.status;

    await sql`
      UPDATE app_environments
      SET
        status = ${envStatus},
        last_deployed_at = ${body.status === 'success' ? new Date().toISOString() : null},
        last_deploy_commit = COALESCE(${body.commitSha || null}, last_deploy_commit),
        updated_at = now()
      WHERE id = ${envId}
    `;

    // Clear routing cache on any status change
    {
      const env = await sql`SELECT subdomain FROM app_environments WHERE id = ${envId}`;
      if (env.length > 0 && env[0].subdomain) {
        clearEnvironmentCache(env[0].subdomain);
      }
    }

    // On successful deploy, sync schedules from signaldb.yaml (sent by deploy agent)
    if (body.status === 'success' && envId && body.schedules) {
      try {
        const { syncSchedulesFromYaml } = await import('../lib/schedule-sync');
        await syncSchedulesFromYaml(envId, body.schedules as any);
      } catch (schedErr) {
        console.warn('[deployment-api] Schedule sync error:', schedErr);
      }
    }

    // On successful deploy, sync feature flags from signaldb.yaml (sent by deploy agent)
    if (body.status === 'success' && envId && body.feature_flags) {
      try {
        // Resolve orgId from environment → app → org
        const orgRows = await sql`
          SELECT a.org_id FROM app_environments ae
          JOIN apps a ON a.id = ae.app_id
          WHERE ae.id = ${envId}
        `;
        if (orgRows.length > 0) {
          const { syncFlagsFromYaml } = await import('../lib/flag-sync');
          await syncFlagsFromYaml(orgRows[0].org_id, body.feature_flags as any);
        }
      } catch (flagErr) {
        console.warn('[deployment-api] Feature flag sync error:', flagErr);
      }
    }

    // On successful deploy, sync capabilities from signaldb.yaml
    if (body.status === 'success' && envId && body.capabilities) {
      try {
        const { syncCapabilities } = await import('../lib/capability-sync');
        await syncCapabilities(envId, body.capabilities as Record<string, boolean | Record<string, unknown>>);
      } catch (capErr) {
        console.warn('[deployment-api] Capability sync error:', capErr);
      }
    }

    // On successful deploy, handle auth config from signaldb.yaml
    if (body.status === 'success' && envId) {
      // If auth: false, disable the auth gate on this environment
      if (body.auth === false) {
        try {
          await sql`
            UPDATE app_environments
            SET auth_gate_enabled = false
            WHERE id = ${envId}
          `;
          console.log(`[deploy] Auth gate disabled (auth: false in config) for env ${envId}`);
        } catch (disableErr) {
          console.warn('[deploy] Failed to disable auth gate:', disableErr);
        }
      } else if (body.auth && typeof body.auth === 'object' && body.auth.roles) {
        // Sync auth role definitions from signaldb.yaml
        try {
          const envInfo = await sql`
            SELECT ae.auth_gate_project_id
            FROM app_environments ae
            WHERE ae.id = ${envId}
          `;
          const projectId = envInfo[0]?.auth_gate_project_id;
          if (projectId) {
            const { syncRoleDefinitions } = await import('../lib/role-sync');
            await syncRoleDefinitions(projectId, body.auth.roles);
          }
        } catch (roleErr) {
          console.warn('[deployment-api] Role sync error:', roleErr);
        }
      }

      // Verify auth chain is wired up (non-blocking diagnostic) — skip if auth disabled
      if (body.auth !== false) {
        try {
          const envCheck = await sql`
            SELECT auth_gate_enabled, auth_gate_project_id FROM app_environments WHERE id = ${envId}
          `;
          if (envCheck[0]?.auth_gate_enabled && envCheck[0]?.auth_gate_project_id) {
            const projCheck = await sql`
              SELECT p.id, p.jwt_secret IS NOT NULL as has_secret,
                     pd.id IS NOT NULL as has_db, ac.id IS NOT NULL as has_auth
              FROM projects p
              LEFT JOIN project_databases pd ON pd.project_id = p.id AND pd.status = 'active'
              LEFT JOIN auth_configs ac ON ac.project_id = p.id
              WHERE p.id = ${envCheck[0].auth_gate_project_id}
            `;
            if (!projCheck[0]) {
              console.warn(`[deploy] Auth chain broken: project ${envCheck[0].auth_gate_project_id} not found`);
            } else if (!projCheck[0].has_secret) {
              console.warn(`[deploy] Auth chain: missing jwt_secret on project ${projCheck[0].id}`);
            } else if (!projCheck[0].has_db) {
              console.warn(`[deploy] Auth chain: missing project_databases for project ${projCheck[0].id}`);
            } else if (!projCheck[0].has_auth) {
              console.warn(`[deploy] Auth chain: missing auth_configs for project ${projCheck[0].id}`);
            } else {
              console.log(`[deploy] Auth chain verified for project ${projCheck[0].id}`);
            }
          }
        } catch (chainErr) {
          // Non-blocking — never fail a deploy for this
          console.warn('[deploy] Auth chain check error:', chainErr);
        }
      }
    }
  }

  // Send pg_notify for real-time SSE streaming
  try {
    const channel = `deploy_${deploymentId.replace(/-/g, '_')}`;
    const notifyPayload: Record<string, unknown> = {
      type: isLogFlush ? 'log' : 'status',
      deploymentId,
      status: body.status,
      stage: body.stage || null,
      ts: Date.now(),
    };

    if (body.logLines && body.logLines.length > 0) {
      notifyPayload.lines = body.logLines;
    }
    if (body.error) {
      notifyPayload.error = body.error;
    }

    // Truncate payload to stay under PG NOTIFY 8KB limit (use 7500 byte budget)
    let payloadStr = JSON.stringify(notifyPayload);
    if (payloadStr.length > 7500) {
      // Trim log lines to fit
      const lines = (notifyPayload.lines as string[]) || [];
      while (payloadStr.length > 7500 && lines.length > 0) {
        lines.shift();
        notifyPayload.lines = lines;
        payloadStr = JSON.stringify(notifyPayload);
      }
    }

    await sql`SELECT pg_notify(${channel}, ${payloadStr})`;
  } catch (err) {
    console.error('[deployment-api] pg_notify error:', err);
  }

  return Response.json({ received: true, status: body.status });
}

/**
 * Promote one environment to another (e.g., dev → production)
 * Uses atomic port swap for zero-downtime deployment
 */
export async function promoteEnvironment(
  req: Request,
  params: { appId: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId } = params;

  // Parse body
  interface PromoteBody {
    from: string;  // source environment name
    to: string;    // target environment name
  }

  let body: PromoteBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.from || !body.to) {
    return Response.json({ error: 'from and to are required' }, { status: 400 });
  }

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT a.id, a.slug, o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get both environments
  const environments = await sql<Environment[]>`
    SELECT id, name, port, status, subdomain, container_name, container_ip, deployment_mode
    FROM app_environments
    WHERE app_id = ${appId} AND name IN (${body.from}, ${body.to})
  `;

  const fromEnv = environments.find(e => e.name === body.from);
  const toEnv = environments.find(e => e.name === body.to);

  if (!fromEnv) {
    return Response.json({ error: `Source environment '${body.from}' not found` }, { status: 404 });
  }
  if (!toEnv) {
    return Response.json({ error: `Target environment '${body.to}' not found` }, { status: 404 });
  }

  // Verify source is healthy
  if (fromEnv.status !== 'running') {
    return Response.json({
      error: 'Source environment not running',
      status: fromEnv.status,
    }, { status: 400 });
  }

  // Health check source
  if (fromEnv.port) {
    try {
      const healthUrl = `http://${CONNECT_APP_HOST}:${fromEnv.port}/health`;
      const healthRes = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!healthRes.ok) {
        return Response.json({
          error: 'Source environment health check failed',
          statusCode: healthRes.status,
        }, { status: 400 });
      }
    } catch (err) {
      return Response.json({
        error: 'Source environment unreachable',
        details: String(err),
      }, { status: 400 });
    }
  }

  // ── Container-aware promotion (blue-green swap) ──
  // For container mode: update socat target to point at the source container's IP
  // For systemd mode: atomic port swap in database
  const sourceDeployMode = (fromEnv as unknown as { deployment_mode?: string }).deployment_mode;
  if (sourceDeployMode === 'container' && (fromEnv as unknown as { container_ip?: string }).container_ip) {
    const sourceIP = (fromEnv as unknown as { container_ip: string }).container_ip;
    const targetInstanceName = toEnv.name === 'production'
      ? `${appCheck[0].slug}`
      : `${appCheck[0].slug}-${toEnv.name}`;

    try {
      const orgSlug = appCheck[0].org_slug;
      const fullInstanceName = `${orgSlug}-${targetInstanceName}`;

      // Delegate socat update to deploy agent (runs on host, not inside container)
      const fromContainerName = (fromEnv as unknown as { container_name: string }).container_name;
      const promoteRes = await fetch(`${DEPLOY_AGENT_URL}/promote-swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deploy-Secret': DEPLOY_SECRET,
        },
        body: JSON.stringify({
          productionContainer: (toEnv as unknown as { container_name?: string }).container_name || '',
          sourceContainer: fromContainerName,
          instanceName: fullInstanceName,
          port: toEnv.port,
        }),
      });

      const promoteData = await promoteRes.json() as { success?: boolean; error?: string; message?: string };
      if (!promoteRes.ok || !promoteData.success) {
        throw new Error(promoteData.error || promoteData.message || 'Promote swap failed');
      }

      // Swap container names and IPs in DB (3-step to avoid unique constraint on container_name)
      await sql.begin(async tx => {
        const fromContainerName = (fromEnv as unknown as { container_name: string }).container_name;
        const toContainerName = (toEnv as unknown as { container_name: string }).container_name;
        const fromIP = (fromEnv as unknown as { container_ip: string }).container_ip;
        const toIP = (toEnv as unknown as { container_ip: string }).container_ip;

        // Step 1: Clear source to avoid unique constraint
        await tx`
          UPDATE app_environments
          SET container_name = NULL, container_ip = NULL
          WHERE id = ${fromEnv.id}
        `;
        // Step 2: Set target to source's container
        await tx`
          UPDATE app_environments
          SET container_name = ${fromContainerName || null}, container_ip = ${fromIP || null}, last_deployed_at = now()
          WHERE id = ${toEnv.id}
        `;
        // Step 3: Set source to target's container
        await tx`
          UPDATE app_environments
          SET container_name = ${toContainerName || null}, container_ip = ${toIP || null}
          WHERE id = ${fromEnv.id}
        `;
      });
    } catch (err) {
      return Response.json({
        error: 'Container swap failed',
        message: String(err),
      }, { status: 500 });
    }
  } else {
    // Standard atomic port swap in database transaction
    await sql.begin(async tx => {
      const tempPort = -1; // Temporary value to avoid unique constraint

      // Step 1: Set target port to temp
      await tx`
        UPDATE app_environments
        SET port = ${tempPort}
        WHERE id = ${toEnv.id}
      `;

      // Step 2: Set source port to target's old port
      await tx`
        UPDATE app_environments
        SET port = ${toEnv.port}
        WHERE id = ${fromEnv.id}
      `;

      // Step 3: Set target port to source's old port
      await tx`
        UPDATE app_environments
        SET port = ${fromEnv.port}, last_deployed_at = now()
        WHERE id = ${toEnv.id}
      `;
    });
  }

  // Clear routing cache for both environments
  if (fromEnv.subdomain) clearEnvironmentCache(fromEnv.subdomain);
  if (toEnv.subdomain) clearEnvironmentCache(toEnv.subdomain);

  // Create deployment record for the promotion
  await sql`
    INSERT INTO app_deployments (
      environment_id,
      deployment_type,
      status,
      completed_at
    ) VALUES (
      ${toEnv.id},
      'promote',
      'success',
      now()
    )
  `;

  return Response.json({
    success: true,
    message: `Promoted ${body.from} to ${body.to}`,
    promoted: {
      from: {
        name: fromEnv.name,
        newPort: toEnv.port,
      },
      to: {
        name: toEnv.name,
        newPort: fromEnv.port,
      },
    },
  });
}

/**
 * Rollback to previous deployment
 */
export async function rollbackEnvironment(
  req: Request,
  params: { appId: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId } = params;

  // Parse body (optional target deployment ID)
  interface RollbackBody {
    environment?: string;  // Environment to rollback (default: production)
    deploymentId?: string; // Specific deployment to rollback to
  }

  let body: RollbackBody = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK
  }

  const envName = body.environment || 'production';

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id, slug FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get environment
  const envResult = await sql<Environment[]>`
    SELECT id, name, port, status, subdomain, container_name, container_ip, deployment_mode
    FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;

  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const environment = envResult[0];

  // Get previous successful deployment
  const previousDeployments = await sql`
    SELECT id, commit_sha, snapshot_name, created_at
    FROM app_deployments
    WHERE environment_id = ${environment.id}
      AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 2
  `;

  if (previousDeployments.length < 2) {
    return Response.json({
      error: 'No previous deployment to rollback to',
      hint: 'At least 2 successful deployments required for rollback',
    }, { status: 400 });
  }

  // The previous deployment (skip current)
  const targetDeployment = body.deploymentId
    ? previousDeployments.find(d => d.id === body.deploymentId)
    : previousDeployments[1];

  if (!targetDeployment) {
    return Response.json({
      error: 'Target deployment not found',
      availableDeployments: previousDeployments.map(d => ({
        id: d.id,
        commitSha: d.commit_sha,
        createdAt: d.created_at,
      })),
    }, { status: 404 });
  }

  // ── Snapshot-based rollback for container mode ──
  if (environment.deployment_mode === 'container' && targetDeployment.snapshot_name && environment.container_name) {
    const startTime = Date.now();

    // Create rollback deployment record
    const deployment = await sql`
      INSERT INTO app_deployments (
        environment_id, deployment_type, status, commit_sha, snapshot_name
      ) VALUES (
        ${environment.id}, 'rollback', 'deploying', ${targetDeployment.commit_sha}, ${targetDeployment.snapshot_name}
      )
      RETURNING id
    `;

    await sql`
      UPDATE app_environments SET status = 'deploying', updated_at = now()
      WHERE id = ${environment.id}
    `;

    if (environment.subdomain) clearEnvironmentCache(environment.subdomain);

    try {
      // Snapshot restore via deploy agent (runs on host, not inside container)
      const restoreRes = await fetch(`${DEPLOY_AGENT_URL}/snapshot-restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deploy-Secret': DEPLOY_SECRET,
        },
        body: JSON.stringify({
          containerName: environment.container_name,
          snapshotName: targetDeployment.snapshot_name,
        }),
      });

      const restoreData = await restoreRes.json() as { success?: boolean; containerIP?: string; error?: string; message?: string };
      if (!restoreRes.ok || !restoreData.success) {
        throw new Error(restoreData.error || restoreData.message || 'Snapshot restore failed');
      }

      // Update container IP if it changed after restore
      if (restoreData.containerIP && restoreData.containerIP !== environment.container_ip) {
        await sql`
          UPDATE app_environments SET container_ip = ${restoreData.containerIP}, updated_at = now()
          WHERE id = ${environment.id}
        `;
      }

      // Health check
      const healthUrl = `http://${CONNECT_APP_HOST}:${environment.port}/health`;
      let healthy = false;
      for (let i = 0; i < 15; i++) {
        try {
          const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
          if (res.ok) { healthy = true; break; }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 1000));
      }

      const durationMs = Date.now() - startTime;

      if (healthy) {
        await sql`
          UPDATE app_deployments
          SET status = 'success', completed_at = now(), duration_ms = ${durationMs}
          WHERE id = ${deployment[0].id}
        `;
        await sql`
          UPDATE app_environments SET status = 'running', updated_at = now()
          WHERE id = ${environment.id}
        `;

        return Response.json({
          deploymentId: deployment[0].id,
          status: 'success',
          method: 'snapshot_restore',
          durationMs,
          snapshotName: targetDeployment.snapshot_name,
          message: `Snapshot restored in ${durationMs}ms`,
        });
      } else {
        throw new Error('Health check failed after snapshot restore');
      }
    } catch (err) {
      await sql`
        UPDATE app_deployments
        SET status = 'failed', error_message = ${String(err)}, completed_at = now()
        WHERE id = ${deployment[0].id}
      `;
      await sql`
        UPDATE app_environments SET status = 'failed', updated_at = now()
        WHERE id = ${environment.id}
      `;
      return Response.json({
        error: 'Snapshot rollback failed',
        message: String(err),
        deploymentId: deployment[0].id,
      }, { status: 500 });
    }
  }

  // ── Standard rollback (rebuild-based) ──
  // Create rollback deployment record
  const deployment = await sql`
    INSERT INTO app_deployments (
      environment_id,
      deployment_type,
      status,
      commit_sha
    ) VALUES (
      ${environment.id},
      'rollback',
      'pending',
      ${targetDeployment.commit_sha}
    )
    RETURNING id
  `;

  // Update environment status
  await sql`
    UPDATE app_environments
    SET status = 'deploying', updated_at = now()
    WHERE id = ${environment.id}
  `;

  // Get org slug and bridge info for deploy agent
  const orgResult = await sql`
    SELECT o.slug as org_slug, o.bridge_name FROM apps a JOIN organizations o ON o.id = a.org_id WHERE a.id = ${appId}
  `;
  const orgSlug = orgResult[0]?.org_slug || 'unknown';
  const rollbackBridgeName = orgResult[0]?.bridge_name || null;

  // Clear routing cache for rollback
  if (environment.subdomain) {
    clearEnvironmentCache(environment.subdomain);
  }

  // Trigger deploy agent with rollback
  triggerDeployAgent({
    deploymentId: deployment[0].id,
    app: {
      id: appId,
      slug: appCheck[0].slug,
      orgSlug,
      framework: 'bun-server', // Will be determined by the existing build
      gitBranch: 'main',
      settings: {},
    },
    environment: {
      id: environment.id,
      name: environment.name,
      port: environment.port!,
      containerName: environment.container_name,
      containerIP: environment.container_ip,
      deploymentMode: environment.deployment_mode,
      bridgeName: rollbackBridgeName,
      settings: {},
    },
  }).catch(err => {
    console.error('[deployment-api] Rollback deploy agent failed:', err);
    sql`
      UPDATE app_deployments
      SET status = 'failed', error_message = ${String(err)}, completed_at = now()
      WHERE id = ${deployment[0].id}
    `.catch(() => {});
  });

  return Response.json({
    deploymentId: deployment[0].id,
    status: 'pending',
    environment: envName,
    rollbackTo: {
      deploymentId: targetDeployment.id,
      commitSha: targetDeployment.commit_sha,
      createdAt: targetDeployment.created_at,
    },
    message: 'Rollback initiated',
  });
}

/**
 * Clone an environment (e.g., production → staging)
 * For container mode: uses incus copy (ZFS CoW clone, ~0.5s)
 * For systemd mode: creates new environment record, triggers deploy
 */
export async function cloneEnvironment(
  req: Request,
  params: { appId: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId } = params;

  interface CloneBody {
    from: string;  // source environment name
    to: string;    // target environment name
  }

  let body: CloneBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.from || !body.to) {
    return Response.json({ error: 'from and to are required' }, { status: 400 });
  }

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT a.id, a.slug, a.framework, a.git_repo, a.git_branch,
      o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const app = appCheck[0];

  // Get source environment
  const sourceEnvResult = await sql<Environment[]>`
    SELECT id, name, port, status, subdomain, container_name, container_ip, deployment_mode
    FROM app_environments
    WHERE app_id = ${appId} AND name = ${body.from}
  `;
  if (sourceEnvResult.length === 0) {
    return Response.json({ error: `Source environment '${body.from}' not found` }, { status: 404 });
  }

  const sourceEnv = sourceEnvResult[0];

  // Check target doesn't already exist
  const existingTarget = await sql`
    SELECT id FROM app_environments WHERE app_id = ${appId} AND name = ${body.to}
  `;
  if (existingTarget.length > 0) {
    return Response.json({ error: `Target environment '${body.to}' already exists` }, { status: 409 });
  }

  // Allocate a new port (verified against actual host usage)
  const newPort = await allocateVerifiedPort();

  // Generate subdomain for target
  const targetSubdomain = body.to === 'production'
    ? app.org_slug
    : `${app.org_slug}-${body.to}`;

  const startTime = Date.now();

  // Create target environment record
  const newEnv = await sql`
    INSERT INTO app_environments (
      app_id, name, port, subdomain, status,
      deployment_mode, container_name, container_ip
    ) VALUES (
      ${appId}, ${body.to}, ${newPort}, ${targetSubdomain}, 'building',
      ${sourceEnv.deployment_mode}, NULL, NULL
    )
    RETURNING id
  `;

  const targetEnvId = newEnv[0].id;

  // ── Container clone (instant ZFS CoW) via deploy agent ──
  if (sourceEnv.deployment_mode === 'container' && sourceEnv.container_name) {
    const targetContainerName = `sdb-app-${app.org_slug}-${app.slug}-${body.to}`;
    const cloneInstanceName = `${app.org_slug}-${app.slug}-${body.to}`;

    try {
      const cloneResponse = await fetch(`${DEPLOY_AGENT_URL}/clone-container`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deploy-Secret': DEPLOY_SECRET,
        },
        body: JSON.stringify({
          sourceContainer: sourceEnv.container_name,
          targetContainer: targetContainerName,
          instanceName: cloneInstanceName,
          port: newPort,
        }),
      });

      const cloneData = await cloneResponse.json() as {
        success?: boolean;
        containerIP?: string;
        durationMs?: number;
        error?: string;
        message?: string;
      };

      if (!cloneResponse.ok || !cloneData.success) {
        throw new Error(cloneData.error || cloneData.message || 'Clone failed');
      }

      const containerIP = cloneData.containerIP!;
      const durationMs = cloneData.durationMs || (Date.now() - startTime);

      // Copy project_id, env_vars_encrypted, and settings from source env
      await sql`
        UPDATE app_environments
        SET project_id = source.project_id,
            env_vars_encrypted = source.env_vars_encrypted,
            settings = source.settings,
            container_name = ${targetContainerName},
            container_ip = ${containerIP},
            status = 'running',
            updated_at = now()
        FROM (
          SELECT project_id, env_vars_encrypted, settings
          FROM app_environments WHERE id = ${sourceEnv.id}
        ) source
        WHERE app_environments.id = ${targetEnvId}
      `;

      // Build corrected .env for the cloned container
      // The ZFS clone inherits the source's .env which has wrong subdomain/origin
      try {
        const envVars: Record<string, string> = {
          PORT: '3000', // Container internal port always 3000
          NODE_ENV: 'production',
          SIGNALDB_API_URL: 'https://api.signaldb.live',
          SIGNALDB_APP_ORIGIN: `https://${targetSubdomain}.signaldb.app`,
        };

        // Inject DATABASE_URL from linked project (same as triggerDeploy)
        const srcProjectResult = await sql`
          SELECT project_id FROM app_environments WHERE id = ${sourceEnv.id}
        `;
        const linkedProjectId = srcProjectResult[0]?.project_id;
        if (linkedProjectId) {
          try {
            const credResult = await sql`
              SELECT
                pd.database_name,
                COALESCE(pd.project_user, di.postgres_user) as username,
                COALESCE(
                  pgp_sym_decrypt(decode(pd.project_password_encrypted, 'hex'), ${ENCRYPTION_KEY}),
                  pgp_sym_decrypt(decode(di.postgres_password_encrypted, 'hex'), ${ENCRYPTION_KEY})
                ) as password,
                di.port as db_port
              FROM project_databases pd
              JOIN database_instances di ON di.id = pd.instance_id
              WHERE pd.project_id = ${linkedProjectId}
            `;
            if (credResult.length > 0) {
              const cred = credResult[0];
              // Container must use direct container IP, not host localhost
              envVars.DATABASE_URL = `postgresql://${cred.username}:${cred.password}@${cred.db_port === 5440 ? '10.34.154.210' : cred.db_port === 5441 ? '10.34.154.178' : '10.34.154.165'}:5432/${cred.database_name}`;
            }
          } catch (err) {
            console.warn('[clone] Failed to fetch project credentials for clone:', err);
          }
        }

        // Merge custom env vars from source env settings
        const srcSettingsResult = await sql`
          SELECT settings FROM app_environments WHERE id = ${sourceEnv.id}
        `;
        const srcSettings = srcSettingsResult[0]?.settings as Record<string, unknown> | undefined;
        if (srcSettings?.envVars) {
          const custom = srcSettings.envVars as Record<string, string>;
          for (const [key, value] of Object.entries(custom)) {
            envVars[key] = value;
          }
        }

        // Decrypt env_vars_encrypted from source
        try {
          const encVarsResult = await sql`
            SELECT env_vars_encrypted FROM app_environments WHERE id = ${sourceEnv.id}
          `;
          if (encVarsResult[0]?.env_vars_encrypted) {
            const decResult = await sql`
              SELECT pgp_sym_decrypt(${encVarsResult[0].env_vars_encrypted}::bytea, ${ENCRYPTION_KEY}) as decrypted
            `;
            if (decResult[0]?.decrypted) {
              const customVars = JSON.parse(decResult[0].decrypted);
              for (const [key, value] of Object.entries(customVars)) {
                envVars[key] = String(value);
              }
            }
          }
        } catch (err) {
          console.warn('[clone] Failed to decrypt env vars for clone:', err);
        }

        // Build .env content string
        const envLines: string[] = [];
        for (const [key, value] of Object.entries(envVars)) {
          envLines.push(`${key}=${value}`);
        }
        const envContent = envLines.join('\n') + '\n';

        // Push corrected .env to the cloned container
        const pushRes = await fetch(`${DEPLOY_AGENT_URL}/push-env`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Deploy-Secret': DEPLOY_SECRET,
          },
          body: JSON.stringify({
            containerName: targetContainerName,
            envContent,
          }),
        });

        if (!pushRes.ok) {
          const pushErr = await pushRes.json() as { error?: string };
          console.warn(`[clone] push-env failed (non-fatal): ${pushErr.error}`);
        }
      } catch (envErr) {
        console.warn('[clone] Env var injection failed (non-fatal):', envErr);
        // Non-fatal: clone still works, just with source's env vars
      }

      // Create deployment record
      await sql`
        INSERT INTO app_deployments (
          environment_id, deployment_type, status, completed_at, duration_ms
        ) VALUES (
          ${targetEnvId}, 'clone', 'success', now(), ${durationMs}
        )
      `;

      return Response.json({
        success: true,
        environmentId: targetEnvId,
        method: 'container_clone',
        containerName: targetContainerName,
        containerIP,
        port: newPort,
        subdomain: targetSubdomain,
        durationMs,
        message: `Environment cloned in ${durationMs}ms`,
      });
    } catch (err) {
      await sql`
        UPDATE app_environments SET status = 'failed', updated_at = now()
        WHERE id = ${targetEnvId}
      `;
      return Response.json({
        error: 'Container clone failed',
        message: String(err),
        environmentId: targetEnvId,
      }, { status: 500 });
    }
  }

  // ── Standard clone (create env + trigger deploy) ──
  await sql`
    UPDATE app_environments SET status = 'pending', updated_at = now()
    WHERE id = ${targetEnvId}
  `;

  return Response.json({
    success: true,
    environmentId: targetEnvId,
    method: 'deploy',
    port: newPort,
    subdomain: targetSubdomain,
    message: `Environment '${body.to}' created. Trigger a deploy to populate it.`,
  });
}

/**
 * Delete an environment — stops container, removes socat, cleans DB
 * Safety: rejects deletion of 'production' environments
 */
export async function deleteEnvironment(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  // Hard safety check: never delete production
  if (envName === 'production') {
    return Response.json({ error: 'Cannot delete the production environment' }, { status: 400 });
  }

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT a.id, a.slug, o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const app = appCheck[0];

  // Verify environment exists
  const envResult = await sql`
    SELECT id, name, container_name, port, status, subdomain
    FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const env = envResult[0];

  // Reject if active deployments in progress
  const activeDeployments = await sql`
    SELECT id FROM app_deployments
    WHERE environment_id = ${env.id}
      AND status IN ('pending', 'building', 'deploying')
  `;
  if (activeDeployments.length > 0) {
    return Response.json({
      error: 'Cannot delete environment with active deployments. Wait for them to complete or reset their status.',
    }, { status: 409 });
  }

  const instanceName = `${app.org_slug}-${app.slug}-${envName}`;
  const containerName = env.container_name || `sdb-app-${instanceName}`;

  try {
    // Call deploy agent on the HOST for container/socat cleanup
    // The API runs inside app-platform container and can't run incus directly
    const cleanupResponse = await fetch(`${DEPLOY_AGENT_URL}/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify({ containerName, instanceName }),
    });

    let cleanupResults: string[] = [];
    if (cleanupResponse.ok) {
      const cleanupData = await cleanupResponse.json() as { success: boolean; results: string[] };
      cleanupResults = cleanupData.results || [];
    } else {
      console.error(`[deleteEnvironment] Cleanup agent returned ${cleanupResponse.status}`);
      // Continue with DB cleanup even if container cleanup fails
    }

    // DB cleanup — cascades to deployments, domains, dependencies
    await sql`DELETE FROM app_environments WHERE id = ${env.id}`;

    // Clear routing cache for this subdomain
    const subdomain = envResult[0].subdomain;
    if (subdomain) {
      clearEnvironmentCache(subdomain);
    }

    return Response.json({
      success: true,
      message: `Environment "${envName}" deleted`,
      containerDeleted: containerName,
      instanceCleaned: instanceName,
      cleanupResults,
    });
  } catch (err) {
    return Response.json({
      error: 'Failed to delete environment',
      message: String(err),
    }, { status: 500 });
  }
}

/**
 * Reset stuck deployment status — escape hatch for envs stuck in building/deploying >10min
 */
export async function resetEnvironmentStatus(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Find environment
  const envResult = await sql`
    SELECT id, status FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const env = envResult[0];

  if (!['building', 'deploying'].includes(env.status)) {
    return Response.json({ error: `Environment is not stuck (status: ${env.status})` }, { status: 400 });
  }

  // Check if the deployment has been in progress for >10 minutes
  const stuckDeployments = await sql`
    SELECT id, started_at FROM app_deployments
    WHERE environment_id = ${env.id}
      AND status IN ('building', 'deploying')
    ORDER BY started_at DESC
    LIMIT 1
  `;

  if (stuckDeployments.length > 0) {
    const startedAt = new Date(stuckDeployments[0].started_at);
    const elapsedMs = Date.now() - startedAt.getTime();
    const tenMinutes = 10 * 60 * 1000;

    if (elapsedMs < tenMinutes) {
      const remainingMin = Math.ceil((tenMinutes - elapsedMs) / 60000);
      return Response.json({
        error: `Deployment started ${Math.floor(elapsedMs / 60000)}m ago. Wait ${remainingMin}m more before resetting.`,
      }, { status: 400 });
    }

    // Mark the stuck deployment as failed
    await sql`
      UPDATE app_deployments
      SET status = 'failed',
          error_message = 'Manually reset by user — deployment was stuck',
          completed_at = now()
      WHERE id = ${stuckDeployments[0].id}
    `;
  }

  // Reset environment status to 'failed'
  await sql`
    UPDATE app_environments
    SET status = 'failed', updated_at = now()
    WHERE id = ${env.id}
  `;

  return Response.json({
    success: true,
    message: `Environment "${envName}" status reset to failed`,
  });
}

/**
 * Stop environment — stop container + socat forwarder
 */
export async function stopEnvironment(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id, status, container_name, subdomain FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const env = envResult[0];
  if (env.status === 'stopped') {
    return Response.json({ error: 'Environment is already stopped' }, { status: 400 });
  }

  const resolved = await resolveServiceInstance(appId, envName, ctx.orgId);
  if (!resolved) {
    return Response.json({ error: 'Could not resolve service instance' }, { status: 500 });
  }

  const containerName = resolved.containerName || `sdb-app-${resolved.serviceName}`;

  try {
    const agentRes = await fetch(`${DEPLOY_AGENT_URL}/container-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify({
        containerName,
        instanceName: resolved.serviceName,
      }),
    });

    if (!agentRes.ok) {
      const data = await agentRes.json().catch(() => ({}));
      return Response.json({ error: 'Deploy agent failed', detail: data }, { status: 500 });
    }

    await sql`
      UPDATE app_environments SET status = 'stopped', updated_at = now()
      WHERE id = ${env.id}
    `;

    if (env.subdomain) clearEnvironmentCache(env.subdomain);

    return Response.json({ success: true, message: `Environment "${envName}" stopped` });
  } catch (err) {
    return Response.json({ error: 'Failed to stop environment', message: String(err) }, { status: 500 });
  }
}

/**
 * Start environment — start container + socat forwarder
 */
export async function startEnvironment(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id, status, container_name, subdomain FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const env = envResult[0];
  if (env.status !== 'stopped' && env.status !== 'failed') {
    return Response.json({ error: `Cannot start environment in "${env.status}" state` }, { status: 400 });
  }

  const resolved = await resolveServiceInstance(appId, envName, ctx.orgId);
  if (!resolved) {
    return Response.json({ error: 'Could not resolve service instance' }, { status: 500 });
  }

  const containerName = resolved.containerName || `sdb-app-${resolved.serviceName}`;

  try {
    const agentRes = await fetch(`${DEPLOY_AGENT_URL}/container-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify({
        containerName,
        instanceName: resolved.serviceName,
      }),
    });

    if (!agentRes.ok) {
      const data = await agentRes.json().catch(() => ({}));
      return Response.json({ error: 'Deploy agent failed', detail: data }, { status: 500 });
    }

    await sql`
      UPDATE app_environments SET status = 'running', updated_at = now()
      WHERE id = ${env.id}
    `;

    if (env.subdomain) clearEnvironmentCache(env.subdomain);

    return Response.json({ success: true, message: `Environment "${envName}" started` });
  } catch (err) {
    return Response.json({ error: 'Failed to start environment', message: String(err) }, { status: 500 });
  }
}

/**
 * Restart environment — restart container + socat forwarder
 */
export async function restartEnvironment(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id, status, container_name, subdomain FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const env = envResult[0];
  if (env.status !== 'running') {
    return Response.json({ error: `Cannot restart environment in "${env.status}" state` }, { status: 400 });
  }

  const resolved = await resolveServiceInstance(appId, envName, ctx.orgId);
  if (!resolved) {
    return Response.json({ error: 'Could not resolve service instance' }, { status: 500 });
  }

  const containerName = resolved.containerName || `sdb-app-${resolved.serviceName}`;

  try {
    const agentRes = await fetch(`${DEPLOY_AGENT_URL}/container-restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deploy-Secret': DEPLOY_SECRET,
      },
      body: JSON.stringify({
        containerName,
        instanceName: resolved.serviceName,
      }),
    });

    if (!agentRes.ok) {
      const data = await agentRes.json().catch(() => ({}));
      return Response.json({ error: 'Deploy agent failed', detail: data }, { status: 500 });
    }

    await sql`
      UPDATE app_environments SET status = 'running', updated_at = now()
      WHERE id = ${env.id}
    `;

    if (env.subdomain) clearEnvironmentCache(env.subdomain);

    return Response.json({ success: true, message: `Environment "${envName}" restarted` });
  } catch (err) {
    return Response.json({ error: 'Failed to restart environment', message: String(err) }, { status: 500 });
  }
}

/**
 * Toggle maintenance mode on/off for an environment
 */
export async function toggleMaintenance(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id, subdomain FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  let body: { enabled: boolean; redirectUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const env = envResult[0];

  await sql`
    UPDATE app_environments
    SET maintenance_mode = ${body.enabled},
        maintenance_url = ${body.redirectUrl || null},
        updated_at = now()
    WHERE id = ${env.id}
  `;

  // Clear proxy cache so the change takes effect immediately
  if (env.subdomain) clearEnvironmentCache(env.subdomain);
  clearEnvironmentCache(); // also clear full cache as custom domains may be in play

  return Response.json({
    success: true,
    message: body.enabled
      ? `Maintenance mode enabled for "${envName}"`
      : `Maintenance mode disabled for "${envName}"`,
    maintenance_mode: body.enabled,
    maintenance_url: body.redirectUrl || null,
  });
}

/**
 * Get full environment detail — combined data for the env detail page
 */
export async function getEnvironmentDetail(
  req: Request,
  params: { appId: string; envName: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, envName } = params;

  const appCheck = await sql`
    SELECT id, name, slug, framework, git_repo, git_branch FROM apps
    WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT
      ae.*,
      COALESCE(ae.maintenance_mode, false) as maintenance_mode,
      ae.maintenance_url
    FROM app_environments ae
    WHERE ae.app_id = ${appId} AND ae.name = ${envName}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  // Fetch recent 10 deployments for this environment
  const deployments = await sql`
    SELECT
      d.id, d.environment_id, d.deployment_type, d.status,
      d.commit_sha, d.commit_message, d.git_branch,
      d.started_at, d.completed_at, d.error_message,
      d.snapshot_name,
      ae.name as environment_name
    FROM app_deployments d
    JOIN app_environments ae ON ae.id = d.environment_id
    WHERE ae.app_id = ${appId} AND ae.name = ${envName}
    ORDER BY d.started_at DESC
    LIMIT 10
  `;

  // Fetch dependencies for this app
  const dependencies = await sql`
    SELECT
      ad.id, ad.app_id, ad.target_app_id as depends_on_app_id, ad.alias, ad.required,
      ae_src.name as environment_name, ad.target_environment_name as depends_on_env_name,
      dep_app.name as depends_on_app_name, dep_app.slug as depends_on_app_slug
    FROM app_dependencies ad
    JOIN apps dep_app ON dep_app.id = ad.target_app_id
    JOIN app_environments ae_src ON ae_src.id = ad.environment_id
    WHERE ad.app_id = ${appId}
  `;

  // Fetch custom domains for this environment
  const domains = await sql`
    SELECT id, domain, verified, verification_token, created_at
    FROM app_domains
    WHERE environment_id = ${envResult[0].id}
    ORDER BY created_at DESC
  `;

  return Response.json({
    app: appCheck[0],
    environment: envResult[0],
    deployments,
    dependencies,
    domains,
  });
}

/**
 * Provision per-project PostgreSQL user for a project
 */
export async function provisionProjectUser(
  req: Request,
  params: { projectId: string },
): Promise<Response> {
  // Verify deploy secret for internal auth
  const secret = req.headers.get('X-Deploy-Secret');
  if (secret !== DEPLOY_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = params;

  try {
    // Dynamic import to avoid circular dependency
    const { projectUserManager } = await import('../lib/project-user-manager');
    const result = await projectUserManager.provisionProjectUser(projectId, true);

    if (!result) {
      return Response.json({
        error: 'Failed to provision user - project may not exist or feature is disabled',
      }, { status: 400 });
    }

    return Response.json({
      username: result.username,
      created: result.created,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Provisioning failed',
    }, { status: 500 });
  }
}

/**
 * Get environment health status
 */
export async function getEnvironmentHealth(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const { appId, env } = params;

  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT port, status FROM app_environments
    WHERE app_id = ${appId} AND name = ${env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const environment = envResult[0];

  if (environment.status !== 'running' || !environment.port) {
    return Response.json({
      status: environment.status === 'running' ? 'no_port' : environment.status,
      healthy: false,
    });
  }

  try {
    const healthRes = await fetch(`http://${CONNECT_APP_HOST}:${environment.port}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    const healthy = healthRes.ok;

    // Update health_status in DB
    await sql`
      UPDATE app_environments
      SET health_status = ${healthy ? 'healthy' : 'unhealthy'}, updated_at = now()
      WHERE app_id = ${appId} AND name = ${env}
    `;

    return Response.json({
      status: healthy ? 'healthy' : 'unhealthy',
      healthy,
      statusCode: healthRes.status,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    await sql`
      UPDATE app_environments
      SET health_status = 'unhealthy', updated_at = now()
      WHERE app_id = ${appId} AND name = ${env}
    `;

    return Response.json({
      status: 'unreachable',
      healthy: false,
      checkedAt: new Date().toISOString(),
    });
  }
}

/**
 * Try to construct AdminContext from internal auth headers
 * Used by Console to call deployment API internally
 */
function getInternalAdminContext(req: Request): AdminContext | null {
  const secret = req.headers.get('X-Deploy-Secret');
  const orgId = req.headers.get('X-Org-Id');

  if (secret === DEPLOY_SECRET && orgId) {
    return { orgId } as AdminContext;
  }

  return null;
}

// =========================================================================
// Environment Readiness Check
// =========================================================================

interface ReadinessCheck {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail?: string;
}

export async function checkEnvironmentReadiness(appId: string, envName: string): Promise<{
  checks: ReadinessCheck[];
  passCount: number;
  failCount: number;
  skipCount: number;
  allPassed: boolean;
}> {
  const checks: ReadinessCheck[] = [];

  // 1. Environment exists
  const envRows = await sql`
    SELECT ae.id, ae.project_id, ae.port, ae.container_name, ae.auth_gate_enabled,
           a.org_id
    FROM app_environments ae
    JOIN apps a ON a.id = ae.app_id
    WHERE a.id = ${appId} AND ae.name = ${envName}
  `;
  if (envRows.length === 0) {
    checks.push({ name: 'environment_exists', status: 'fail', detail: 'Environment not found' });
    return { checks, passCount: 0, failCount: 1, skipCount: 0, allPassed: false };
  }
  const env = envRows[0];
  checks.push({ name: 'environment_exists', status: 'pass' });

  // 2. Project linked
  if (env.project_id) {
    checks.push({ name: 'project_linked', status: 'pass', detail: env.project_id });
  } else {
    checks.push({ name: 'project_linked', status: 'fail', detail: 'No project linked' });
  }

  // 3. Project database
  if (env.project_id) {
    const dbRows = await sql`
      SELECT pd.id FROM project_databases pd WHERE pd.project_id = ${env.project_id} AND pd.status = 'active'
    `;
    checks.push({
      name: 'project_database',
      status: dbRows.length > 0 ? 'pass' : 'fail',
      detail: dbRows.length > 0 ? undefined : 'No active database for project',
    });
  } else {
    checks.push({ name: 'project_database', status: 'skip', detail: 'No project linked' });
  }

  // 4. Auth gate
  if (env.auth_gate_enabled && env.project_id) {
    checks.push({ name: 'auth_gate', status: 'pass' });
  } else if (env.auth_gate_enabled && !env.project_id) {
    checks.push({ name: 'auth_gate', status: 'fail', detail: 'Auth gate enabled but no project linked' });
  } else {
    checks.push({ name: 'auth_gate', status: 'skip', detail: 'Auth gate not enabled' });
  }

  // 5. Auth config
  if (env.project_id) {
    const acRows = await sql`
      SELECT id, enabled FROM auth_configs WHERE project_id = ${env.project_id}
    `;
    if (acRows.length > 0 && acRows[0].enabled) {
      checks.push({ name: 'auth_config', status: 'pass' });
    } else if (acRows.length > 0) {
      checks.push({ name: 'auth_config', status: 'skip', detail: 'Auth config exists but disabled' });
    } else {
      checks.push({ name: 'auth_config', status: 'skip', detail: 'No auth config' });
    }
  } else {
    checks.push({ name: 'auth_config', status: 'skip', detail: 'No project linked' });
  }

  // 6. Storage credentials
  const storageRows = await sql`
    SELECT id FROM org_storage_credentials WHERE organization_id = ${env.org_id}
  `;
  checks.push({
    name: 'storage_credentials',
    status: storageRows.length > 0 ? 'pass' : 'skip',
    detail: storageRows.length > 0 ? undefined : 'No storage provisioned',
  });

  // 7. Platform key
  const orgRows = await sql`
    SELECT platform_key_prefix FROM organizations WHERE id = ${env.org_id}
  `;
  checks.push({
    name: 'platform_key',
    status: orgRows.length > 0 && orgRows[0].platform_key_prefix ? 'pass' : 'fail',
    detail: orgRows.length > 0 && orgRows[0].platform_key_prefix ? undefined : 'No platform key',
  });

  // 8. Port assigned
  checks.push({
    name: 'port_assigned',
    status: env.port ? 'pass' : 'fail',
    detail: env.port ? `Port ${env.port}` : 'No port assigned',
  });

  // 9. Container name
  checks.push({
    name: 'container_name',
    status: env.container_name ? 'pass' : 'fail',
    detail: env.container_name || 'No container name',
  });

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;
  for (let i = 0; i < checks.length; i++) {
    if (checks[i].status === 'pass') passCount++;
    else if (checks[i].status === 'fail') failCount++;
    else skipCount++;
  }

  return { checks, passCount, failCount, skipCount, allPassed: failCount === 0 };
}

/**
 * Route handler for deployment API
 */
export async function handleDeploymentRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {
  // Use internal auth context if provided (from Console)
  const effectiveCtx = getInternalAdminContext(req) || ctx;

  // Deployment callback (internal - from deploy agent)
  // POST /v1/deployments/:id/status
  const callbackMatch = pathname.match(/^\/v1\/deployments\/([^/]+)\/status$/);
  if (callbackMatch && req.method === 'POST') {
    return handleDeploymentCallback(req, { deploymentId: callbackMatch[1] });
  }

  // Stale deployment recovery (internal - from deploy agent on startup)
  // POST /v1/deployments/stale
  if (pathname === '/v1/deployments/stale' && req.method === 'POST') {
    const secret = req.headers.get('X-Deploy-Secret');
    if (secret !== DEPLOY_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body: { thresholdMs?: number } = {};
    try { body = await req.json(); } catch { /* empty body OK */ }
    const thresholdMs = body.thresholdMs || 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - thresholdMs).toISOString();

    const stale = await sql`
      UPDATE app_deployments
      SET status = 'failed',
          error_message = 'Deploy agent restarted during deployment',
          completed_at = now(),
          stage_history = COALESCE(stage_history, '[]'::jsonb) || ${JSON.stringify([{
            status: 'failed',
            stage: null,
            timestamp: new Date().toISOString(),
            error: 'Deploy agent restarted during deployment',
          }])}::jsonb
      WHERE status IN ('building', 'deploying')
        AND started_at < ${cutoff}
      RETURNING id, environment_id
    `;

    // Clear cache for affected environments
    for (let i = 0; i < stale.length; i++) {
      const env = await sql`SELECT subdomain FROM app_environments WHERE id = ${stale[i].environment_id}`;
      if (env.length > 0 && env[0].subdomain) {
        clearEnvironmentCache(env[0].subdomain);
      }
      // Also update environment status back to failed
      await sql`UPDATE app_environments SET status = 'failed', updated_at = now() WHERE id = ${stale[i].environment_id}`;
    }

    return Response.json({ recovered: stale.length });
  }

  // Provision per-project user (internal)
  // POST /v1/projects/:projectId/provision-user
  const provisionMatch = pathname.match(/^\/v1\/projects\/([^/]+)\/provision-user$/);
  if (provisionMatch && req.method === 'POST') {
    return provisionProjectUser(req, { projectId: provisionMatch[1] });
  }

  // All other routes require admin auth (already validated by caller)

  // List environments: GET /v1/apps/:appId/environments
  const envListMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments$/);
  if (envListMatch && req.method === 'GET') {
    return listEnvironments(req, { appId: envListMatch[1] }, effectiveCtx);
  }

  // Deploy to environment: POST /v1/apps/:appId/environments/:env/deploy
  const deployMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/deploy$/);
  if (deployMatch && req.method === 'POST') {
    return triggerDeploy(req, { appId: deployMatch[1], env: deployMatch[2] }, effectiveCtx);
  }

  // Get environment status: GET /v1/apps/:appId/environments/:env/status
  const statusMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'GET') {
    return getEnvironmentStatus(req, { appId: statusMatch[1], env: statusMatch[2] }, effectiveCtx);
  }

  // Get deployment logs: GET /v1/apps/:appId/environments/:env/logs
  const logsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/logs$/);
  if (logsMatch && req.method === 'GET') {
    return getDeploymentLogs(req, { appId: logsMatch[1], env: logsMatch[2] }, effectiveCtx);
  }

  // Get environment health: GET /v1/apps/:appId/environments/:env/health
  const healthMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/health$/);
  if (healthMatch && req.method === 'GET') {
    return getEnvironmentHealth(req, { appId: healthMatch[1], env: healthMatch[2] }, effectiveCtx);
  }

  // Get runtime logs: GET /v1/apps/:appId/environments/:env/runtime-logs
  const runtimeLogsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/runtime-logs$/);
  if (runtimeLogsMatch && req.method === 'GET') {
    return getRuntimeLogs(req, { appId: runtimeLogsMatch[1], env: runtimeLogsMatch[2] }, effectiveCtx);
  }

  // Stream runtime logs: GET /v1/apps/:appId/environments/:env/runtime-logs/stream
  const runtimeLogsStreamMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/runtime-logs\/stream$/);
  if (runtimeLogsStreamMatch && req.method === 'GET') {
    return streamRuntimeLogs(req, { appId: runtimeLogsStreamMatch[1], env: runtimeLogsStreamMatch[2] }, effectiveCtx);
  }

  // Clone environment: POST /v1/apps/:appId/environments/clone
  const cloneMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/clone$/);
  if (cloneMatch && req.method === 'POST') {
    return cloneEnvironment(req, { appId: cloneMatch[1] }, effectiveCtx);
  }

  // Reset environment status: POST /v1/apps/:appId/environments/:env/reset-status
  const resetStatusMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/reset-status$/);
  if (resetStatusMatch && req.method === 'POST') {
    return resetEnvironmentStatus(req, { appId: resetStatusMatch[1], envName: resetStatusMatch[2] }, effectiveCtx);
  }

  // Delete environment: DELETE /v1/apps/:appId/environments/:envName
  const deleteEnvMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)$/);
  if (deleteEnvMatch && req.method === 'DELETE') {
    return deleteEnvironment(req, { appId: deleteEnvMatch[1], envName: deleteEnvMatch[2] }, effectiveCtx);
  }

  // Promote environment: POST /v1/apps/:appId/promote
  const promoteMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/promote$/);
  if (promoteMatch && req.method === 'POST') {
    return promoteEnvironment(req, { appId: promoteMatch[1] }, effectiveCtx);
  }

  // Rollback environment: POST /v1/apps/:appId/rollback
  const rollbackMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/rollback$/);
  if (rollbackMatch && req.method === 'POST') {
    return rollbackEnvironment(req, { appId: rollbackMatch[1] }, effectiveCtx);
  }

  // Stop environment: POST /v1/apps/:appId/environments/:env/stop
  const stopMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/stop$/);
  if (stopMatch && req.method === 'POST') {
    return stopEnvironment(req, { appId: stopMatch[1], envName: stopMatch[2] }, effectiveCtx);
  }

  // Start environment: POST /v1/apps/:appId/environments/:env/start
  const startMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/start$/);
  if (startMatch && req.method === 'POST') {
    return startEnvironment(req, { appId: startMatch[1], envName: startMatch[2] }, effectiveCtx);
  }

  // Restart environment: POST /v1/apps/:appId/environments/:env/restart
  const restartMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/restart$/);
  if (restartMatch && req.method === 'POST') {
    return restartEnvironment(req, { appId: restartMatch[1], envName: restartMatch[2] }, effectiveCtx);
  }

  // Toggle maintenance mode: POST /v1/apps/:appId/environments/:env/maintenance
  const maintenanceMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/maintenance$/);
  if (maintenanceMatch && req.method === 'POST') {
    return toggleMaintenance(req, { appId: maintenanceMatch[1], envName: maintenanceMatch[2] }, effectiveCtx);
  }

  // Environment detail: GET /v1/apps/:appId/environments/:env/detail
  const detailMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/detail$/);
  if (detailMatch && req.method === 'GET') {
    return getEnvironmentDetail(req, { appId: detailMatch[1], envName: detailMatch[2] }, effectiveCtx);
  }

  // Environment readiness: GET /v1/apps/:appId/environments/:env/readiness
  const readinessMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/readiness$/);
  if (readinessMatch && req.method === 'GET') {
    try {
      const result = await checkEnvironmentReadiness(readinessMatch[1], readinessMatch[2]);
      return Response.json(result);
    } catch (err: any) {
      console.error('[deployment-api] Readiness check failed:', err);
      return Response.json({ error: 'Readiness check failed', detail: err?.message }, { status: 500 });
    }
  }

  // =========================================================================
  // Capabilities API
  // =========================================================================

  // Get capabilities: GET /v1/apps/:appId/capabilities
  const capsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/capabilities$/);
  if (capsMatch && req.method === 'GET') {
    return handleGetCapabilities(req, { appId: capsMatch[1] }, effectiveCtx);
  }

  // =========================================================================
  // Secret Provider API Endpoints
  // =========================================================================

  // List secret providers: GET /v1/secret-providers
  if (pathname === '/v1/secret-providers' && req.method === 'GET') {
    return handleListSecretProviders(req, effectiveCtx);
  }

  // Create secret provider: POST /v1/secret-providers
  if (pathname === '/v1/secret-providers' && req.method === 'POST') {
    return handleCreateSecretProvider(req, effectiveCtx);
  }

  // Update secret provider: PUT /v1/secret-providers/:id
  const updateProviderMatch = pathname.match(/^\/v1\/secret-providers\/([^/]+)$/);
  if (updateProviderMatch && req.method === 'PUT') {
    return handleUpdateSecretProvider(req, { id: updateProviderMatch[1] }, effectiveCtx);
  }

  // Delete secret provider: DELETE /v1/secret-providers/:id
  const deleteProviderMatch = pathname.match(/^\/v1\/secret-providers\/([^/]+)$/);
  if (deleteProviderMatch && req.method === 'DELETE') {
    return handleDeleteSecretProvider(req, { id: deleteProviderMatch[1] }, effectiveCtx);
  }

  // Test secret provider: POST /v1/secret-providers/:id/test
  const testProviderMatch = pathname.match(/^\/v1\/secret-providers\/([^/]+)\/test$/);
  if (testProviderMatch && req.method === 'POST') {
    return handleTestSecretProvider(req, { id: testProviderMatch[1] }, effectiveCtx);
  }

  // Link environment to secret provider: PUT /v1/apps/:appId/environments/:env/secret-provider
  const linkProviderMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/secret-provider$/);
  if (linkProviderMatch && req.method === 'PUT') {
    return handleLinkSecretProvider(req, { appId: linkProviderMatch[1], env: linkProviderMatch[2] }, effectiveCtx);
  }

  // =========================================================================
  // App Dependencies API Endpoints
  // =========================================================================

  // List dependencies: GET /v1/apps/:appId/dependencies
  const depsListMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/dependencies$/);
  if (depsListMatch && req.method === 'GET') {
    return handleListDependencies(req, { appId: depsListMatch[1] }, effectiveCtx);
  }

  // Add dependency: POST /v1/apps/:appId/environments/:env/dependencies
  const depsAddMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/dependencies$/);
  if (depsAddMatch && req.method === 'POST') {
    return handleAddDependency(req, { appId: depsAddMatch[1], env: depsAddMatch[2] }, effectiveCtx);
  }

  // Remove dependency: DELETE /v1/apps/:appId/dependencies/:depId
  const depsDeleteMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/dependencies\/([^/]+)$/);
  if (depsDeleteMatch && req.method === 'DELETE') {
    return handleRemoveDependency(req, { appId: depsDeleteMatch[1], depId: depsDeleteMatch[2] }, effectiveCtx);
  }

  // Validate dependencies: POST /v1/apps/:appId/dependencies/validate
  const depsValidateMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/dependencies\/validate$/);
  if (depsValidateMatch && req.method === 'POST') {
    return handleValidateDependencies(req, { appId: depsValidateMatch[1] }, effectiveCtx);
  }

  // =========================================================================
  // Git Provider API Endpoints
  // =========================================================================

  // Save git installation: POST /v1/git/callback
  if (pathname === '/v1/git/callback' && req.method === 'POST') {
    return handleGitCallback(req, effectiveCtx);
  }

  // List repos from git installation: GET /v1/git/repos
  if (pathname === '/v1/git/repos' && req.method === 'GET') {
    return handleListGitRepos(req, effectiveCtx);
  }

  // List branches for a repo: GET /v1/git/repos/:owner/:repo/branches
  const branchesMatch = pathname.match(/^\/v1\/git\/repos\/([^/]+)\/([^/]+)\/branches$/);
  if (branchesMatch && req.method === 'GET') {
    return handleListRepoBranches(req, { owner: branchesMatch[1], repo: branchesMatch[2] }, effectiveCtx);
  }

  // Generate ephemeral git token: POST /v1/git/token
  if (pathname === '/v1/git/token' && req.method === 'POST') {
    return handleGenerateGitToken(req, effectiveCtx);
  }

  // Update git installation permissions: PUT /v1/git/permissions
  if (pathname === '/v1/git/permissions' && req.method === 'PUT') {
    return handleUpdateGitPermissions(req, effectiveCtx);
  }

  // =========================================================================
  // App CRUD Endpoints
  // =========================================================================

  // List apps: GET /v1/apps
  if (pathname === '/v1/apps' && req.method === 'GET') {
    return handleListApps(req, effectiveCtx);
  }

  // Create app: POST /v1/apps
  if (pathname === '/v1/apps' && req.method === 'POST') {
    return handleCreateApp(req, effectiveCtx);
  }

  // Get app: GET /v1/apps/:appId (exact match, no sub-path)
  const getAppMatch = pathname.match(/^\/v1\/apps\/([^/]+)$/);
  if (getAppMatch && req.method === 'GET') {
    return handleGetApp(req, { appId: getAppMatch[1] }, effectiveCtx);
  }

  // Update app: PUT /v1/apps/:appId
  if (getAppMatch && req.method === 'PUT') {
    return handleUpdateApp(req, { appId: getAppMatch[1] }, effectiveCtx);
  }

  // Delete app: DELETE /v1/apps/:appId
  if (getAppMatch && req.method === 'DELETE') {
    return handleDeleteApp(req, { appId: getAppMatch[1] }, effectiveCtx);
  }

  // =========================================================================
  // Environment Variables Endpoints
  // =========================================================================

  // Get env vars: GET /v1/apps/:appId/environments/:env/variables
  const envVarsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/variables$/);
  if (envVarsMatch && req.method === 'GET') {
    return handleGetEnvVars(req, { appId: envVarsMatch[1], env: envVarsMatch[2] }, effectiveCtx);
  }

  // Update env vars: PUT /v1/apps/:appId/environments/:env/variables
  if (envVarsMatch && req.method === 'PUT') {
    return handleUpdateEnvVars(req, { appId: envVarsMatch[1], env: envVarsMatch[2] }, effectiveCtx);
  }

  // =========================================================================
  // Branch Override Endpoints
  // =========================================================================

  // Set branch: PUT /v1/apps/:appId/environments/:env/branch
  const branchMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/branch$/);
  if (branchMatch && req.method === 'PUT') {
    return handleUpdateBranch(req, { appId: branchMatch[1], env: branchMatch[2] }, effectiveCtx);
  }

  // Clear branch: DELETE /v1/apps/:appId/environments/:env/branch
  if (branchMatch && req.method === 'DELETE') {
    return handleClearBranch(req, { appId: branchMatch[1], env: branchMatch[2] }, effectiveCtx);
  }

  // =========================================================================
  // Database Linking Endpoints
  // =========================================================================

  // Link database: PUT /v1/apps/:appId/environments/:env/database
  const dbLinkMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/database$/);
  if (dbLinkMatch && req.method === 'PUT') {
    return handleLinkDatabase(req, { appId: dbLinkMatch[1], env: dbLinkMatch[2] }, effectiveCtx);
  }

  // Unlink database: DELETE /v1/apps/:appId/environments/:env/database
  if (dbLinkMatch && req.method === 'DELETE') {
    return handleUnlinkDatabase(req, { appId: dbLinkMatch[1], env: dbLinkMatch[2] }, effectiveCtx);
  }

  // =========================================================================
  // Custom Domain Endpoints
  // =========================================================================

  // List domains: GET /v1/apps/:appId/environments/:env/domains
  const domainsListMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/domains$/);
  if (domainsListMatch && req.method === 'GET') {
    return handleListDomains(req, { appId: domainsListMatch[1], env: domainsListMatch[2] }, effectiveCtx);
  }

  // Add domain: POST /v1/apps/:appId/environments/:env/domains
  if (domainsListMatch && req.method === 'POST') {
    return handleAddDomain(req, { appId: domainsListMatch[1], env: domainsListMatch[2] }, effectiveCtx);
  }

  // Remove domain: DELETE /v1/apps/:appId/domains/:domainId
  const domainDeleteMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/domains\/([^/]+)$/);
  if (domainDeleteMatch && req.method === 'DELETE') {
    return handleRemoveDomain(req, { appId: domainDeleteMatch[1], domainId: domainDeleteMatch[2] }, effectiveCtx);
  }

  // Verify domain: POST /v1/apps/:appId/domains/:domainId/verify
  const domainVerifyMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/domains\/([^/]+)\/verify$/);
  if (domainVerifyMatch && req.method === 'POST') {
    return handleVerifyDomain(req, { appId: domainVerifyMatch[1], domainId: domainVerifyMatch[2] }, effectiveCtx);
  }

  // =========================================================================
  // Dev Access (SSH Key Management) Endpoints
  // =========================================================================

  // List dev-access keys: GET /v1/apps/:appId/environments/:env/dev-access
  const devAccessListMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/dev-access$/);
  if (devAccessListMatch && req.method === 'GET') {
    return handleListDevAccessKeys(req, { appId: devAccessListMatch[1], env: devAccessListMatch[2] }, effectiveCtx);
  }

  // Generate dev-access key: POST /v1/apps/:appId/environments/:env/dev-access
  if (devAccessListMatch && req.method === 'POST') {
    return handleGenerateDevAccessKey(req, { appId: devAccessListMatch[1], env: devAccessListMatch[2] }, effectiveCtx);
  }

  // Revoke dev-access key: DELETE /v1/apps/:appId/environments/:env/dev-access/:keyId
  const devAccessDeleteMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/dev-access\/([^/]+)$/);
  if (devAccessDeleteMatch && req.method === 'DELETE') {
    return handleRevokeDevAccessKey(req, { appId: devAccessDeleteMatch[1], env: devAccessDeleteMatch[2], keyId: devAccessDeleteMatch[3] }, effectiveCtx);
  }

  // Not a deployment route
  return null;
}

// =========================================================================
// Runtime Logs Handlers
// =========================================================================

/**
 * Resolve systemd service instance name for an environment.
 * Returns the instance name used in signaldb-app@{instance}.service
 */
async function resolveServiceInstance(
  appId: string,
  envName: string,
  orgId: string,
): Promise<{ serviceName: string; deploymentMode: string | null; containerName: string | null; error?: string } | null> {
  // Get app + org info
  const appResult = await sql`
    SELECT a.slug as app_slug, o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${appId} AND a.org_id = ${orgId}
  `;
  if (appResult.length === 0) return null;

  const { app_slug, org_slug } = appResult[0];

  // Check for explicit container_name in app_environments
  const envResult = await sql`
    SELECT container_name, deployment_mode FROM app_environments
    WHERE app_id = ${appId} AND name = ${envName}
  `;
  if (envResult.length === 0) return null;

  // Instance naming: {org}-{app} for production, {org}-{app}-{env} for non-prod
  const instanceName = envResult[0].container_name
    || (envName === 'production'
      ? `${org_slug}-${app_slug}`
      : `${org_slug}-${app_slug}-${envName}`);

  return {
    serviceName: instanceName,
    deploymentMode: envResult[0].deployment_mode,
    containerName: envResult[0].container_name,
  };
}

/**
 * Read last N lines from journalctl for a systemd service
 */
async function readJournalctlLines(serviceName: string, lineCount: number): Promise<string> {
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const unit = `signaldb-app@${serviceName}`;
    const proc = spawn('sudo', ['journalctl', '-u', unit, '-n', String(lineCount), '--no-pager', '-o', 'short-iso'], {
      env: { ...process.env },
    });

    let output = '';
    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });
    proc.on('close', () => {
      resolve(output.trim());
    });
    proc.on('error', () => {
      resolve('');
    });
  });
}

/**
 * Get runtime logs (stdout + stderr) for an environment via journalctl
 * Container-mode apps: fetches logs via deploy agent (incus exec journalctl)
 * Systemd-mode apps: reads journalctl directly on host
 */
async function getRuntimeLogs(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const { appId, env } = params;

  const resolved = await resolveServiceInstance(appId, env, ctx.orgId);
  if (!resolved) {
    return Response.json({ error: 'App or environment not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const lines = Math.min(Number(url.searchParams.get('lines')) || 200, 1000);

  // Container mode: delegate to deploy agent
  if (resolved.deploymentMode === 'container' && resolved.containerName) {
    try {
      const logsResponse = await fetch(
        `${DEPLOY_AGENT_URL}/container-logs?container=${encodeURIComponent(resolved.containerName)}&lines=${lines}`,
        {
          headers: { 'X-Deploy-Secret': DEPLOY_SECRET },
        }
      );
      if (logsResponse.ok) {
        const data = await logsResponse.json() as { stdout: string; stderr: string; containerName: string };
        return Response.json({
          stdout: data.stdout,
          stderr: data.stderr,
          serviceName: resolved.containerName,
        });
      }
      const errData = await logsResponse.json() as { error?: string };
      return Response.json({
        stdout: '',
        stderr: errData.error || `Deploy agent returned ${logsResponse.status}`,
        serviceName: resolved.containerName,
      });
    } catch (err: any) {
      return Response.json({
        stdout: '',
        stderr: `Failed to fetch container logs: ${err.message}`,
        serviceName: resolved.containerName,
      });
    }
  }

  // Systemd mode: read directly via journalctl
  const stdout = await readJournalctlLines(resolved.serviceName, lines);

  return Response.json({
    stdout,
    stderr: '', // journalctl merges stdout/stderr
    serviceName: resolved.serviceName,
  });
}

/**
 * Stream runtime logs via SSE using journalctl -f (follow mode)
 */
async function streamRuntimeLogs(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const { appId, env } = params;

  const resolved = await resolveServiceInstance(appId, env, ctx.orgId);
  if (!resolved) {
    return Response.json({ error: 'App or environment not found' }, { status: 404 });
  }

  // Container mode: proxy SSE from deploy agent's /container-logs/stream
  if (resolved.deploymentMode === 'container' && resolved.containerName) {
    try {
      const streamUrl = `${DEPLOY_AGENT_URL}/container-logs/stream?container=${encodeURIComponent(resolved.containerName)}`;
      const agentRes = await fetch(streamUrl, {
        headers: { 'X-Deploy-Secret': DEPLOY_SECRET },
        signal: req.signal,
      });

      if (!agentRes.ok) {
        const errData = await agentRes.json() as { error?: string };
        return Response.json({
          error: errData.error || `Deploy agent returned ${agentRes.status}`,
        }, { status: agentRes.status });
      }

      // Proxy the SSE stream directly from deploy agent
      return new Response(agentRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err: any) {
      return Response.json({
        error: `Failed to connect to deploy agent for streaming: ${err.message}`,
      }, { status: 502 });
    }
  }

  // Systemd mode: spawn journalctl -f directly
  const { spawn } = await import('child_process');
  const encoder = new TextEncoder();
  const signal = req.signal;

  // Max stream duration: 5 minutes
  const MAX_STREAM_MS = 5 * 60 * 1000;
  const KEEPALIVE_INTERVAL_MS = 30000;

  const unit = `signaldb-app@${resolved.serviceName}`;

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

      // Send connected event
      safeSend('connected', JSON.stringify({ serviceName: resolved.serviceName }));

      // Spawn journalctl -f (follow) process
      const journalProc = spawn('sudo', ['journalctl', '-u', unit, '-f', '-o', 'short-iso', '--since', 'now'], {
        env: { ...process.env },
      });

      // Buffer partial lines
      let lineBuffer = '';

      journalProc.stdout.on('data', (data: Buffer) => {
        if (closed) return;
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        // Keep the last incomplete line in buffer
        lineBuffer = lines.pop() || '';

        const completeLines = lines.filter(l => l.length > 0);
        if (completeLines.length > 0) {
          safeSend('log', JSON.stringify({ lines: completeLines, source: 'stdout' }));
        }
      });

      journalProc.stderr.on('data', (data: Buffer) => {
        if (closed) return;
        const lines = data.toString().split('\n').filter(l => l.length > 0);
        if (lines.length > 0) {
          safeSend('log', JSON.stringify({ lines, source: 'stderr' }));
        }
      });

      journalProc.on('close', () => {
        if (!closed) {
          // Flush any remaining buffered content
          if (lineBuffer.trim().length > 0) {
            safeSend('log', JSON.stringify({ lines: [lineBuffer.trim()], source: 'stdout' }));
          }
          closed = true;
          try { controller.close(); } catch {}
        }
      });

      // Keepalive
      const keepalive = setInterval(() => {
        safeSend('ping', JSON.stringify({ ts: Date.now() }));
      }, KEEPALIVE_INTERVAL_MS);

      // Max lifetime
      const maxLifetime = setTimeout(() => {
        closed = true;
        journalProc.kill('SIGTERM');
        clearInterval(keepalive);
        try { controller.close(); } catch {}
      }, MAX_STREAM_MS);

      // Abort handler
      signal.addEventListener('abort', () => {
        closed = true;
        journalProc.kill('SIGTERM');
        clearInterval(keepalive);
        clearTimeout(maxLifetime);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// =========================================================================
// Secret Provider Handlers
// =========================================================================

async function handleListSecretProviders(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  const providers = await sql`
    SELECT id, org_id, name, provider, settings, created_at, updated_at
    FROM organization_secret_providers
    WHERE org_id = ${ctx.orgId}
    ORDER BY created_at DESC
  `;

  return Response.json({ data: providers });
}

async function handleCreateSecretProvider(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  let body: { name?: string; provider?: string; credentials?: Record<string, string>; settings?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.credentials?.clientId || !body.credentials?.clientSecret) {
    return Response.json({ error: 'credentials.clientId and credentials.clientSecret are required' }, { status: 400 });
  }

  const credentialsJson = JSON.stringify(body.credentials);

  const result = await sql`
    INSERT INTO organization_secret_providers (
      org_id, name, provider, credentials_encrypted, settings
    ) VALUES (
      ${ctx.orgId},
      ${body.name || 'Infisical'},
      ${body.provider || 'infisical'},
      pgp_sym_encrypt(${credentialsJson}, ${ENCRYPTION_KEY}),
      ${body.settings || {}}
    )
    RETURNING id, org_id, name, provider, settings, created_at, updated_at
  `;

  return Response.json({ data: result[0] }, { status: 201 });
}

async function handleUpdateSecretProvider(
  req: Request,
  params: { id: string },
  ctx: AdminContext,
): Promise<Response> {
  let body: { name?: string; credentials?: Record<string, string>; settings?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify provider belongs to org
  const existing = await sql`
    SELECT id FROM organization_secret_providers
    WHERE id = ${params.id} AND org_id = ${ctx.orgId}
  `;
  if (existing.length === 0) {
    return Response.json({ error: 'Secret provider not found' }, { status: 404 });
  }

  // Build dynamic update
  if (body.credentials) {
    const credentialsJson = JSON.stringify(body.credentials);
    await sql`
      UPDATE organization_secret_providers
      SET
        name = COALESCE(${body.name || null}, name),
        credentials_encrypted = pgp_sym_encrypt(${credentialsJson}, ${ENCRYPTION_KEY}),
        settings = COALESCE(${body.settings || null}, settings),
        updated_at = now()
      WHERE id = ${params.id}
    `;
  } else {
    await sql`
      UPDATE organization_secret_providers
      SET
        name = COALESCE(${body.name || null}, name),
        settings = COALESCE(${body.settings || null}, settings),
        updated_at = now()
      WHERE id = ${params.id}
    `;
  }

  const updated = await sql`
    SELECT id, org_id, name, provider, settings, created_at, updated_at
    FROM organization_secret_providers
    WHERE id = ${params.id}
  `;

  return Response.json({ data: updated[0] });
}

async function handleDeleteSecretProvider(
  req: Request,
  params: { id: string },
  ctx: AdminContext,
): Promise<Response> {
  const existing = await sql`
    SELECT id FROM organization_secret_providers
    WHERE id = ${params.id} AND org_id = ${ctx.orgId}
  `;
  if (existing.length === 0) {
    return Response.json({ error: 'Secret provider not found' }, { status: 404 });
  }

  await sql`DELETE FROM organization_secret_providers WHERE id = ${params.id}`;

  return Response.json({ success: true });
}

async function handleTestSecretProvider(
  req: Request,
  params: { id: string },
  ctx: AdminContext,
): Promise<Response> {
  // Get provider with decrypted credentials
  const result = await sql`
    SELECT
      provider,
      pgp_sym_decrypt(credentials_encrypted::bytea, ${ENCRYPTION_KEY}) as credentials_decrypted,
      settings
    FROM organization_secret_providers
    WHERE id = ${params.id} AND org_id = ${ctx.orgId}
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Secret provider not found' }, { status: 404 });
  }

  const row = result[0];
  let body: { projectId?: string; environment?: string; secretPath?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body OK — use defaults from settings
  }

  try {
    const credentials = JSON.parse(row.credentials_decrypted);
    const projectId = body.projectId || (row.settings as Record<string, string>)?.defaultProjectId;
    const environment = body.environment || (row.settings as Record<string, string>)?.defaultEnvironment || 'prod';

    if (!projectId) {
      return Response.json({ error: 'projectId is required for testing' }, { status: 400 });
    }

    const secrets = await fetchInfisicalSecrets(
      {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        url: credentials.url || 'https://vault.newleads.co.za',
      },
      {
        projectId,
        environment,
        secretPath: body.secretPath || '/',
      },
    );

    return Response.json({
      success: true,
      secretCount: Object.keys(secrets).length,
      secretKeys: Object.keys(secrets),
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 400 });
  }
}

async function handleLinkSecretProvider(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  let body: { providerId?: string | null; config?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // If providerId is provided, verify it belongs to the same org
  if (body.providerId) {
    const providerCheck = await sql`
      SELECT id FROM organization_secret_providers
      WHERE id = ${body.providerId} AND org_id = ${ctx.orgId}
    `;
    if (providerCheck.length === 0) {
      return Response.json({ error: 'Secret provider not found' }, { status: 404 });
    }
  }

  await sql`
    UPDATE app_environments
    SET
      secret_provider_id = ${body.providerId || null},
      secret_provider_config = ${body.config || {}},
      updated_at = now()
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;

  return Response.json({ success: true });
}

// =========================================================================
// App Dependencies Handlers
// =========================================================================

/**
 * Detect dependency cycles using BFS.
 * Returns true if adding appId -> targetAppId would create a cycle.
 */
async function detectDependencyCycle(
  appId: string,
  targetAppId: string,
  orgId: string,
): Promise<boolean> {
  // BFS from targetAppId's dependencies to see if we reach appId
  const visited = new Set<string>();
  const queue = [targetAppId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === appId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await sql`
      SELECT DISTINCT ad.target_app_id
      FROM app_dependencies ad
      JOIN apps a ON a.id = ad.app_id
      WHERE ad.app_id = ${current} AND a.org_id = ${orgId}
    `;
    for (let i = 0; i < deps.length; i++) {
      queue.push(deps[i].target_app_id);
    }
  }

  return false;
}

/**
 * Resolve dependencies for an environment and return env var map.
 * For each dependency:
 *   1. Find target app in same org
 *   2. Find target environment (explicit -> same name -> production fallback)
 *   3. Resolve URL (container: http://{container_ip}:3000, systemd: http://127.0.0.1:{port})
 *   4. If required and target not running, throw error
 *   5. Return as SIGNALDB_SVC_{ALIAS}_URL
 */
async function resolveDependencies(
  environmentId: string,
  orgId: string,
  envName: string,
): Promise<Record<string, string>> {
  const deps = await sql`
    SELECT
      ad.id, ad.alias, ad.target_app_id, ad.target_environment_name, ad.required,
      a.slug as target_app_slug, a.name as target_app_name
    FROM app_dependencies ad
    JOIN apps a ON a.id = ad.target_app_id
    WHERE ad.environment_id = ${environmentId}
  `;

  if (deps.length === 0) return {};

  const envVars: Record<string, string> = {};

  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    const targetEnvName = dep.target_environment_name || envName;

    // Find target environment: explicit name -> same name -> production fallback
    let targetEnv = await sql`
      SELECT id, name, port, status, container_ip, container_name, deployment_mode
      FROM app_environments
      WHERE app_id = ${dep.target_app_id} AND name = ${targetEnvName}
    `;

    // Fallback to production if target env doesn't exist
    if (targetEnv.length === 0 && targetEnvName !== 'production') {
      targetEnv = await sql`
        SELECT id, name, port, status, container_ip, container_name, deployment_mode
        FROM app_environments
        WHERE app_id = ${dep.target_app_id} AND name = 'production'
      `;
    }

    if (targetEnv.length === 0) {
      if (dep.required) {
        throw new Error(
          `Required dependency "${dep.alias}" -> ${dep.target_app_slug}/${targetEnvName}: environment not found`
        );
      }
      continue;
    }

    const env = targetEnv[0];

    // Check if running when required
    if (dep.required && env.status !== 'running') {
      throw new Error(
        `Required dependency "${dep.alias}" -> ${dep.target_app_slug}/${env.name}: environment status is "${env.status}" (expected "running")`
      );
    }

    // Resolve URL based on deployment mode
    // Container mode: use DNS name (resolved by Incus managed DNS on org bridge)
    // This survives container restarts — raw IPs go stale but DNS updates automatically
    let resolvedUrl: string;
    if (env.deployment_mode === 'container' && env.container_name) {
      resolvedUrl = `http://${env.container_name}:3000`;
    } else if (env.deployment_mode === 'container' && env.container_ip) {
      // Fallback to IP if container_name not set (shouldn't happen for new deploys)
      resolvedUrl = `http://${env.container_ip}:3000`;
    } else if (env.port) {
      resolvedUrl = `http://127.0.0.1:${env.port}`;
    } else {
      if (dep.required) {
        throw new Error(
          `Required dependency "${dep.alias}" -> ${dep.target_app_slug}/${env.name}: no IP or port assigned`
        );
      }
      continue;
    }

    // Cache resolved URL in DB
    await sql`
      UPDATE app_dependencies
      SET resolved_url = ${resolvedUrl}, resolved_at = now(), updated_at = now()
      WHERE id = ${dep.id}
    `;

    envVars[`SIGNALDB_SVC_${dep.alias}_URL`] = resolvedUrl;
  }

  return envVars;
}

/**
 * GET /v1/apps/:appId/dependencies
 * List all dependencies for an app (across all environments)
 */
/**
 * GET /v1/apps/:appId/capabilities
 * Returns declared capabilities merged with quota/usage data from billing plan.
 */
async function handleGetCapabilities(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT a.id, a.org_id FROM apps a WHERE a.id = ${params.appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get all environments and their declared capabilities
  const envs = await sql`
    SELECT id, name, settings FROM app_environments WHERE app_id = ${params.appId}
  `;

  // Get billing plan limits
  const planResult = await sql`
    SELECT bp.limits FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${ctx.orgId} AND os.status = 'active'
    ORDER BY os.created_at DESC LIMIT 1
  `;
  const planLimits = (planResult[0]?.limits || {}) as Record<string, unknown>;

  // Get usage data for each service
  const [emailUsage, imageUsage, flagUsage, storageUsage] = await Promise.all([
    sql`SELECT COALESCE(SUM(count), 0) as used FROM email_usage WHERE org_id = ${ctx.orgId}
        AND month = date_trunc('month', now())`.catch(() => [{ used: 0 }]),
    sql`SELECT COALESCE(SUM(count), 0) as used FROM image_usage WHERE org_id = ${ctx.orgId}
        AND month = date_trunc('month', now())`.catch(() => [{ used: 0 }]),
    sql`SELECT COALESCE(SUM(evaluation_count), 0) as used FROM feature_toggle_usage
        WHERE org_id = ${ctx.orgId} AND month = date_trunc('month', now())`.catch(() => [{ used: 0 }]),
    sql`SELECT COALESCE(storage_used_bytes, 0) as used FROM organizations
        WHERE id = ${ctx.orgId}`.catch(() => [{ used: 0 }]),
  ]);

  // Merge capabilities from all environments (union)
  const mergedCapabilities: Record<string, unknown> = {};
  for (const env of envs) {
    const settings = env.settings as Record<string, unknown> | null;
    const caps = settings?.capabilities as Record<string, unknown> | undefined;
    if (caps) {
      for (const [name, value] of Object.entries(caps)) {
        if (value) mergedCapabilities[name] = true;
      }
    }
  }

  const capabilities: Record<string, unknown> = {
    email: {
      enabled: !!mergedCapabilities.email,
      quota: {
        used: Number(emailUsage[0]?.used || 0),
        limit: Number(planLimits.email_monthly_limit || 0),
      },
    },
    images: {
      enabled: !!mergedCapabilities.images,
      quota: {
        used: Number(imageUsage[0]?.used || 0),
        limit: Number(planLimits.image_monthly_limit || 0),
      },
    },
    storage: {
      enabled: !!mergedCapabilities.storage,
      quota: {
        used_bytes: Number(storageUsage[0]?.used || 0),
        limit_bytes: Number(planLimits.storage_bytes_limit || 0),
      },
    },
    flags: {
      enabled: !!mergedCapabilities.flags,
      quota: {
        evaluations: Number(flagUsage[0]?.used || 0),
        limit: Number(planLimits.feature_toggle_monthly_limit || 0),
      },
    },
    database: {
      enabled: !!mergedCapabilities.database,
    },
    auth: {
      enabled: !!mergedCapabilities.auth,
    },
    sse: {
      enabled: !!mergedCapabilities.sse,
    },
  };

  return Response.json({
    capabilities,
    environments: envs.map((e) => ({
      id: e.id,
      name: e.name,
      capabilities: (e.settings as Record<string, unknown> | null)?.capabilities || {},
    })),
  });
}

async function handleListDependencies(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const deps = await sql`
    SELECT
      ad.id, ad.app_id, ad.environment_id, ad.target_app_id,
      ad.target_environment_name, ad.alias, ad.resolved_url,
      ad.resolved_at, ad.required, ad.created_at, ad.updated_at,
      ta.slug as target_app_slug, ta.name as target_app_name,
      ae.name as environment_name
    FROM app_dependencies ad
    JOIN apps ta ON ta.id = ad.target_app_id
    JOIN app_environments ae ON ae.id = ad.environment_id
    WHERE ad.app_id = ${params.appId}
    ORDER BY ae.name, ad.alias
  `;

  return Response.json({ data: deps });
}

/**
 * POST /v1/apps/:appId/environments/:env/dependencies
 * Add a dependency
 */
async function handleAddDependency(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  interface AddDepBody {
    targetAppSlug: string;
    alias: string;
    targetEnv?: string;
    required?: boolean;
  }

  let body: AddDepBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.targetAppSlug || !body.alias) {
    return Response.json({ error: 'targetAppSlug and alias are required' }, { status: 400 });
  }

  // Validate alias format
  const ALIAS_RE = /^[A-Z][A-Z0-9_]{0,49}$/;
  if (!ALIAS_RE.test(body.alias)) {
    return Response.json({
      error: `Alias must match ${ALIAS_RE.source}`,
    }, { status: 400 });
  }

  // Verify source app
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Find environment
  const envResult = await sql`
    SELECT id FROM app_environments WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }
  const envId = envResult[0].id;

  // Find target app in same org
  const targetApp = await sql`
    SELECT id, slug FROM apps WHERE slug = ${body.targetAppSlug} AND org_id = ${ctx.orgId}
  `;
  if (targetApp.length === 0) {
    return Response.json({
      error: `Target app "${body.targetAppSlug}" not found in your organization`,
    }, { status: 404 });
  }
  const targetAppId = targetApp[0].id;

  // Prevent self-dependency
  if (targetAppId === params.appId) {
    return Response.json({ error: 'An app cannot depend on itself' }, { status: 400 });
  }

  // Cycle detection
  const hasCycle = await detectDependencyCycle(params.appId, targetAppId, ctx.orgId);
  if (hasCycle) {
    return Response.json({
      error: `Adding this dependency would create a cycle (${body.targetAppSlug} already depends on this app)`,
    }, { status: 400 });
  }

  // Check for duplicate alias
  const existing = await sql`
    SELECT id FROM app_dependencies WHERE environment_id = ${envId} AND alias = ${body.alias}
  `;
  if (existing.length > 0) {
    return Response.json({
      error: `Alias "${body.alias}" already exists for this environment`,
    }, { status: 409 });
  }

  // Insert
  const result = await sql`
    INSERT INTO app_dependencies (
      app_id, environment_id, target_app_id, target_environment_name, alias, required
    ) VALUES (
      ${params.appId}, ${envId}, ${targetAppId},
      ${body.targetEnv || null}, ${body.alias}, ${body.required !== false}
    )
    RETURNING id, app_id, environment_id, target_app_id, target_environment_name,
      alias, required, created_at
  `;

  return Response.json({ data: result[0] }, { status: 201 });
}

/**
 * DELETE /v1/apps/:appId/dependencies/:depId
 * Remove a dependency
 */
async function handleRemoveDependency(
  req: Request,
  params: { appId: string; depId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const result = await sql`
    DELETE FROM app_dependencies
    WHERE id = ${params.depId} AND app_id = ${params.appId}
    RETURNING id
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Dependency not found' }, { status: 404 });
  }

  return Response.json({ success: true });
}

/**
 * POST /v1/apps/:appId/dependencies/validate
 * Dry-run dependency resolution
 */
async function handleValidateDependencies(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get all environments
  const environments = await sql`
    SELECT id, name FROM app_environments WHERE app_id = ${params.appId}
  `;

  const results: Array<{
    environment: string;
    resolved: Record<string, string>;
    errors: string[];
  }> = [];

  for (let i = 0; i < environments.length; i++) {
    const env = environments[i];
    try {
      const resolved = await resolveDependencies(env.id, ctx.orgId, env.name);
      results.push({ environment: env.name, resolved, errors: [] });
    } catch (err) {
      results.push({
        environment: env.name,
        resolved: {},
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  const allValid = results.every(r => r.errors.length === 0);
  return Response.json({ valid: allValid, environments: results });
}

// =========================================================================
// Git Provider Handlers
// =========================================================================

/**
 * POST /v1/git/callback
 * Save a git installation for an org (called by Console after GitHub redirects back)
 */
async function handleGitCallback(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  let body: { installationId: string; provider?: string; permissionsLevel?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.installationId) {
    return Response.json({ error: 'installationId is required' }, { status: 400 });
  }

  const provider = body.provider || 'github';
  const permissionsLevel = body.permissionsLevel === 'read-write' ? 'read-write' : 'read';

  try {
    // Fetch installation details from GitHub
    const details = await (await import('../lib/github-app')).getInstallationDetails(body.installationId);

    // Upsert installation record
    const result = await sql`
      INSERT INTO organization_git_installations (
        organization_id, provider, installation_id,
        account_login, account_type, account_avatar_url,
        permissions, repository_selection, permissions_level
      ) VALUES (
        ${ctx.orgId}, ${provider}, ${body.installationId},
        ${details.accountLogin}, ${details.accountType}, ${details.accountAvatarUrl},
        ${details.permissions}, ${details.repositorySelection}, ${permissionsLevel}
      )
      ON CONFLICT (organization_id, provider, installation_id) DO UPDATE SET
        account_login = EXCLUDED.account_login,
        account_type = EXCLUDED.account_type,
        account_avatar_url = EXCLUDED.account_avatar_url,
        permissions = EXCLUDED.permissions,
        repository_selection = EXCLUDED.repository_selection,
        permissions_level = EXCLUDED.permissions_level,
        suspended_at = NULL,
        updated_at = now()
      RETURNING id, organization_id, provider, installation_id,
        account_login, account_type, account_avatar_url,
        permissions_level, repository_selection, created_at, updated_at
    `;

    return Response.json({ data: result[0] }, { status: 201 });
  } catch (err) {
    console.error('[git-callback] Failed to save installation:', err);
    return Response.json({
      error: 'Failed to save installation',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

/**
 * GET /v1/git/repos
 * List repositories accessible through the org's GitHub installation
 */
async function handleListGitRepos(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  // Get org's GitHub installation
  const installations = await sql`
    SELECT installation_id FROM organization_git_installations
    WHERE organization_id = ${ctx.orgId} AND provider = 'github'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (installations.length === 0) {
    return Response.json({ error: 'No GitHub installation found', data: [] }, { status: 404 });
  }

  try {
    const repos = await listInstallationRepos(installations[0].installation_id);
    return Response.json({ data: repos });
  } catch (err) {
    return Response.json({
      error: 'Failed to list repositories',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

/**
 * GET /v1/git/repos/:owner/:repo/branches
 * List branches for a repository accessible through the org's GitHub installation
 */
async function handleListRepoBranches(
  req: Request,
  params: { owner: string; repo: string },
  ctx: AdminContext,
): Promise<Response> {
  // Get org's GitHub installation
  const installations = await sql`
    SELECT installation_id FROM organization_git_installations
    WHERE organization_id = ${ctx.orgId} AND provider = 'github'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (installations.length === 0) {
    return Response.json({ error: 'No GitHub installation found', data: [] }, { status: 404 });
  }

  try {
    const branches = await listRepoBranches(
      installations[0].installation_id,
      params.owner,
      params.repo
    );
    return Response.json({ data: branches });
  } catch (err) {
    return Response.json({
      error: 'Failed to list branches',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

/**
 * POST /v1/git/token
 * Generate an ephemeral installation token for a git URL
 */
async function handleGenerateGitToken(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  let body: { gitUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const provider = body.gitUrl ? detectProvider(body.gitUrl) : 'github';

  if (provider !== 'github') {
    return Response.json({ error: 'Only GitHub is currently supported' }, { status: 400 });
  }

  const installations = await sql`
    SELECT installation_id, permissions_level FROM organization_git_installations
    WHERE organization_id = ${ctx.orgId} AND provider = 'github'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (installations.length === 0) {
    return Response.json({ error: 'No GitHub installation found' }, { status: 404 });
  }

  try {
    const permLevel = (installations[0].permissions_level || 'read') as PermissionsLevel;
    const token = await generateInstallationToken(installations[0].installation_id, permLevel);
    let authenticatedUrl: string | undefined;
    if (body.gitUrl) {
      authenticatedUrl = getAuthenticatedCloneUrl(body.gitUrl, token);
    }

    return Response.json({
      token,
      expiresIn: 3600,
      permissionsLevel: permLevel,
      authenticatedUrl,
    });
  } catch (err) {
    return Response.json({
      error: 'Failed to generate token',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

/**
 * PUT /v1/git/permissions
 * Update the permissions level for an org's git installation
 */
async function handleUpdateGitPermissions(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  let body: { permissionsLevel: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const level = body.permissionsLevel === 'read-write' ? 'read-write' : 'read';

  const result = await sql`
    UPDATE organization_git_installations
    SET permissions_level = ${level}, updated_at = now()
    WHERE organization_id = ${ctx.orgId}
      AND provider = 'github'
      ${body.id ? sql`AND id = ${body.id}` : sql``}
    RETURNING id, permissions_level
  `;

  if (result.length === 0) {
    return Response.json({ error: 'No GitHub installation found' }, { status: 404 });
  }

  return Response.json({ data: result[0] });
}

// =========================================================================
// App CRUD Endpoints
// =========================================================================

/**
 * GET /v1/apps — List all apps for the org
 */
async function handleListApps(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  const apps = await sql`
    SELECT
      a.id, a.name, a.slug, a.description, a.git_repo, a.git_branch,
      a.framework, a.settings, a.created_at, a.updated_at,
      (
        SELECT ae.subdomain FROM app_environments ae
        WHERE ae.app_id = a.id AND ae.name = 'production'
        LIMIT 1
      ) as production_subdomain,
      (
        SELECT json_agg(json_build_object(
          'id', ae.id, 'name', ae.name, 'status', ae.status, 'subdomain', ae.subdomain
        ))
        FROM app_environments ae WHERE ae.app_id = a.id
      ) as environments
    FROM apps a
    WHERE a.org_id = ${ctx.orgId}
    ORDER BY a.created_at DESC
  `;

  return Response.json({ data: apps });
}

/**
 * POST /v1/apps — Create a new app
 */
async function handleCreateApp(
  req: Request,
  ctx: AdminContext,
): Promise<Response> {
  let body: {
    name: string;
    slug: string;
    framework?: string;
    gitRepo?: string;
    gitBranch?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || !body.slug) {
    return Response.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(body.slug) && body.slug.length > 1) {
    return Response.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 400 });
  }

  // Check for duplicate slug in org
  const existing = await sql`
    SELECT id FROM apps WHERE org_id = ${ctx.orgId} AND slug = ${body.slug}
  `;
  if (existing.length > 0) {
    return Response.json({ error: 'An app with this slug already exists' }, { status: 409 });
  }

  // Create app
  const app = await sql`
    INSERT INTO apps (org_id, name, slug, framework, git_repo, git_branch, description)
    VALUES (
      ${ctx.orgId},
      ${body.name},
      ${body.slug},
      ${body.framework || 'bun-server'},
      ${body.gitRepo || null},
      ${body.gitBranch || 'main'},
      ${body.description || null}
    )
    RETURNING id, name, slug, framework, git_repo, git_branch, description, created_at
  `;

  // Allocate port and create default production environment
  const port = await allocateVerifiedPort();
  const env = await sql`
    INSERT INTO app_environments (app_id, name, port, status, deployment_mode)
    VALUES (${app[0].id}, 'production', ${port}, 'pending', 'container')
    RETURNING id, name, port, status, subdomain
  `;

  return Response.json({
    data: {
      ...app[0],
      environments: [env[0]],
    },
  }, { status: 201 });
}

/**
 * GET /v1/apps/:appId — Get app details + environments
 */
async function handleGetApp(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appResult = await sql`
    SELECT
      a.id, a.name, a.slug, a.description, a.git_repo, a.git_branch,
      a.framework, a.settings, a.created_at, a.updated_at
    FROM apps a
    WHERE a.id = ${params.appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appResult.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const environments = await sql`
    SELECT
      id, name, status, port, subdomain, container_name, container_ip,
      deployment_mode, last_deployed_at, last_deploy_commit,
      health_status, visibility, git_branch, project_id
    FROM app_environments
    WHERE app_id = ${params.appId}
    ORDER BY
      CASE name WHEN 'production' THEN 1 WHEN 'staging' THEN 2 WHEN 'dev' THEN 3 ELSE 4 END
  `;

  return Response.json({
    data: {
      ...appResult[0],
      environments,
    },
  });
}

/**
 * PUT /v1/apps/:appId — Update app settings
 */
async function handleUpdateApp(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  let body: {
    name?: string;
    slug?: string;
    gitRepo?: string;
    gitBranch?: string;
    framework?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Build dynamic update
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.gitRepo !== undefined) updates.git_repo = body.gitRepo === '__none__' ? null : body.gitRepo;
  if (body.gitBranch !== undefined) updates.git_branch = body.gitBranch;
  if (body.framework !== undefined) updates.framework = body.framework;
  if (body.description !== undefined) updates.description = body.description;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Check slug uniqueness if changing
  if (updates.slug) {
    const slugCheck = await sql`
      SELECT id FROM apps
      WHERE org_id = ${ctx.orgId} AND slug = ${updates.slug as string} AND id != ${params.appId}
    `;
    if (slugCheck.length > 0) {
      return Response.json({ error: 'An app with this slug already exists' }, { status: 409 });
    }
  }

  const result = await sql`
    UPDATE apps SET
      ${sql(updates as Record<string, string>)},
      updated_at = now()
    WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
    RETURNING id, name, slug, framework, git_repo, git_branch, description, updated_at
  `;

  return Response.json({ data: result[0] });
}

/**
 * DELETE /v1/apps/:appId — Delete app (cascade)
 */
async function handleDeleteApp(
  req: Request,
  params: { appId: string },
  ctx: AdminContext,
): Promise<Response> {
  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Check for running environments
  const running = await sql`
    SELECT id, name FROM app_environments
    WHERE app_id = ${params.appId} AND status = 'running'
  `;
  if (running.length > 0) {
    return Response.json({
      error: 'Cannot delete app with running environments',
      runningEnvironments: running.map(e => e.name),
    }, { status: 409 });
  }

  await sql`DELETE FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}`;

  return Response.json({ ok: true });
}

// =========================================================================
// Environment Variables Endpoints
// =========================================================================

/**
 * GET /v1/apps/:appId/environments/:env/variables — Get env vars (decrypted)
 */
async function handleGetEnvVars(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id, port, project_id, env_vars_encrypted
    FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const environment = envResult[0];
  const vars: Record<string, string> = {};

  // Auto-populated vars
  vars.PORT = String(environment.port || 3000);
  vars.NODE_ENV = params.env === 'production' ? 'production' : 'development';
  vars.SIGNALDB_API_URL = 'https://api.signaldb.live';

  // Database URL from linked project
  if (environment.project_id) {
    try {
      const credResult = await sql`
        SELECT
          pd.database_name,
          COALESCE(pd.project_user, di.postgres_user) as username,
          COALESCE(
            pgp_sym_decrypt(decode(pd.project_password_encrypted, 'hex'), ${ENCRYPTION_KEY}),
            pgp_sym_decrypt(decode(di.postgres_password_encrypted, 'hex'), ${ENCRYPTION_KEY})
          ) as password,
          di.port as db_port
        FROM project_databases pd
        JOIN database_instances di ON di.id = pd.instance_id
        WHERE pd.project_id = ${environment.project_id}
      `;
      if (credResult.length > 0) {
        const cred = credResult[0];
        vars.DATABASE_URL = `postgresql://${cred.username}:${cred.password}@127.0.0.1:${cred.db_port}/${cred.database_name}`;
      }
    } catch {
      // Non-fatal
    }
  }

  // Decrypt custom env vars
  if (environment.env_vars_encrypted) {
    try {
      const decResult = await sql`
        SELECT pgp_sym_decrypt(${environment.env_vars_encrypted}::bytea, ${ENCRYPTION_KEY}) as decrypted
      `;
      if (decResult[0]?.decrypted) {
        const customVars = JSON.parse(decResult[0].decrypted);
        for (const [key, value] of Object.entries(customVars)) {
          vars[key] = String(value);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return Response.json({ data: vars });
}

/**
 * PUT /v1/apps/:appId/environments/:env/variables — Update env vars
 */
async function handleUpdateEnvVars(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  // Verify app belongs to org
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  let body: { vars: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.vars || typeof body.vars !== 'object') {
    return Response.json({ error: 'vars object is required' }, { status: 400 });
  }

  // Filter out read-only keys
  const readOnlyKeys = new Set(['PORT', 'NODE_ENV', 'DATABASE_URL', 'SIGNALDB_API_URL']);
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.vars)) {
    if (!readOnlyKeys.has(key)) {
      filtered[key] = String(value);
    }
  }

  // Encrypt and store
  const jsonStr = JSON.stringify(filtered);
  await sql`
    UPDATE app_environments
    SET env_vars_encrypted = pgp_sym_encrypt(${jsonStr}, ${ENCRYPTION_KEY})::bytea,
        updated_at = now()
    WHERE id = ${envResult[0].id}
  `;

  return Response.json({ ok: true, varsCount: Object.keys(filtered).length });
}

// =========================================================================
// Branch Override Endpoints
// =========================================================================

/**
 * PUT /v1/apps/:appId/environments/:env/branch — Set git branch override
 */
async function handleUpdateBranch(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  let body: { branch: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.branch) {
    return Response.json({ error: 'branch is required' }, { status: 400 });
  }

  const result = await sql`
    UPDATE app_environments
    SET git_branch = ${body.branch}, updated_at = now()
    WHERE app_id = ${params.appId} AND name = ${params.env}
    RETURNING id, name, git_branch
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  return Response.json({ data: result[0] });
}

/**
 * DELETE /v1/apps/:appId/environments/:env/branch — Clear branch override
 */
async function handleClearBranch(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const result = await sql`
    UPDATE app_environments
    SET git_branch = NULL, updated_at = now()
    WHERE app_id = ${params.appId} AND name = ${params.env}
    RETURNING id, name, git_branch
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  return Response.json({ data: result[0] });
}

// =========================================================================
// Database Linking Endpoints
// =========================================================================

/**
 * PUT /v1/apps/:appId/environments/:env/database — Link env to a project/DB
 */
async function handleLinkDatabase(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  let body: { projectId: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }

  // Verify project belongs to same org
  const projectCheck = await sql`
    SELECT id FROM projects WHERE id = ${body.projectId} AND org_id = ${ctx.orgId}
  `;
  if (projectCheck.length === 0) {
    return Response.json({ error: 'Project not found or belongs to another org' }, { status: 404 });
  }

  const result = await sql`
    UPDATE app_environments
    SET project_id = ${body.projectId}, updated_at = now()
    WHERE app_id = ${params.appId} AND name = ${params.env}
    RETURNING id, name, project_id
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  return Response.json({ data: result[0] });
}

/**
 * DELETE /v1/apps/:appId/environments/:env/database — Unlink database
 */
async function handleUnlinkDatabase(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const result = await sql`
    UPDATE app_environments
    SET project_id = NULL, updated_at = now()
    WHERE app_id = ${params.appId} AND name = ${params.env}
    RETURNING id, name, project_id
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  return Response.json({ data: result[0] });
}

// =========================================================================
// Custom Domain Endpoints
// =========================================================================

/**
 * GET /v1/apps/:appId/environments/:env/domains — List domains for env
 */
async function handleListDomains(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const domains = await sql`
    SELECT id, domain, is_primary, ssl_status, verified, verification_token, created_at
    FROM app_domains
    WHERE environment_id = ${envResult[0].id}
    ORDER BY is_primary DESC, created_at ASC
  `;

  return Response.json({ data: domains });
}

/**
 * POST /v1/apps/:appId/environments/:env/domains — Add custom domain
 */
async function handleAddDomain(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  let body: { domain: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.domain) {
    return Response.json({ error: 'domain is required' }, { status: 400 });
  }

  // Normalize domain (lowercase, trim)
  const domain = body.domain.toLowerCase().trim();

  // Check if domain already exists
  const existingDomain = await sql`
    SELECT id FROM app_domains WHERE domain = ${domain}
  `;
  if (existingDomain.length > 0) {
    return Response.json({ error: 'Domain is already in use' }, { status: 409 });
  }

  // Generate verification token
  const verificationToken = `signaldb-verify-${crypto.randomUUID().slice(0, 12)}`;

  const result = await sql`
    INSERT INTO app_domains (environment_id, domain, verification_token)
    VALUES (${envResult[0].id}, ${domain}, ${verificationToken})
    RETURNING id, domain, is_primary, ssl_status, verified, verification_token, created_at
  `;

  return Response.json({
    data: result[0],
    verification: {
      type: 'TXT',
      name: `_signaldb-verify.${domain}`,
      value: verificationToken,
      instructions: `Add a TXT record for _signaldb-verify.${domain} with value ${verificationToken}`,
    },
  }, { status: 201 });
}

/**
 * DELETE /v1/apps/:appId/domains/:domainId — Remove domain
 */
async function handleRemoveDomain(
  req: Request,
  params: { appId: string; domainId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Verify domain belongs to this app
  const domainCheck = await sql`
    SELECT ad.id FROM app_domains ad
    JOIN app_environments ae ON ae.id = ad.environment_id
    WHERE ad.id = ${params.domainId} AND ae.app_id = ${params.appId}
  `;
  if (domainCheck.length === 0) {
    return Response.json({ error: 'Domain not found' }, { status: 404 });
  }

  await sql`DELETE FROM app_domains WHERE id = ${params.domainId}`;

  return Response.json({ ok: true });
}

/**
 * POST /v1/apps/:appId/domains/:domainId/verify — Verify DNS record
 */
async function handleVerifyDomain(
  req: Request,
  params: { appId: string; domainId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  // Get domain record
  const domainResult = await sql`
    SELECT ad.id, ad.domain, ad.verification_token, ad.verified
    FROM app_domains ad
    JOIN app_environments ae ON ae.id = ad.environment_id
    WHERE ad.id = ${params.domainId} AND ae.app_id = ${params.appId}
  `;
  if (domainResult.length === 0) {
    return Response.json({ error: 'Domain not found' }, { status: 404 });
  }

  const domainRecord = domainResult[0];

  if (domainRecord.verified) {
    return Response.json({ data: { verified: true, message: 'Domain already verified' } });
  }

  // DNS TXT lookup
  const { resolve } = await import('dns/promises');
  try {
    const txtRecords = await resolve(`_signaldb-verify.${domainRecord.domain}`, 'TXT');
    const flatRecords = txtRecords.map(r => r.join(''));
    const found = flatRecords.includes(domainRecord.verification_token);

    if (found) {
      await sql`
        UPDATE app_domains
        SET verified = true, updated_at = now()
        WHERE id = ${params.domainId}
      `;
      return Response.json({ data: { verified: true, message: 'Domain verified successfully' } });
    }

    return Response.json({
      data: {
        verified: false,
        message: 'Verification token not found in DNS TXT records',
        expected: { name: `_signaldb-verify.${domainRecord.domain}`, value: domainRecord.verification_token },
        found: flatRecords,
      },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json({
      data: {
        verified: false,
        message: `DNS lookup failed: ${errMsg}`,
        expected: { name: `_signaldb-verify.${domainRecord.domain}`, value: domainRecord.verification_token },
      },
    });
  }
}

// =========================================================================
// Dev Access (SSH Key Management) Handlers
// =========================================================================

const SERVER_HOST = process.env.SERVER_HOST || '172.232.188.216';

/**
 * GET /v1/apps/:appId/environments/:env/dev-access — List SSH keys for environment
 */
async function handleListDevAccessKeys(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT id FROM apps WHERE id = ${params.appId} AND org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const envResult = await sql`
    SELECT id FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }

  const keys = await sql`
    SELECT id, name, fingerprint, container_name, created_at, last_used_at, expires_at
    FROM app_dev_keys
    WHERE environment_id = ${envResult[0].id} AND org_id = ${ctx.orgId}
    ORDER BY created_at DESC
  `;

  return Response.json({ data: keys });
}

/**
 * POST /v1/apps/:appId/environments/:env/dev-access — Generate a new SSH key
 */
async function handleGenerateDevAccessKey(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext,
): Promise<Response> {
  // Verify app belongs to org and get slug
  const appResult = await sql`
    SELECT a.id, a.slug, o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${params.appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appResult.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }
  const app = appResult[0];

  // Verify environment exists and is running
  const envResult = await sql`
    SELECT id, container_name, status
    FROM app_environments
    WHERE app_id = ${params.appId} AND name = ${params.env}
  `;
  if (envResult.length === 0) {
    return Response.json({ error: 'Environment not found' }, { status: 404 });
  }
  const env = envResult[0];

  if (!env.container_name) {
    return Response.json({ error: 'No container assigned to this environment' }, { status: 409 });
  }
  if (env.status !== 'running') {
    return Response.json({ error: `Container is not running (status: ${env.status})` }, { status: 409 });
  }

  let body: { keyName?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const keyName = body.keyName || 'default';

  // Call deploy agent to generate the key
  const agentRes = await fetch(`${DEPLOY_AGENT_URL}/dev-access/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify({
      containerName: env.container_name,
      orgSlug: app.org_slug,
      appSlug: app.slug,
      envName: params.env,
      keyName,
    }),
  });

  if (!agentRes.ok) {
    const errData = await agentRes.json().catch(() => ({ error: 'Deploy agent error' }));
    return Response.json({ error: (errData as any).error || 'Failed to generate key' }, { status: 500 });
  }

  const agentData = await agentRes.json() as {
    privateKey: string;
    publicKey: string;
    fingerprint: string;
    appDir: string;
    keyId: string;
    orgUsername: string;
  };

  // Persist key metadata to DB (never store private key)
  await sql`
    INSERT INTO app_dev_keys (id, environment_id, org_id, name, public_key, fingerprint, container_name, app_dir)
    VALUES (
      ${agentData.keyId}, ${env.id}, ${ctx.orgId},
      ${keyName}, ${agentData.publicKey}, ${agentData.fingerprint},
      ${env.container_name}, ${agentData.appDir}
    )
  `;

  // Build connection instructions
  const orgUser = agentData.orgUsername;
  const safeName = `sdb-${app.org_slug}-${app.slug}`.replace(/[^a-z0-9-]/g, '-');
  const sshIdent = `~/.ssh/${safeName}.pem`;

  return Response.json({
    data: {
      privateKey: agentData.privateKey,
      fingerprint: agentData.fingerprint,
      keyName,
      fileName: `${safeName}.pem`,
      instructions: {
        ssh: `ssh -i ${sshIdent} ${orgUser}@${SERVER_HOST}`,
        gitClone: `GIT_SSH_COMMAND="ssh -i ${sshIdent}" git clone ${orgUser}@${SERVER_HOST}:app ${app.slug}`,
        rsync: `rsync -avz --exclude node_modules --exclude .git -e "ssh -i ${sshIdent}" ./ ${orgUser}@${SERVER_HOST}:./`,
        deploy: `ssh -i ${sshIdent} ${orgUser}@${SERVER_HOST} deploy`,
        logs: `ssh -i ${sshIdent} ${orgUser}@${SERVER_HOST} logs`,
      },
    },
  }, { status: 201 });
}

/**
 * DELETE /v1/apps/:appId/environments/:env/dev-access/:keyId — Revoke an SSH key
 */
async function handleRevokeDevAccessKey(
  req: Request,
  params: { appId: string; env: string; keyId: string },
  ctx: AdminContext,
): Promise<Response> {
  const appCheck = await sql`
    SELECT a.id, o.slug as org_slug
    FROM apps a
    JOIN organizations o ON o.id = a.org_id
    WHERE a.id = ${params.appId} AND a.org_id = ${ctx.orgId}
  `;
  if (appCheck.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }
  const orgSlug = appCheck[0].org_slug;

  // Look up key — verify org ownership
  const keyResult = await sql`
    SELECT id, fingerprint FROM app_dev_keys
    WHERE id = ${params.keyId} AND org_id = ${ctx.orgId}
  `;
  if (keyResult.length === 0) {
    return Response.json({ error: 'Key not found' }, { status: 404 });
  }

  // Revoke from authorized_keys via deploy agent
  const agentRes = await fetch(`${DEPLOY_AGENT_URL}/dev-access/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify({ fingerprint: keyResult[0].fingerprint, orgSlug }),
  });

  if (!agentRes.ok) {
    const errData = await agentRes.json().catch(() => ({ error: 'Deploy agent error' }));
    return Response.json({ error: (errData as any).error || 'Failed to revoke key' }, { status: 500 });
  }

  // Remove from DB
  await sql`DELETE FROM app_dev_keys WHERE id = ${params.keyId} AND org_id = ${ctx.orgId}`;

  return Response.json({ success: true });
}
