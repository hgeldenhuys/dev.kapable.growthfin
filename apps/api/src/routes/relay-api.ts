/**
 * Relay API Routes - Proxy to Relay Daemon on Mac Studio
 *
 * Follows the same proxy pattern as deploy-agent (deployment-api.ts).
 * The Relay daemon runs on Mac Studio, accessible via socat (127.0.0.1:4200)
 * which forwards to Tailscale IP 100.74.69.40:4200.
 *
 * Some routes proxy directly to the daemon, others read from the database
 * (so they work even when the daemon is temporarily unreachable).
 */

import { sql } from '../lib/db';
import type { AdminContext } from '../lib/admin-auth';

const RELAY_HOST = process.env.CONNECT_APP_HOST || '127.0.0.1';
const RELAY_URL = process.env.RELAY_DAEMON_URL || `http://${RELAY_HOST}:4200`;
const RELAY_SECRET = process.env.RELAY_SECRET || 'dev-relay-secret';

/**
 * Proxy a request to the Relay daemon
 */
async function proxyToRelay(
  method: string,
  path: string,
  body?: any,
  timeoutMs = 30_000
): Promise<Response> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Secret': RELAY_SECRET,
      },
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${RELAY_URL}${path}`, options);
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return Response.json({ error: 'Relay daemon timeout' }, { status: 504 });
    }
    return Response.json({
      error: 'Relay daemon unreachable',
      detail: err.message,
    }, { status: 502 });
  }
}

/**
 * Handle all /v1/relay/* routes
 */
export async function handleRelayRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {
  // Strip /v1/relay prefix
  const relayPath = pathname.replace(/^\/v1\/relay/, '');

  // GET /v1/relay/health — proxy to daemon health
  if (relayPath === '/health' && req.method === 'GET') {
    return proxyToRelay('GET', '/health', undefined, 5_000);
  }

  // GET /v1/relay/status — proxy to daemon status
  if (relayPath === '/status' && req.method === 'GET') {
    return proxyToRelay('GET', '/status', undefined, 5_000);
  }

  // POST /v1/relay/pipelines/run — trigger a pipeline
  if (relayPath === '/pipelines/run' && req.method === 'POST') {
    const body = await req.json();
    return proxyToRelay('POST', '/pipelines/run', {
      ...body,
      orgId: ctx.orgId || body.orgId,
    }, 15_000);
  }

  // POST /v1/relay/pipelines/cancel/:runId — cancel a run
  const cancelMatch = relayPath.match(/^\/pipelines\/cancel\/([a-f0-9-]+)$/);
  if (cancelMatch && req.method === 'POST') {
    return proxyToRelay('POST', `/pipelines/cancel/${cancelMatch[1]}`);
  }

  // GET /v1/relay/pipelines/runs — list runs (from database)
  if (relayPath === '/pipelines/runs' && req.method === 'GET') {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status');

    try {
      let runs;
      if (status) {
        runs = await sql`
          SELECT r.*, d.name as pipeline_name, d.pipeline_type
          FROM ci_pipeline_runs r
          LEFT JOIN ci_pipeline_definitions d ON r.definition_id = d.id
          WHERE r.status = ${status}
          ORDER BY r.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        runs = await sql`
          SELECT r.*, d.name as pipeline_name, d.pipeline_type
          FROM ci_pipeline_runs r
          LEFT JOIN ci_pipeline_definitions d ON r.definition_id = d.id
          ORDER BY r.created_at DESC
          LIMIT ${limit}
        `;
      }
      return Response.json({ runs });
    } catch (err: any) {
      // Fallback to daemon if DB query fails
      return proxyToRelay('GET', `/pipelines/runs?limit=${limit}${status ? `&status=${status}` : ''}`);
    }
  }

  // GET /v1/relay/pipelines/runs/:runId — get run detail (from database)
  const runDetailMatch = relayPath.match(/^\/pipelines\/runs\/([a-f0-9-]+)$/);
  if (runDetailMatch && req.method === 'GET') {
    const runId = runDetailMatch[1];

    try {
      const [runRows, stageRows] = await Promise.all([
        sql`
          SELECT r.*, d.name as pipeline_name, d.pipeline_type
          FROM ci_pipeline_runs r
          LEFT JOIN ci_pipeline_definitions d ON r.definition_id = d.id
          WHERE r.id = ${runId}
        `,
        sql`
          SELECT * FROM ci_pipeline_stages
          WHERE run_id = ${runId}
          ORDER BY stage_order
        `,
      ]);

      if (runRows.length === 0) {
        // Try daemon for active runs not yet in DB
        return proxyToRelay('GET', `/pipelines/runs/${runId}`);
      }

      return Response.json({
        ...runRows[0],
        stages: stageRows,
      });
    } catch {
      return proxyToRelay('GET', `/pipelines/runs/${runId}`);
    }
  }

  // GET /v1/relay/pipelines/runs/:runId/logs — stream logs from daemon
  const logsMatch = relayPath.match(/^\/pipelines\/runs\/([a-f0-9-]+)\/logs$/);
  if (logsMatch && req.method === 'GET') {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || '0';
    return proxyToRelay('GET', `/pipelines/runs/${logsMatch[1]}/logs?from=${from}`, undefined, 10_000);
  }

  // GET /v1/relay/pipelines/definitions — list pipeline definitions (from database)
  if (relayPath === '/pipelines/definitions' && req.method === 'GET') {
    try {
      const defs = await sql`
        SELECT * FROM ci_pipeline_definitions
        WHERE enabled = true
        ORDER BY pipeline_type, name
      `;
      return Response.json({ definitions: defs });
    } catch {
      return proxyToRelay('GET', '/pipelines/definitions');
    }
  }

  return null;
}
