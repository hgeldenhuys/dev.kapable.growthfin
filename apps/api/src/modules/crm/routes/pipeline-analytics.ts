/**
 * Pipeline Analytics Routes
 * Pipeline performance metrics, revenue forecasting, deal velocity, and win/loss analysis
 */

import { Elysia, t } from 'elysia';
import {
  crmOpportunities,
  users,
} from '@agios/db/schema';
import { eq, and, isNull, sql, gte, lte, count, sum, avg, desc } from 'drizzle-orm';

export const pipelineAnalyticsRoutes = new Elysia({ prefix: '/pipeline' })

  // ============================================================================
  // 1. PIPELINE METRICS - Value breakdown by stage
  // ============================================================================
  .get(
    '/metrics',
    async ({ db, query }) => {
      const { workspaceId } = query;

      const stageMetrics = await db
        .select({
          stage: crmOpportunities.stage,
          count: count(),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
          weightedValue: sum(
            sql<number>`CAST(${crmOpportunities.amount} AS numeric) * ${crmOpportunities.probability} / 100`
          ),
          avgDealSize: avg(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
          avgProbability: avg(crmOpportunities.probability),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt)
          )
        )
        .groupBy(crmOpportunities.stage);

      // Summary across all open deals
      const summaryResult = await db
        .select({
          totalOpen: count(),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
          weightedValue: sum(
            sql<number>`CAST(${crmOpportunities.amount} AS numeric) * ${crmOpportunities.probability} / 100`
          ),
          avgDealSize: avg(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt)
          )
        );

      const summary = summaryResult[0];

      return {
        stages: stageMetrics.map((s) => ({
          stage: s.stage,
          count: Number(s.count),
          totalValue: Number(s.totalValue || 0),
          weightedValue: Number(Number(s.weightedValue || 0).toFixed(2)),
          avgDealSize: Number(Number(s.avgDealSize || 0).toFixed(2)),
          avgProbability: Number(Number(s.avgProbability || 0).toFixed(2)),
        })),
        summary: {
          totalOpen: Number(summary.totalOpen || 0),
          totalValue: Number(summary.totalValue || 0),
          weightedValue: Number(Number(summary.weightedValue || 0).toFixed(2)),
          avgDealSize: Number(Number(summary.avgDealSize || 0).toFixed(2)),
          dealsCount: Number(summary.totalOpen || 0),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Pipeline Analytics'],
        summary: 'Get pipeline metrics',
        description:
          'Pipeline value breakdown by stage with weighted values and averages for open deals',
      },
    }
  )

  // ============================================================================
  // 2. REVENUE FORECAST - Monthly projections based on expected close dates
  // ============================================================================
  .get(
    '/forecast',
    async ({ db, query }) => {
      const { workspaceId, months = '3' } = query;
      const monthCount = parseInt(months, 10);

      // Get the start of the current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate end date (N months from now)
      const endDate = new Date(now.getFullYear(), now.getMonth() + monthCount, 0);

      const monthlyData = await db
        .select({
          month: sql<string>`TO_CHAR(${crmOpportunities.expectedCloseDate}, 'YYYY-MM')`,
          bestCase: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
          expected: sum(
            sql<number>`CAST(${crmOpportunities.amount} AS numeric) * ${crmOpportunities.probability} / 100`
          ),
          dealsCount: count(),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt),
            gte(crmOpportunities.expectedCloseDate, startOfMonth),
            lte(crmOpportunities.expectedCloseDate, endDate),
            sql`${crmOpportunities.expectedCloseDate} IS NOT NULL`
          )
        )
        .groupBy(sql`TO_CHAR(${crmOpportunities.expectedCloseDate}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${crmOpportunities.expectedCloseDate}, 'YYYY-MM')`);

      const formattedMonths = monthlyData.map((m) => {
        const bestCase = Number(m.bestCase || 0);
        const expected = Number(Number(m.expected || 0).toFixed(2));
        const worstCase = Number((expected * 0.7).toFixed(2));
        return {
          month: m.month,
          bestCase,
          expected,
          worstCase,
          dealsCount: Number(m.dealsCount),
        };
      });

      // Calculate totals
      const totals = formattedMonths.reduce(
        (acc, m) => ({
          bestCase: acc.bestCase + m.bestCase,
          expected: acc.expected + m.expected,
          worstCase: acc.worstCase + m.worstCase,
          dealsCount: acc.dealsCount + m.dealsCount,
        }),
        { bestCase: 0, expected: 0, worstCase: 0, dealsCount: 0 }
      );

      return {
        months: formattedMonths,
        totals: {
          bestCase: Number(totals.bestCase.toFixed(2)),
          expected: Number(totals.expected.toFixed(2)),
          worstCase: Number(totals.worstCase.toFixed(2)),
          dealsCount: totals.dealsCount,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        months: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Pipeline Analytics'],
        summary: 'Get revenue forecast',
        description:
          'Monthly revenue forecast based on expected close dates and weighted probability',
      },
    }
  )

  // ============================================================================
  // 3. DEAL VELOCITY - Sales cycle speed and conversion metrics
  // ============================================================================
  .get(
    '/velocity',
    async ({ db, query }) => {
      const { workspaceId, days = '90' } = query;
      const dayCount = parseInt(days, 10);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dayCount);

      const previousCutoff = new Date();
      previousCutoff.setDate(previousCutoff.getDate() - dayCount * 2);

      // Average sales cycle (days from creation to actual close) for current period
      const velocityMetrics = await db
        .select({
          avgSalesCycleDays: sql<number>`
            AVG(
              EXTRACT(EPOCH FROM (${crmOpportunities.actualCloseDate} - ${crmOpportunities.createdAt})) / 86400
            )
          `,
          avgDealSize: avg(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
          totalClosed: count(),
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        );

      const currentMetrics = velocityMetrics[0];
      const wonCount = Number(currentMetrics.wonCount || 0);
      const lostCount = Number(currentMetrics.lostCount || 0);
      const totalClosed = wonCount + lostCount;
      const conversionRate = totalClosed > 0 ? Number(((wonCount / totalClosed) * 100).toFixed(2)) : 0;

      // Previous period for trends comparison
      const previousMetrics = await db
        .select({
          totalClosed: count(),
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, previousCutoff),
            lte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        );

      const prev = previousMetrics[0];
      const prevWon = Number(prev.wonCount || 0);
      const prevLost = Number(prev.lostCount || 0);
      const prevTotal = prevWon + prevLost;
      const prevWinRate = prevTotal > 0 ? Number(((prevWon / prevTotal) * 100).toFixed(2)) : 0;
      const prevValue = Number(prev.totalValue || 0);

      const currentValue = Number(currentMetrics.totalValue || 0);

      // Stage velocity - average days deals spent at each stage
      // Use the last stage at which the deal was closed as a proxy
      const stageVelocity = await db
        .select({
          stage: crmOpportunities.stage,
          avgDaysInStage: sql<number>`
            AVG(
              EXTRACT(EPOCH FROM (${crmOpportunities.actualCloseDate} - ${crmOpportunities.createdAt})) / 86400
            )
          `,
          dealsProcessed: count(),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        )
        .groupBy(crmOpportunities.stage);

      // Calculate percentage changes
      const dealsChange = prevTotal > 0
        ? Number((((totalClosed - prevTotal) / prevTotal) * 100).toFixed(2))
        : 0;
      const valueChange = prevValue > 0
        ? Number((((currentValue - prevValue) / prevValue) * 100).toFixed(2))
        : 0;
      const winRateChange = prevWinRate > 0
        ? Number(((conversionRate - prevWinRate) / prevWinRate * 100).toFixed(2))
        : 0;

      return {
        avgSalesCycleDays: Number(Number(currentMetrics.avgSalesCycleDays || 0).toFixed(1)),
        avgDealSize: Number(Number(currentMetrics.avgDealSize || 0).toFixed(2)),
        conversionRate,
        stageVelocity: stageVelocity.map((s) => ({
          stage: s.stage,
          avgDaysInStage: Number(Number(s.avgDaysInStage || 0).toFixed(1)),
          dealsProcessed: Number(s.dealsProcessed),
        })),
        trendsComparison: {
          currentPeriod: {
            deals: totalClosed,
            value: currentValue,
            winRate: conversionRate,
          },
          previousPeriod: {
            deals: prevTotal,
            value: prevValue,
            winRate: prevWinRate,
          },
          change: {
            deals: dealsChange,
            value: valueChange,
            winRate: winRateChange,
          },
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Pipeline Analytics'],
        summary: 'Get deal velocity',
        description:
          'Deal velocity and stage conversion metrics with period-over-period comparison',
      },
    }
  )

  // ============================================================================
  // 4. WIN/LOSS ANALYSIS - Breakdown by source, reason, stage, and owner
  // ============================================================================
  .get(
    '/win-loss',
    async ({ db, query }) => {
      const { workspaceId, days = '90' } = query;
      const dayCount = parseInt(days, 10);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dayCount);

      // Summary
      const summaryResult = await db
        .select({
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
          avgWonDealSize: sql<number>`
            AVG(CASE WHEN ${crmOpportunities.outcome} = 'won' THEN CAST(${crmOpportunities.amount} AS numeric) END)
          `,
          avgLostDealSize: sql<number>`
            AVG(CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN CAST(${crmOpportunities.amount} AS numeric) END)
          `,
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        );

      const summary = summaryResult[0];
      const won = Number(summary.wonCount || 0);
      const lost = Number(summary.lostCount || 0);
      const total = won + lost;
      const winRate = total > 0 ? Number(((won / total) * 100).toFixed(2)) : 0;

      // By lead source
      const bySource = await db
        .select({
          source: crmOpportunities.leadSource,
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        )
        .groupBy(crmOpportunities.leadSource)
        .orderBy(desc(sql`SUM(CAST(${crmOpportunities.amount} AS numeric))`));

      // By lost reason
      const byLostReason = await db
        .select({
          reason: crmOpportunities.lostReason,
          count: count(),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            eq(crmOpportunities.outcome, 'lost'),
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        )
        .groupBy(crmOpportunities.lostReason)
        .orderBy(desc(count()));

      // By closing stage (at which stage deals were closed)
      const byStage = await db
        .select({
          stage: crmOpportunities.stage,
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`
          )
        )
        .groupBy(crmOpportunities.stage);

      // By owner (join with users for name)
      const byOwner = await db
        .select({
          ownerId: crmOpportunities.ownerId,
          ownerName: users.name,
          wonCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'won' THEN 1 ELSE 0 END`),
          lostCount: sum(sql<number>`CASE WHEN ${crmOpportunities.outcome} = 'lost' THEN 1 ELSE 0 END`),
          totalValue: sum(sql<number>`CAST(${crmOpportunities.amount} AS numeric)`),
        })
        .from(crmOpportunities)
        .leftJoin(users, eq(crmOpportunities.ownerId, users.id))
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.outcome} IN ('won', 'lost')`,
            gte(crmOpportunities.actualCloseDate, cutoffDate),
            sql`${crmOpportunities.actualCloseDate} IS NOT NULL`,
            sql`${crmOpportunities.ownerId} IS NOT NULL`
          )
        )
        .groupBy(crmOpportunities.ownerId, users.name)
        .orderBy(desc(sql`SUM(CAST(${crmOpportunities.amount} AS numeric))`));

      return {
        summary: {
          won,
          lost,
          winRate,
          avgWonDealSize: Number(Number(summary.avgWonDealSize || 0).toFixed(2)),
          avgLostDealSize: Number(Number(summary.avgLostDealSize || 0).toFixed(2)),
        },
        bySource: bySource.map((s) => {
          const sWon = Number(s.wonCount || 0);
          const sLost = Number(s.lostCount || 0);
          const sTotal = sWon + sLost;
          return {
            source: s.source || 'unknown',
            won: sWon,
            lost: sLost,
            winRate: sTotal > 0 ? Number(((sWon / sTotal) * 100).toFixed(2)) : 0,
            totalValue: Number(s.totalValue || 0),
          };
        }),
        byLostReason: byLostReason.map((r) => ({
          reason: r.reason || 'unspecified',
          count: Number(r.count),
          totalValue: Number(r.totalValue || 0),
        })),
        byStage: byStage.map((s) => {
          const sWon = Number(s.wonCount || 0);
          const sLost = Number(s.lostCount || 0);
          const sTotal = sWon + sLost;
          return {
            stage: s.stage,
            won: sWon,
            lost: sLost,
            winRate: sTotal > 0 ? Number(((sWon / sTotal) * 100).toFixed(2)) : 0,
          };
        }),
        byOwner: byOwner.map((o) => {
          const oWon = Number(o.wonCount || 0);
          const oLost = Number(o.lostCount || 0);
          const oTotal = oWon + oLost;
          return {
            ownerId: o.ownerId,
            ownerName: o.ownerName || 'Unknown',
            won: oWon,
            lost: oLost,
            winRate: oTotal > 0 ? Number(((oWon / oTotal) * 100).toFixed(2)) : 0,
            totalValue: Number(o.totalValue || 0),
          };
        }),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Pipeline Analytics'],
        summary: 'Get win/loss analysis',
        description:
          'Win/loss analysis broken down by source, lost reason, stage, and owner',
      },
    }
  )

  // ============================================================================
  // 5. PIPELINE HEALTH - Stale deals, aging analysis, overdue deals
  // ============================================================================
  .get(
    '/health',
    async ({ db, query }) => {
      const { workspaceId } = query;

      const now = new Date();
      const staleDaysThreshold = 14;
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - staleDaysThreshold);

      // Stale deals - no update in 14+ days and still open
      const staleDeals = await db
        .select({
          id: crmOpportunities.id,
          name: crmOpportunities.name,
          amount: crmOpportunities.amount,
          stage: crmOpportunities.stage,
          updatedAt: crmOpportunities.updatedAt,
          expectedCloseDate: crmOpportunities.expectedCloseDate,
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt),
            lte(crmOpportunities.updatedAt, staleDate)
          )
        )
        .orderBy(desc(sql`CAST(${crmOpportunities.amount} AS numeric)`))
        .limit(50);

      // Aging analysis - categorize open deals by age
      const agingData = await db
        .select({
          lessThan30Count: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 30 THEN 1 ELSE 0 END`
          ),
          lessThan30Value: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 30 THEN CAST(${crmOpportunities.amount} AS numeric) ELSE 0 END`
          ),
          thirtyTo60Count: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 30 AND EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 60 THEN 1 ELSE 0 END`
          ),
          thirtyTo60Value: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 30 AND EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 60 THEN CAST(${crmOpportunities.amount} AS numeric) ELSE 0 END`
          ),
          sixtyTo90Count: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 60 AND EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 90 THEN 1 ELSE 0 END`
          ),
          sixtyTo90Value: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 60 AND EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 < 90 THEN CAST(${crmOpportunities.amount} AS numeric) ELSE 0 END`
          ),
          moreThan90Count: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 90 THEN 1 ELSE 0 END`
          ),
          moreThan90Value: sum(
            sql<number>`CASE WHEN EXTRACT(EPOCH FROM (NOW() - ${crmOpportunities.createdAt})) / 86400 >= 90 THEN CAST(${crmOpportunities.amount} AS numeric) ELSE 0 END`
          ),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt)
          )
        );

      const aging = agingData[0];

      // Overdue deals count (expectedCloseDate < now and still open)
      const overdueResult = await db
        .select({
          overdueDeals: count(),
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.status, 'open'),
            isNull(crmOpportunities.deletedAt),
            sql`${crmOpportunities.expectedCloseDate} IS NOT NULL`,
            lte(crmOpportunities.expectedCloseDate, now)
          )
        );

      return {
        staleDeals: staleDeals.map((d) => {
          const daysSinceUpdate = Math.floor(
            (now.getTime() - new Date(d.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const isOverdue = d.expectedCloseDate
            ? new Date(d.expectedCloseDate) < now
            : false;

          return {
            id: d.id,
            name: d.name,
            amount: Number(d.amount || 0),
            stage: d.stage,
            daysSinceUpdate,
            expectedCloseDate: d.expectedCloseDate
              ? new Date(d.expectedCloseDate).toISOString()
              : null,
            isOverdue,
          };
        }),
        aging: {
          lessThan30: {
            count: Number(aging.lessThan30Count || 0),
            value: Number(aging.lessThan30Value || 0),
          },
          thirtyTo60: {
            count: Number(aging.thirtyTo60Count || 0),
            value: Number(aging.thirtyTo60Value || 0),
          },
          sixtyTo90: {
            count: Number(aging.sixtyTo90Count || 0),
            value: Number(aging.sixtyTo90Value || 0),
          },
          moreThan90: {
            count: Number(aging.moreThan90Count || 0),
            value: Number(aging.moreThan90Value || 0),
          },
        },
        overdueDeals: Number(overdueResult[0].overdueDeals || 0),
        staleDealCount: staleDeals.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Pipeline Analytics'],
        summary: 'Get pipeline health',
        description:
          'Pipeline health check including stale deals, aging analysis, and overdue deal count',
      },
    }
  );
