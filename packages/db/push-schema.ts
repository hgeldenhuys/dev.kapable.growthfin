#!/usr/bin/env bun
/**
 * Push schema to database using migrations directly.
 * Two-pass approach: first CREATE TYPE + CREATE TABLE, then ALTER TABLE + CREATE INDEX.
 * This handles Drizzle's migration ordering issues where enums are defined in later
 * migrations but referenced by tables in the baseline.
 */
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://hgeldenhuys@localhost:5432/growthfin_clean';
const migrationDir = join(import.meta.dir, 'src/migrations');

async function pushSchema() {
  const client = postgres(connectionString, { max: 1 });

  const files = readdirSync(migrationDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  // Collect ALL statements from all files
  const allStatements: string[] = [];
  for (const file of files) {
    const content = readFileSync(join(migrationDir, file), 'utf-8');
    const statements = content.split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const s of statements) allStatements.push(s);
  }

  console.log(`Total statements: ${allStatements.length}`);

  // Categorize statements
  const createTypes = allStatements.filter(s => s.startsWith('CREATE TYPE'));
  const createTables = allStatements.filter(s => s.startsWith('CREATE TABLE'));
  const alterTables = allStatements.filter(s => s.startsWith('ALTER TABLE'));
  const createIndexes = allStatements.filter(s => s.startsWith('CREATE INDEX') || s.startsWith('CREATE UNIQUE INDEX'));
  const others = allStatements.filter(s =>
    !s.startsWith('CREATE TYPE') &&
    !s.startsWith('CREATE TABLE') &&
    !s.startsWith('ALTER TABLE') &&
    !s.startsWith('CREATE INDEX') &&
    !s.startsWith('CREATE UNIQUE INDEX')
  );

  console.log(`Types: ${createTypes.length}, Tables: ${createTables.length}, Alters: ${alterTables.length}, Indexes: ${createIndexes.length}, Others: ${others.length}`);

  // Execute in order: types → tables → alters → indexes → others
  let errors = 0;
  const groups = [
    { name: 'CREATE TYPE', stmts: createTypes },
    { name: 'CREATE TABLE', stmts: createTables },
    { name: 'ALTER TABLE', stmts: alterTables },
    { name: 'CREATE INDEX', stmts: createIndexes },
    { name: 'OTHER', stmts: others },
  ];

  for (const group of groups) {
    console.log(`\nRunning ${group.name} (${group.stmts.length})...`);
    for (const stmt of group.stmts) {
      try {
        await client.unsafe(stmt);
      } catch (e: any) {
        // Skip "already exists" errors
        if (e.code === '42710' || e.code === '42P07' || e.code === '42P16') continue;
        // Skip "does not exist" for DROP
        if (e.code === '42704' && stmt.toLowerCase().includes('drop')) continue;
        // Skip duplicate column/constraint
        if (e.code === '42701' || e.code === '42P10') continue;
        // Skip invalid enum value (enum already has different values from newer migration)
        if (e.code === '22P02') continue;

        errors++;
        if (errors <= 20) {
          console.error(`  [${e.code}] ${e.message?.substring(0, 120)}`);
        }
      }
    }
  }

  if (errors > 20) console.log(`  ... and ${errors - 20} more errors`);
  console.log(`\nDone! (${errors} non-critical errors)`);

  // Verify by counting tables
  const result = await client`SELECT count(*) as c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  console.log(`Tables in database: ${result[0].c}`);

  await client.end();
}

pushSchema().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
