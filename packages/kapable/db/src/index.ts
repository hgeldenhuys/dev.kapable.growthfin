/**
 * @kapable/db — Database access for Kapable apps.
 *
 * Usage:
 *   import { getDB, getSchema, closeDB } from '@kapable/db';
 *   const sql = getDB();
 *   const rows = await sql`SELECT * FROM users`;
 */

import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

export function getSchema(): string | undefined {
  return process.env.SIGNALDB_SCHEMA || undefined;
}

export function getDB(): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Ensure your app is linked to a project and deployed via the platform.'
    );
  }

  const schema = getSchema();

  _sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    max_lifetime: 300,
    ...(schema ? { connection: { search_path: schema } } : {}),
  });

  return _sql;
}

export async function closeDB(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
