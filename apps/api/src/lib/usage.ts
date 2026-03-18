/**
 * Usage Metering for billing
 *
 * Tracks per-org usage:
 * - API requests by endpoint
 * - WebSocket connections and events
 * - Storage (rows, data size)
 */

import { sql } from './db';

interface OrgUsage {
  requests: {
    total: number;
    byEndpoint: Map<string, number>;
  };
  websocket: {
    connections: number;      // Current active
    totalConnections: number; // All-time
    eventsReceived: number;
  };
  sse: {
    connections: number;
    totalConnections: number;
  };
  database: {
    activeQueries: number;    // Current active queries
    totalQueries: number;     // All-time query count
  };
  lastUpdated: number;
}

// In-memory usage tracking (flush to DB periodically for persistence)
const orgUsage = new Map<string, OrgUsage>();

/**
 * Get or create usage tracker for an org
 */
function getOrgUsage(orgId: string): OrgUsage {
  let usage = orgUsage.get(orgId);
  if (!usage) {
    usage = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
      },
      websocket: {
        connections: 0,
        totalConnections: 0,
        eventsReceived: 0,
      },
      sse: {
        connections: 0,
        totalConnections: 0,
      },
      database: {
        activeQueries: 0,
        totalQueries: 0,
      },
      lastUpdated: Date.now(),
    };
    orgUsage.set(orgId, usage);
  }
  return usage;
}

/**
 * Track an API request
 */
export function trackApiRequest(orgId: string, endpoint: string): void {
  const usage = getOrgUsage(orgId);
  usage.requests.total++;
  usage.requests.byEndpoint.set(
    endpoint,
    (usage.requests.byEndpoint.get(endpoint) || 0) + 1
  );
  usage.lastUpdated = Date.now();
}

/**
 * Track WebSocket connection open
 */
export function trackWsConnect(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.websocket.connections++;
  usage.websocket.totalConnections++;
  usage.lastUpdated = Date.now();
}

/**
 * Track WebSocket connection close
 */
export function trackWsDisconnect(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.websocket.connections = Math.max(0, usage.websocket.connections - 1);
  usage.lastUpdated = Date.now();
}

/**
 * Track WebSocket event received
 */
export function trackWsEvent(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.websocket.eventsReceived++;
  usage.lastUpdated = Date.now();
}

/**
 * Track SSE connection open
 */
export function trackSseConnect(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.sse.connections++;
  usage.sse.totalConnections++;
  usage.lastUpdated = Date.now();
}

/**
 * Track SSE connection close
 */
export function trackSseDisconnect(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.sse.connections = Math.max(0, usage.sse.connections - 1);
  usage.lastUpdated = Date.now();
}

/**
 * Track database query start
 */
export function trackDbQueryStart(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.database.activeQueries++;
  usage.database.totalQueries++;
  usage.lastUpdated = Date.now();
}

/**
 * Track database query end
 */
export function trackDbQueryEnd(orgId: string): void {
  const usage = getOrgUsage(orgId);
  usage.database.activeQueries = Math.max(0, usage.database.activeQueries - 1);
  usage.lastUpdated = Date.now();
}

/**
 * Get storage usage for an org from database (aggregates across all project schemas)
 */
export async function getStorageUsage(orgId: string): Promise<{
  tables: number;
  rows: number;
  estimatedSizeBytes: number;
}> {
  try {
    // Get all projects for this org with their schema names
    const projects = await sql`
      SELECT id, schema_name FROM projects WHERE org_id = ${orgId} AND schema_name IS NOT NULL
    `;

    let totalTables = 0;
    let totalRows = 0;
    let totalSize = 0;

    // Aggregate across all project schemas
    for (const project of projects) {
      try {
        const tableResult = await sql`
          SELECT COUNT(*) as count FROM ${sql(project.schema_name)}.tables
        `;
        totalTables += Number(tableResult[0]?.count || 0);

        const rowResult = await sql`
          SELECT
            COUNT(*) as count,
            COALESCE(SUM(pg_column_size(data)), 0) as data_size
          FROM ${sql(project.schema_name)}.data
        `;
        totalRows += Number(rowResult[0]?.count || 0);
        totalSize += Number(rowResult[0]?.data_size || 0);
      } catch {
        // Schema might not exist or be empty, continue
      }
    }

    return { tables: totalTables, rows: totalRows, estimatedSizeBytes: totalSize };
  } catch (error) {
    console.error('[usage] Error getting storage usage:', error);
    return { tables: 0, rows: 0, estimatedSizeBytes: 0 };
  }
}

/**
 * Get usage summary for an org
 */
export async function getOrgUsageSummary(orgId: string): Promise<{
  requests: { total: number; byEndpoint: Record<string, number> };
  websocket: { active: number; total: number; events: number };
  sse: { active: number; total: number };
  database: { active: number; total: number };
  storage: { tables: number; rows: number; sizeBytes: number };
}> {
  const usage = getOrgUsage(orgId);
  const storage = await getStorageUsage(orgId);

  return {
    requests: {
      total: usage.requests.total,
      byEndpoint: Object.fromEntries(usage.requests.byEndpoint),
    },
    websocket: {
      active: usage.websocket.connections,
      total: usage.websocket.totalConnections,
      events: usage.websocket.eventsReceived,
    },
    sse: {
      active: usage.sse.connections,
      total: usage.sse.totalConnections,
    },
    database: {
      active: usage.database.activeQueries,
      total: usage.database.totalQueries,
    },
    storage: {
      tables: storage.tables,
      rows: storage.rows,
      sizeBytes: storage.estimatedSizeBytes,
    },
  };
}

/**
 * Get usage for all orgs (for admin stats)
 */
export function getAllUsage(): Record<string, {
  requests: number;
  wsConnections: number;
  sseConnections: number;
  dbQueries: number;
}> {
  const result: Record<string, {
    requests: number;
    wsConnections: number;
    sseConnections: number;
    dbQueries: number;
  }> = {};

  for (const [orgId, usage] of orgUsage) {
    result[orgId] = {
      requests: usage.requests.total,
      wsConnections: usage.websocket.connections,
      sseConnections: usage.sse.connections,
      dbQueries: usage.database.activeQueries,
    };
  }

  return result;
}

/**
 * Get total active connections across all orgs
 */
export function getTotalConnections(): {
  websocket: number;
  sse: number;
  total: number;
} {
  let websocket = 0;
  let sse = 0;

  for (const usage of orgUsage.values()) {
    websocket += usage.websocket.connections;
    sse += usage.sse.connections;
  }

  return {
    websocket,
    sse,
    total: websocket + sse,
  };
}

/**
 * Flush in-memory usage data to the database using the existing record_usage() SQL function.
 * Called periodically by startUsageFlusher().
 */
export async function flushUsageToDb(): Promise<void> {
  try {
    for (const [orgId, usage] of orgUsage) {
      if (usage.requests.total <= 0) continue;

      const totalRequests = usage.requests.total;

      // Record API calls
      await sql`
        SELECT record_usage(${orgId}::uuid, 'api_calls', ${totalRequests}::bigint)
      `.catch((err: unknown) => {
        console.error(`[usage-flush] Failed to record api_calls for org ${orgId}:`, err);
      });

      // Record WebSocket connections (total connections made this period)
      if (usage.websocket.totalConnections > 0) {
        await sql`
          SELECT record_usage(${orgId}::uuid, 'ws_connections', ${usage.websocket.totalConnections}::bigint)
        `.catch((err: unknown) => {
          console.error(`[usage-flush] Failed to record ws_connections for org ${orgId}:`, err);
        });
      }

      // Record SSE connections (total connections made this period)
      if (usage.sse.totalConnections > 0) {
        await sql`
          SELECT record_usage(${orgId}::uuid, 'sse_connections', ${usage.sse.totalConnections}::bigint)
        `.catch((err: unknown) => {
          console.error(`[usage-flush] Failed to record sse_connections for org ${orgId}:`, err);
        });
      }

      // Reset counters after flush (keep active connection counts)
      usage.requests.total = 0;
      usage.requests.byEndpoint.clear();
      usage.websocket.totalConnections = 0;
      usage.websocket.eventsReceived = 0;
      usage.sse.totalConnections = 0;
      usage.database.totalQueries = 0;
    }
  } catch (err) {
    console.error('[usage-flush] Unexpected error during flush:', err);
  }
}

let flushInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic flushing of usage data to the database.
 * Call once on server startup.
 */
export function startUsageFlusher(intervalMs: number = 60_000): void {
  if (flushInterval) return;
  flushInterval = setInterval(() => {
    flushUsageToDb().catch((err) => {
      console.error('[usage-flush] Timer flush error:', err);
    });
  }, intervalMs);
  console.log(`[usage-flush] Started (interval: ${intervalMs}ms)`);
}

/**
 * Stop the usage flusher (for graceful shutdown)
 */
export function stopUsageFlusher(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

/**
 * Reset usage for an org (for testing)
 */
export function resetOrgUsage(orgId: string): void {
  orgUsage.delete(orgId);
}

/**
 * Reset all usage (for testing)
 */
export function resetAllUsage(): void {
  orgUsage.clear();
}
