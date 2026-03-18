/**
 * Database Client
 * PostgreSQL connection with Drizzle ORM using shared connection pool
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { getDbConnection } from './connection';
import { schema } from './schema';

/**
 * Create database client using the shared connection pool
 * This prevents "too many clients" errors by reusing connections
 */
export function createDbClient(connectionString?: string) {
  const client = getDbConnection(connectionString);
  return drizzle(client, { schema });
}

/**
 * Default database client (uses DATABASE_URL from env)
 * Uses the shared singleton connection pool
 */
export const db = createDbClient(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev'
);

export type Database = typeof db;
