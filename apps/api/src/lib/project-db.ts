/**
 * Project Database Helper
 *
 * Provides easy access to project-specific database connections.
 * Handles routing to the correct database based on project tier.
 *
 * Usage in routes:
 *   import { projectQuery, projectSql } from '../lib/project-db';
 *
 *   // Option 1: Use projectQuery for simple queries
 *   const rows = await projectQuery(ctx, sql => sql`
 *     SELECT * FROM ${sql(ctx.schemaName)}.data WHERE table_name = ${table}
 *   `);
 *
 *   // Option 2: Get the sql connection directly (for complex operations)
 *   const { sql: pSql, schema } = await projectSql(ctx);
 *   // Use pSql for multiple queries...
 */

import type { Sql } from 'postgres';
import { connectionManager, RemoteDataError } from './connection-manager';
import type { ApiContext } from '../types';

// Re-export for convenience
export { RemoteDataError };

/**
 * Get SQL connection and schema for a project
 */
export async function projectSql(ctx: ApiContext): Promise<{ sql: Sql; schema: string | null }> {
  const { sql, schema } = await connectionManager.getPool(ctx.projectId);
  return { sql, schema };
}

/**
 * Execute a query for a project with automatic connection routing
 *
 * @param ctx API context
 * @param queryFn Function that receives sql connection and returns query result
 */
export async function projectQuery<T>(
  ctx: ApiContext,
  queryFn: (sql: Sql) => Promise<T>
): Promise<T> {
  const { sql } = await connectionManager.getPool(ctx.projectId);
  return queryFn(sql);
}

/**
 * Invalidate cache for a project (call after tier migration)
 */
export function invalidateProject(projectId: string): void {
  connectionManager.invalidateProject(projectId);
}

/**
 * Get connection manager stats
 */
export function getConnectionStats() {
  return connectionManager.getStats();
}
