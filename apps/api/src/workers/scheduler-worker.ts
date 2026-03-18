/**
 * Scheduler Worker
 *
 * Background process that:
 * - Polls for due scheduled jobs every 15 seconds
 * - Atomically claims jobs to prevent double-execution
 * - Executes webhook (HTTP) or bash (container exec) actions
 * - Logs runs to app_job_runs table
 * - Cleans up old runs daily (30-day retention)
 */

import { sql } from '../lib/db';
import { calculateNextRun } from '../lib/schedule-sync';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 15_000;  // 15 seconds
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const BATCH_SIZE = 10;
const MAX_RESPONSE_BODY = 4096;  // 4KB truncation for response_body
const RETENTION_DAYS = 30;

const DEPLOY_AGENT_URL = process.env.DEPLOY_AGENT_URL || 'http://127.0.0.1:4100';
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || '';
const CRON_SIGNING_SECRET = process.env.CRON_SIGNING_SECRET || process.env.DEPLOY_SECRET || '';

interface ScheduledJob {
  id: string;
  environment_id: string;
  name: string;
  cron_expression: string;
  action_type: string;
  action_config: any;
  timeout_ms: number;
  max_retries: number;
}

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the scheduler worker
 */
export function startSchedulerWorker(): void {
  if (isRunning) {
    console.log('[scheduler-worker] Already running');
    return;
  }

  isRunning = true;
  console.log('[scheduler-worker] Starting...');

  // Start polling loop
  poll();

  // Start cleanup timer
  scheduleCleanup();

  console.log('[scheduler-worker] Started successfully');
}

/**
 * Stop the scheduler worker
 */
export function stopSchedulerWorker(): void {
  if (!isRunning) {
    console.log('[scheduler-worker] Not running');
    return;
  }

  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  console.log('[scheduler-worker] Stopped');
}

/**
 * Poll for due scheduled jobs
 */
async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    const processed = await processDueJobs();
    if (processed > 0) {
      console.log(`[scheduler-worker] Processed ${processed} jobs`);
    }
  } catch (error) {
    console.error('[scheduler-worker] Error in poll cycle:', error);
  }

  // Schedule next poll
  if (isRunning) {
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
  }
}

/**
 * Find and execute due jobs
 */
async function processDueJobs(): Promise<number> {
  const now = new Date().toISOString();

  // Atomically claim a batch of due jobs
  const dueJobs = await sql<ScheduledJob[]>`
    UPDATE app_scheduled_jobs
    SET next_run_at = NULL
    WHERE id IN (
      SELECT j.id FROM app_scheduled_jobs j
      JOIN app_environments e ON e.id = j.environment_id
      WHERE j.enabled = true
        AND j.next_run_at IS NOT NULL
        AND j.next_run_at <= ${now}
        AND e.status = 'running'
      ORDER BY j.next_run_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, environment_id, name, cron_expression, action_type, action_config, timeout_ms, max_retries
  `;

  if (dueJobs.length === 0) return 0;

  // Execute each job concurrently
  const results = await Promise.allSettled(
    dueJobs.map(job => executeJob(job))
  );

  // Update next_run_at for all claimed jobs
  for (let i = 0; i < dueJobs.length; i++) {
    const job = dueJobs[i];
    try {
      const nextRun = calculateNextRun(job.cron_expression);
      const result = results[i];
      const status = result.status === 'fulfilled' ? result.value : 'failed';

      await sql`
        UPDATE app_scheduled_jobs
        SET next_run_at = ${nextRun.toISOString()},
            last_run_at = now(),
            last_run_status = ${status},
            updated_at = now()
        WHERE id = ${job.id}
      `;
    } catch (err) {
      console.error(`[scheduler-worker] Failed to update next_run for job ${job.name}:`, err);
      // Re-enable the job with a fallback next_run
      try {
        const fallback = new Date(Date.now() + 60_000).toISOString();
        await sql`
          UPDATE app_scheduled_jobs
          SET next_run_at = ${fallback}, updated_at = now()
          WHERE id = ${job.id}
        `;
      } catch {}
    }
  }

  return dueJobs.length;
}

/**
 * Execute a single scheduled job
 */
async function executeJob(job: ScheduledJob): Promise<'success' | 'failed' | 'timeout'> {
  const maxAttempts = 1 + (job.max_retries || 0);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Create run record
    const [run] = await sql`
      INSERT INTO app_job_runs (job_id, status, attempt)
      VALUES (${job.id}, 'running', ${attempt})
      RETURNING id
    `;

    const startTime = Date.now();
    let status: 'success' | 'failed' | 'timeout' = 'failed';
    let httpStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      if (job.action_type === 'webhook') {
        const result = await executeWebhook(job, attempt);
        httpStatus = result.httpStatus;
        responseBody = result.responseBody;
        status = result.httpStatus >= 200 && result.httpStatus < 300 ? 'success' : 'failed';
        if (status === 'failed') {
          errorMessage = `HTTP ${result.httpStatus}`;
        }
      } else if (job.action_type === 'bash') {
        const result = await executeBash(job);
        responseBody = result.stdout;
        status = result.exitCode === 0 ? 'success' : 'failed';
        if (status === 'failed') {
          errorMessage = result.stderr || `Exit code ${result.exitCode}`;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        status = 'timeout';
        errorMessage = `Timed out after ${job.timeout_ms}ms`;
      } else {
        status = 'failed';
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    const durationMs = Date.now() - startTime;

    // Truncate response body
    if (responseBody && responseBody.length > MAX_RESPONSE_BODY) {
      responseBody = responseBody.substring(0, MAX_RESPONSE_BODY) + '... (truncated)';
    }

    // Update run record
    await sql`
      UPDATE app_job_runs
      SET status = ${status},
          completed_at = now(),
          duration_ms = ${durationMs},
          http_status = ${httpStatus},
          response_body = ${responseBody},
          error_message = ${errorMessage}
      WHERE id = ${run.id}
    `;

    if (status === 'success') return 'success';

    // If not the last attempt, wait before retrying
    if (attempt < maxAttempts) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
      await new Promise(r => setTimeout(r, backoffMs));
    } else {
      return status;
    }
  }

  return 'failed';
}

/**
 * Execute a webhook action
 */
async function executeWebhook(
  job: ScheduledJob,
  attempt: number
): Promise<{ httpStatus: number; responseBody: string }> {
  const config = job.action_config;

  // Resolve container URL
  const env = await sql`
    SELECT e.container_name, e.subdomain, a.name as app_name
    FROM app_environments e
    JOIN apps a ON a.id = e.app_id
    WHERE e.id = ${job.environment_id}
  `;

  if (env.length === 0) throw new Error('Environment not found');

  const containerName = env[0].container_name;
  if (!containerName) throw new Error('Environment has no container');

  const url = `http://${containerName}:3000${config.url || '/'}`;

  // HMAC signature for verification
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${job.name}.${attempt}`;
  const signature = crypto
    .createHmac('sha256', CRON_SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SignalDB-Cron-Job': job.name,
    'X-SignalDB-Cron-Timestamp': String(timestamp),
    'X-SignalDB-Cron-Signature': `v1=${signature}`,
    'User-Agent': 'SignalDB-Scheduler/1.0',
    ...(config.headers || {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), job.timeout_ms);

  try {
    const response = await fetch(url, {
      method: config.method || 'POST',
      headers,
      body: config.body || undefined,
      signal: controller.signal,
    });

    const responseBody = await response.text().catch(() => '');

    return {
      httpStatus: response.status,
      responseBody,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute a bash action via deploy agent
 */
async function executeBash(
  job: ScheduledJob
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const config = job.action_config;

  // Get container name
  const env = await sql`
    SELECT container_name FROM app_environments WHERE id = ${job.environment_id}
  `;

  if (env.length === 0) throw new Error('Environment not found');
  const containerName = env[0].container_name;
  if (!containerName) throw new Error('Environment has no container');

  const response = await fetch(`${DEPLOY_AGENT_URL}/container-exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify({
      containerName,
      command: config.command,
      timeoutMs: job.timeout_ms,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Deploy agent error: ${response.status} ${text}`);
  }

  return await response.json() as { exitCode: number; stdout: string; stderr: string };
}

/**
 * Schedule cleanup of old runs
 */
function scheduleCleanup(): void {
  if (!isRunning) return;

  cleanupTimer = setTimeout(async () => {
    if (!isRunning) return;

    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const result = await sql`
        DELETE FROM app_job_runs WHERE created_at < ${cutoff} RETURNING id
      `;
      if (result.length > 0) {
        console.log(`[scheduler-worker] Cleaned up ${result.length} old run records`);
      }
    } catch (error) {
      console.error('[scheduler-worker] Error in cleanup:', error);
    }

    if (isRunning) {
      scheduleCleanup();
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get worker status
 */
export async function getSchedulerWorkerStatus(): Promise<{
  running: boolean;
  stats: { total_jobs: number; enabled_jobs: number; due_jobs: number };
}> {
  const [stats] = await sql`
    SELECT
      COUNT(*)::int as total_jobs,
      COUNT(*) FILTER (WHERE enabled = true)::int as enabled_jobs,
      COUNT(*) FILTER (WHERE enabled = true AND next_run_at <= now())::int as due_jobs
    FROM app_scheduled_jobs
  `;
  return {
    running: isRunning,
    stats: {
      total_jobs: stats.total_jobs,
      enabled_jobs: stats.enabled_jobs,
      due_jobs: stats.due_jobs,
    },
  };
}

// Auto-start if this file is run directly
if (import.meta.main) {
  console.log('[scheduler-worker] Starting as standalone process...');
  startSchedulerWorker();

  process.on('SIGINT', () => {
    console.log('[scheduler-worker] Received SIGINT, shutting down...');
    stopSchedulerWorker();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[scheduler-worker] Received SIGTERM, shutting down...');
    stopSchedulerWorker();
    process.exit(0);
  });
}
