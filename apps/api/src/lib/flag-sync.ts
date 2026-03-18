/**
 * Flag Sync — YAML-to-DB sync for feature flags
 *
 * Follows the same pattern as schedule-sync.ts:
 * - UPSERT yaml-sourced flags
 * - DELETE yaml-sourced flags no longer in YAML
 * - Never touch console-sourced flags
 */

import { sql } from './db';

export interface YamlFlagConfig {
  type?: 'boolean' | 'rollout';
  default?: boolean;
  description?: string;
  enabled?: boolean;
  environments?: Record<string, boolean>;
  rollout?: {
    percentage?: number;
    rules?: Array<{
      attribute: string;
      operator: string;
      value: string | string[] | number;
      result: boolean;
    }>;
  };
}

/**
 * Sync feature flags from signaldb.yaml into the database.
 * - UPSERTs yaml-sourced flags (matched by organization_id + name)
 * - DELETEs yaml-sourced flags that are no longer in the YAML
 * - Never touches console-sourced flags
 */
export async function syncFlagsFromYaml(
  orgId: string,
  flags: Record<string, YamlFlagConfig>
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const yamlNames = new Set(Object.keys(flags));

  // UPSERT each flag from YAML
  for (const [name, config] of Object.entries(flags)) {
    const flagType = config.type || 'boolean';
    const defaultValue = config.default ?? false;
    const rolloutConfig = config.rollout ? {
      percentage: config.rollout.percentage,
      rules: config.rollout.rules,
    } : {};
    const environmentOverrides = config.environments || {};

    const result = await sql`
      INSERT INTO feature_flags (
        organization_id, name, description, flag_type, default_value,
        rollout_config, environment_overrides, enabled, source
      ) VALUES (
        ${orgId},
        ${name},
        ${config.description || null},
        ${flagType},
        ${defaultValue},
        ${sql.json(rolloutConfig)},
        ${sql.json(environmentOverrides)},
        ${config.enabled ?? true},
        'yaml'
      )
      ON CONFLICT (organization_id, name)
      DO UPDATE SET
        description = EXCLUDED.description,
        flag_type = EXCLUDED.flag_type,
        default_value = EXCLUDED.default_value,
        rollout_config = EXCLUDED.rollout_config,
        environment_overrides = EXCLUDED.environment_overrides,
        enabled = EXCLUDED.enabled,
        source = 'yaml',
        updated_at = now()
      WHERE feature_flags.source = 'yaml'
      RETURNING (xmax = 0) AS is_insert
    `;

    if (result.length > 0) {
      if (result[0].is_insert) created++;
      else updated++;
    }
  }

  // DELETE yaml-sourced flags that are no longer in the YAML
  if (yamlNames.size === 0) {
    const removed = await sql`
      DELETE FROM feature_flags
      WHERE organization_id = ${orgId} AND source = 'yaml'
      RETURNING id
    `;
    deleted = removed.length;
  } else {
    const nameArray = Array.from(yamlNames);
    const removed = await sql`
      DELETE FROM feature_flags
      WHERE organization_id = ${orgId}
        AND source = 'yaml'
        AND name != ALL(${nameArray})
      RETURNING id
    `;
    deleted = removed.length;
  }

  if (created + updated + deleted > 0) {
    console.log(`[flag-sync] org=${orgId}: created=${created} updated=${updated} deleted=${deleted}`);
  }

  return { created, updated, deleted };
}
