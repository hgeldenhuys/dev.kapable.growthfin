/**
 * Lead Routing Routes (US-LEAD-AI-011)
 * API endpoints for automated lead routing
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { agentProfiles, routingRules, leadRoutingHistory } from '@agios/db';
import { and, eq, desc } from 'drizzle-orm';
import { createRoutingService } from '../../../services/ai/routing-service';
import { jobQueue } from '../../../lib/queue';

export const routingRoutes = new Elysia({ prefix: '/routing' })
  /**
   * POST /api/v1/crm/routing/leads/:leadId
   * Manually trigger lead routing
   */
  .post(
    '/leads/:leadId',
    async ({ params, query, body, set }) => {
      const { leadId } = params;
      const { workspaceId } = query;
      const { routingStrategy = 'balanced', prioritize, constraints } = body;

      try {
        const service = createRoutingService();
        const result = await service.routeLead(leadId, workspaceId, {
          strategy: routingStrategy,
          prioritize,
          constraints,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error: any) {
        set.status = 400;
        return {
          success: false,
          error: error.message,
          code: error.message.includes('No available agents')
            ? 'NO_AVAILABLE_AGENTS'
            : error.message.includes('already assigned')
              ? 'LEAD_ALREADY_ASSIGNED'
              : 'ROUTING_FAILED',
        };
      }
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        routingStrategy: t.Optional(
          t.Union([
            t.Literal('balanced'),
            t.Literal('skill_match'),
            t.Literal('round_robin'),
            t.Literal('predictive'),
          ])
        ),
        prioritize: t.Optional(t.Array(t.String())),
        constraints: t.Optional(
          t.Object({
            maxLeadsPerAgent: t.Optional(t.Number()),
            requiredSkills: t.Optional(t.Array(t.String())),
          })
        ),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Route lead to agent',
        description: 'Manually trigger lead routing to best-fit agent',
      },
    }
  )

  /**
   * POST /api/v1/crm/routing/leads/:leadId/queue
   * Queue lead for async routing (background job)
   */
  .post(
    '/leads/:leadId/queue',
    async ({ params, query, body }) => {
      const { leadId } = params;
      const { workspaceId } = query;
      const { routingStrategy = 'balanced' } = body;

      const jobId = await jobQueue.send('route-lead', {
        leadId,
        workspaceId,
        trigger: 'manual',
        routingStrategy,
      });

      return {
        success: true,
        jobId,
        message: 'Lead routing queued for background processing',
      };
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        routingStrategy: t.Optional(
          t.Union([
            t.Literal('balanced'),
            t.Literal('skill_match'),
            t.Literal('round_robin'),
            t.Literal('predictive'),
          ])
        ),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Queue lead routing',
        description: 'Queue lead for async routing (background job)',
      },
    }
  )

  /**
   * GET /api/v1/crm/routing/agents/capacity
   * Get agent capacity overview
   */
  .get(
    '/agents/capacity',
    async ({ query }) => {
      const { workspaceId } = query;

      const service = createRoutingService();
      const agents = await service.getAgentCapacity(workspaceId);

      return {
        agents,
        summary: {
          total_agents: agents.length,
          available_agents: agents.filter((a) => a.availability_status === 'available').length,
          at_capacity: agents.filter((a) => a.current_leads >= a.max_leads).length,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Get agent capacity',
        description: 'Get overview of agent workload and availability',
      },
    }
  )

  /**
   * GET /api/v1/crm/routing/history/:leadId
   * Get routing history for a lead
   */
  .get(
    '/history/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      const history = await db.query.leadRoutingHistory.findMany({
        where: and(
          eq(leadRoutingHistory.leadId, leadId),
          eq(leadRoutingHistory.workspaceId, workspaceId)
        ),
        orderBy: [desc(leadRoutingHistory.routedAt)],
      });

      return {
        lead_id: leadId,
        routing_count: history.length,
        history: history.map((h) => ({
          routing_id: h.id,
          routed_at: h.routedAt,
          to_agent_id: h.toAgentId,
          from_agent_id: h.fromAgentId,
          routing_strategy: h.routingStrategy,
          routing_score: h.routingScore,
          routing_reason: h.routingReason,
          was_manual: h.wasManualOverride,
          accepted_at: h.acceptedAt,
        })),
      };
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Get routing history',
        description: 'Get routing history for a lead',
      },
    }
  )

  /**
   * GET /api/v1/crm/routing/rules
   * List routing rules
   */
  .get(
    '/rules',
    async ({ query }) => {
      const { workspaceId } = query;

      const rules = await db.query.routingRules.findMany({
        where: eq(routingRules.workspaceId, workspaceId),
        orderBy: [desc(routingRules.priority)],
      });

      return {
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          priority: r.priority,
          is_active: r.isActive,
          conditions: r.conditions,
          assign_to_agent_id: r.assignToAgentId,
          assign_to_team: r.assignToTeam,
          routing_strategy: r.routingStrategy,
          created_at: r.createdAt,
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'List routing rules',
        description: 'Get all routing rules for workspace',
      },
    }
  )

  /**
   * POST /api/v1/crm/routing/rules
   * Create routing rule
   */
  .post(
    '/rules',
    async ({ query, body }) => {
      const { workspaceId, userId } = query;
      const { name, description, priority, conditions, assignToAgentId, assignToTeam, routingStrategy, isActive } = body;

      const createdBy = userId || null;

      const [rule] = await db
        .insert(routingRules)
        .values({
          workspaceId,
          name,
          description,
          priority: priority ?? 0,
          conditions,
          assignToAgentId,
          assignToTeam,
          routingStrategy,
          isActive: isActive ?? true,
          createdBy,
        })
        .returning();

      return {
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
          is_active: rule.isActive,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
      }),
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        conditions: t.Any(), // JSONB
        assignToAgentId: t.Optional(t.String()),
        assignToTeam: t.Optional(t.String()),
        routingStrategy: t.Optional(
          t.Union([
            t.Literal('balanced'),
            t.Literal('skill_match'),
            t.Literal('round_robin'),
            t.Literal('predictive'),
          ])
        ),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Create routing rule',
        description: 'Create new routing rule',
      },
    }
  )

  /**
   * PATCH /api/v1/crm/routing/rules/:ruleId
   * Update routing rule
   */
  .patch(
    '/rules/:ruleId',
    async ({ params, query, body }) => {
      const { ruleId } = params;
      const { workspaceId } = query;

      const [updated] = await db
        .update(routingRules)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(and(eq(routingRules.id, ruleId), eq(routingRules.workspaceId, workspaceId)))
        .returning();

      if (!updated) {
        return {
          success: false,
          error: 'Rule not found',
        };
      }

      return {
        success: true,
        rule: updated,
      };
    },
    {
      params: t.Object({
        ruleId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        conditions: t.Optional(t.Any()),
        assignToAgentId: t.Optional(t.String()),
        assignToTeam: t.Optional(t.String()),
        routingStrategy: t.Optional(
          t.Union([
            t.Literal('balanced'),
            t.Literal('skill_match'),
            t.Literal('round_robin'),
            t.Literal('predictive'),
          ])
        ),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Update routing rule',
        description: 'Update existing routing rule',
      },
    }
  )

  /**
   * DELETE /api/v1/crm/routing/rules/:ruleId
   * Deactivate routing rule
   */
  .delete(
    '/rules/:ruleId',
    async ({ params, query }) => {
      const { ruleId } = params;
      const { workspaceId } = query;

      const [deactivated] = await db
        .update(routingRules)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(routingRules.id, ruleId), eq(routingRules.workspaceId, workspaceId)))
        .returning();

      if (!deactivated) {
        return {
          success: false,
          error: 'Rule not found',
        };
      }

      return {
        success: true,
        message: 'Rule deactivated',
      };
    },
    {
      params: t.Object({
        ruleId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Routing'],
        summary: 'Deactivate routing rule',
        description: 'Deactivate routing rule (soft delete)',
      },
    }
  );
