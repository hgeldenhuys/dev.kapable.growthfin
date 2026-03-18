/**
 * Lead Health API Routes
 * Endpoints for accessing and managing lead health scores
 * Story: US-LEAD-AI-013
 */

import { Elysia, t } from 'elysia';
import { db, leadHealthScores, healthScoreHistory, crmLeads } from '@agios/db';
import { eq, and, inArray, desc, asc } from 'drizzle-orm';
import { healthService } from '../../../services/ai/health-service';
import { jobQueue } from '../../../lib/queue';

export const healthRoutes = new Elysia({ prefix: '/health' })
  /**
   * GET /api/v1/crm/leads/:leadId/health
   * Get current health score for a specific lead
   */
  .get(
    '/leads/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      const healthScore = await db.query.leadHealthScores.findFirst({
        where: and(eq(leadHealthScores.leadId, leadId), eq(leadHealthScores.workspaceId, workspaceId)),
        with: {
          lead: true,
        },
      });

      if (!healthScore) {
        // Gracefully handle missing health score
        return {
          calculated: false,
          lead_id: leadId,
          message: 'Health score not yet calculated',
          calculate_url: `/api/v1/crm/health/leads/${leadId}/calculate?workspaceId=${workspaceId}`,
        };
      }

      return {
        calculated: true,
        lead_id: healthScore.leadId,
        lead_name: healthScore.lead?.name,
        health_score: healthScore.healthScore,
        health_status: healthScore.healthStatus,
        trend: healthScore.trend,
        engagement_score: healthScore.engagementScore,
        responsiveness_score: healthScore.responsivenessScore,
        activity_score: healthScore.activityScore,
        relationship_score: healthScore.relationshipScore,
        risk_factors: healthScore.riskFactors,
        positive_factors: healthScore.positiveFactors,
        recommended_actions: healthScore.recommendedActions,
        last_calculated: healthScore.calculatedAt,
      };
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Get lead health score',
        description: 'Get current health score and factors for a specific lead',
      },
    }
  )

  /**
   * POST /api/v1/crm/leads/:leadId/health/calculate
   * Manually trigger health calculation for a lead
   */
  .post(
    '/leads/:leadId/calculate',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      // Queue health calculation job
      await jobQueue.send('calculate-health', {
        leadId,
        workspaceId,
        batchAll: false,
      });

      return {
        message: 'Health calculation queued',
        lead_id: leadId,
      };
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Calculate lead health',
        description: 'Manually trigger health score calculation for a specific lead',
      },
    }
  )

  /**
   * GET /api/v1/crm/health/at-risk
   * Get all at-risk and critical leads in workspace
   */
  .get(
    '/at-risk',
    async ({ query, set }) => {
      const { workspaceId } = query;

      try {
        const atRiskLeads = await db.query.leadHealthScores.findMany({
          where: and(
            eq(leadHealthScores.workspaceId, workspaceId),
            inArray(leadHealthScores.healthStatus, ['critical', 'at_risk'])
          ),
          orderBy: [asc(leadHealthScores.healthScore)], // Worst first
          limit: 100,
          with: {
            lead: true,
          },
        });

        return {
          count: atRiskLeads.length,
          leads: atRiskLeads.map((h) => ({
            lead_id: h.leadId,
            lead_name: h.lead?.name,
            lead_email: h.lead?.email,
            health_score: h.healthScore,
            health_status: h.healthStatus,
            trend: h.trend,
            risk_factors: h.riskFactors,
            recommended_actions: h.recommendedActions,
            calculated_at: h.calculatedAt,
          })),
        };
      } catch (error) {
        console.error('[health/at-risk] Error fetching at-risk leads:', error);
        set.status = 500;
        return {
          error: 'Failed to fetch at-risk leads',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Get at-risk leads',
        description: 'List all leads with critical or at-risk health status',
      },
    }
  )

  /**
   * GET /api/v1/crm/health/history/:leadId
   * Get health score history for trend analysis
   */
  .get(
    '/history/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId, days = '30' } = query;

      const daysAgo = parseInt(days, 10);
      const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const history = await db.query.healthScoreHistory.findMany({
        where: and(
          eq(healthScoreHistory.leadId, leadId),
          eq(healthScoreHistory.workspaceId, workspaceId)
        ),
        orderBy: [desc(healthScoreHistory.calculatedAt)],
        limit: daysAgo,
      });

      return {
        lead_id: leadId,
        history: history.map((h) => ({
          health_score: h.healthScore,
          health_status: h.healthStatus,
          score_delta: h.scoreDelta,
          status_changed: h.statusChanged,
          calculated_at: h.calculatedAt,
        })),
      };
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Health'],
        summary: 'Get health score history',
        description: 'Get historical health scores for trend charting',
      },
    }
  )

  /**
   * GET /api/v1/crm/health/dashboard
   * Get health dashboard overview for workspace
   */
  .get(
    '/dashboard',
    async ({ query }) => {
      const { workspaceId } = query;

      // Get counts by status
      const healthScores = await db.query.leadHealthScores.findMany({
        where: eq(leadHealthScores.workspaceId, workspaceId),
      });

      const statusCounts = {
        excellent: 0,
        healthy: 0,
        at_risk: 0,
        critical: 0,
      };

      const trendCounts = {
        improving: 0,
        stable: 0,
        declining: 0,
      };

      for (const score of healthScores) {
        statusCounts[score.healthStatus]++;
        trendCounts[score.trend]++;
      }

      // Calculate average health score
      const avgHealthScore =
        healthScores.length > 0
          ? Math.round(healthScores.reduce((sum, s) => sum + s.healthScore, 0) / healthScores.length)
          : 0;

      return {
        total_leads: healthScores.length,
        average_health_score: avgHealthScore,
        status_breakdown: statusCounts,
        trend_breakdown: trendCounts,
        at_risk_count: statusCounts.at_risk + statusCounts.critical,
      };
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Get health dashboard',
        description: 'Get overview of lead health across workspace',
      },
    }
  )

  /**
   * POST /api/v1/crm/health/calculate-all
   * Manually trigger health calculation for all leads
   */
  .post(
    '/calculate-all',
    async ({ query }) => {
      const { workspaceId } = query;

      // Queue batch calculation job
      await jobQueue.send('calculate-health-all', {
        workspaceId,
        batchAll: true,
      });

      return {
        message: 'Batch health calculation queued for all leads',
        workspace_id: workspaceId,
      };
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Calculate all lead health',
        description: 'Manually trigger health score calculation for all leads in workspace',
      },
    }
  );
