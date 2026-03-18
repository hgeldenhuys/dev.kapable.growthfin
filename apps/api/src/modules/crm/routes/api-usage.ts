/**
 * API Usage Monitoring Routes
 * Endpoints for viewing provider usage, alerts, and triggering manual checks
 */

import { Elysia, t } from 'elysia';
import { db, apiUsageSnapshots, apiUsageAlerts } from '@agios/db';
import { eq, and, desc, isNull, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';

export const apiUsageRoutes = new Elysia({ prefix: '/api-usage' })
  /**
   * GET /api/v1/crm/api-usage/current
   * Latest snapshot per provider (up to 10 rows)
   */
  .get(
    '/current',
    async () => {
      // Get the most recent snapshot for each provider using a lateral join pattern
      const results = await db.execute(sql`
        SELECT DISTINCT ON (provider) *
        FROM api_usage_snapshots
        ORDER BY provider, created_at DESC
      `);

      // db.execute returns array directly in some drivers, object with .rows in others
      const rows: any[] = Array.isArray(results) ? results : (results as any).rows ?? [];

      return {
        providers: rows.map((row: any) => ({
          id: row.id,
          provider: row.provider,
          trackingMethod: row.tracking_method,
          balanceRemaining: row.balance_remaining ? parseFloat(row.balance_remaining) : null,
          balanceUnit: row.balance_unit,
          quotaUsed: row.quota_used ? parseFloat(row.quota_used) : null,
          quotaLimit: row.quota_limit ? parseFloat(row.quota_limit) : null,
          quotaUnit: row.quota_unit,
          quotaResetAt: row.quota_reset_at,
          callCountPeriod: row.call_count_period,
          estimatedCostPeriod: row.estimated_cost_period ? parseFloat(row.estimated_cost_period) : null,
          usagePercent: row.usage_percent ? parseFloat(row.usage_percent) : null,
          isReachable: row.is_reachable,
          lastError: row.last_error,
          latencyMs: row.latency_ms,
          createdAt: row.created_at,
        })),
        checkedAt: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ['API Usage'],
        summary: 'Get current API usage',
        description: 'Returns the latest usage snapshot for each of the 10 monitored providers',
      },
    }
  )

  /**
   * GET /api/v1/crm/api-usage/history
   * Time-series data for a specific provider (for charting)
   */
  .get(
    '/history',
    async ({ query }) => {
      const { provider, days = '30' } = query;
      const daysAgo = parseInt(days, 10);
      const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const snapshots = await db
        .select()
        .from(apiUsageSnapshots)
        .where(
          and(
            sql`${apiUsageSnapshots.provider} = ${provider}`,
            gte(apiUsageSnapshots.createdAt, since)
          )
        )
        .orderBy(desc(apiUsageSnapshots.createdAt));

      return {
        provider,
        days: daysAgo,
        snapshots,
      };
    },
    {
      query: t.Object({
        provider: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['API Usage'],
        summary: 'Get usage history',
        description: 'Get time-series usage data for a provider (for charting)',
      },
    }
  )

  /**
   * GET /api/v1/crm/api-usage/alerts
   * List alerts, optionally filtered by resolved status
   */
  .get(
    '/alerts',
    async ({ query }) => {
      const { resolved } = query;

      const baseQuery = db
        .select()
        .from(apiUsageAlerts);

      let alerts;
      if (resolved === 'false') {
        alerts = await baseQuery
          .where(isNull(apiUsageAlerts.resolvedAt))
          .orderBy(desc(apiUsageAlerts.createdAt))
          .limit(100);
      } else if (resolved === 'true') {
        alerts = await baseQuery
          .where(sql`${apiUsageAlerts.resolvedAt} IS NOT NULL`)
          .orderBy(desc(apiUsageAlerts.createdAt))
          .limit(100);
      } else {
        alerts = await baseQuery
          .orderBy(desc(apiUsageAlerts.createdAt))
          .limit(100);
      }

      return {
        alerts,
        count: alerts.length,
      };
    },
    {
      query: t.Object({
        resolved: t.Optional(t.String()),
      }),
      detail: {
        tags: ['API Usage'],
        summary: 'List usage alerts',
        description: 'List API usage alerts, optionally filtered by resolved status',
      },
    }
  )

  /**
   * POST /api/v1/crm/api-usage/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  .post(
    '/alerts/:id/acknowledge',
    async ({ params, query }) => {
      const { id } = params;
      const userId = query.userId;

      const [updated] = await db
        .update(apiUsageAlerts)
        .set({
          acknowledgedAt: new Date(),
          acknowledgedBy: userId || null,
        })
        .where(eq(apiUsageAlerts.id, id))
        .returning();

      if (!updated) {
        return { error: 'Alert not found' };
      }

      return {
        id: updated.id,
        provider: updated.provider,
        alertLevel: updated.alertLevel,
        acknowledgedAt: updated.acknowledgedAt,
        message: 'Alert acknowledged',
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['API Usage'],
        summary: 'Acknowledge alert',
        description: 'Mark an alert as acknowledged by a user',
      },
    }
  )

  /**
   * POST /api/v1/crm/api-usage/refresh
   * Manually trigger a usage check (runs the worker immediately)
   */
  .post(
    '/refresh',
    async () => {
      await jobQueue.send('check-api-usage', {});

      return {
        message: 'API usage check queued',
        note: 'Snapshots will be available within seconds',
      };
    },
    {
      detail: {
        tags: ['API Usage'],
        summary: 'Refresh usage data',
        description: 'Manually trigger an API usage check across all providers',
      },
    }
  );
