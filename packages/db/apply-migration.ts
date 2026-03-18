#!/usr/bin/env bun

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

async function applyMigration() {
  const sql = postgres(connectionString, { max: 1 });

  try {
    const migrationSQL = readFileSync(
      join(__dirname, 'src/migrations/0019_add_finding_applied_by.sql'),
      'utf-8'
    );

    console.log('Applying migration 0019_add_finding_applied_by.sql...');
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
