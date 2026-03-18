/**
 * Scheduler API — REST endpoints for managing scheduled jobs
 *
 * Routes:
 *   GET    /v1/apps/:appId/environments/:env/schedules           — list jobs
 *   POST   /v1/apps/:appId/environments/:env/schedules           — create job
 *   PUT    /v1/apps/:appId/environments/:env/schedules/:jobId    — update job
 *   DELETE /v1/apps/:appId/environments/:env/schedules/:jobId    — delete job
 *   GET    /v1/apps/:appId/environments/:env/schedules/:jobId/runs — run history
 *   POST   /v1/apps/:appId/environments/:env/schedules/:jobId/trigger — manual trigger
 */

import { sql } from '../lib/db';
import { calculateNextRun, validateCronExpression } from '../lib/schedule-sync';
import type { AdminContext } from '../lib/admin-auth';

const DEPLOY_SECRET = process.env.DEPLOY_SECRET || '';

function getInternalAdminContext(req: Request): AdminContext | null {
  const secret = req.headers.get('X-Deploy-Secret');
  const orgId = req.headers.get('X-Org-Id');
  if (secret === DEPLOY_SECRET && orgId) {
    return { orgId } as AdminContext;
  }
  return null;
}

/**
 * Route handler for scheduler API
 */
export async function handleSchedulerRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {
  const effectiveCtx = getInternalAdminContext(req) || ctx;

  // List schedules: GET /v1/apps/:appId/environments/:env/schedules
  const listMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/schedules$/);
  if (listMatch && req.method === 'GET') {
    return listSchedules(req, { appId: listMatch[1], env: listMatch[2] }, effectiveCtx);
  }

  // Create schedule: POST /v1/apps/:appId/environments/:env/schedules
  if (listMatch && req.method === 'POST') {
    return createSchedule(req, { appId: listMatch[1], env: listMatch[2] }, effectiveCtx);
  }

  // Run history: GET /v1/apps/:appId/environments/:env/schedules/:jobId/runs
  const runsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/schedules\/([^/]+)\/runs$/);
  if (runsMatch && req.method === 'GET') {
    return getJobRuns(req, { appId: runsMatch[1], env: runsMatch[2], jobId: runsMatch[3] }, effectiveCtx);
  }

  // Manual trigger: POST /v1/apps/:appId/environments/:env/schedules/:jobId/trigger
  const triggerMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/schedules\/([^/]+)\/trigger$/);
  if (triggerMatch && req.method === 'POST') {
    return triggerJob(req, { appId: triggerMatch[1], env: triggerMatch[2], jobId: triggerMatch[3] }, effectiveCtx);
  }

  // Update schedule: PUT /v1/apps/:appId/environments/:env/schedules/:jobId
  const jobMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/schedules\/([^/]+)$/);
  if (jobMatch && req.method === 'PUT') {
    return updateSchedule(req, { appId: jobMatch[1], env: jobMatch[2], jobId: jobMatch[3] }, effectiveCtx);
  }

  // Delete schedule: DELETE /v1/apps/:appId/environments/:env/schedules/:jobId
  if (jobMatch && req.method === 'DELETE') {
    return deleteSchedule(req, { appId: jobMatch[1], env: jobMatch[2], jobId: jobMatch[3] }, effectiveCtx);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveEnvironmentId(appId: string, envName: string, orgId: string): Promise<string | null> {
  const result = await sql`
    SELECT e.id FROM app_environments e
    JOIN apps a ON a.id = e.app_id
    WHERE e.app_id = ${appId}::uuid AND e.name = ${envName}
      AND a.org_id = ${orgId}::uuid
  `;
  return result.length > 0 ? result[0].id : null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function listSchedules(
  _req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  const jobs = await sql`
    SELECT j.*,
      (SELECT COUNT(*)::int FROM app_job_runs WHERE job_id = j.id) as total_runs,
      (SELECT COUNT(*)::int FROM app_job_runs WHERE job_id = j.id AND status = 'failed') as failed_runs
    FROM app_scheduled_jobs j
    WHERE j.environment_id = ${envId}
    ORDER BY j.name ASC
  `;

  return Response.json({ schedules: jobs });
}

async function createSchedule(
  req: Request,
  params: { appId: string; env: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, cron_expression, action_type, action_config, timeout_ms, max_retries, enabled } = body;

  if (!name || !cron_expression || !action_type) {
    return Response.json({ error: 'name, cron_expression, and action_type are required' }, { status: 400 });
  }

  const cronErr = validateCronExpression(cron_expression);
  if (cronErr) {
    return Response.json({ error: `Invalid cron expression: ${cronErr}` }, { status: 400 });
  }

  if (!['webhook', 'bash'].includes(action_type)) {
    return Response.json({ error: 'action_type must be "webhook" or "bash"' }, { status: 400 });
  }

  const nextRun = calculateNextRun(cron_expression);

  try {
    const [job] = await sql`
      INSERT INTO app_scheduled_jobs (
        environment_id, name, cron_expression, action_type, action_config,
        next_run_at, timeout_ms, max_retries, enabled, source
      ) VALUES (
        ${envId}, ${name}, ${cron_expression}, ${action_type},
        ${sql.json(action_config || {})}, ${nextRun.toISOString()},
        ${timeout_ms || 30000}, ${max_retries || 0},
        ${enabled !== false}, 'console'
      )
      RETURNING *
    `;
    return Response.json({ schedule: job }, { status: 201 });
  } catch (err: any) {
    if (err.code === '23505') {
      return Response.json({ error: `Schedule '${name}' already exists for this environment` }, { status: 409 });
    }
    throw err;
  }
}

async function updateSchedule(
  req: Request,
  params: { appId: string; env: string; jobId: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Build dynamic update
  const updates: string[] = [];
  const values: any[] = [];

  if (body.cron_expression !== undefined) {
    const cronErr = validateCronExpression(body.cron_expression);
    if (cronErr) {
      return Response.json({ error: `Invalid cron expression: ${cronErr}` }, { status: 400 });
    }
  }

  // Use a full UPDATE with COALESCE-style approach
  const cronExpr = body.cron_expression;
  const nextRun = cronExpr ? calculateNextRun(cronExpr) : null;

  const [updated] = await sql`
    UPDATE app_scheduled_jobs
    SET
      name = COALESCE(${body.name || null}, name),
      cron_expression = COALESCE(${body.cron_expression || null}, cron_expression),
      action_type = COALESCE(${body.action_type || null}, action_type),
      action_config = CASE WHEN ${body.action_config !== undefined} THEN ${sql.json(body.action_config || {})} ELSE action_config END,
      timeout_ms = COALESCE(${body.timeout_ms || null}, timeout_ms),
      max_retries = COALESCE(${body.max_retries !== undefined ? body.max_retries : null}, max_retries),
      enabled = COALESCE(${body.enabled !== undefined ? body.enabled : null}, enabled),
      next_run_at = COALESCE(${nextRun ? nextRun.toISOString() : null}, next_run_at),
      updated_at = now()
    WHERE id = ${params.jobId}::uuid
      AND environment_id = ${envId}
    RETURNING *
  `;

  if (!updated) return Response.json({ error: 'Schedule not found' }, { status: 404 });

  return Response.json({ schedule: updated });
}

async function deleteSchedule(
  _req: Request,
  params: { appId: string; env: string; jobId: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  const [deleted] = await sql`
    DELETE FROM app_scheduled_jobs
    WHERE id = ${params.jobId}::uuid AND environment_id = ${envId}
    RETURNING id
  `;

  if (!deleted) return Response.json({ error: 'Schedule not found' }, { status: 404 });

  return Response.json({ deleted: true });
}

async function getJobRuns(
  req: Request,
  params: { appId: string; env: string; jobId: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  // Verify job belongs to this environment
  const [job] = await sql`
    SELECT id FROM app_scheduled_jobs
    WHERE id = ${params.jobId}::uuid AND environment_id = ${envId}
  `;
  if (!job) return Response.json({ error: 'Schedule not found' }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const runs = await sql`
    SELECT * FROM app_job_runs
    WHERE job_id = ${params.jobId}::uuid
    ORDER BY started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return Response.json({ runs });
}

async function triggerJob(
  _req: Request,
  params: { appId: string; env: string; jobId: string },
  ctx: AdminContext
): Promise<Response> {
  const envId = await resolveEnvironmentId(params.appId, params.env, ctx.orgId);
  if (!envId) return Response.json({ error: 'Environment not found' }, { status: 404 });

  // Set next_run_at to now to trigger on next poll cycle
  const [updated] = await sql`
    UPDATE app_scheduled_jobs
    SET next_run_at = now(), updated_at = now()
    WHERE id = ${params.jobId}::uuid
      AND environment_id = ${envId}
      AND enabled = true
    RETURNING id, name
  `;

  if (!updated) return Response.json({ error: 'Schedule not found or not enabled' }, { status: 404 });

  return Response.json({ triggered: true, name: updated.name, message: 'Job will execute on the next scheduler cycle (within ~15 seconds)' });
}
