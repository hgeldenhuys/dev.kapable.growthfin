/**
 * Database Migration Service
 *
 * Handles tier migrations for projects in a 4-tier system:
 *
 * Tier Structure:
 * - Hobbyist:   Schema isolation (shared DB, separate schema per project)
 * - Pro:        Database isolation (shared instance, separate DB per project)
 * - Business:   Org Instance isolation (dedicated container per org)
 * - Enterprise: Project Instance isolation (dedicated container per project)
 *
 * Upgrade Functions:
 * - upgradeToProTier:        Hobbyist → Pro
 * - upgradeToBusinessTier:   Pro → Business
 * - upgradeToEnterpriseTier: Pro/Business → Enterprise
 *
 * Downgrade Functions:
 * - downgradeToHobbyistTier:     Pro → Hobbyist
 * - downgradeFromBusinessTier:   Business → Pro
 * - downgradeFromEnterpriseTier: Enterprise → Pro
 *
 * Migration process:
 * 1. Validate org plan allows target tier
 * 2. Create migration record
 * 3. Create target database/schema
 * 4. Dump source data
 * 5. Restore to target
 * 6. Create triggers
 * 7. Update registry
 * 8. Cleanup source
 */

import { sql } from '../lib/db';
import { encrypt } from '../lib/encryption';
import { connectionManager } from '../lib/connection-manager';
import { requireEnv } from '../lib/require-env';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

export interface MigrationResult {
  migrationId: string;
  success: boolean;
  error?: string;
  duration?: number;
}

interface ProjectDatabase {
  id: string;
  project_id: string;
  instance_id: string;
  database_name: string;
  schema_name: string | null;
  size_bytes: number;
}

interface DatabaseInstance {
  id: string;
  server_id: string;
  name: string;
  container_name: string;
  port: number;
  tier: string;
  max_databases: number | null;
  current_databases: number;
  postgres_user: string;
  postgres_password_encrypted: string;
}

interface PlanLimit {
  max_db_size_mb: number | null;
  max_rows: number | null;
}

/**
 * Execute a shell command and return output
 */
async function exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bash', '-c', command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Create NOTIFY triggers in a database
 */
async function createNotifyTriggers(
  host: string,
  port: number,
  database: string,
  user: string,
  password: string,
  projectId: string
): Promise<void> {
  const channel = `project_${projectId.replace(/-/g, '_')}`;
  const triggerFile = `/tmp/trigger_setup_${projectId}.sql`;

  const triggerSQL = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create _tables table if not exists (new naming convention)
-- Also create legacy 'tables' alias for backwards compatibility
CREATE TABLE IF NOT EXISTS _tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  schema JSONB DEFAULT '{"fields":[]}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  storage_mode TEXT DEFAULT 'jsonb' CHECK (storage_mode IN ('jsonb', 'typed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing _tables (idempotent)
ALTER TABLE _tables ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE _tables ADD COLUMN IF NOT EXISTS storage_mode TEXT DEFAULT 'jsonb';
ALTER TABLE _tables ADD COLUMN IF NOT EXISTS rsc_schema JSONB;
ALTER TABLE _tables ADD COLUMN IF NOT EXISTS rsc_source TEXT;

-- Create _data table if not exists (new naming convention)
CREATE TABLE IF NOT EXISTS _data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx__data_table_name ON _data(table_name);
CREATE INDEX IF NOT EXISTS idx_data_data_gin ON _data USING GIN(data);
CREATE INDEX IF NOT EXISTS idx__data_created ON _data(created_at DESC);

-- Create notify function
CREATE OR REPLACE FUNCTION notify_data_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  record_data RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_data := OLD;
  ELSE
    record_data := NEW;
  END IF;

  payload := jsonb_build_object(
    'op', TG_OP,
    'table', record_data.table_name,
    'id', record_data.id,
    'data', record_data.data,
    'ts', extract(epoch from now())
  );

  PERFORM pg_notify('${channel}', payload::TEXT);
  RETURN record_data;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on _data
DROP TRIGGER IF EXISTS _data_notify ON _data;
CREATE TRIGGER _data_notify
  AFTER INSERT OR UPDATE OR DELETE ON _data
  FOR EACH ROW EXECUTE FUNCTION notify_data_change();

-- Create updated_at function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
DROP TRIGGER IF EXISTS _tables_updated_at ON _tables;
CREATE TRIGGER _tables_updated_at BEFORE UPDATE ON _tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS _data_updated_at ON _data;
CREATE TRIGGER _data_updated_at BEFORE UPDATE ON _data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

  // Write SQL to temp file to avoid shell escaping issues
  await Bun.write(triggerFile, triggerSQL);

  const result = await exec(
    `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -f ${triggerFile}`
  );

  // Cleanup temp file
  await exec(`rm -f ${triggerFile}`);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create triggers: ${result.stderr}`);
  }
}

/**
 * Validate org plan allows the requested tier
 */
async function validateOrgPlan(projectId: string, requiredPlan: string[]): Promise<{ orgId: string; plan: string }> {
  const result = await sql`
    SELECT o.id as org_id, o.plan
    FROM organizations o
    JOIN projects p ON p.org_id = o.id
    WHERE p.id = ${projectId}
  `;

  if (result.length === 0) {
    throw new Error('Project not found');
  }

  const { org_id, plan } = result[0];

  if (!requiredPlan.includes(plan)) {
    throw new Error(`Organization must be on ${requiredPlan.join(' or ')} plan to perform this upgrade (current: ${plan})`);
  }

  return { orgId: org_id, plan };
}

/**
 * Upgrade a project from Free tier to Pro tier
 */
export async function upgradeToProTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 0. Validate org plan allows Pro tier
  await validateOrgPlan(projectId, ['pro', 'business', 'enterprise']);

  // 1. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status)
    VALUES (${projectId}, 'upgrade_to_pro', 'pending')
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting upgrade for project ${projectId}`);

    // 2. Get current project location with decrypted password inline
    const currentResult = await sql`
      SELECT
        pd.*,
        di.port as instance_port,
        di.postgres_user,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
        di.container_name
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${projectId}
    `;

    if (currentResult.length === 0) {
      throw new Error('Project not found in registry');
    }

    const current = currentResult[0] as ProjectDatabase & {
      instance_port: number;
      postgres_user: string;
      postgres_password: string;
      container_name: string;
    };

    if (!current.schema_name) {
      throw new Error('Project is not on hobbyist tier (no schema isolation)');
    }

    // 3. Find Pro pool with capacity (with decrypted password inline)
    const proInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'pro'
        AND di.status = 'active'
        AND (di.max_databases IS NULL OR di.current_databases < di.max_databases)
      ORDER BY di.current_databases ASC
      LIMIT 1
    `;

    if (proInstanceResult.length === 0) {
      throw new Error('No Pro pool available - please provision a new instance');
    }

    const proInstance = proInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    console.log(`[Migration] Using Pro pool: ${proInstance.name} (port ${proInstance.port})`);

    // 4. Create new database name
    const newDbName = `project_${projectId.replace(/-/g, '_')}`;

    // 5. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.instance_id},
        from_database = ${current.database_name},
        from_schema = ${current.schema_name},
        to_instance_id = ${proInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 6. Get passwords (already decrypted inline)
    const hobbyistPassword = current.postgres_password;
    const proPassword = proInstance.postgres_password;

    // 7. Create database in Pro pool
    console.log(`[Migration] Creating database ${newDbName} in Pro pool`);
    const createDbResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    if (createDbResult.exitCode !== 0 && !createDbResult.stderr.includes('already exists')) {
      throw new Error(`Failed to create database: ${createDbResult.stderr}`);
    }

    // 8. Create triggers and tables in new database
    console.log(`[Migration] Setting up triggers in ${newDbName}`);
    await createNotifyTriggers(
      '127.0.0.1',
      proInstance.port,
      newDbName,
      'signaldb',
      proPassword,
      projectId
    );

    // 9. Dump from schema
    console.log(`[Migration] Dumping data from schema ${current.schema_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    const dumpResult = await exec(
      `PGPASSWORD="${hobbyistPassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb --schema="${current.schema_name}" --data-only --no-owner --no-acl -f ${dumpFile}`
    );

    if (dumpResult.exitCode !== 0) {
      throw new Error(`Failed to dump data: ${dumpResult.stderr}`);
    }

    // 10. Transform dump - remove schema prefix and adjust for public schema
    console.log(`[Migration] Transforming dump file`);
    await exec(`sed -i '' 's/"${current.schema_name}"\\./public./g' ${dumpFile} 2>/dev/null || sed -i 's/"${current.schema_name}"\\./public./g' ${dumpFile}`);
    await exec(`sed -i '' 's/SET search_path = "${current.schema_name}"/SET search_path = public/g' ${dumpFile} 2>/dev/null || sed -i 's/SET search_path = "${current.schema_name}"/SET search_path = public/g' ${dumpFile}`);

    // 11. Copy table registry data (try _tables first, then tables for legacy schemas)
    console.log(`[Migration] Copying table registry`);
    let tablesResult = await exec(
      `PGPASSWORD="${hobbyistPassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb -t -A -c "SELECT row_to_json(t) FROM (SELECT id, name, display_name, schema, settings, COALESCE(storage_mode, 'jsonb') as storage_mode, created_at, updated_at FROM \\"${current.schema_name}\\"._tables) t" 2>/dev/null`
    );

    // Fallback to legacy 'tables' name if _tables doesn't exist
    if (!tablesResult.stdout.trim()) {
      tablesResult = await exec(
        `PGPASSWORD="${hobbyistPassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb -t -A -c "SELECT row_to_json(t) FROM (SELECT id, name, display_name, schema, settings, 'jsonb' as storage_mode, created_at, updated_at FROM \\"${current.schema_name}\\".tables) t"`
      );
    }

    if (tablesResult.stdout.trim()) {
      const tables = tablesResult.stdout.trim().split('\n').filter(Boolean);
      for (const tableJson of tables) {
        const table = JSON.parse(tableJson);
        await exec(
          `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d ${newDbName} -c "INSERT INTO _tables (id, name, display_name, schema, settings, storage_mode, created_at, updated_at) VALUES ('${table.id}', '${table.name}', '${table.display_name || table.name}', '${JSON.stringify(table.schema).replace(/'/g, "''")}', '${JSON.stringify(table.settings || {}).replace(/'/g, "''")}', '${table.storage_mode || 'jsonb'}', '${table.created_at}', '${table.updated_at}') ON CONFLICT (name) DO NOTHING"`
        );
      }
    }

    // 12. Restore data to new database
    console.log(`[Migration] Restoring data to ${newDbName}`);
    const restoreResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    // Ignore "already exists" errors from restore
    if (restoreResult.exitCode !== 0 && !restoreResult.stderr.includes('already exists')) {
      console.warn(`[Migration] Restore warnings: ${restoreResult.stderr}`);
    }

    // 13. Update project_databases registry
    console.log(`[Migration] Updating registry`);
    const newConnString = `postgresql://signaldb:${proPassword}@127.0.0.1:${proInstance.port}/${newDbName}`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${proInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // 14. Update instance database count
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${proInstance.id}
    `;

    // 15. Drop old schema (keep as backup for now - can cleanup later)
    console.log(`[Migration] Marking old schema for cleanup`);
    // await exec(
    //   `PGPASSWORD="${hobbyistPassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb -c "DROP SCHEMA IF EXISTS \\"${current.schema_name}\\" CASCADE"`
    // );

    // 16. Cleanup temp files
    await exec(`rm -f ${dumpFile}`);

    // 17. Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 18. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Upgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Upgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

/**
 * Upgrade a project from Pro tier to Business tier
 *
 * Business tier provides a dedicated PostgreSQL container for the organization.
 * All projects in the org share this dedicated instance.
 */
export async function upgradeToBusinessTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 0. Validate org plan allows Business tier
  const { orgId } = await validateOrgPlan(projectId, ['business', 'enterprise']);

  // 1. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status)
    VALUES (${projectId}, 'upgrade_to_business', 'pending')
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting Pro → Business upgrade for project ${projectId}`);

    // 2. Get current project location (must be on Pro tier)
    const currentResult = await sql`
      SELECT
        pd.*,
        di.port as instance_port,
        di.tier as current_tier,
        di.postgres_user,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
        di.container_name
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${projectId}
    `;

    if (currentResult.length === 0) {
      throw new Error('Project not found in registry');
    }

    const current = currentResult[0] as ProjectDatabase & {
      instance_port: number;
      current_tier: string;
      postgres_user: string;
      postgres_password: string;
      container_name: string;
    };

    if (current.current_tier !== 'pro') {
      throw new Error(`Project must be on Pro tier to upgrade to Business (current: ${current.current_tier})`);
    }

    // 3. Find or create Business instance for this org
    let businessInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'business'
        AND di.org_id = ${orgId}
        AND di.status = 'active'
      LIMIT 1
    `;

    if (businessInstanceResult.length === 0) {
      throw new Error('No Business instance provisioned for this organization. Please provision a dedicated instance first.');
    }

    const businessInstance = businessInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    console.log(`[Migration] Using Business instance: ${businessInstance.name} (port ${businessInstance.port})`);

    // 4. Database name (same as current - just moving to different instance)
    const newDbName = current.database_name;

    // 5. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.instance_id},
        from_database = ${current.database_name},
        to_instance_id = ${businessInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 6. Create database in Business instance
    console.log(`[Migration] Creating database ${newDbName} in Business instance`);
    const proPassword = current.postgres_password;
    const businessPassword = businessInstance.postgres_password;

    const createDbResult = await exec(
      `PGPASSWORD="${businessPassword}" psql -h 127.0.0.1 -p ${businessInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    if (createDbResult.exitCode !== 0 && !createDbResult.stderr.includes('already exists')) {
      throw new Error(`Failed to create database: ${createDbResult.stderr}`);
    }

    // 7. Create triggers in new database
    console.log(`[Migration] Setting up triggers in ${newDbName}`);
    await createNotifyTriggers(
      '127.0.0.1',
      businessInstance.port,
      newDbName,
      'signaldb',
      businessPassword,
      projectId
    );

    // 8. Dump from Pro database
    console.log(`[Migration] Dumping data from Pro database ${current.database_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    const dumpResult = await exec(
      `PGPASSWORD="${proPassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} --data-only --no-owner --no-acl -t tables -t data -f ${dumpFile}`
    );

    if (dumpResult.exitCode !== 0) {
      throw new Error(`Failed to dump data: ${dumpResult.stderr}`);
    }

    // 9. Restore data to Business database
    console.log(`[Migration] Restoring data to ${newDbName}`);
    const restoreResult = await exec(
      `PGPASSWORD="${businessPassword}" psql -h 127.0.0.1 -p ${businessInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    if (restoreResult.exitCode !== 0 && !restoreResult.stderr.includes('already exists')) {
      console.warn(`[Migration] Restore warnings: ${restoreResult.stderr}`);
    }

    // 10. Update project_databases registry
    console.log(`[Migration] Updating registry`);
    const newConnString = `postgresql://signaldb:${businessPassword}@127.0.0.1:${businessInstance.port}/${newDbName}`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${businessInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // 11. Update instance database counts
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${businessInstance.id}
    `;

    await sql`
      UPDATE database_instances
      SET current_databases = current_databases - 1
      WHERE id = ${current.instance_id}
    `;

    // 12. Cleanup temp files
    await exec(`rm -f ${dumpFile}`);

    // 13. Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 14. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Business upgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Business upgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

/**
 * Downgrade a project from Business tier to Pro tier
 *
 * This migration moves a project from an org-dedicated instance
 * back to the shared Pro pool.
 */
export async function downgradeFromBusinessTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 1. Get current project location (must be on Business tier)
  const currentResult = await sql`
    SELECT
      pd.*,
      di.port as instance_port,
      di.tier as current_tier,
      di.id as business_instance_id,
      di.postgres_user,
      pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
      di.container_name
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = ${projectId}
  `;

  if (currentResult.length === 0) {
    return {
      migrationId: '',
      success: false,
      error: 'Project not found in registry'
    };
  }

  const current = currentResult[0] as ProjectDatabase & {
    instance_port: number;
    current_tier: string;
    business_instance_id: string;
    postgres_user: string;
    postgres_password: string;
    container_name: string;
  };

  if (current.current_tier !== 'business') {
    return {
      migrationId: '',
      success: false,
      error: `Project must be on Business tier to downgrade to Pro (current: ${current.current_tier})`
    };
  }

  // 2. Check Pro tier limits
  const planLimitsResult = await sql`
    SELECT max_db_size_mb, max_rows FROM plan_limits WHERE plan = 'pro'
  `;

  const proLimits = planLimitsResult[0] || { max_db_size_mb: null, max_rows: null };
  const businessPassword = current.postgres_password;

  // Check database size
  const sizeResult = await exec(
    `PGPASSWORD="${businessPassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} -t -A -c "SELECT pg_database_size('${current.database_name}')"`
  );

  const actualSize = parseInt(sizeResult.stdout.trim()) || 0;

  if (proLimits.max_db_size_mb) {
    const maxBytes = proLimits.max_db_size_mb * 1024 * 1024;
    if (actualSize > maxBytes) {
      return {
        migrationId: '',
        success: false,
        error: `Database size (${formatBytes(actualSize)}) exceeds Pro tier limit (${proLimits.max_db_size_mb}MB). Please reduce data before downgrading.`
      };
    }
  }

  // Check row count
  if (proLimits.max_rows) {
    const rowCountResult = await exec(
      `PGPASSWORD="${businessPassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} -t -A -c "SELECT COUNT(*) FROM data"`
    );

    const rowCount = parseInt(rowCountResult.stdout.trim()) || 0;

    if (rowCount > proLimits.max_rows) {
      return {
        migrationId: '',
        success: false,
        error: `Row count (${rowCount}) exceeds Pro tier limit (${proLimits.max_rows}). Please reduce data before downgrading.`
      };
    }
  }

  // 3. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status, size_bytes)
    VALUES (${projectId}, 'downgrade_to_pro', 'pending', ${actualSize})
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting Business → Pro downgrade for project ${projectId}`);

    // 4. Find Pro pool with capacity
    const proInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'pro'
        AND di.status = 'active'
        AND (di.max_databases IS NULL OR di.current_databases < di.max_databases)
      ORDER BY di.current_databases ASC
      LIMIT 1
    `;

    if (proInstanceResult.length === 0) {
      throw new Error('No Pro pool available with capacity');
    }

    const proInstance = proInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    console.log(`[Migration] Using Pro pool: ${proInstance.name} (port ${proInstance.port})`);

    // 5. Database name in Pro pool (same name)
    const newDbName = current.database_name;

    // 6. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.business_instance_id},
        from_database = ${current.database_name},
        to_instance_id = ${proInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    const proPassword = proInstance.postgres_password;

    // 7. Create database in Pro pool
    console.log(`[Migration] Creating database ${newDbName} in Pro pool`);
    const createDbResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    if (createDbResult.exitCode !== 0 && !createDbResult.stderr.includes('already exists')) {
      throw new Error(`Failed to create database: ${createDbResult.stderr}`);
    }

    // 8. Create triggers and tables in Pro database
    console.log(`[Migration] Setting up triggers in ${newDbName}`);
    await createNotifyTriggers(
      '127.0.0.1',
      proInstance.port,
      newDbName,
      'signaldb',
      proPassword,
      projectId
    );

    // 9. Dump from Business database
    console.log(`[Migration] Dumping data from Business database ${current.database_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    const dumpResult = await exec(
      `PGPASSWORD="${businessPassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} --data-only --no-owner --no-acl -t tables -t data -f ${dumpFile}`
    );

    if (dumpResult.exitCode !== 0) {
      throw new Error(`Failed to dump data: ${dumpResult.stderr}`);
    }

    // 10. Restore data to Pro database
    console.log(`[Migration] Restoring data to Pro database ${newDbName}`);
    const restoreResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    if (restoreResult.exitCode !== 0 && !restoreResult.stderr.includes('already exists')) {
      console.warn(`[Migration] Restore warnings: ${restoreResult.stderr}`);
    }

    // 11. Update project_databases registry
    console.log(`[Migration] Updating registry`);
    const newConnString = `postgresql://signaldb:${proPassword}@127.0.0.1:${proInstance.port}/${newDbName}`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${proInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        size_bytes = ${actualSize},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // 12. Update instance database counts
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${proInstance.id}
    `;

    await sql`
      UPDATE database_instances
      SET current_databases = current_databases - 1
      WHERE id = ${current.business_instance_id}
    `;

    // 13. Cleanup temp files
    await exec(`rm -f ${dumpFile}`);

    // 14. Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 15. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Pro downgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Pro downgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

/**
 * Downgrade a project from Pro tier to Hobbyist tier
 */
export async function downgradeToHobbyistTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 1. Check size limits (with inline decryption)
  const projectResult = await sql`
    SELECT
      pd.size_bytes,
      pd.database_name,
      pd.instance_id,
      di.port as instance_port,
      pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
      pl.max_db_size_mb,
      pl.max_rows
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    CROSS JOIN plan_limits pl
    WHERE pd.project_id = ${projectId}
      AND pl.plan = 'hobbyist'
  `;

  if (projectResult.length === 0) {
    return {
      migrationId: '',
      success: false,
      error: 'Project not found in registry'
    };
  }

  const project = projectResult[0];
  const maxBytes = (project.max_db_size_mb || 100) * 1024 * 1024;

  // Get password (already decrypted inline)
  const proPassword = project.postgres_password;
  const sizeResult = await exec(
    `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${project.instance_port} -U signaldb -d ${project.database_name} -t -A -c "SELECT pg_database_size('${project.database_name}')"`
  );

  const actualSize = parseInt(sizeResult.stdout.trim()) || 0;

  if (actualSize > maxBytes) {
    return {
      migrationId: '',
      success: false,
      error: `Database size (${formatBytes(actualSize)}) exceeds hobbyist tier limit (${project.max_db_size_mb}MB). Please reduce data before downgrading.`
    };
  }

  // Check row count
  const rowCountResult = await exec(
    `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${project.instance_port} -U signaldb -d ${project.database_name} -t -A -c "SELECT COUNT(*) FROM data"`
  );

  const rowCount = parseInt(rowCountResult.stdout.trim()) || 0;

  if (project.max_rows && rowCount > project.max_rows) {
    return {
      migrationId: '',
      success: false,
      error: `Row count (${rowCount}) exceeds hobbyist tier limit (${project.max_rows}). Please reduce data before downgrading.`
    };
  }

  // Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status, size_bytes)
    VALUES (${projectId}, 'downgrade_to_hobbyist', 'pending', ${actualSize})
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting downgrade for project ${projectId}`);

    // Get hobbyist tier instance (with inline decryption)
    const hobbyistInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'hobbyist'
        AND di.status = 'active'
      LIMIT 1
    `;

    if (hobbyistInstanceResult.length === 0) {
      throw new Error('No hobbyist tier instance available');
    }

    const hobbyistInstance = hobbyistInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    const hobbyistPassword = hobbyistInstance.postgres_password;

    // Create schema name
    const newSchemaName = `project_${projectId.replace(/-/g, '_')}`;

    // Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${project.instance_id},
        from_database = ${project.database_name},
        to_instance_id = ${hobbyistInstance.id},
        to_database = 'signaldb',
        to_schema = ${newSchemaName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    // Create schema in hobbyist tier database
    console.log(`[Migration] Creating schema ${newSchemaName}`);
    await exec(
      `PGPASSWORD="${hobbyistPassword}" psql -h 127.0.0.1 -p ${hobbyistInstance.port} -U signaldb -d signaldb -c "SELECT create_project_schema('${projectId}'::UUID)"`
    );

    // Dump data from pro database
    console.log(`[Migration] Dumping data from ${project.database_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    await exec(
      `PGPASSWORD="${proPassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${project.instance_port} -U signaldb -d ${project.database_name} --data-only --no-owner --no-acl -t tables -t data -f ${dumpFile}`
    );

    // Transform dump for schema
    await exec(`sed -i '' 's/public\\./${newSchemaName}./g' ${dumpFile} 2>/dev/null || sed -i 's/public\\./${newSchemaName}./g' ${dumpFile}`);

    // Restore to schema
    console.log(`[Migration] Restoring to schema ${newSchemaName}`);
    await exec(
      `PGPASSWORD="${hobbyistPassword}" psql -h 127.0.0.1 -p ${hobbyistInstance.port} -U signaldb -d signaldb -f ${dumpFile}`
    );

    // Update registry
    const newConnString = `postgresql://signaldb:${hobbyistPassword}@127.0.0.1:${hobbyistInstance.port}/signaldb`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${hobbyistInstance.id},
        database_name = 'signaldb',
        schema_name = ${newSchemaName},
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        size_bytes = ${actualSize},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // Update instance counts
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases - 1
      WHERE id = ${project.instance_id}
    `;

    // Cleanup
    await exec(`rm -f ${dumpFile}`);

    // Drop pro database (keep as backup - can cleanup later)
    // await exec(
    //   `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${project.instance_port} -U signaldb -d postgres -c "DROP DATABASE IF EXISTS ${project.database_name}"`
    // );

    // Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Downgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Downgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(migrationId: string) {
  const result = await sql`
    SELECT
      dm.*,
      p.name as project_name,
      fi.name as from_instance_name,
      ti.name as to_instance_name
    FROM database_migrations dm
    JOIN projects p ON p.id = dm.project_id
    LEFT JOIN database_instances fi ON fi.id = dm.from_instance_id
    JOIN database_instances ti ON ti.id = dm.to_instance_id
    WHERE dm.id = ${migrationId}
  `;

  return result[0] || null;
}

/**
 * List migrations for a project
 */
export async function listProjectMigrations(projectId: string) {
  const result = await sql`
    SELECT
      dm.*,
      fi.name as from_instance_name,
      ti.name as to_instance_name
    FROM database_migrations dm
    LEFT JOIN database_instances fi ON fi.id = dm.from_instance_id
    JOIN database_instances ti ON ti.id = dm.to_instance_id
    WHERE dm.project_id = ${projectId}
    ORDER BY dm.created_at DESC
  `;

  return result;
}

/**
 * Upgrade a project from Pro tier to Enterprise tier
 *
 * Enterprise tier provides a dedicated PostgreSQL container per customer.
 * This migration:
 * 1. Finds an available Enterprise instance (or requires one to be provisioned)
 * 2. Creates a database in the Enterprise instance
 * 3. Dumps data from Pro database
 * 4. Restores to Enterprise instance
 * 5. Updates registry
 */
export async function upgradeToEnterpriseTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 0. Validate org plan allows Enterprise tier
  await validateOrgPlan(projectId, ['enterprise']);

  // 1. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status)
    VALUES (${projectId}, 'upgrade_to_enterprise', 'pending')
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting Pro → Enterprise upgrade for project ${projectId}`);

    // 2. Get current project location (must be on Pro tier)
    const currentResult = await sql`
      SELECT
        pd.*,
        di.port as instance_port,
        di.tier as current_tier,
        di.postgres_user,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
        di.container_name
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${projectId}
    `;

    if (currentResult.length === 0) {
      throw new Error('Project not found in registry');
    }

    const current = currentResult[0] as ProjectDatabase & {
      instance_port: number;
      current_tier: string;
      postgres_user: string;
      postgres_password: string;
      container_name: string;
    };

    if (current.current_tier !== 'pro' && current.current_tier !== 'business') {
      throw new Error(`Project must be on Pro or Business tier to upgrade to Enterprise (current: ${current.current_tier})`);
    }

    if (current.schema_name) {
      throw new Error('Project appears to be on Free tier (has schema isolation)');
    }

    // 3. Find available Enterprise instance
    const enterpriseInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'enterprise'
        AND di.status = 'active'
        AND di.current_databases = 0
      ORDER BY di.created_at ASC
      LIMIT 1
    `;

    if (enterpriseInstanceResult.length === 0) {
      throw new Error('No available Enterprise instance. Please provision a dedicated PostgreSQL container first.');
    }

    const enterpriseInstance = enterpriseInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    console.log(`[Migration] Using Enterprise instance: ${enterpriseInstance.name} (port ${enterpriseInstance.port})`);

    // 4. Database name for enterprise (usually just 'signaldb' or project-specific)
    const newDbName = `project_${projectId.replace(/-/g, '_')}`;

    // 5. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.instance_id},
        from_database = ${current.database_name},
        to_instance_id = ${enterpriseInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 6. Get passwords
    const proPassword = current.postgres_password;
    const enterprisePassword = enterpriseInstance.postgres_password;

    // 7. Create database in Enterprise instance
    console.log(`[Migration] Creating database ${newDbName} in Enterprise instance`);
    const createDbResult = await exec(
      `PGPASSWORD="${enterprisePassword}" psql -h 127.0.0.1 -p ${enterpriseInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    if (createDbResult.exitCode !== 0 && !createDbResult.stderr.includes('already exists')) {
      throw new Error(`Failed to create database: ${createDbResult.stderr}`);
    }

    // 8. Create triggers and tables in new database
    console.log(`[Migration] Setting up triggers in ${newDbName}`);
    await createNotifyTriggers(
      '127.0.0.1',
      enterpriseInstance.port,
      newDbName,
      'signaldb',
      enterprisePassword,
      projectId
    );

    // 9. Dump from Pro database
    console.log(`[Migration] Dumping data from Pro database ${current.database_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    const dumpResult = await exec(
      `PGPASSWORD="${proPassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} --data-only --no-owner --no-acl -t tables -t data -f ${dumpFile}`
    );

    if (dumpResult.exitCode !== 0) {
      throw new Error(`Failed to dump data: ${dumpResult.stderr}`);
    }

    // 10. Restore data to Enterprise database
    console.log(`[Migration] Restoring data to ${newDbName}`);
    const restoreResult = await exec(
      `PGPASSWORD="${enterprisePassword}" psql -h 127.0.0.1 -p ${enterpriseInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    if (restoreResult.exitCode !== 0 && !restoreResult.stderr.includes('already exists')) {
      console.warn(`[Migration] Restore warnings: ${restoreResult.stderr}`);
    }

    // 11. Update project_databases registry
    console.log(`[Migration] Updating registry`);
    const newConnString = `postgresql://signaldb:${enterprisePassword}@127.0.0.1:${enterpriseInstance.port}/${newDbName}`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${enterpriseInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // 12. Update instance database counts
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${enterpriseInstance.id}
    `;

    await sql`
      UPDATE database_instances
      SET current_databases = current_databases - 1
      WHERE id = ${current.instance_id}
    `;

    // 13. Cleanup temp files
    await exec(`rm -f ${dumpFile}`);

    // 14. Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 15. Update organization plan to enterprise
    await sql`
      UPDATE organizations o
      SET plan = 'enterprise'
      FROM projects p
      WHERE p.org_id = o.id AND p.id = ${projectId}
    `;

    // 16. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Enterprise upgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Enterprise upgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

/**
 * Downgrade a project from Enterprise tier to Pro tier
 *
 * This migration:
 * 1. Finds a Pro pool with capacity
 * 2. Dumps data from Enterprise instance
 * 3. Creates database in Pro pool
 * 4. Restores data
 * 5. Updates registry
 * 6. Releases the Enterprise instance (marks it available)
 */
export async function downgradeFromEnterpriseTier(projectId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  // 1. Get current project location (must be on Enterprise tier)
  const currentResult = await sql`
    SELECT
      pd.*,
      di.port as instance_port,
      di.tier as current_tier,
      di.id as enterprise_instance_id,
      di.postgres_user,
      pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password,
      di.container_name
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = ${projectId}
  `;

  if (currentResult.length === 0) {
    return {
      migrationId: '',
      success: false,
      error: 'Project not found in registry'
    };
  }

  const current = currentResult[0] as ProjectDatabase & {
    instance_port: number;
    current_tier: string;
    enterprise_instance_id: string;
    postgres_user: string;
    postgres_password: string;
    container_name: string;
  };

  if (current.current_tier !== 'enterprise') {
    return {
      migrationId: '',
      success: false,
      error: `Project must be on Enterprise tier to downgrade to Pro (current: ${current.current_tier})`
    };
  }

  // 2. Check Pro tier limits
  const planLimitsResult = await sql`
    SELECT max_db_size_mb, max_rows FROM plan_limits WHERE plan = 'pro'
  `;

  const proLimits = planLimitsResult[0] || { max_db_size_mb: null, max_rows: null };
  const enterprisePassword = current.postgres_password;

  // Check database size
  const sizeResult = await exec(
    `PGPASSWORD="${enterprisePassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} -t -A -c "SELECT pg_database_size('${current.database_name}')"`
  );

  const actualSize = parseInt(sizeResult.stdout.trim()) || 0;

  if (proLimits.max_db_size_mb) {
    const maxBytes = proLimits.max_db_size_mb * 1024 * 1024;
    if (actualSize > maxBytes) {
      return {
        migrationId: '',
        success: false,
        error: `Database size (${formatBytes(actualSize)}) exceeds Pro tier limit (${proLimits.max_db_size_mb}MB). Please reduce data before downgrading.`
      };
    }
  }

  // Check row count
  if (proLimits.max_rows) {
    const rowCountResult = await exec(
      `PGPASSWORD="${enterprisePassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} -t -A -c "SELECT COUNT(*) FROM data"`
    );

    const rowCount = parseInt(rowCountResult.stdout.trim()) || 0;

    if (rowCount > proLimits.max_rows) {
      return {
        migrationId: '',
        success: false,
        error: `Row count (${rowCount}) exceeds Pro tier limit (${proLimits.max_rows}). Please reduce data before downgrading.`
      };
    }
  }

  // 3. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status, size_bytes)
    VALUES (${projectId}, 'downgrade_to_pro', 'pending', ${actualSize})
    RETURNING id
  `;

  try {
    console.log(`[Migration] Starting Enterprise → Pro downgrade for project ${projectId}`);

    // 4. Find Pro pool with capacity
    const proInstanceResult = await sql`
      SELECT
        di.*,
        s.host as server_host,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as postgres_password
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'pro'
        AND di.status = 'active'
        AND (di.max_databases IS NULL OR di.current_databases < di.max_databases)
      ORDER BY di.current_databases ASC
      LIMIT 1
    `;

    if (proInstanceResult.length === 0) {
      throw new Error('No Pro pool available with capacity');
    }

    const proInstance = proInstanceResult[0] as DatabaseInstance & { server_host: string; postgres_password: string };
    console.log(`[Migration] Using Pro pool: ${proInstance.name} (port ${proInstance.port})`);

    // 5. Database name in Pro pool
    const newDbName = `project_${projectId.replace(/-/g, '_')}`;

    // 6. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.enterprise_instance_id},
        from_database = ${current.database_name},
        to_instance_id = ${proInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    const proPassword = proInstance.postgres_password;

    // 7. Create database in Pro pool
    console.log(`[Migration] Creating database ${newDbName} in Pro pool`);
    const createDbResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    if (createDbResult.exitCode !== 0 && !createDbResult.stderr.includes('already exists')) {
      throw new Error(`Failed to create database: ${createDbResult.stderr}`);
    }

    // 8. Create triggers and tables in Pro database
    console.log(`[Migration] Setting up triggers in ${newDbName}`);
    await createNotifyTriggers(
      '127.0.0.1',
      proInstance.port,
      newDbName,
      'signaldb',
      proPassword,
      projectId
    );

    // 9. Dump from Enterprise database
    console.log(`[Migration] Dumping data from Enterprise database ${current.database_name}`);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    const dumpResult = await exec(
      `PGPASSWORD="${enterprisePassword}" /usr/lib/postgresql/16/bin/pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d ${current.database_name} --data-only --no-owner --no-acl -t tables -t data -f ${dumpFile}`
    );

    if (dumpResult.exitCode !== 0) {
      throw new Error(`Failed to dump data: ${dumpResult.stderr}`);
    }

    // 10. Restore data to Pro database
    console.log(`[Migration] Restoring data to Pro database ${newDbName}`);
    const restoreResult = await exec(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    if (restoreResult.exitCode !== 0 && !restoreResult.stderr.includes('already exists')) {
      console.warn(`[Migration] Restore warnings: ${restoreResult.stderr}`);
    }

    // 11. Update project_databases registry
    console.log(`[Migration] Updating registry`);
    const newConnString = `postgresql://signaldb:${proPassword}@127.0.0.1:${proInstance.port}/${newDbName}`;
    const encryptedConnString = await encrypt(newConnString);

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${proInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${encryptedConnString},
        migration_id = ${migration.id},
        size_bytes = ${actualSize},
        status = 'active',
        updated_at = NOW()
      WHERE project_id = ${projectId}
    `;

    // 12. Update instance database counts
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${proInstance.id}
    `;

    await sql`
      UPDATE database_instances
      SET current_databases = current_databases - 1
      WHERE id = ${current.enterprise_instance_id}
    `;

    // 13. Cleanup temp files
    await exec(`rm -f ${dumpFile}`);

    // 14. Complete migration
    const duration = Date.now() - startTime;
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 15. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    console.log(`[Migration] Pro downgrade complete for ${projectId} in ${duration}ms`);
    return { migrationId: migration.id, success: true, duration };

  } catch (error: any) {
    console.error(`[Migration] Pro downgrade failed for ${projectId}:`, error);

    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}
