/**
 * Connect SDK — Database
 *
 * Singleton postgres.js pool that reads DATABASE_URL and SIGNALDB_SCHEMA
 * from environment variables. Schema-aware for hobbyist tier isolation.
 *
 * Usage:
 *   import { getDB, getSchema } from '@signaldb-live/connect/db';
 *
 *   const sql = getDB();
 *   const rows = await sql`SELECT * FROM users`;
 */

import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Get the SIGNALDB_SCHEMA env var, or undefined if not set.
 * Hobbyist tier apps get a schema like `project_xxxx` for isolation.
 */
export function getSchema(): string | undefined {
  return process.env.SIGNALDB_SCHEMA || undefined;
}

/**
 * Get or create a singleton postgres.js connection pool.
 * Reads DATABASE_URL from environment. Configures sensible defaults
 * for Connect app workloads (max 10 connections, 5min lifetime).
 */
export function getDB(): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Ensure your app is linked to a SignalDB project and deployed via the platform.'
    );
  }

  const schema = getSchema();

  _sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    max_lifetime: 300,
    // Set search_path for hobbyist schema-per-project isolation
    ...(schema ? { connection: { search_path: schema } } : {}),
  });

  return _sql;
}

/**
 * Close the database pool. Call on shutdown for clean exit.
 */
export async function closeDB(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
