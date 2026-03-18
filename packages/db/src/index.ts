/**
 * @agios/db
 * Shared database schemas and client
 *
 * @example
 * ```typescript
 * import { db, users, workspaces } from '@agios/db';
 * import { withRLSContext } from '@agios/db/rls';
 *
 * // Query with RLS context
 * const myWorkspaces = await withRLSContext(
 *   db,
 *   { userId: '...', workspaceId: '...' },
 *   async (db) => db.select().from(workspaces)
 * );
 * ```
 */

// Export client
export { createDbClient, db, type Database } from './client';

// Export connection pool utilities
export { getDbConnection, closeDbConnection, isDbConnectionInitialized } from './connection';

// Export all schemas
export * from './schema';

// Export RLS utilities
export { setRLSContext, clearRLSContext, withRLSContext, createRLSPoliciesSQL, type RLSContext } from './rls';
