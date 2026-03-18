/**
 * Usage Enforcement
 *
 * Checks organization usage against plan limits before processing API requests.
 * Returns 429 when limits exceeded.
 */

import { sql } from './db';
import { logger } from './logger';

interface UsageCheckResult {
  allowed: boolean;
  warning: boolean;
  metric: string;
  current: number;
  limit: number;
  percentUsed: number;
}

/**
 * Check if org is within API call limits for current billing period
 */
export async function checkUsageEnforcement(orgId: string): Promise<UsageCheckResult> {
  try {
    const rows = await sql`
      SELECT
        COALESCE(
          (SELECT SUM(um.value) FROM usage_metrics um
           WHERE um.org_id = ${orgId}
             AND um.metric_type = 'api_calls'
             AND um.metric_date >= COALESCE(
               (SELECT current_period_start FROM org_subscriptions WHERE org_id = ${orgId}),
               date_trunc('month', CURRENT_DATE)
             )),
          0
        )::bigint as current_calls,
        COALESCE(
          (SELECT (bp.limits->>'api_calls_limit')::bigint
           FROM org_subscriptions os
           JOIN billing_plans bp ON bp.id = os.plan_id
           WHERE os.org_id = ${orgId}),
          1000
        ) as call_limit
    `;

    if (rows.length === 0) {
      return { allowed: true, warning: false, metric: 'api_calls', current: 0, limit: 1000, percentUsed: 0 };
    }

    const current = Number(rows[0].current_calls);
    const limit = Number(rows[0].call_limit);

    if (limit <= 0) {
      return { allowed: true, warning: false, metric: 'api_calls', current, limit: 0, percentUsed: 0 };
    }

    const percentUsed = (current / limit) * 100;

    return {
      allowed: percentUsed < 100,
      warning: percentUsed >= 80,
      metric: 'api_calls',
      current,
      limit,
      percentUsed,
    };
  } catch (error) {
    logger.error('Usage enforcement check failed', error instanceof Error ? error : new Error(String(error)), { orgId });
    // Fail open — don't block requests on enforcement errors
    return { allowed: true, warning: false, metric: 'api_calls', current: 0, limit: 0, percentUsed: 0 };
  }
}

/**
 * Check if org is within row count limits
 */
export async function checkRowLimitEnforcement(orgId: string): Promise<UsageCheckResult> {
  try {
    const rows = await sql`
      SELECT
        COALESCE(
          (SELECT SUM(cnt)::bigint FROM (
            SELECT COUNT(*)::bigint as cnt
            FROM projects p
            JOIN LATERAL (
              SELECT COUNT(*) as cnt FROM information_schema.tables
              WHERE table_schema = p.schema_name AND table_name = 'data'
            ) tbl ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*) as cnt FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = p.schema_name AND c.relname = 'data'
            ) rel ON true
            WHERE p.org_id = ${orgId} AND p.schema_name IS NOT NULL
          ) sub),
          0
        ) as total_placeholder,
        COALESCE(
          (SELECT (bp.limits->>'rows_limit')::bigint
           FROM org_subscriptions os
           JOIN billing_plans bp ON bp.id = os.plan_id
           WHERE os.org_id = ${orgId}),
          10000
        ) as row_limit
    `;

    // Actually count rows across project schemas
    const projectRows = await sql`
      SELECT schema_name FROM projects WHERE org_id = ${orgId} AND schema_name IS NOT NULL
    `;

    let totalRows = 0;
    for (const proj of projectRows) {
      try {
        const countResult = await sql`
          SELECT COUNT(*)::bigint as cnt FROM ${sql(proj.schema_name)}.data
        `;
        totalRows += Number(countResult[0]?.cnt || 0);
      } catch {
        // Schema may not have data table
      }
    }

    const limit = Number(rows[0]?.row_limit || 10000);

    // 0 means unlimited (enterprise)
    if (limit <= 0) {
      return { allowed: true, warning: false, metric: 'rows', current: totalRows, limit: 0, percentUsed: 0 };
    }

    const percentUsed = (totalRows / limit) * 100;

    return {
      allowed: percentUsed < 100,
      warning: percentUsed >= 80,
      metric: 'rows',
      current: totalRows,
      limit,
      percentUsed,
    };
  } catch (error) {
    logger.error('Row limit check failed', error instanceof Error ? error : new Error(String(error)), { orgId });
    return { allowed: true, warning: false, metric: 'rows', current: 0, limit: 0, percentUsed: 0 };
  }
}

/**
 * Check if org can insert a batch of rows without exceeding row limits.
 * Returns current count and limit for error messaging.
 */
export async function checkRowLimitForBatch(orgId: string, batchSize: number): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  try {
    // Get the row limit for this org's plan
    const limitRows = await sql`
      SELECT COALESCE(
        (SELECT (bp.limits->>'rows_limit')::bigint
         FROM org_subscriptions os
         JOIN billing_plans bp ON bp.id = os.plan_id
         WHERE os.org_id = ${orgId}),
        10000
      ) as row_limit
    `;
    const limit = Number(limitRows[0]?.row_limit || 10000);

    // 0 means unlimited (enterprise)
    if (limit <= 0) {
      return { allowed: true, current: 0, limit: 0 };
    }

    // Count current rows across all project schemas for this org
    const projectRows = await sql`
      SELECT schema_name FROM projects WHERE org_id = ${orgId} AND schema_name IS NOT NULL
    `;

    let totalRows = 0;
    for (const proj of projectRows) {
      try {
        const countResult = await sql`
          SELECT COUNT(*)::bigint as cnt FROM ${sql(proj.schema_name)}.data
        `;
        totalRows += Number(countResult[0]?.cnt || 0);
      } catch {
        // Schema may not have data table
      }
    }

    return {
      allowed: (totalRows + batchSize) <= limit,
      current: totalRows,
      limit,
    };
  } catch (error) {
    logger.error('Batch row limit check failed', error instanceof Error ? error : new Error(String(error)), { orgId, batchSize });
    // Fail open
    return { allowed: true, current: 0, limit: 0 };
  }
}

/**
 * Create a 429 response for usage limit exceeded
 */
export function usageLimitResponse(result: UsageCheckResult): Response {
  return Response.json({
    error: 'Usage limit exceeded',
    message: `Your organization has reached its ${result.metric} limit (${result.current}/${result.limit}). Upgrade your plan to continue.`,
    current: result.current,
    limit: result.limit,
    upgrade_url: 'https://console.signaldb.app/console',
  }, {
    status: 429,
    headers: {
      'X-Usage-Limit': String(result.limit),
      'X-Usage-Current': String(result.current),
      'X-Usage-Percent': String(Math.round(result.percentUsed)),
    },
  });
}
