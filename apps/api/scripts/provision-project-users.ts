#!/usr/bin/env bun
/**
 * Provision per-project PostgreSQL users
 *
 * This script:
 * 1. Runs the migration to add project_user columns
 * 2. For each project without a dedicated user, creates one
 * 3. Grants appropriate permissions based on tier
 * 4. Stores encrypted credentials in project_databases
 *
 * Usage:
 *   bun run scripts/provision-project-users.ts [--dry-run]
 */

import postgres from 'postgres';
import { randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev_encryption_key_change_in_production_32chars';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signaldb:signaldb@localhost:5440/signaldb';

const isDryRun = process.argv.includes('--dry-run');

// Control plane connection
const controlSql = postgres(DATABASE_URL);

interface ProjectInfo {
  id: string;
  project_id: string;
  instance_id: string;
  schema_name: string | null;
  database_name: string;
  tier: string;
  host: string;
  port: number;
  admin_user: string;
  admin_password: string;
  has_project_user: boolean;
}

async function runMigration() {
  console.log('Running migration 008_per_project_users.sql...');

  await controlSql`
    ALTER TABLE project_databases
    ADD COLUMN IF NOT EXISTS project_user TEXT,
    ADD COLUMN IF NOT EXISTS project_password_encrypted TEXT
  `;

  console.log('Migration complete.');
}

function generateUsername(projectId: string): string {
  // Format: p_<project-uuid-no-dashes> truncated to 63 chars
  const username = 'p_' + projectId.replace(/-/g, '_');
  return username.substring(0, 63);
}

function generatePassword(): string {
  // Generate a secure 32-character password
  const bytes = randomBytes(24);
  return bytes.toString('base64').replace(/\//g, '_').replace(/\+/g, '-').substring(0, 32);
}

async function getProjectsWithoutUsers(): Promise<ProjectInfo[]> {
  const result = await controlSql`
    SELECT
      pd.id,
      pd.project_id,
      pd.instance_id,
      pd.schema_name,
      pd.database_name,
      di.tier,
      '127.0.0.1' as host,
      di.port,
      di.postgres_user as admin_user,
      pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as admin_password,
      CASE WHEN pd.project_user IS NOT NULL THEN true ELSE false END as has_project_user
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.status = 'active'
      AND pd.project_user IS NULL
  `;

  return result as unknown as ProjectInfo[];
}

async function createProjectUser(project: ProjectInfo): Promise<void> {
  const username = generateUsername(project.project_id);
  const password = generatePassword();

  console.log(`\n[${project.project_id}] Creating user ${username}...`);
  console.log(`  Tier: ${project.tier}`);
  console.log(`  Schema: ${project.schema_name || 'N/A'}`);
  console.log(`  Database: ${project.database_name}`);

  if (isDryRun) {
    console.log('  [DRY RUN] Would create user and grant permissions');
    return;
  }

  // Connect to the target database instance as admin
  const instanceSql = postgres({
    host: project.host,
    port: project.port,
    database: project.database_name,
    username: project.admin_user,
    password: project.admin_password,
  });

  try {
    // Check if user already exists
    const existingUser = await instanceSql`
      SELECT 1 FROM pg_roles WHERE rolname = ${username}
    `;

    if (existingUser.length === 0) {
      // Create the user
      await instanceSql.unsafe(`CREATE ROLE "${username}" WITH LOGIN PASSWORD '${password}'`);
      console.log(`  Created PostgreSQL role: ${username}`);
    } else {
      // Update password for existing user
      await instanceSql.unsafe(`ALTER ROLE "${username}" WITH PASSWORD '${password}'`);
      console.log(`  Updated password for existing role: ${username}`);
    }

    // Grant appropriate permissions based on tier
    if ((project.tier === 'hobbyist' || project.tier === 'free') && project.schema_name) {
      // Schema isolation: grant access only to project schema
      await instanceSql.unsafe(`GRANT USAGE ON SCHEMA "${project.schema_name}" TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${project.schema_name}" TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${project.schema_name}" TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${project.schema_name}" GRANT ALL PRIVILEGES ON TABLES TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${project.schema_name}" GRANT ALL PRIVILEGES ON SEQUENCES TO "${username}"`);
      console.log(`  Granted schema-level permissions on ${project.schema_name}`);
    } else {
      // Database isolation: grant access to public schema
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "${username}"`);
      console.log(`  Granted database-level permissions on public schema`);
    }

    // Store credentials in control plane
    await controlSql`
      UPDATE project_databases
      SET
        project_user = ${username},
        project_password_encrypted = pgp_sym_encrypt(${password}, ${ENCRYPTION_KEY})::text,
        updated_at = NOW()
      WHERE id = ${project.id}
    `;
    console.log(`  Stored encrypted credentials in project_databases`);

  } finally {
    await instanceSql.end();
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Per-Project PostgreSQL User Provisioning');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  try {
    // Step 1: Run migration
    await runMigration();

    // Step 2: Get projects that need users
    const projects = await getProjectsWithoutUsers();
    console.log(`\nFound ${projects.length} projects without dedicated users.`);

    if (projects.length === 0) {
      console.log('All projects already have dedicated users.');
      return;
    }

    // Step 3: Create users for each project
    let successCount = 0;
    let errorCount = 0;

    for (const project of projects) {
      try {
        await createProjectUser(project);
        successCount++;
      } catch (error) {
        console.error(`  ERROR creating user for ${project.project_id}:`, error);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`  Total projects: ${projects.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);

    if (isDryRun) {
      console.log('\n*** DRY RUN COMPLETE - Run without --dry-run to apply changes ***');
    }

  } finally {
    await controlSql.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
