/**
 * Project User Manager
 *
 * Handles lifecycle management for per-project PostgreSQL users:
 * - Automatic provisioning on project creation (when enabled)
 * - Cleanup on project deletion
 * - Password rotation
 *
 * Per-project users provide credential isolation so leaked credentials
 * only expose a single project rather than all projects in a tier.
 */

import postgres, { Sql } from 'postgres';
import { randomBytes, createHash } from 'crypto';
import { sql } from './db';
import { requireEnv } from './require-env';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

/**
 * Result of provisioning a project user
 */
export interface ProvisionResult {
  username: string;
  created: boolean; // true if new user, false if updated existing
}

/**
 * Instance info for user provisioning
 */
interface InstanceInfo {
  id: string;
  host: string;
  port: number;
  database: string;
  adminUser: string;
  adminPassword: string;
  tier: string;
  perProjectUsersEnabled: boolean;
}

/**
 * Project info for user provisioning
 */
interface ProjectInfo {
  projectId: string;
  instanceId: string;
  schemaName: string | null;
  databaseName: string;
  existingUser: string | null;
}

/**
 * Project User Manager
 *
 * Handles per-project PostgreSQL user lifecycle:
 * - Create user with appropriate permissions on project creation
 * - Drop user on project deletion
 * - Rotate credentials when requested
 */
class ProjectUserManager {
  /**
   * Generate a PostgreSQL username from project ID
   * Format: p_<project_uuid_with_underscores> (max 63 chars)
   */
  generateUsername(projectId: string): string {
    const username = 'p_' + projectId.replace(/-/g, '_');
    return username.substring(0, 63);
  }

  /**
   * Generate a secure password
   * 24 random bytes, base64 encoded with URL-safe chars
   */
  generatePassword(): string {
    const bytes = randomBytes(24);
    return bytes
      .toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .substring(0, 32);
  }

  /**
   * Generate MD5 hash for PgBouncer userlist.txt
   * Format: md5<hash of password+username>
   */
  generateMd5Hash(username: string, password: string): string {
    const hash = createHash('md5')
      .update(password + username)
      .digest('hex');
    return `md5${hash}`;
  }

  /**
   * Check if per-project users are enabled for an instance
   */
  async isEnabledForInstance(instanceId: string): Promise<boolean> {
    const result = await sql`
      SELECT COALESCE(per_project_users_enabled, false) as enabled
      FROM database_instances
      WHERE id = ${instanceId}
    `;

    return result.length > 0 && result[0].enabled === true;
  }

  /**
   * Get instance connection info for admin operations
   */
  async getInstanceInfo(instanceId: string): Promise<InstanceInfo | null> {
    const result = await sql`
      SELECT
        di.id,
        '127.0.0.1' as host,
        di.port,
        di.database_name as database,
        di.postgres_user as admin_user,
        pgp_sym_decrypt(di.postgres_password_encrypted::bytea, ${ENCRYPTION_KEY}) as admin_password,
        di.tier,
        COALESCE(di.per_project_users_enabled, false) as per_project_users_enabled
      FROM database_instances di
      WHERE di.id = ${instanceId}
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      database: row.database,
      adminUser: row.admin_user,
      adminPassword: row.admin_password,
      tier: row.tier,
      perProjectUsersEnabled: row.per_project_users_enabled,
    };
  }

  /**
   * Get project database info
   */
  async getProjectInfo(projectId: string): Promise<ProjectInfo | null> {
    const result = await sql`
      SELECT
        pd.project_id,
        pd.instance_id,
        pd.schema_name,
        pd.database_name,
        pd.project_user as existing_user
      FROM project_databases pd
      WHERE pd.project_id = ${projectId}
        AND pd.status = 'active'
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      projectId: row.project_id,
      instanceId: row.instance_id,
      schemaName: row.schema_name,
      databaseName: row.database_name,
      existingUser: row.existing_user,
    };
  }

  /**
   * Create or update a per-project PostgreSQL user
   *
   * @param projectId - The project UUID
   * @param force - If true, create even if feature is disabled for instance
   * @returns ProvisionResult or null if feature is disabled and force=false
   */
  async provisionProjectUser(
    projectId: string,
    force: boolean = false
  ): Promise<ProvisionResult | null> {
    // Get project info
    const project = await this.getProjectInfo(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get instance info
    const instance = await this.getInstanceInfo(project.instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${project.instanceId}`);
    }

    // Check if feature is enabled (unless forced)
    if (!force && !instance.perProjectUsersEnabled) {
      console.log(`[ProjectUserManager] Per-project users not enabled for instance ${instance.id}`);
      return null;
    }

    // Generate credentials
    const username = this.generateUsername(projectId);
    const password = this.generatePassword();

    // Connect to target database as admin
    const instanceSql = postgres({
      host: instance.host,
      port: instance.port,
      database: project.databaseName,
      username: instance.adminUser,
      password: instance.adminPassword,
    });

    try {
      // Check if user already exists
      const existingRole = await instanceSql`
        SELECT 1 FROM pg_roles WHERE rolname = ${username}
      `;

      const userExists = existingRole.length > 0;

      if (userExists) {
        // Update password for existing user
        await instanceSql.unsafe(`ALTER ROLE "${username}" WITH PASSWORD '${password}'`);
        console.log(`[ProjectUserManager] Updated password for existing user: ${username}`);
      } else {
        // Create new user
        await instanceSql.unsafe(`CREATE ROLE "${username}" WITH LOGIN PASSWORD '${password}'`);
        console.log(`[ProjectUserManager] Created new user: ${username}`);
      }

      // Grant appropriate permissions based on tier
      await this.grantPermissions(instanceSql, username, project.schemaName, instance.tier);

      // Store encrypted credentials in control plane
      await sql`
        UPDATE project_databases
        SET
          project_user = ${username},
          project_password_encrypted = pgp_sym_encrypt(${password}, ${ENCRYPTION_KEY})::text,
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `;

      console.log(`[ProjectUserManager] Stored credentials for project: ${projectId}`);

      return {
        username,
        created: !userExists,
      };
    } finally {
      await instanceSql.end();
    }
  }

  /**
   * Grant permissions to a project user based on tier
   */
  private async grantPermissions(
    instanceSql: Sql,
    username: string,
    schemaName: string | null,
    tier: string
  ): Promise<void> {
    if ((tier === 'hobbyist' || tier === 'free') && schemaName) {
      // Schema isolation: grant access only to project schema
      await instanceSql.unsafe(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL PRIVILEGES ON TABLES TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL PRIVILEGES ON SEQUENCES TO "${username}"`);
      console.log(`[ProjectUserManager] Granted schema-level permissions on ${schemaName}`);
    } else {
      // Database isolation: grant access to public schema
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "${username}"`);
      await instanceSql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "${username}"`);
      console.log(`[ProjectUserManager] Granted database-level permissions on public schema`);
    }
  }

  /**
   * Drop a per-project PostgreSQL user
   * Called when a project is deleted
   */
  async dropProjectUser(projectId: string): Promise<boolean> {
    // Get project info
    const project = await this.getProjectInfo(projectId);
    if (!project) {
      console.log(`[ProjectUserManager] Project not found: ${projectId}`);
      return false;
    }

    // Check if project has a dedicated user
    if (!project.existingUser) {
      console.log(`[ProjectUserManager] Project ${projectId} has no dedicated user`);
      return false;
    }

    // Get instance info
    const instance = await this.getInstanceInfo(project.instanceId);
    if (!instance) {
      console.error(`[ProjectUserManager] Instance not found: ${project.instanceId}`);
      return false;
    }

    // Connect to target database as admin
    const instanceSql = postgres({
      host: instance.host,
      port: instance.port,
      database: project.databaseName,
      username: instance.adminUser,
      password: instance.adminPassword,
    });

    try {
      const username = project.existingUser;

      // Revoke permissions first
      if ((instance.tier === 'hobbyist' || instance.tier === 'free') && project.schemaName) {
        await instanceSql.unsafe(`
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${project.schemaName}" FROM "${username}";
          REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${project.schemaName}" FROM "${username}";
          REVOKE USAGE ON SCHEMA "${project.schemaName}" FROM "${username}";
        `).catch(() => { /* Ignore if already revoked */ });
      } else {
        await instanceSql.unsafe(`
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${username}";
          REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "${username}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${username}";
        `).catch(() => { /* Ignore if already revoked */ });
      }

      // Drop the role
      await instanceSql.unsafe(`DROP ROLE IF EXISTS "${username}"`);
      console.log(`[ProjectUserManager] Dropped user: ${username}`);

      // Clear credentials in control plane
      await sql`
        UPDATE project_databases
        SET
          project_user = NULL,
          project_password_encrypted = NULL,
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `;

      return true;
    } catch (error) {
      console.error(`[ProjectUserManager] Error dropping user for project ${projectId}:`, error);
      return false;
    } finally {
      await instanceSql.end();
    }
  }

  /**
   * Rotate password for a per-project user
   * Returns the new password (shown once) or null if no user exists
   */
  async rotatePassword(projectId: string): Promise<string | null> {
    // Get project info
    const project = await this.getProjectInfo(projectId);
    if (!project || !project.existingUser) {
      console.log(`[ProjectUserManager] No dedicated user for project: ${projectId}`);
      return null;
    }

    // Get instance info
    const instance = await this.getInstanceInfo(project.instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${project.instanceId}`);
    }

    // Generate new password
    const newPassword = this.generatePassword();

    // Connect to target database as admin
    const instanceSql = postgres({
      host: instance.host,
      port: instance.port,
      database: project.databaseName,
      username: instance.adminUser,
      password: instance.adminPassword,
    });

    try {
      // Update password in PostgreSQL
      await instanceSql.unsafe(`ALTER ROLE "${project.existingUser}" WITH PASSWORD '${newPassword}'`);

      // Update encrypted password in control plane
      // Note: project_user_last_rotated is updated by trigger in migration 010
      await sql`
        UPDATE project_databases
        SET
          project_password_encrypted = pgp_sym_encrypt(${newPassword}, ${ENCRYPTION_KEY})::text,
          updated_at = NOW()
        WHERE project_id = ${projectId}
      `;

      console.log(`[ProjectUserManager] Rotated password for: ${project.existingUser}`);
      return newPassword;
    } finally {
      await instanceSql.end();
    }
  }

  /**
   * Get provisioning statistics for monitoring
   */
  async getStats(): Promise<{
    instanceName: string;
    tier: string;
    featureEnabled: boolean;
    totalProjects: number;
    withDedicatedUser: number;
    withoutDedicatedUser: number;
  }[]> {
    const result = await sql`SELECT * FROM get_project_user_stats()`;
    return result.map((row: Record<string, unknown>) => ({
      instanceName: row.instance_name as string,
      tier: row.tier as string,
      featureEnabled: row.feature_enabled as boolean,
      totalProjects: Number(row.total_projects),
      withDedicatedUser: Number(row.with_dedicated_user),
      withoutDedicatedUser: Number(row.without_dedicated_user),
    }));
  }

  /**
   * Sync a user to PgBouncer userlist (for Business tier)
   * Call this after provisioning a Business tier project user
   *
   * Note: This requires write access to /etc/pgbouncer/userlist.txt
   * In production, this is typically done via the pgbouncer-manage.ts script
   * or through a cron job that periodically syncs.
   */
  async syncToPgBouncer(
    username: string,
    password: string,
    action: 'add' | 'remove' = 'add'
  ): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      const scriptPath = new URL('../scripts/pgbouncer-manage.ts', import.meta.url).pathname;

      if (action === 'add') {
        const hash = this.generateMd5Hash(username, password);
        execSync(`bun ${scriptPath} add-user "${username}" "${hash}"`, {
          stdio: 'pipe',
        });
      } else {
        execSync(`bun ${scriptPath} remove-user "${username}"`, {
          stdio: 'pipe',
        });
      }

      // Reload PgBouncer to apply changes
      execSync(`bun ${scriptPath} reload`, { stdio: 'pipe' });

      console.log(`[ProjectUserManager] PgBouncer ${action}: ${username}`);
      return true;
    } catch (error) {
      console.warn(`[ProjectUserManager] Failed to sync to PgBouncer:`, error);
      // Don't fail the operation, PgBouncer sync can be done manually
      return false;
    }
  }

  /**
   * Check if a project requires PgBouncer sync (Business tier)
   */
  async requiresPgBouncerSync(projectId: string): Promise<boolean> {
    const project = await this.getProjectInfo(projectId);
    if (!project) return false;

    const instance = await this.getInstanceInfo(project.instanceId);
    return instance?.tier === 'business';
  }
}

// Export singleton instance
export const projectUserManager = new ProjectUserManager();
