/**
 * Automation Routes (Phase U)
 * REST endpoints for automation analytics, workflow approvals, and lead routing rules.
 */

import { Elysia, t } from 'elysia';
import { automationAnalyticsService } from '../services/automation-analytics.service';
import { leadRoutingService } from '../services/lead-routing.service';
import {
  crmWorkflowApprovals,
  crmLeads,
} from '@agios/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Automation Routes
// ============================================================================

export const automationRoutes = new Elysia({ prefix: '/automation' })
  // ==========================================================================
  // Analytics
  // ==========================================================================
  .get(
    '/analytics/workflows',
    async ({ db, query }) => {
      const analytics = await automationAnalyticsService.getWorkflowAnalytics(
        db,
        query.workspaceId
      );
      return analytics;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Workflow performance analytics',
        description: 'Get workflow performance analytics including enrollment rates, completion rates, and per-workflow statistics',
      },
    }
  )
  .get(
    '/analytics/triggers',
    async ({ db, query }) => {
      const analytics = await automationAnalyticsService.getTriggerAnalytics(
        db,
        query.workspaceId
      );
      return analytics;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Trigger effectiveness analytics',
        description: 'Get trigger effectiveness analytics including fire counts and per-trigger statistics',
      },
    }
  )
  .get(
    '/analytics/approvals',
    async ({ db, query }) => {
      const stats = await automationAnalyticsService.getApprovalStats(
        db,
        query.workspaceId
      );
      return stats;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Approval queue statistics',
        description: 'Get approval queue statistics including pending, approved, rejected, expired counts and average decision time',
      },
    }
  )
  .get(
    '/analytics/routing',
    async ({ db, query }) => {
      const stats = await automationAnalyticsService.getRoutingStats(
        db,
        query.workspaceId
      );
      return stats;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Lead routing statistics',
        description: 'Get lead routing rule statistics including match counts and per-rule performance',
      },
    }
  )

  // ==========================================================================
  // Approval Queue
  // ==========================================================================
  .get(
    '/approvals',
    async ({ db, query }) => {
      let conditions = [eq(crmWorkflowApprovals.workspaceId, query.workspaceId)];

      // Build query with optional status filter
      const baseQuery = db
        .select()
        .from(crmWorkflowApprovals)
        .where(
          query.status
            ? and(
                eq(crmWorkflowApprovals.workspaceId, query.workspaceId),
                eq(crmWorkflowApprovals.status, query.status)
              )
            : eq(crmWorkflowApprovals.workspaceId, query.workspaceId)
        )
        .orderBy(desc(crmWorkflowApprovals.requestedAt));

      const approvals = await baseQuery;
      return { approvals };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'List approvals',
        description: 'List workflow approval requests, optionally filtered by status (pending, approved, rejected, expired)',
      },
    }
  )
  .post(
    '/approvals/:id/approve',
    async ({ db, params, body, set }) => {
      try {
        const [approval] = await db
          .select()
          .from(crmWorkflowApprovals)
          .where(
            and(
              eq(crmWorkflowApprovals.id, params.id),
              eq(crmWorkflowApprovals.workspaceId, body.workspaceId)
            )
          );

        if (!approval) {
          set.status = 404;
          return { error: 'Approval not found' };
        }

        if (approval.status !== 'pending') {
          set.status = 400;
          return { error: `Approval is already ${approval.status}` };
        }

        const [updated] = await db
          .update(crmWorkflowApprovals)
          .set({
            status: 'approved',
            decidedBy: body.decidedBy ?? null,
            decidedAt: new Date(),
            decisionNotes: body.notes ?? null,
          })
          .where(eq(crmWorkflowApprovals.id, params.id))
          .returning();

        return updated;
      } catch (error) {
        console.error('[automation/approvals/approve POST] Error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to approve',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        decidedBy: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Approve a workflow step',
        description: 'Approve a pending workflow step approval request',
      },
    }
  )
  .post(
    '/approvals/:id/reject',
    async ({ db, params, body, set }) => {
      try {
        const [approval] = await db
          .select()
          .from(crmWorkflowApprovals)
          .where(
            and(
              eq(crmWorkflowApprovals.id, params.id),
              eq(crmWorkflowApprovals.workspaceId, body.workspaceId)
            )
          );

        if (!approval) {
          set.status = 404;
          return { error: 'Approval not found' };
        }

        if (approval.status !== 'pending') {
          set.status = 400;
          return { error: `Approval is already ${approval.status}` };
        }

        const [updated] = await db
          .update(crmWorkflowApprovals)
          .set({
            status: 'rejected',
            decidedBy: body.decidedBy ?? null,
            decidedAt: new Date(),
            decisionNotes: body.notes ?? null,
          })
          .where(eq(crmWorkflowApprovals.id, params.id))
          .returning();

        return updated;
      } catch (error) {
        console.error('[automation/approvals/reject POST] Error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to reject',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        decidedBy: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Reject a workflow step',
        description: 'Reject a pending workflow step approval request',
      },
    }
  )

  // ==========================================================================
  // Lead Routing Rules
  // ==========================================================================
  .get(
    '/routing-rules',
    async ({ db, query }) => {
      const rules = await leadRoutingService.listRules(db, query.workspaceId);
      return { rules };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'List routing rules',
        description: 'List all lead routing rules for a workspace, ordered by priority (highest first)',
      },
    }
  )
  .post(
    '/routing-rules',
    async ({ db, body, set }) => {
      try {
        const rule = await leadRoutingService.createRule(db, {
          workspaceId: body.workspaceId,
          name: body.name,
          description: body.description,
          priority: body.priority,
          isActive: body.isActive,
          conditions: body.conditions,
          assignToUserId: body.assignToUserId,
          assignToTeam: body.assignToTeam,
          roundRobin: body.roundRobin,
          createdBy: body.createdBy,
        });

        set.status = 201;
        return rule;
      } catch (error) {
        console.error('[automation/routing-rules POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create routing rule',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
        conditions: t.Any(),
        assignToUserId: t.Optional(t.String()),
        assignToTeam: t.Optional(t.String()),
        roundRobin: t.Optional(t.Boolean()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Create routing rule',
        description: 'Create a new lead routing rule with conditions and assignment target',
      },
    }
  )
  .patch(
    '/routing-rules/:id',
    async ({ db, params, body, set }) => {
      try {
        const updated = await leadRoutingService.updateRule(db, params.id, body.workspaceId, {
          name: body.name,
          description: body.description,
          priority: body.priority,
          isActive: body.isActive,
          conditions: body.conditions,
          assignToUserId: body.assignToUserId,
          assignToTeam: body.assignToTeam,
          roundRobin: body.roundRobin,
        });

        if (!updated) {
          set.status = 404;
          return { error: 'Routing rule not found' };
        }

        return updated;
      } catch (error) {
        console.error('[automation/routing-rules PATCH] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to update routing rule',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
        conditions: t.Optional(t.Any()),
        assignToUserId: t.Optional(t.String()),
        assignToTeam: t.Optional(t.String()),
        roundRobin: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Update routing rule',
        description: 'Update an existing lead routing rule',
      },
    }
  )
  .delete(
    '/routing-rules/:id',
    async ({ db, params, query, set }) => {
      try {
        await leadRoutingService.deleteRule(db, params.id, query.workspaceId);
        return { success: true };
      } catch (error) {
        console.error('[automation/routing-rules DELETE] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to delete routing rule',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Delete routing rule',
        description: 'Delete a lead routing rule',
      },
    }
  )
  .post(
    '/routing-rules/test',
    async ({ db, body, set }) => {
      try {
        // Get the lead data if leadId is provided
        let leadData: Record<string, unknown> = body.leadData ?? {};

        if (body.leadId) {
          const [lead] = await db
            .select()
            .from(crmLeads)
            .where(
              and(
                eq(crmLeads.id, body.leadId),
                eq(crmLeads.workspaceId, body.workspaceId)
              )
            );

          if (!lead) {
            set.status = 404;
            return { error: 'Lead not found' };
          }

          // Convert lead record to plain object for condition evaluation
          leadData = { ...lead } as Record<string, unknown>;
        }

        // Test routing without actually assigning
        const rules = await leadRoutingService.listRules(db, body.workspaceId);
        const matches: Array<{ ruleId: string; name: string; priority: number }> = [];

        for (const rule of rules) {
          if (!rule.isActive) continue;
          const conditions = rule.conditions as any;
          // We need to evaluate conditions - use the service's internal logic
          // For test mode, we just check which rules would match
          const conditionArray = Array.isArray(conditions) ? conditions : [conditions];
          let allMatch = true;
          for (const cond of conditionArray) {
            const fieldValue = leadData[cond.field];
            let condMatch = false;
            switch (cond.operator) {
              case 'equals':
                condMatch = fieldValue === cond.value;
                break;
              case 'not_equals':
                condMatch = fieldValue !== cond.value;
                break;
              case 'contains':
                condMatch = typeof fieldValue === 'string' && typeof cond.value === 'string' &&
                  fieldValue.toLowerCase().includes(cond.value.toLowerCase());
                break;
              case 'not_contains':
                condMatch = typeof fieldValue === 'string' && typeof cond.value === 'string' &&
                  !fieldValue.toLowerCase().includes(cond.value.toLowerCase());
                break;
              case 'greater_than':
                condMatch = typeof fieldValue === 'number' && typeof cond.value === 'number' &&
                  fieldValue > cond.value;
                break;
              case 'less_than':
                condMatch = typeof fieldValue === 'number' && typeof cond.value === 'number' &&
                  fieldValue < cond.value;
                break;
              case 'in':
                condMatch = Array.isArray(cond.value) && cond.value.includes(fieldValue);
                break;
              case 'not_in':
                condMatch = Array.isArray(cond.value) && !cond.value.includes(fieldValue);
                break;
              case 'exists':
                condMatch = fieldValue !== undefined && fieldValue !== null;
                break;
              case 'not_exists':
                condMatch = fieldValue === undefined || fieldValue === null;
                break;
              default:
                condMatch = false;
            }
            if (!condMatch) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            matches.push({
              ruleId: rule.id,
              name: rule.name,
              priority: rule.priority,
            });
          }
        }

        return {
          totalRulesEvaluated: rules.filter((r) => r.isActive).length,
          matchedRules: matches,
          wouldAssignTo: matches.length > 0
            ? rules.find((r) => r.id === matches[0].ruleId)?.assignToUserId ?? null
            : null,
        };
      } catch (error) {
        console.error('[automation/routing-rules/test POST] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to test routing rules',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        leadId: t.Optional(t.String()),
        leadData: t.Optional(t.Record(t.String(), t.Any())),
      }),
      detail: {
        tags: ['Automation'],
        summary: 'Test routing rules',
        description: 'Test which routing rules would match a given lead without actually routing. Provide either leadId to test with an existing lead, or leadData for ad-hoc testing.',
      },
    }
  );
