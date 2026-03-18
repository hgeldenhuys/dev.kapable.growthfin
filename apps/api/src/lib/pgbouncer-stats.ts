/**
 * PgBouncer Stats
 *
 * Queries PgBouncer admin interface for connection statistics.
 * Used to track direct PostgreSQL connections for Business tier.
 */

import postgres from 'postgres';

// PgBouncer connection config
const PGBOUNCER_HOST = process.env.PGBOUNCER_HOST || '127.0.0.1';
const PGBOUNCER_PORT = parseInt(process.env.PGBOUNCER_PORT || '6432', 10);
const PGBOUNCER_USER = process.env.PGBOUNCER_STATS_USER || 'pgbouncer_stats';
const PGBOUNCER_PASS = process.env.PGBOUNCER_STATS_PASS || '';


// Create connection to PgBouncer admin interface
let pgbouncerSql: ReturnType<typeof postgres> | null = null;

function getPgBouncerConnection() {
  if (!pgbouncerSql && PGBOUNCER_PASS) {
    pgbouncerSql = postgres({
      host: PGBOUNCER_HOST,
      port: PGBOUNCER_PORT,
      database: 'pgbouncer',
      username: PGBOUNCER_USER,
      password: PGBOUNCER_PASS,
      max: 1,
      idle_timeout: 60,
      // PgBouncer requires TLS for client connections
      ssl: { rejectUnauthorized: false },
      // PgBouncer admin console requires simple query protocol
      prepare: false,
      // Disable type fetching which uses extended protocol
      fetch_types: false,
      // Disable type transformation
      types: [],
      connection: {
        application_name: 'signaldb-stats',
      },
    });
  }
  return pgbouncerSql;
}

/**
 * Reset PgBouncer connection (for error recovery)
 */
function resetPgBouncerConnection() {
  if (pgbouncerSql) {
    pgbouncerSql.end().catch(() => {});
    pgbouncerSql = null;
  }
}

export interface PoolStats {
  database: string;
  user: string;
  clientsActive: number;
  clientsWaiting: number;
  serversActive: number;
  serversIdle: number;
  poolMode: string;
}

export interface DatabaseStats {
  name: string;
  host: string;
  port: number;
  currentConnections: number;
  currentClientConnections: number;
  maxConnections: number;
  poolSize: number;
  paused: boolean;
  disabled: boolean;
}

export interface ClientStats {
  user: string;
  database: string;
  state: string;
  addr: string;
  connectTime: string;
  applicationName: string;
}

/**
 * Get pool statistics from PgBouncer
 */
export async function getPoolStats(): Promise<PoolStats[]> {
  const sql = getPgBouncerConnection();
  if (!sql) {
    console.warn('[pgbouncer-stats] No PgBouncer connection configured');
    return [];
  }

  try {
    // Use simple: true to force simple query protocol
    const result = await sql`SHOW POOLS`.simple();
    return result.map((row: any) => ({
      database: row.database,
      user: row.user,
      clientsActive: parseInt(row.cl_active, 10) || 0,
      clientsWaiting: parseInt(row.cl_waiting, 10) || 0,
      serversActive: parseInt(row.sv_active, 10) || 0,
      serversIdle: parseInt(row.sv_idle, 10) || 0,
      poolMode: row.pool_mode || 'transaction',
    }));
  } catch (error: any) {
    console.error('[pgbouncer-stats] Error fetching pool stats:', error?.message || error);
    resetPgBouncerConnection();
    return [];
  }
}

/**
 * Get database statistics from PgBouncer
 */
export async function getDatabaseStats(): Promise<DatabaseStats[]> {
  const sql = getPgBouncerConnection();
  if (!sql) {
    return [];
  }

  try {
    // Use simple: true to force simple query protocol
    const result = await sql`SHOW DATABASES`.simple();
    return result.map((row: any) => ({
      name: row.name,
      host: row.host,
      port: parseInt(row.port, 10) || 0,
      currentConnections: parseInt(row.current_connections, 10) || 0,
      currentClientConnections: parseInt(row.current_client_connections, 10) || 0,
      maxConnections: parseInt(row.max_connections, 10) || 100,
      poolSize: parseInt(row.pool_size, 10) || 20,
      paused: row.paused === 1 || row.paused === '1',
      disabled: row.disabled === 1 || row.disabled === '1',
    }));
  } catch (error) {
    console.error('[pgbouncer-stats] Error fetching database stats:', error);
    resetPgBouncerConnection();
    return [];
  }
}

/**
 * Get active client connections from PgBouncer
 */
export async function getClientStats(): Promise<ClientStats[]> {
  const sql = getPgBouncerConnection();
  if (!sql) {
    return [];
  }

  try {
    // Use simple: true to force simple query protocol
    const result = await sql`SHOW CLIENTS`.simple();
    return result
      .filter((row: any) => row.database !== 'pgbouncer') // Exclude admin connections
      .map((row: any) => ({
        user: row.user,
        database: row.database,
        state: row.state,
        addr: row.addr,
        connectTime: row.connect_time,
        applicationName: row.application_name || '',
      }));
  } catch (error) {
    console.error('[pgbouncer-stats] Error fetching client stats:', error);
    resetPgBouncerConnection();
    return [];
  }
}

/**
 * Get connection stats grouped by org (based on database name pattern)
 * Business tier databases are named: business_{org_slug}
 */
export async function getConnectionsByOrg(): Promise<Record<string, {
  database: string;
  clientConnections: number;
  serverConnections: number;
  orgSlug: string | null;
}>> {
  const pools = await getPoolStats();
  const databases = await getDatabaseStats();

  const result: Record<string, {
    database: string;
    clientConnections: number;
    serverConnections: number;
    orgSlug: string | null;
  }> = {};

  // Combine pool and database stats
  for (const db of databases) {
    // Skip internal databases
    if (db.name === 'pgbouncer' || db.name === 'signaldb_control') {
      continue;
    }

    // Find matching pool stats
    const pool = pools.find(p => p.database === db.name);

    // Extract org slug from business tier database names
    let orgSlug: string | null = null;
    if (db.name.startsWith('business_')) {
      orgSlug = db.name.replace('business_', '');
    }

    result[db.name] = {
      database: db.name,
      clientConnections: pool?.clientsActive || db.currentClientConnections,
      serverConnections: pool?.serversActive || db.currentConnections,
      orgSlug,
    };
  }

  return result;
}

/**
 * Get summary stats for all PgBouncer pools
 */
export async function getPgBouncerSummary(): Promise<{
  totalClientConnections: number;
  totalServerConnections: number;
  businessTierConnections: number;
  databases: DatabaseStats[];
  pools: PoolStats[];
}> {
  const [databases, pools] = await Promise.all([
    getDatabaseStats(),
    getPoolStats(),
  ]);

  let totalClientConnections = 0;
  let totalServerConnections = 0;
  let businessTierConnections = 0;

  for (const db of databases) {
    if (db.name === 'pgbouncer') continue;
    totalClientConnections += db.currentClientConnections;
    totalServerConnections += db.currentConnections;

    if (db.name.startsWith('business_')) {
      businessTierConnections += db.currentClientConnections;
    }
  }

  return {
    totalClientConnections,
    totalServerConnections,
    businessTierConnections,
    databases: databases.filter(d => d.name !== 'pgbouncer'),
    pools: pools.filter(p => p.database !== 'pgbouncer'),
  };
}

/**
 * Check if PgBouncer stats are available
 */
export function isPgBouncerConfigured(): boolean {
  const configured = !!PGBOUNCER_PASS;
  if (!configured) {
    console.warn('[pgbouncer-stats] Not configured: PGBOUNCER_STATS_PASS env var is empty');
  }
  return configured;
}
