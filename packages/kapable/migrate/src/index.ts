/**
 * @kapable/migrate — Schema-aware DDL migration runner for Kapable apps.
 *
 * Usage:
 *   import { getDB } from '@kapable/db';
 *   import { runMigration } from '@kapable/migrate';
 *   const sql = getDB();
 *   await runMigration(sql, ['CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY)']);
 */

import type postgres from 'postgres';
import { getSchema } from '@kapable/db';

export async function runMigration(
  sql: ReturnType<typeof postgres>,
  statements: string[],
): Promise<void> {
  const schema = getSchema();

  await sql.begin(async (tx) => {
    if (schema) {
      await tx.unsafe(`SET LOCAL search_path TO ${schema}, public`);
    }

    for (const stmt of statements) {
      await tx.unsafe(stmt);
    }
  });
}
