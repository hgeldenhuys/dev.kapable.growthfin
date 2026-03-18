/**
 * Role Sync — merge YAML auth.roles into auth_configs.role_definitions
 *
 * Follows the same pattern as schedule-sync.ts:
 * - YAML roles override same-named existing roles
 * - Existing roles not in YAML are preserved (console-defined roles)
 * - owner and admin always retain '*' permissions
 */

import { sql } from './db';
import type { AuthRoleConfig } from '../services/signaldb-config';

/**
 * Sync role definitions from signaldb.yaml into auth_configs.role_definitions.
 * Uses JSONB merge: YAML roles override same-named entries, console-only roles preserved.
 */
export async function syncRoleDefinitions(
  projectId: string,
  yamlRoles: Record<string, AuthRoleConfig>
): Promise<{ merged: number }> {
  // Build the JSONB object to merge
  const roleDefs: Record<string, { permissions: string[]; description?: string }> = {};
  for (const [name, config] of Object.entries(yamlRoles)) {
    roleDefs[name] = {
      permissions: config.permissions,
    };
    if (config.description) {
      roleDefs[name].description = config.description;
    }
  }

  // Ensure owner and admin always have wildcard permissions
  if (roleDefs.owner) {
    roleDefs.owner.permissions = ['*'];
  }
  if (roleDefs.admin) {
    roleDefs.admin.permissions = ['*'];
  }

  // Merge YAML roles into existing role_definitions using JSONB concat (||)
  // This preserves console-only roles while overriding YAML-defined ones
  await sql`
    UPDATE auth_configs
    SET role_definitions = COALESCE(role_definitions, '{}'::jsonb) || ${sql.json(roleDefs)}::jsonb,
        updated_at = NOW()
    WHERE project_id = ${projectId}
  `;

  const merged = Object.keys(roleDefs).length;
  if (merged > 0) {
    console.log(`[role-sync] project=${projectId}: merged ${merged} role definitions from YAML`);
  }

  return { merged };
}
