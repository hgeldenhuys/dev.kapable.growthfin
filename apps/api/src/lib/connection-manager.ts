/**
 * Connection Manager
 *
 * Handles dynamic database routing for multi-tenant isolation:
 * - Free tier: Schema isolation (shared database)
 * - Pro tier: Database isolation (dedicated database in shared pool)
 * - Enterprise tier: Instance isolation (dedicated PostgreSQL)
 *
 * Manages connection pools and routes queries to the correct database.
 */

import postgres, { Sql } from 'postgres';
import { sql } from './db';
import { requireEnv } from './require-env';

// Current server ID (set in environment)
const CURRENT_SERVER_ID = process.env.SERVER_ID;
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

/**
 * Project database location info
 */
export interface ProjectLocation {
  instanceId: string;
  serverId: string;
  serverHost: string;
  host: string;
  port: number;
  database: string;
  schema: string | null;
  user: string;
  password: string;
  tier: string;
}

/**
 * Connection pool entry
 */
interface PoolEntry {
  sql: Sql;
  instanceId: string;
  database: string;
  tier: string;
  createdAt: number;
}

/**
 * Error thrown when data is on a remote server
 */
export class RemoteDataError extends Error {
  constructor(public serverId: string, public serverHost: string) {
    super(`Data is on remote server ${serverId}`);
    this.name = 'RemoteDataError';
  }
}

/**
 * LRU-style cache with TTL
 */
class LocationCache {
  private cache = new Map<string, { location: ProjectLocation; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): ProjectLocation | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.location;
  }

  set(key: string, location: ProjectLocation): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { location, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Connection Manager singleton
 */
class ConnectionManager {
  private pools = new Map<string, PoolEntry>();
  private locationCache = new LocationCache();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup stale pools every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStalePools(), 5 * 60 * 1000);
  }

  /**
   * Get project database location
   */
  async getProjectLocation(projectId: string): Promise<ProjectLocation> {
    // Check cache first
    const cached = this.locationCache.get(projectId);
    if (cached) return cached;

    // Query control plane for project location (with inline password decryption)
    // Uses project-specific credentials if available, falls back to instance credentials
    const result = await sql`
      SELECT
        pd.instance_id,
        di.server_id,
        s.host as server_host,
        '127.0.0.1' as host,
        di.port,
        pd.database_name as database,
        pd.schema_name as schema,
        COALESCE(pd.project_user, di.postgres_user) as user,
        COALESCE(
          pgp_sym_decrypt(pd.project_password_encrypted::bytea, ${ENCRYPTION_KEY}),
          pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY})
        ) as password,
        di.tier,
        CASE WHEN pd.project_user IS NOT NULL THEN true ELSE false END as has_project_user
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      JOIN servers s ON s.id = di.server_id
      WHERE pd.project_id = ${projectId}
        AND pd.status = 'active'
    `;

    if (result.length === 0) {
      throw new Error(`No database found for project ${projectId}`);
    }

    const row = result[0];
    const location: ProjectLocation = {
      instanceId: row.instance_id,
      serverId: row.server_id,
      serverHost: row.server_host,
      host: row.host,
      port: row.port,
      database: row.database,
      schema: row.schema,
      user: row.user,
      password: row.password,
      tier: row.tier,
    };

    this.locationCache.set(projectId, location);
    return location;
  }

  /**
   * Get or create connection pool for a project
   */
  async getPool(projectId: string): Promise<{ sql: Sql; schema: string | null; tier: string }> {
    const location = await this.getProjectLocation(projectId);

    // Check if data is on this server (for future multi-server support)
    if (CURRENT_SERVER_ID && location.serverId !== CURRENT_SERVER_ID) {
      throw new RemoteDataError(location.serverId, location.serverHost);
    }

    const poolKey = `${location.instanceId}:${location.database}`;

    // Return existing pool if available
    if (this.pools.has(poolKey)) {
      const entry = this.pools.get(poolKey)!;
      return { sql: entry.sql, schema: location.schema, tier: location.tier };
    }

    // Create new pool (password already decrypted in getProjectLocation)
    const poolConfig = {
      host: location.host,
      port: location.port,
      database: location.database,
      username: location.user,
      password: location.password,
      max: location.tier === 'enterprise' ? 50 : location.tier === 'pro' ? 20 : 10,
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 300,
    };

    const newSql = postgres(poolConfig);

    this.pools.set(poolKey, {
      sql: newSql,
      instanceId: location.instanceId,
      database: location.database,
      tier: location.tier,
      createdAt: Date.now(),
    });

    console.log(`[ConnectionManager] Created pool for ${poolKey} (tier: ${location.tier})`);

    return { sql: newSql, schema: location.schema, tier: location.tier };
  }

  /**
   * Execute a query for a project
   * Handles schema isolation for free tier
   */
  async query<T>(
    projectId: string,
    queryFn: (sql: Sql, schema: string | null) => Promise<T>
  ): Promise<T> {
    const { sql: projectSql, schema } = await this.getPool(projectId);
    return queryFn(projectSql, schema);
  }

  /**
   * Execute a query with RLS context set
   * Sets app.project_id and app.org_id session variables before query
   * This enables PostgreSQL Row-Level Security policies
   */
  async withRLS<T>(
    projectId: string,
    orgId: string,
    queryFn: (sql: Sql, schema: string | null, tier: string) => Promise<T>
  ): Promise<T> {
    const { sql: projectSql, schema, tier } = await this.getPool(projectId);

    // Validate UUIDs to prevent SQL injection (defense in depth)
    // SET LOCAL doesn't support $1 params, so we validate format instead
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      throw new Error('Invalid projectId format');
    }
    if (!uuidRegex.test(orgId)) {
      throw new Error('Invalid orgId format');
    }

    // Use a transaction to ensure SET applies to the query
    // The session variables are set for this transaction only
    return projectSql.begin(async (tx) => {
      // Set RLS context variables
      // UUIDs are validated above, safe to interpolate
      await tx.unsafe(`
        SET LOCAL app.project_id = '${projectId}';
        SET LOCAL app.org_id = '${orgId}';
      `);

      // Execute the actual query with RLS context active
      return queryFn(tx as unknown as Sql, schema, tier);
    });
  }

  /**
   * Execute a raw query with RLS context (for simple queries)
   * Wraps the query in a transaction with session variables set
   */
  async queryWithRLS<T>(
    projectId: string,
    orgId: string,
    queryBuilder: (sql: Sql, schema: string | null, tier: string) => Promise<T[]>
  ): Promise<T[]> {
    return this.withRLS(projectId, orgId, queryBuilder);
  }

  /**
   * Invalidate cached location for a project (call after migration)
   */
  invalidateProject(projectId: string): void {
    this.locationCache.delete(projectId);
    console.log(`[ConnectionManager] Invalidated cache for project ${projectId}`);
  }

  /**
   * Cleanup stale connection pools
   */
  private cleanupStalePools(): void {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [key, entry] of this.pools) {
      if (now - entry.createdAt > maxAge) {
        entry.sql.end();
        this.pools.delete(key);
        console.log(`[ConnectionManager] Cleaned up stale pool: ${key}`);
      }
    }
  }

  /**
   * Shutdown all pools
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [key, entry] of this.pools) {
      await entry.sql.end();
      console.log(`[ConnectionManager] Closed pool: ${key}`);
    }
    this.pools.clear();
    this.locationCache.clear();
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { poolCount: number; cacheSize: number } {
    return {
      poolCount: this.pools.size,
      cacheSize: 0, // Can't get size easily from our cache implementation
    };
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[ConnectionManager] Shutting down...');
  await connectionManager.shutdown();
});

process.on('SIGINT', async () => {
  console.log('[ConnectionManager] Shutting down...');
  await connectionManager.shutdown();
});
