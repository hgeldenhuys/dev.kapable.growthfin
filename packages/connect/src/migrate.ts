/**
 * Connect SDK — Migration Helper
 *
 * Runs DDL statements inside a transaction with SET LOCAL search_path
 * to ensure schema isolation on hobbyist tier.
 *
 * Usage:
 *   import { getDB } from '@signaldb-live/connect/db';
 *   import { runMigration } from '@signaldb-live/connect/migrate';
 *
 *   const sql = getDB();
 *   await runMigration(sql, [
 *     `CREATE TABLE IF NOT EXISTS users (
 *       id SERIAL PRIMARY KEY,
 *       email TEXT NOT NULL UNIQUE,
 *       created_at TIMESTAMPTZ DEFAULT now()
 *     )`,
 *     `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
 *   ]);
 */

import type postgres from 'postgres';
import { getSchema } from './db';

/**
 * Run migration statements inside a transaction with correct search_path.
 * Uses sql.begin() to ensure all statements execute on the same connection.
 */
export async function runMigration(
  sql: ReturnType<typeof postgres>,
  statements: string[],
): Promise<void> {
  const schema = getSchema();

  await sql.begin(async (tx) => {
    // Set search_path for this transaction (essential for hobbyist tier)
    if (schema) {
      await tx.unsafe(`SET LOCAL search_path TO ${schema}, public`);
    }

    for (const stmt of statements) {
      await tx.unsafe(stmt);
    }
  });
}
