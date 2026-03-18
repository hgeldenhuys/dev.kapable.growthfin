#!/usr/bin/env bun

/**
 * Database Migration Script
 * Runs Drizzle migrations and sets up RLS policies
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createRLSPoliciesSQL } from './rls';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Run Drizzle migrations
    await migrate(db, { migrationsFolder: './src/migrations' });
    console.log('✅ Migrations completed successfully');

    // Set up RLS policies
    console.log('🔒 Setting up RLS policies...');
    await db.execute(createRLSPoliciesSQL);
    console.log('✅ RLS policies created successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
