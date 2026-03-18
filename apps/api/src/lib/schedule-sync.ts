/**
 * Schedule Sync — cron parsing, validation, and YAML-to-DB sync for platform scheduler
 */

import { CronExpressionParser } from 'cron-parser';
import { sql } from './db';

/**
 * Calculate the next run time from a cron expression
 */
export function calculateNextRun(cronExpr: string, fromDate?: Date): Date {
  const interval = CronExpressionParser.parse(cronExpr, {
    currentDate: fromDate || new Date(),
    tz: 'UTC',
  });
  return interval.next().toDate();
}

/**
 * Validate a cron expression. Returns null if valid, error message if invalid.
 */
export function validateCronExpression(expr: string): string | null {
  try {
    CronExpressionParser.parse(expr);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid cron expression';
  }
}

/**
 * Sync schedules from signaldb.yaml into the database.
 * - UPSERTs yaml-sourced jobs (matched by environment_id + name)
 * - DELETEs yaml-sourced jobs that are no longer in the YAML
 * - Never touches console-sourced jobs
 */
export async function syncSchedulesFromYaml(
  environmentId: string,
  schedules: Record<string, YamlScheduleConfig>
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const yamlNames = new Set(Object.keys(schedules));

  // UPSERT each schedule from YAML
  for (const [name, config] of Object.entries(schedules)) {
    const cronErr = validateCronExpression(config.cron);
    if (cronErr) {
      console.warn(`[schedule-sync] Skipping invalid cron for '${name}': ${cronErr}`);
      continue;
    }

    const nextRun = calculateNextRun(config.cron);
    const actionConfig = {
      url: config.action.url,
      method: config.action.method || 'POST',
      headers: config.action.headers || {},
      body: config.action.body || null,
      command: config.action.command || null,
    };

    const result = await sql`
      INSERT INTO app_scheduled_jobs (environment_id, name, cron_expression, action_type, action_config, next_run_at, timeout_ms, max_retries, source)
      VALUES (
        ${environmentId},
        ${name},
        ${config.cron},
        ${config.action.type || 'webhook'},
        ${sql.json(actionConfig)},
        ${nextRun.toISOString()},
        ${config.timeout || 30000},
        ${config.retries || 0},
        'yaml'
      )
      ON CONFLICT (environment_id, name)
      DO UPDATE SET
        cron_expression = EXCLUDED.cron_expression,
        action_type = EXCLUDED.action_type,
        action_config = EXCLUDED.action_config,
        next_run_at = EXCLUDED.next_run_at,
        timeout_ms = EXCLUDED.timeout_ms,
        max_retries = EXCLUDED.max_retries,
        source = 'yaml',
        updated_at = now()
      WHERE app_scheduled_jobs.source = 'yaml'
      RETURNING (xmax = 0) AS is_insert
    `;

    if (result.length > 0) {
      if (result[0].is_insert) created++;
      else updated++;
    }
  }

  // DELETE yaml-sourced jobs that are no longer in the YAML
  if (yamlNames.size === 0) {
    // Delete all yaml-sourced jobs
    const removed = await sql`
      DELETE FROM app_scheduled_jobs
      WHERE environment_id = ${environmentId} AND source = 'yaml'
      RETURNING id
    `;
    deleted = removed.length;
  } else {
    const nameArray = Array.from(yamlNames);
    const removed = await sql`
      DELETE FROM app_scheduled_jobs
      WHERE environment_id = ${environmentId}
        AND source = 'yaml'
        AND name != ALL(${nameArray})
      RETURNING id
    `;
    deleted = removed.length;
  }

  if (created + updated + deleted > 0) {
    console.log(`[schedule-sync] env=${environmentId}: created=${created} updated=${updated} deleted=${deleted}`);
  }

  return { created, updated, deleted };
}

export interface YamlScheduleAction {
  type?: 'webhook' | 'bash';
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  command?: string;
}

export interface YamlScheduleConfig {
  cron: string;
  action: YamlScheduleAction;
  timeout?: number;
  retries?: number;
}
