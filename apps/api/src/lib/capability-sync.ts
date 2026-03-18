/**
 * Capability Sync — Stores declared capabilities in app_environments.settings JSONB.
 *
 * Called after a successful deploy to record which capabilities the app declared
 * in its signaldb.yaml. No separate table needed — capabilities are a property
 * of the environment config.
 */

import { sql } from './db';

export async function syncCapabilities(
  environmentId: string,
  capabilities: Record<string, boolean | Record<string, unknown>>,
): Promise<void> {
  try {
    // Merge capabilities into the existing settings JSONB
    await sql`
      UPDATE app_environments
      SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('capabilities', ${sql.json(capabilities as any)}),
          updated_at = now()
      WHERE id = ${environmentId}
    `;
    console.log(`[capability-sync] Synced ${Object.keys(capabilities).length} capabilities for env ${environmentId}`);
  } catch (err) {
    console.warn('[capability-sync] Failed to sync capabilities:', err);
  }
}
