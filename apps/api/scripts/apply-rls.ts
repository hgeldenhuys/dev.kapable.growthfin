#!/usr/bin/env bun
/**
 * Apply RLS Policies to a Project Database
 *
 * Usage:
 *   bun scripts/apply-rls.ts <project-id>
 *   bun scripts/apply-rls.ts --all  # Apply to all projects
 *
 * This script:
 * 1. Connects to the project's database (hobbyist schema or pro/enterprise database)
 * 2. Applies the RLS helper functions
 * 3. Creates RLS policies on _data, _tables, _tokens tables
 */

import { sql } from '../src/lib/db';
import { connectionManager } from '../src/lib/connection-manager';
import { readFileSync } from 'fs';
import { join } from 'path';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev_encryption_key_change_in_production_32chars';

async function applyRLSToProject(projectId: string): Promise<void> {
  console.log(`\n🔐 Applying RLS policies to project: ${projectId}`);

  try {
    // Get project's database connection info
    const projectInfoResult = await sql`
      SELECT
        pd.database_name,
        pd.schema_name,
        di.tier,
        di.port,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as password
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${projectId}
        AND pd.status = 'active'
    `;

    if (projectInfoResult.length === 0) {
      console.log(`  ⚠️  Project not found in project_databases registry`);
      return;
    }

    const info = projectInfoResult[0];
    console.log(`  📊 Tier: ${info.tier}`);
    console.log(`  🗄️  Database: ${info.database_name}`);
    if (info.schema_name) {
      console.log(`  📁 Schema: ${info.schema_name}`);
    }

    // Get connection to project database
    const { sql: projectSql, schema } = await connectionManager.getPool(projectId);

    // Read the RLS SQL file
    const rlsSqlPath = join(import.meta.dir, '..', 'sql', 'rls-policies.sql');
    const rlsSql = readFileSync(rlsSqlPath, 'utf-8');

    // For hobbyist tier with schema, set search path first
    if (schema) {
      console.log(`  📍 Setting search_path to schema: ${schema}`);
      await projectSql.unsafe(`SET search_path TO "${schema}", public`);
    }

    // Apply the RLS policies
    console.log(`  ⚙️  Applying RLS policies...`);

    // Split by statement and execute (filtering out comments and empty statements)
    const statements = rlsSql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        // Skip pure comment blocks
        if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
          continue;
        }
        await projectSql.unsafe(statement);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message?.includes('already exists')) {
          console.log(`  ⚠️  Warning: ${err.message?.slice(0, 100)}`);
        }
      }
    }

    // Verify RLS is enabled
    const rlsStatus = await projectSql.unsafe(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = $1
        AND tablename IN ('_data', 'data', '_tables', 'tables', '_tokens')
    `, [schema || 'public']);

    console.log(`  ✅ RLS Status:`);
    for (const row of rlsStatus) {
      const status = row.rowsecurity ? '🔒 enabled' : '🔓 disabled';
      console.log(`     ${row.tablename}: ${status}`);
    }

    // List policies
    const policies = await projectSql.unsafe(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = $1
    `, [schema || 'public']);

    if (policies.length > 0) {
      console.log(`  📋 Policies created:`);
      for (const p of policies) {
        console.log(`     ${p.tablename}: ${p.policyname}`);
      }
    }

    console.log(`  ✅ RLS policies applied successfully!`);

  } catch (error: any) {
    console.error(`  ❌ Error applying RLS: ${error.message}`);
  }
}

async function applyRLSToAllProjects(): Promise<void> {
  console.log('🔐 Applying RLS policies to ALL projects...\n');

  const projects = await sql`
    SELECT p.id, p.name, o.name as org_name
    FROM projects p
    JOIN organizations o ON o.id = p.org_id
    JOIN project_databases pd ON pd.project_id = p.id
    WHERE pd.status = 'active'
    ORDER BY o.name, p.name
  `;

  console.log(`Found ${projects.length} active projects\n`);

  for (const project of projects) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 ${project.org_name} / ${project.name}`);
    await applyRLSToProject(project.id);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Done! Applied RLS to ${projects.length} projects`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  bun scripts/apply-rls.ts <project-id>');
    console.log('  bun scripts/apply-rls.ts --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    await applyRLSToAllProjects();
  } else {
    await applyRLSToProject(args[0]);
  }

  // Cleanup connections
  await connectionManager.shutdown();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
