/**
 * Analytics Routes
 * Comprehensive analytics endpoints for Campaign Management & Research system
 */

import { Elysia, t } from 'elysia';
import {
  crmCampaigns,
  crmCampaignRecipients,
  crmCampaignMessages,
  crmResearchSessions,
  crmResearchQueries,
  crmResearchFindings,
  crmTimelineEvents,
} from '@agios/db/schema';
import { eq, and, isNull, gte, lte, count, avg, sum, sql, desc } from 'drizzle-orm';
import { getCampaignMetrics } from '../services/campaign-metrics';
import { getCampaignFunnel } from '../services/campaign-funnel';
import { getChannelPerformance, type DateRange } from '../services/channel-performance';
import { getCampaignCostROI } from '../services/campaign-cost-roi';
import { jobQueue } from '../../../lib/queue';
import { randomUUID } from 'crypto';
import {
  createExportJob,
  getExportJobStatus,
  type GenerateAnalyticsExportJob,
} from '../../../workers/generate-analytics-export';
import { promises as fs } from 'fs';

export const analyticsRoutes = new Elysia({ prefix: '/analytics' })
  // ============================================================================
  // CAMPAIGN METRICS (US-ANALYTICS-001)
  // ============================================================================
  .get(
    '/campaigns/:campaignId/metrics',
    async ({ db, params, query }) => {
      const { campaignId } = params;
      const { workspaceId } = query;

      const startTime = Date.now();

      // Get campaign metrics using optimized service
      const metrics = await getCampaignMetrics(db, workspaceId, campaignId);

      if (!metrics) {
        return {
          status: 404,
          error: 'Campaign not found or deleted',
        };
      }

      const queryTime = Date.now() - startTime;

      return {
        campaignId: metrics.campaignId,
        campaignName: metrics.campaignName,
        totalRecipients: metrics.totalRecipients,
        totalSent: metrics.totalSent,
        totalDelivered: metrics.totalDelivered,
        totalOpened: metrics.totalOpened,
        totalClicked: metrics.totalClicked,
        totalBounced: metrics.totalBounced,
        deliveryRate: metrics.deliveryRate,
        openRate: metrics.openRate,
        clickRate: metrics.clickRate,
        bounceRate: metrics.bounceRate,
        engagementScore: metrics.engagementScore,
        _meta: {
          queryTime,
          lastUpdated: new Date().toISOString(),
        },
      };
    },
    {
      params: t.Object({
        campaignId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get campaign metrics',
        description:
          'Get comprehensive metrics for a specific campaign including delivery, open, click rates and engagement score',
      },
    }
  )

  // ============================================================================
  // CAMPAIGN ANALYTICS (OVERVIEW)
  // ============================================================================
  .get(
    '/campaigns',
    async ({ db, query }) => {
      const { workspaceId, startDate, endDate, days } = query;

      // Calculate date range
      let dateFilter = sql`true`;
      if (startDate && endDate) {
        dateFilter = and(
          gte(crmCampaigns.createdAt, new Date(startDate)),
          lte(crmCampaigns.createdAt, new Date(endDate))
        );
      } else if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));
        dateFilter = gte(crmCampaigns.createdAt, daysAgo);
      }

      // Overall campaign metrics
      const campaignMetrics = await db
        .select({
          totalCampaigns: count(),
          activeCampaigns: sum(sql<number>`CASE WHEN status = 'active' THEN 1 ELSE 0 END`),
          completedCampaigns: sum(sql<number>`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`),
          draftCampaigns: sum(sql<number>`CASE WHEN status = 'draft' THEN 1 ELSE 0 END`),
          pausedCampaigns: sum(sql<number>`CASE WHEN status = 'paused' THEN 1 ELSE 0 END`),
          cancelledCampaigns: sum(sql<number>`CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END`),
          totalRecipients: sum(crmCampaigns.totalRecipients),
          totalSent: sum(crmCampaigns.totalSent),
          totalDelivered: sum(crmCampaigns.totalDelivered),
          totalOpened: sum(crmCampaigns.totalOpened),
          totalClicked: sum(crmCampaigns.totalClicked),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        );

      const metrics = campaignMetrics[0];

      // Calculate rates
      const deliveryRate =
        Number(metrics.totalSent) > 0
          ? (Number(metrics.totalDelivered) / Number(metrics.totalSent)) * 100
          : 0;
      const openRate =
        Number(metrics.totalDelivered) > 0
          ? (Number(metrics.totalOpened) / Number(metrics.totalDelivered)) * 100
          : 0;
      const clickRate =
        Number(metrics.totalOpened) > 0
          ? (Number(metrics.totalClicked) / Number(metrics.totalOpened)) * 100
          : 0;
      const ctr =
        Number(metrics.totalDelivered) > 0
          ? (Number(metrics.totalClicked) / Number(metrics.totalDelivered)) * 100
          : 0;

      // Channel breakdown
      const channelBreakdown = await db
        .select({
          channel: sql<string>`unnest(channels)`,
          campaignCount: count(),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        )
        .groupBy(sql`unnest(channels)`);

      // Performance by objective
      const objectiveBreakdown = await db
        .select({
          objective: crmCampaigns.objective,
          campaignCount: count(),
          totalSent: sum(crmCampaigns.totalSent),
          totalOpened: sum(crmCampaigns.totalOpened),
          totalClicked: sum(crmCampaigns.totalClicked),
          avgOpenRate: sql<number>`
            CASE
              WHEN SUM(${crmCampaigns.totalDelivered}) > 0
              THEN (SUM(${crmCampaigns.totalOpened})::float / SUM(${crmCampaigns.totalDelivered})::float * 100)
              ELSE 0
            END
          `,
          avgClickRate: sql<number>`
            CASE
              WHEN SUM(${crmCampaigns.totalOpened}) > 0
              THEN (SUM(${crmCampaigns.totalClicked})::float / SUM(${crmCampaigns.totalOpened})::float * 100)
              ELSE 0
            END
          `,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        )
        .groupBy(crmCampaigns.objective);

      // Time-series data (last 30 days by default, or custom range)
      const timeSeriesDays = days ? parseInt(days, 10) : 30;
      const timeSeriesData = await db
        .select({
          date: sql<string>`DATE(${crmCampaigns.createdAt})`,
          campaignsCreated: count(),
          recipientsAdded: sum(crmCampaigns.totalRecipients),
          messagesSent: sum(crmCampaigns.totalSent),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            gte(
              crmCampaigns.createdAt,
              startDate
                ? new Date(startDate)
                : new Date(Date.now() - timeSeriesDays * 24 * 60 * 60 * 1000)
            ),
            endDate ? lte(crmCampaigns.createdAt, new Date(endDate)) : sql`true`
          )
        )
        .groupBy(sql`DATE(${crmCampaigns.createdAt})`)
        .orderBy(sql`DATE(${crmCampaigns.createdAt})`);

      // Top performing campaigns
      const topCampaigns = await db
        .select({
          id: crmCampaigns.id,
          name: crmCampaigns.name,
          objective: crmCampaigns.objective,
          status: crmCampaigns.status,
          totalSent: crmCampaigns.totalSent,
          totalOpened: crmCampaigns.totalOpened,
          totalClicked: crmCampaigns.totalClicked,
          openRate: sql<number>`
            CASE
              WHEN ${crmCampaigns.totalDelivered} > 0
              THEN (${crmCampaigns.totalOpened}::float / ${crmCampaigns.totalDelivered}::float * 100)
              ELSE 0
            END
          `,
          clickRate: sql<number>`
            CASE
              WHEN ${crmCampaigns.totalOpened} > 0
              THEN (${crmCampaigns.totalClicked}::float / ${crmCampaigns.totalOpened}::float * 100)
              ELSE 0
            END
          `,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        )
        .orderBy(sql`
          CASE
            WHEN ${crmCampaigns.totalOpened} > 0
            THEN (${crmCampaigns.totalClicked}::float / ${crmCampaigns.totalOpened}::float * 100)
            ELSE 0
          END DESC
        `)
        .limit(10);

      // Average execution time for completed campaigns
      const executionMetrics = await db
        .select({
          avgExecutionTime: sql<number>`
            AVG(
              EXTRACT(EPOCH FROM (${crmCampaigns.endedAt} - ${crmCampaigns.startedAt}))
            ) / 3600
          `,
          completedCount: count(),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            eq(crmCampaigns.status, 'completed'),
            sql`${crmCampaigns.startedAt} IS NOT NULL`,
            sql`${crmCampaigns.endedAt} IS NOT NULL`,
            dateFilter
          )
        );

      return {
        serverTimestamp: new Date().toISOString(),
        metrics: {
          total: Number(metrics.totalCampaigns || 0),
          active: Number(metrics.activeCampaigns || 0),
          completed: Number(metrics.completedCampaigns || 0),
          draft: Number(metrics.draftCampaigns || 0),
          paused: Number(metrics.pausedCampaigns || 0),
          cancelled: Number(metrics.cancelledCampaigns || 0),
          totalRecipients: Number(metrics.totalRecipients || 0),
          totalSent: Number(metrics.totalSent || 0),
          totalDelivered: Number(metrics.totalDelivered || 0),
          totalOpened: Number(metrics.totalOpened || 0),
          totalClicked: Number(metrics.totalClicked || 0),
          deliveryRate: Number(deliveryRate.toFixed(2)),
          openRate: Number(openRate.toFixed(2)),
          clickRate: Number(clickRate.toFixed(2)),
          clickThroughRate: Number(ctr.toFixed(2)),
        },
        channelBreakdown: channelBreakdown.map((c) => ({
          channel: c.channel,
          count: Number(c.campaignCount),
        })),
        objectiveBreakdown: objectiveBreakdown.map((o) => ({
          objective: o.objective,
          count: Number(o.campaignCount),
          totalSent: Number(o.totalSent || 0),
          totalOpened: Number(o.totalOpened || 0),
          totalClicked: Number(o.totalClicked || 0),
          avgOpenRate: Number((o.avgOpenRate || 0).toFixed(2)),
          avgClickRate: Number((o.avgClickRate || 0).toFixed(2)),
        })),
        timeSeries: timeSeriesData.map((d) => ({
          date: d.date,
          campaignsCreated: Number(d.campaignsCreated),
          recipientsAdded: Number(d.recipientsAdded || 0),
          messagesSent: Number(d.messagesSent || 0),
        })),
        topPerformers: topCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          objective: c.objective,
          status: c.status,
          totalSent: Number(c.totalSent || 0),
          totalOpened: Number(c.totalOpened || 0),
          totalClicked: Number(c.totalClicked || 0),
          openRate: Number((c.openRate || 0).toFixed(2)),
          clickRate: Number((c.clickRate || 0).toFixed(2)),
        })),
        execution: {
          avgExecutionTimeHours: Number((Number(executionMetrics[0]?.avgExecutionTime) || 0).toFixed(2)),
          completedCount: Number(executionMetrics[0]?.completedCount || 0),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get campaign analytics',
        description: 'Comprehensive campaign performance metrics and breakdowns',
      },
    }
  )

  // ============================================================================
  // RESEARCH ANALYTICS
  // ============================================================================
  .get(
    '/research',
    async ({ db, query }) => {
      const { workspaceId, startDate, endDate, days } = query;

      // Calculate date range
      let dateFilter = sql`true`;
      if (startDate && endDate) {
        dateFilter = and(
          gte(crmResearchSessions.createdAt, new Date(startDate)),
          lte(crmResearchSessions.createdAt, new Date(endDate))
        );
      } else if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));
        dateFilter = gte(crmResearchSessions.createdAt, daysAgo);
      }

      // Overall research metrics
      const sessionMetrics = await db
        .select({
          totalSessions: count(),
          pendingSessions: sum(sql<number>`CASE WHEN status = 'pending' THEN 1 ELSE 0 END`),
          runningSessions: sum(sql<number>`CASE WHEN status = 'running' THEN 1 ELSE 0 END`),
          completedSessions: sum(sql<number>`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`),
          failedSessions: sum(sql<number>`CASE WHEN status = 'failed' THEN 1 ELSE 0 END`),
          stoppedSessions: sum(sql<number>`CASE WHEN status = 'stopped' THEN 1 ELSE 0 END`),
          totalQueries: sum(crmResearchSessions.totalQueries),
          totalFindings: sum(crmResearchSessions.totalFindings),
          totalCostCents: sum(crmResearchSessions.costCents),
        })
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, workspaceId),
            isNull(crmResearchSessions.deletedAt),
            dateFilter
          )
        );

      const metrics = sessionMetrics[0];

      // Findings breakdown
      const findingsMetrics = await db
        .select({
          totalFindings: count(),
          pendingFindings: sum(sql<number>`CASE WHEN ${crmResearchFindings.status} = 'pending' THEN 1 ELSE 0 END`),
          approvedFindings: sum(sql<number>`CASE WHEN ${crmResearchFindings.status} = 'approved' THEN 1 ELSE 0 END`),
          rejectedFindings: sum(sql<number>`CASE WHEN ${crmResearchFindings.status} = 'rejected' THEN 1 ELSE 0 END`),
          appliedFindings: sum(sql<number>`CASE WHEN applied = true THEN 1 ELSE 0 END`),
          avgConfidence: avg(crmResearchFindings.confidence),
        })
        .from(crmResearchFindings)
        .innerJoin(
          crmResearchSessions,
          eq(crmResearchFindings.sessionId, crmResearchSessions.id)
        )
        .where(
          and(
            eq(crmResearchFindings.workspaceId, workspaceId),
            dateFilter
          )
        );

      const findings = findingsMetrics[0];

      // Calculate rates
      const approvalRate =
        Number(findings.totalFindings) > 0
          ? ((Number(findings.approvedFindings || 0) / Number(findings.totalFindings)) * 100)
          : 0;
      const rejectionRate =
        Number(findings.totalFindings) > 0
          ? ((Number(findings.rejectedFindings || 0) / Number(findings.totalFindings)) * 100)
          : 0;
      const applicationRate =
        Number(findings.approvedFindings) > 0
          ? ((Number(findings.appliedFindings || 0) / Number(findings.approvedFindings)) * 100)
          : 0;
      const completionRate =
        Number(metrics.totalSessions) > 0
          ? ((Number(metrics.completedSessions || 0) / Number(metrics.totalSessions)) * 100)
          : 0;

      // Findings by field type
      const fieldTypeBreakdown = await db
        .select({
          field: crmResearchFindings.field,
          count: count(),
          avgConfidence: avg(crmResearchFindings.confidence),
          approvedCount: sum(sql<number>`CASE WHEN ${crmResearchFindings.status} = 'approved' THEN 1 ELSE 0 END`),
          appliedCount: sum(sql<number>`CASE WHEN applied = true THEN 1 ELSE 0 END`),
        })
        .from(crmResearchFindings)
        .innerJoin(
          crmResearchSessions,
          eq(crmResearchFindings.sessionId, crmResearchSessions.id)
        )
        .where(
          and(
            eq(crmResearchFindings.workspaceId, workspaceId),
            dateFilter
          )
        )
        .groupBy(crmResearchFindings.field)
        .orderBy(sql`count(*) DESC`)
        .limit(15);

      // Time-series data
      const timeSeriesDays = days ? parseInt(days, 10) : 30;
      const timeSeriesData = await db
        .select({
          date: sql<string>`DATE(${crmResearchSessions.createdAt})`,
          sessionsCreated: count(),
          queriesExecuted: sum(crmResearchSessions.totalQueries),
          findingsGenerated: sum(crmResearchSessions.totalFindings),
        })
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, workspaceId),
            isNull(crmResearchSessions.deletedAt),
            gte(
              crmResearchSessions.createdAt,
              startDate
                ? new Date(startDate)
                : new Date(Date.now() - timeSeriesDays * 24 * 60 * 60 * 1000)
            ),
            endDate ? lte(crmResearchSessions.createdAt, new Date(endDate)) : sql`true`
          )
        )
        .groupBy(sql`DATE(${crmResearchSessions.createdAt})`)
        .orderBy(sql`DATE(${crmResearchSessions.createdAt})`);

      // Scope breakdown
      const scopeBreakdown = await db
        .select({
          scope: crmResearchSessions.scope,
          sessionCount: count(),
          avgQueries: avg(crmResearchSessions.totalQueries),
          avgFindings: avg(crmResearchSessions.totalFindings),
          avgCost: avg(crmResearchSessions.costCents),
        })
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, workspaceId),
            isNull(crmResearchSessions.deletedAt),
            dateFilter
          )
        )
        .groupBy(crmResearchSessions.scope);

      return {
        serverTimestamp: new Date().toISOString(),
        sessions: {
          total: Number(metrics.totalSessions || 0),
          pending: Number(metrics.pendingSessions || 0),
          running: Number(metrics.runningSessions || 0),
          completed: Number(metrics.completedSessions || 0),
          failed: Number(metrics.failedSessions || 0),
          stopped: Number(metrics.stoppedSessions || 0),
          completionRate: Number(completionRate.toFixed(2)),
          totalQueries: Number(metrics.totalQueries || 0),
          totalFindings: Number(metrics.totalFindings || 0),
          totalCostCents: Number(metrics.totalCostCents || 0),
          totalCostDollars: Number((Number(metrics.totalCostCents || 0) / 100).toFixed(2)),
        },
        findings: {
          total: Number(findings.totalFindings || 0),
          pending: Number(findings.pendingFindings || 0),
          approved: Number(findings.approvedFindings || 0),
          rejected: Number(findings.rejectedFindings || 0),
          applied: Number(findings.appliedFindings || 0),
          avgConfidence: Number((findings.avgConfidence || 0).toFixed(2)),
          approvalRate: Number(approvalRate.toFixed(2)),
          rejectionRate: Number(rejectionRate.toFixed(2)),
          applicationRate: Number(applicationRate.toFixed(2)),
        },
        fieldTypeBreakdown: fieldTypeBreakdown.map((f) => ({
          field: f.field,
          count: Number(f.count),
          avgConfidence: Number((f.avgConfidence || 0).toFixed(2)),
          approvedCount: Number(f.approvedCount || 0),
          appliedCount: Number(f.appliedCount || 0),
          approvalRate:
            Number(f.count) > 0
              ? Number(((Number(f.approvedCount || 0) / Number(f.count)) * 100).toFixed(2))
              : 0,
        })),
        scopeBreakdown: scopeBreakdown.map((s) => ({
          scope: s.scope,
          sessionCount: Number(s.sessionCount),
          avgQueries: Number((s.avgQueries || 0).toFixed(2)),
          avgFindings: Number((s.avgFindings || 0).toFixed(2)),
          avgCostCents: Number((s.avgCost || 0).toFixed(2)),
        })),
        timeSeries: timeSeriesData.map((d) => ({
          date: d.date,
          sessionsCreated: Number(d.sessionsCreated),
          queriesExecuted: Number(d.queriesExecuted || 0),
          findingsGenerated: Number(d.findingsGenerated || 0),
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get research analytics',
        description: 'Comprehensive research session and findings metrics',
      },
    }
  )

  // ============================================================================
  // CAMPAIGN FUNNEL (US-ANALYTICS-002)
  // ============================================================================
  .get(
    '/campaigns/:campaignId/funnel',
    async ({ db, params, query }) => {
      const { campaignId } = params;
      const { workspaceId } = query;

      const startTime = Date.now();

      // Get campaign funnel using optimized service
      const funnel = await getCampaignFunnel(db, workspaceId, campaignId);

      if (!funnel) {
        return {
          status: 404,
          error: 'Campaign not found or deleted',
        };
      }

      const queryTime = Date.now() - startTime;

      // Format stages with rounded percentages
      const stages = funnel.stages.map((stage) => ({
        name: stage.name,
        count: stage.count,
        percentage: Number(stage.percentage.toFixed(1)),
      }));

      // Format conversion rates with 3 decimal precision
      const conversionRates = {
        recipientToLead: Number(funnel.conversionRates.recipientToLead.toFixed(3)),
        leadToQualified: Number(funnel.conversionRates.leadToQualified.toFixed(3)),
        qualifiedToOpportunity: Number(funnel.conversionRates.qualifiedToOpportunity.toFixed(3)),
        overallConversion: Number(funnel.conversionRates.overallConversion.toFixed(3)),
      };

      return {
        stages,
        conversionRates,
        _meta: {
          queryTime,
          lastUpdated: new Date().toISOString(),
        },
      };
    },
    {
      params: t.Object({
        campaignId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get campaign funnel',
        description:
          'Get 7-stage conversion funnel (Recipients → Delivered → Opened → Clicked → Leads → Qualified → Opportunities) with conversion rates',
      },
    }
  )

  // ============================================================================
  // CHANNEL PERFORMANCE (US-ANALYTICS-003)
  // ============================================================================
  .get(
    '/channel-performance',
    async ({ db, query }) => {
      const { workspaceId, dateRange = '30d' } = query;

      const startTime = Date.now();

      // Validate date range
      const validRanges: DateRange[] = ['7d', '30d', '90d', 'all'];
      const range = validRanges.includes(dateRange as DateRange) ? (dateRange as DateRange) : '30d';

      // Get channel performance using optimized service
      const performance = await getChannelPerformance(db, workspaceId, range);

      const queryTime = Date.now() - startTime;

      // Format performance metrics
      const channels = performance.map((channel) => ({
        channel: channel.channel,
        totalCampaigns: channel.totalCampaigns,
        totalSent: channel.totalSent,
        deliveryRate: Number(channel.deliveryRate.toFixed(3)),
        openRate: Number(channel.openRate.toFixed(3)),
        clickRate: Number(channel.clickRate.toFixed(3)),
        costPerSend: channel.costPerSend, // Placeholder (0 for now)
      }));

      return {
        serverTimestamp: new Date().toISOString(),
        dateRange: range,
        channels,
        _meta: {
          queryTime,
          lastUpdated: new Date().toISOString(),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        dateRange: t.Optional(t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d'), t.Literal('all')])),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get channel performance',
        description:
          'Get performance metrics by channel (email, SMS, WhatsApp) with delivery, open, and click rates',
      },
    }
  )

  // ============================================================================
  // COMBINED DASHBOARD METRICS
  // ============================================================================
  .get(
    '/dashboard',
    async ({ db, query }) => {
      const { workspaceId, days = '30' } = query;

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));

      // Campaign summary
      const campaignSummary = await db
        .select({
          total: count(),
          active: sum(sql<number>`CASE WHEN status = 'active' THEN 1 ELSE 0 END`),
          completed: sum(sql<number>`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`),
          totalSent: sum(crmCampaigns.totalSent),
          totalOpened: sum(crmCampaigns.totalOpened),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt)
          )
        );

      // Research summary
      const researchSummary = await db
        .select({
          total: count(),
          completed: sum(sql<number>`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`),
          totalFindings: sum(crmResearchSessions.totalFindings),
        })
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, workspaceId),
            isNull(crmResearchSessions.deletedAt)
          )
        );

      // Recent timeline events (last 10)
      const recentActivity = await db
        .select({
          id: crmTimelineEvents.id,
          entityType: crmTimelineEvents.entityType,
          entityId: crmTimelineEvents.entityId,
          eventType: crmTimelineEvents.eventType,
          eventCategory: crmTimelineEvents.eventCategory,
          eventLabel: crmTimelineEvents.eventLabel,
          summary: crmTimelineEvents.summary,
          occurredAt: crmTimelineEvents.occurredAt,
          actorType: crmTimelineEvents.actorType,
          actorName: crmTimelineEvents.actorName,
        })
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.workspaceId, workspaceId),
            isNull(crmTimelineEvents.deletedAt),
            sql`${crmTimelineEvents.eventType} LIKE 'campaign.%' OR ${crmTimelineEvents.eventType} LIKE 'research.%'`
          )
        )
        .orderBy(desc(crmTimelineEvents.occurredAt))
        .limit(10);

      // Growth metrics (WoW, MoM)
      // Convert dates to ISO strings for SQL interpolation (postgres.js requires strings, not Date objects)
      const weekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const twoWeeksAgoStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const twoMonthsAgoStr = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const weekGrowth = await db
        .select({
          campaignsThisWeek: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${weekAgoStr}::timestamptz THEN 1 END)`,
          campaignsLastWeek: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${twoWeeksAgoStr}::timestamptz AND ${crmCampaigns.createdAt} < ${weekAgoStr}::timestamptz THEN 1 END)`,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt)
          )
        );

      const monthGrowth = await db
        .select({
          campaignsThisMonth: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${monthAgoStr}::timestamptz THEN 1 END)`,
          campaignsLastMonth: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${twoMonthsAgoStr}::timestamptz AND ${crmCampaigns.createdAt} < ${monthAgoStr}::timestamptz THEN 1 END)`,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt)
          )
        );

      const weekData = weekGrowth[0];
      const monthData = monthGrowth[0];

      const campaignsWoW =
        Number(weekData.campaignsLastWeek) > 0
          ? ((Number(weekData.campaignsThisWeek) - Number(weekData.campaignsLastWeek)) /
              Number(weekData.campaignsLastWeek)) *
            100
          : 0;

      const campaignsMoM =
        Number(monthData.campaignsLastMonth) > 0
          ? ((Number(monthData.campaignsThisMonth) - Number(monthData.campaignsLastMonth)) /
              Number(monthData.campaignsLastMonth)) *
            100
          : 0;

      // Key performance indicators
      const campaign = campaignSummary[0];
      const research = researchSummary[0];

      return {
        serverTimestamp: new Date().toISOString(),
        summary: {
          campaigns: {
            total: Number(campaign.total || 0),
            active: Number(campaign.active || 0),
            completed: Number(campaign.completed || 0),
            totalSent: Number(campaign.totalSent || 0),
            totalOpened: Number(campaign.totalOpened || 0),
            openRate:
              Number(campaign.totalSent) > 0
                ? Number(((Number(campaign.totalOpened || 0) / Number(campaign.totalSent)) * 100).toFixed(2))
                : 0,
          },
          research: {
            total: Number(research.total || 0),
            completed: Number(research.completed || 0),
            totalFindings: Number(research.totalFindings || 0),
          },
        },
        recentActivity: recentActivity.map((event) => ({
          id: event.id,
          entityType: event.entityType,
          entityId: event.entityId,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          eventLabel: event.eventLabel,
          summary: event.summary,
          occurredAt: event.occurredAt,
          actorType: event.actorType,
          actorName: event.actorName,
        })),
        growth: {
          campaigns: {
            weekOverWeek: Number(campaignsWoW.toFixed(2)),
            monthOverMonth: Number(campaignsMoM.toFixed(2)),
            thisWeek: Number(weekData.campaignsThisWeek),
            thisMonth: Number(monthData.campaignsThisMonth),
          },
        },
        kpi: {
          campaignActiveRate:
            Number(campaign.total) > 0
              ? Number(((Number(campaign.active || 0) / Number(campaign.total)) * 100).toFixed(2))
              : 0,
          campaignCompletionRate:
            Number(campaign.total) > 0
              ? Number(((Number(campaign.completed || 0) / Number(campaign.total)) * 100).toFixed(2))
              : 0,
          researchCompletionRate:
            Number(research.total) > 0
              ? Number(((Number(research.completed || 0) / Number(research.total)) * 100).toFixed(2))
              : 0,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get dashboard analytics',
        description: 'Combined overview metrics for campaigns and research',
      },
    }
  )

  // ============================================================================
  // DELIVERY SUMMARY DASHBOARD (H.2)
  // ============================================================================
  .get(
    '/delivery-summary',
    async ({ db, query }) => {
      const { workspaceId, dateRange = '30d' } = query;

      const startTime = Date.now();

      // Calculate date filter
      let dateFilter = sql`true`;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[dateRange] || 30;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        dateFilter = gte(crmCampaigns.createdAt, daysAgo);
      }

      // Overall delivery metrics
      const overallMetrics = await db
        .select({
          totalSent: sum(crmCampaigns.totalSent),
          totalDelivered: sum(crmCampaigns.totalDelivered),
          totalBounced: sum(sql<number>`COALESCE(${crmCampaigns.totalSent}, 0) - COALESCE(${crmCampaigns.totalDelivered}, 0)`),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        );

      const overall = overallMetrics[0];
      const overallDeliveryRate =
        Number(overall.totalSent) > 0
          ? (Number(overall.totalDelivered) / Number(overall.totalSent)) * 100
          : 0;

      // Delivery by channel
      const channelMetrics = await db
        .select({
          channel: sql<string>`unnest(channels)`,
          totalSent: sum(crmCampaigns.totalSent),
          totalDelivered: sum(crmCampaigns.totalDelivered),
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            dateFilter
          )
        )
        .groupBy(sql`unnest(channels)`);

      // Format channel data
      const byChannel: Record<string, { sent: number; delivered: number; rate: number }> = {};
      for (const ch of channelMetrics) {
        const sent = Number(ch.totalSent || 0);
        const delivered = Number(ch.totalDelivered || 0);
        byChannel[ch.channel] = {
          sent,
          delivered,
          rate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0,
        };
      }

      // Top 5 campaigns by delivery rate
      const topCampaigns = await db
        .select({
          id: crmCampaigns.id,
          name: crmCampaigns.name,
          channel: sql<string>`(channels)[1]`,
          totalSent: crmCampaigns.totalSent,
          totalDelivered: crmCampaigns.totalDelivered,
          totalBounced: sql<number>`COALESCE(${crmCampaigns.totalSent}, 0) - COALESCE(${crmCampaigns.totalDelivered}, 0)`,
          deliveryRate: sql<number>`
            CASE
              WHEN ${crmCampaigns.totalSent} > 0
              THEN (${crmCampaigns.totalDelivered}::float / ${crmCampaigns.totalSent}::float * 100)
              ELSE 0
            END
          `,
          updatedAt: crmCampaigns.updatedAt,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            sql`${crmCampaigns.totalSent} > 0`,
            dateFilter
          )
        )
        .orderBy(sql`
          CASE
            WHEN ${crmCampaigns.totalSent} > 0
            THEN (${crmCampaigns.totalDelivered}::float / ${crmCampaigns.totalSent}::float * 100)
            ELSE 0
          END DESC
        `)
        .limit(5);

      // Bottom 5 campaigns by delivery rate (improvement candidates)
      const bottomCampaigns = await db
        .select({
          id: crmCampaigns.id,
          name: crmCampaigns.name,
          channel: sql<string>`(channels)[1]`,
          totalSent: crmCampaigns.totalSent,
          totalDelivered: crmCampaigns.totalDelivered,
          totalBounced: sql<number>`COALESCE(${crmCampaigns.totalSent}, 0) - COALESCE(${crmCampaigns.totalDelivered}, 0)`,
          deliveryRate: sql<number>`
            CASE
              WHEN ${crmCampaigns.totalSent} > 0
              THEN (${crmCampaigns.totalDelivered}::float / ${crmCampaigns.totalSent}::float * 100)
              ELSE 0
            END
          `,
          updatedAt: crmCampaigns.updatedAt,
        })
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            sql`${crmCampaigns.totalSent} > 0`,
            dateFilter
          )
        )
        .orderBy(sql`
          CASE
            WHEN ${crmCampaigns.totalSent} > 0
            THEN (${crmCampaigns.totalDelivered}::float / ${crmCampaigns.totalSent}::float * 100)
            ELSE 0
          END ASC
        `)
        .limit(5);

      // Recent delivery failures (bounced recipients)
      const recentFailures = await db
        .select({
          id: crmCampaignRecipients.id,
          campaignId: crmCampaignRecipients.campaignId,
          campaignName: crmCampaigns.name,
          recipientId: crmCampaignRecipients.contactId,
          channel: crmCampaignMessages.channel,
          status: crmCampaignRecipients.status,
          errorCode: crmCampaignRecipients.bounceType,
          errorMessage: sql<string>`COALESCE(${crmCampaignRecipients.bounceDescription}, ${crmCampaignRecipients.statusReason})`,
          sentAt: crmCampaignRecipients.sentAt,
        })
        .from(crmCampaignRecipients)
        .innerJoin(crmCampaigns, eq(crmCampaignRecipients.campaignId, crmCampaigns.id))
        .leftJoin(crmCampaignMessages, eq(crmCampaignRecipients.messageId, crmCampaignMessages.id))
        .where(
          and(
            eq(crmCampaignRecipients.workspaceId, workspaceId),
            isNull(crmCampaigns.deletedAt),
            sql`${crmCampaignRecipients.status} IN ('bounced', 'failed')`,
            dateFilter
          )
        )
        .orderBy(desc(crmCampaignRecipients.sentAt))
        .limit(10);

      const queryTime = Date.now() - startTime;

      return {
        serverTimestamp: new Date().toISOString(),
        dateRange,
        overallDeliveryRate: Number(overallDeliveryRate.toFixed(2)),
        totalSent: Number(overall.totalSent || 0),
        totalDelivered: Number(overall.totalDelivered || 0),
        totalBounced: Number(overall.totalBounced || 0),
        byChannel,
        topCampaigns: topCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          channel: c.channel || 'email',
          sent: Number(c.totalSent || 0),
          delivered: Number(c.totalDelivered || 0),
          bounced: Number(c.totalBounced || 0),
          deliveryRate: Number((c.deliveryRate || 0).toFixed(2)),
          lastUpdated: c.updatedAt?.toISOString() || null,
        })),
        bottomCampaigns: bottomCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          channel: c.channel || 'email',
          sent: Number(c.totalSent || 0),
          delivered: Number(c.totalDelivered || 0),
          bounced: Number(c.totalBounced || 0),
          deliveryRate: Number((c.deliveryRate || 0).toFixed(2)),
          lastUpdated: c.updatedAt?.toISOString() || null,
        })),
        recentFailures: recentFailures.map((f) => ({
          id: f.id,
          campaignId: f.campaignId,
          campaignName: f.campaignName,
          recipientId: f.recipientId,
          channel: f.channel,
          status: f.status,
          errorCode: f.errorCode,
          errorMessage: f.errorMessage,
          sentAt: f.sentAt?.toISOString() || null,
        })),
        _meta: {
          queryTime,
          lastUpdated: new Date().toISOString(),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        dateRange: t.Optional(t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d'), t.Literal('all')])),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get delivery summary dashboard (H.2)',
        description:
          'Comprehensive delivery analytics: overall rate, channel breakdown, top/bottom campaigns, and recent failures',
      },
    }
  )

  // ============================================================================
  // COST & ROI TRACKING (US-ANALYTICS-004)
  // ============================================================================
  .get(
    '/campaigns/:campaignId/cost-roi',
    async ({ db, params, query }) => {
      const { campaignId } = params;
      const { workspaceId } = query;

      const startTime = Date.now();

      // Get cost and ROI metrics using service
      const costROI = await getCampaignCostROI(db, workspaceId, campaignId);

      if (!costROI) {
        return {
          status: 404,
          error: 'Campaign not found or deleted',
        };
      }

      const queryTime = Date.now() - startTime;

      return {
        campaignId: costROI.campaignId,
        campaignName: costROI.campaignName,
        totalCost: costROI.totalCost,
        costPerLead: costROI.costPerLead,
        costPerAcquisition: costROI.costPerAcquisition,
        estimatedRevenue: costROI.estimatedRevenue,
        roi: costROI.roi,
        roiIndicator: costROI.roiIndicator,
        leadsCreated: costROI.leadsCreated,
        opportunitiesCreated: costROI.opportunitiesCreated,
        _meta: {
          queryTime,
          lastUpdated: new Date().toISOString(),
        },
      };
    },
    {
      params: t.Object({
        campaignId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get campaign cost & ROI',
        description:
          'Get financial performance metrics: total cost, cost-per-lead, cost-per-acquisition, revenue, and ROI percentage',
      },
    }
  )

  // ============================================================================
  // EXPORT FUNCTIONALITY (US-ANALYTICS-005)
  // ============================================================================
  .post(
    '/export',
    async ({ body, query, set }) => {
      const { campaignId, exportType } = body;
      const { workspaceId } = query;

      // Validate export type (redundant safety check — Elysia schema validates this)
      const validTypes = ['campaign_metrics', 'funnel_data', 'channel_performance', 'recipient_details'];
      if (!validTypes.includes(exportType)) {
        set.status = 400;
        return { error: `Invalid export type. Must be one of: ${validTypes.join(', ')}` };
      }

      // Generate unique job ID
      const jobId = randomUUID();

      // Create job record
      createExportJob(jobId);

      // Queue background job
      await jobQueue.send<GenerateAnalyticsExportJob>(
        'generate-analytics-export',
        {
          jobId,
          workspaceId,
          campaignId,
          exportType: exportType as any,
        },
        {
          priority: 10,
          retryLimit: 2,
        }
      );

      return {
        jobId,
        status: 'pending',
        downloadUrl: null,
      };
    },
    {
      body: t.Object({
        campaignId: t.Optional(t.Union([t.String(), t.Null()])),
        exportType: t.Union([
          t.Literal('campaign_metrics'),
          t.Literal('funnel_data'),
          t.Literal('channel_performance'),
          t.Literal('recipient_details'),
        ]),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Create analytics export job',
        description:
          'Create a background job to export campaign analytics data to CSV. Returns job ID to poll for status.',
      },
    }
  )

  .get(
    '/export/:jobId/status',
    async ({ params, query, set }) => {
      const { jobId } = params;
      const { workspaceId } = query;

      // Get job status
      const job = getExportJobStatus(jobId);

      if (!job) {
        set.status = 404;
        return { error: 'Export job not found' };
      }

      return {
        jobId,
        status: job.status,
        downloadUrl: job.status === 'completed' ? job.downloadUrl : null,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() || null,
      };
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Get export job status',
        description:
          'Check the status of an analytics export job. Returns download URL when completed.',
      },
    }
  )

  .get(
    '/export/:jobId/download',
    async ({ params, query, set }) => {
      const { jobId } = params;
      const { workspaceId } = query;

      // Get job status
      const job = getExportJobStatus(jobId);

      if (!job) {
        set.status = 404;
        return { error: 'Export job not found' };
      }

      if (job.status !== 'completed') {
        set.status = 400;
        return { error: `Export job not ready. Status: ${job.status}` };
      }

      if (!job.filePath) {
        set.status = 500;
        return { error: 'Export file not found' };
      }

      try {
        // Read file from disk
        const csvData = await fs.readFile(job.filePath, 'utf-8');

        // Set headers for CSV download
        set.headers['Content-Type'] = 'text/csv; charset=utf-8';
        set.headers['Content-Disposition'] = `attachment; filename="export-${jobId}.csv"`;

        return csvData;
      } catch (error) {
        console.error('Failed to read export file:', error);
        set.status = 500;
        return { error: 'Failed to download export file' };
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Analytics'],
        summary: 'Download export file',
        description: 'Download the generated CSV export file. Available for 1 hour after completion.',
      },
    }
  );
