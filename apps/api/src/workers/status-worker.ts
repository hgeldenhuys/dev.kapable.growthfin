/**
 * Status Worker
 *
 * Background process that:
 * - Pings each service /health endpoint every 30 seconds
 * - Updates service_status table with results
 * - Records health history for uptime calculations
 * - Sends alerts on state changes (down/recovered)
 * - Checks disk space
 * - Follows the webhook-worker pattern (setTimeout loop)
 */

import { sql } from '../lib/db';
import { logger } from '../lib/logger';
import { sendAlert, resolveAlert } from '../lib/alerting';

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

let isRunning = false;
let checkTimer: ReturnType<typeof setTimeout> | null = null;

// Track previous states for change detection
const previousStates = new Map<string, string>();

interface ServiceCheck {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

const CLAUDE_PROXY_URL = process.env.CLAUDE_PROXY_URL || 'http://127.0.0.1:9080';

const SERVICES: ServiceCheck[] = [
  { name: 'api', url: 'http://127.0.0.1:3003/health' },
  { name: 'console', url: 'http://127.0.0.1:3005/health' },
  { name: 'auth', url: 'http://127.0.0.1:3009/health' },
  { name: 'marketing', url: 'http://127.0.0.1:3003/health', headers: { 'Host': 'signaldb.live', 'X-Connect-Subdomain': 'signaldb.live' } },
  { name: 'claude-proxy', url: `${CLAUDE_PROXY_URL}/health` },
];

/**
 * Check a single service health
 */
async function checkService(service: ServiceCheck): Promise<{
  status: string;
  responseTimeMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(service.url, { signal: controller.signal, headers: service.headers });
    clearTimeout(timeout);

    const responseTimeMs = Date.now() - start;

    if (res.ok) {
      return { status: 'operational', responseTimeMs };
    }
    return {
      status: 'degraded',
      responseTimeMs,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'down',
      responseTimeMs,
      error: message,
    };
  }
}

/**
 * Check database instances by attempting a simple query
 */
async function checkDatabase(name: string): Promise<{
  status: string;
  responseTimeMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await sql`SELECT 1`;
    return { status: 'operational', responseTimeMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'down',
      responseTimeMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * Check disk space usage
 */
async function checkDiskSpace(): Promise<{
  status: string;
  percentUsed: number;
  error?: string;
}> {
  try {
    const proc = Bun.spawn(['df', '-h', '/'], { stdout: 'pipe' });
    const output = await new Response(proc.stdout).text();
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const percentStr = parts[4]?.replace('%', '') || '0';
      const percentUsed = parseInt(percentStr, 10);
      if (percentUsed >= 90) {
        return { status: 'critical', percentUsed, error: `Disk usage at ${percentUsed}%` };
      }
      if (percentUsed >= 80) {
        return { status: 'warning', percentUsed };
      }
      return { status: 'operational', percentUsed };
    }
    return { status: 'operational', percentUsed: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'unknown', percentUsed: 0, error: message };
  }
}

/**
 * Handle state change for a service — send alert or resolution
 */
async function handleStateChange(name: string, currentStatus: string, error?: string): Promise<void> {
  const previousStatus = previousStates.get(name);
  previousStates.set(name, currentStatus);

  // First check — no previous state
  if (previousStatus === undefined) return;

  // State changed to down/degraded
  if (currentStatus === 'down' && previousStatus !== 'down') {
    await sendAlert({
      type: 'service_down',
      severity: 'critical',
      serviceName: name,
      message: `Service "${name}" is down. ${error || ''}`.trim(),
    });
  } else if (currentStatus === 'degraded' && previousStatus === 'operational') {
    await sendAlert({
      type: 'service_degraded',
      severity: 'warning',
      serviceName: name,
      message: `Service "${name}" is degraded. ${error || ''}`.trim(),
    });
  }

  // Recovered
  if (currentStatus === 'operational' && (previousStatus === 'down' || previousStatus === 'degraded')) {
    await resolveAlert('service_down', name);
    await resolveAlert('service_degraded', name);
  }
}

/**
 * Record health check in history table (for uptime calculations)
 */
async function recordHealthHistory(name: string, status: string, responseTimeMs: number, error?: string): Promise<void> {
  try {
    await sql`
      INSERT INTO health_history (service_name, status, response_time_ms, error_message)
      VALUES (${name}, ${status}, ${responseTimeMs}, ${error || null})
    `;
  } catch (err) {
    // Non-critical — just log
    logger.error(`[status-worker] Failed to record health history for ${name}`, err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Run all health checks and update database
 */
async function runChecks(): Promise<void> {
  // Check HTTP services
  for (const service of SERVICES) {
    const result = await checkService(service);
    try {
      await sql`
        INSERT INTO service_status (service_name, status, last_check, response_time_ms, error_message)
        VALUES (${service.name}, ${result.status}, now(), ${result.responseTimeMs}, ${result.error || null})
        ON CONFLICT (service_name) DO UPDATE SET
          status = EXCLUDED.status,
          last_check = EXCLUDED.last_check,
          response_time_ms = EXCLUDED.response_time_ms,
          error_message = EXCLUDED.error_message
      `;
    } catch (err) {
      logger.error(`Failed to update status for ${service.name}`, err instanceof Error ? err : new Error(String(err)));
    }

    // Record history + handle state changes
    await recordHealthHistory(service.name, result.status, result.responseTimeMs, result.error);
    await handleStateChange(service.name, result.status, result.error);
  }

  // Check database instances
  for (const dbName of ['database-hobbyist', 'database-pro']) {
    const result = await checkDatabase(dbName);
    try {
      await sql`
        INSERT INTO service_status (service_name, status, last_check, response_time_ms, error_message)
        VALUES (${dbName}, ${result.status}, now(), ${result.responseTimeMs}, ${result.error || null})
        ON CONFLICT (service_name) DO UPDATE SET
          status = EXCLUDED.status,
          last_check = EXCLUDED.last_check,
          response_time_ms = EXCLUDED.response_time_ms,
          error_message = EXCLUDED.error_message
      `;
    } catch (err) {
      logger.error(`Failed to update status for ${dbName}`, err instanceof Error ? err : new Error(String(err)));
    }

    await recordHealthHistory(dbName, result.status, result.responseTimeMs, result.error);
    await handleStateChange(dbName, result.status, result.error);
  }

  // Check disk space
  const diskResult = await checkDiskSpace();
  if (diskResult.status === 'critical') {
    await sendAlert({
      type: 'disk_space',
      severity: 'critical',
      serviceName: 'disk',
      message: diskResult.error || `Disk usage at ${diskResult.percentUsed}%`,
    });
  } else if (diskResult.status === 'warning') {
    await sendAlert({
      type: 'disk_space',
      severity: 'warning',
      serviceName: 'disk',
      message: `Disk usage at ${diskResult.percentUsed}%`,
    });
  }
}

/**
 * Polling loop
 */
async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    await runChecks();
  } catch (error) {
    logger.error('[status-worker] Error in check cycle', error instanceof Error ? error : new Error(String(error)));
  }

  if (isRunning) {
    checkTimer = setTimeout(poll, CHECK_INTERVAL_MS);
  }
}

/**
 * Start the status worker
 */
export function startStatusWorker(): void {
  if (isRunning) {
    logger.info('[status-worker] Already running');
    return;
  }

  isRunning = true;
  logger.info('[status-worker] Starting...');
  poll();
  logger.info('[status-worker] Started successfully');
}

/**
 * Stop the status worker
 */
export function stopStatusWorker(): void {
  if (!isRunning) return;

  isRunning = false;
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }
  logger.info('[status-worker] Stopped');
}

/**
 * Get current status of all services
 */
export async function getServiceStatuses(): Promise<Array<{
  service_name: string;
  status: string;
  last_check: Date;
  response_time_ms: number | null;
  error_message: string | null;
}>> {
  try {
    const rows = await sql`SELECT * FROM service_status ORDER BY service_name`;
    return rows as any[];
  } catch {
    return [];
  }
}

/**
 * Get active incidents
 */
export async function getActiveIncidents(): Promise<Array<{
  id: string;
  title: string;
  severity: string;
  status: string;
  affected_services: string[];
  started_at: Date;
  updates: any[];
}>> {
  try {
    const rows = await sql`
      SELECT * FROM status_incidents
      WHERE resolved_at IS NULL
      ORDER BY started_at DESC
    `;
    return rows as any[];
  } catch {
    return [];
  }
}

/**
 * Get uptime percentage for a service over the last N days
 */
export async function getServiceUptime(serviceName: string, days: number = 30): Promise<number> {
  try {
    const rows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'operational') as up_count,
        COUNT(*) as total_count
      FROM health_history
      WHERE service_name = ${serviceName}
        AND checked_at > now() - ${days + ' days'}::interval
    `;
    const total = Number(rows[0]?.total_count || 0);
    if (total === 0) return 100;
    const up = Number(rows[0]?.up_count || 0);
    return Math.round((up / total) * 10000) / 100; // 2 decimal places
  } catch {
    return 100;
  }
}

/**
 * Get worker status for stats endpoint
 */
export function getStatusWorkerStatus(): { running: boolean } {
  return { running: isRunning };
}
