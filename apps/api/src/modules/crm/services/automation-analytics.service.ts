/**
 * Automation Analytics Service (Phase U)
 * Provides workflow performance, trigger effectiveness, approval queue, and lead routing analytics.
 */

import type { Database } from '@agios/db';
import {
  campaignWorkflows,
  campaignWorkflowEnrollments,
  campaignTriggers,
  crmWorkflowApprovals,
  crmLeadRoutingRules,
} from '@agios/db/schema';
import { eq, and, count, sql, avg, desc } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowAnalytics {
  totalWorkflows: number;
  activeWorkflows: number;
  totalEnrollments: number;
  activeEnrollments: number;
  completionRate: number;
  avgCompletionTimeHours: number;
  workflowPerformance: Array<{
    workflowId: string;
    name: string;
    status: string;
    enrollments: number;
    activeEnrollments: number;
    completionRate: number;
  }>;
}

export interface TriggerAnalytics {
  totalTriggers: number;
  activeTriggers: number;
  totalFired: number;
  triggerPerformance: Array<{
    triggerId: string;
    name: string;
    eventType: string;
    firedCount: number;
    lastFired: string | null;
  }>;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  avgDecisionTimeHours: number;
}

export interface RoutingStats {
  totalRules: number;
  activeRules: number;
  totalMatches: number;
  rulePerformance: Array<{
    ruleId: string;
    name: string;
    matchCount: number;
    lastMatchedAt: string | null;
    assignToUserId: string | null;
  }>;
}

// ============================================================================
// Service
// ============================================================================

export class AutomationAnalyticsService {
  /**
   * Get workflow performance analytics for a workspace.
   */
  async getWorkflowAnalytics(db: Database, workspaceId: string): Promise<WorkflowAnalytics> {
    // Get all workflows for workspace
    const workflows = await db
      .select()
      .from(campaignWorkflows)
      .where(
        and(
          eq(campaignWorkflows.workspaceId, workspaceId),
          sql`${campaignWorkflows.deletedAt} IS NULL`
        )
      );

    const totalWorkflows = workflows.length;
    const activeWorkflows = workflows.filter((w) => w.status === 'active').length;

    // Get enrollment counts
    const enrollments = await db
      .select()
      .from(campaignWorkflowEnrollments)
      .where(eq(campaignWorkflowEnrollments.workspaceId, workspaceId));

    const totalEnrollments = enrollments.length;
    const activeEnrollments = enrollments.filter((e) => e.status === 'active').length;
    const completedEnrollments = enrollments.filter((e) => e.status === 'completed').length;
    const completionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100) / 100
      : 0;

    // Calculate average completion time for completed enrollments
    const completedWithTimes = enrollments.filter(
      (e) => e.status === 'completed' && e.completedAt && e.enrolledAt
    );
    let avgCompletionTimeHours = 0;
    if (completedWithTimes.length > 0) {
      const totalMs = completedWithTimes.reduce((sum, e) => {
        const completed = new Date(e.completedAt!).getTime();
        const enrolled = new Date(e.enrolledAt).getTime();
        return sum + (completed - enrolled);
      }, 0);
      avgCompletionTimeHours =
        Math.round((totalMs / completedWithTimes.length / (1000 * 60 * 60)) * 100) / 100;
    }

    // Build per-workflow performance
    const workflowPerformance = workflows.map((w) => {
      const wEnrollments = enrollments.filter((e) => e.workflowId === w.id);
      const wCompleted = wEnrollments.filter((e) => e.status === 'completed').length;
      const wActive = wEnrollments.filter((e) => e.status === 'active').length;
      return {
        workflowId: w.id,
        name: w.name,
        status: w.status,
        enrollments: wEnrollments.length,
        activeEnrollments: wActive,
        completionRate: wEnrollments.length > 0
          ? Math.round((wCompleted / wEnrollments.length) * 100) / 100
          : 0,
      };
    });

    return {
      totalWorkflows,
      activeWorkflows,
      totalEnrollments,
      activeEnrollments,
      completionRate,
      avgCompletionTimeHours,
      workflowPerformance,
    };
  }

  /**
   * Get trigger effectiveness analytics for a workspace.
   */
  async getTriggerAnalytics(db: Database, workspaceId: string): Promise<TriggerAnalytics> {
    const triggers = await db
      .select()
      .from(campaignTriggers)
      .where(
        and(
          eq(campaignTriggers.workspaceId, workspaceId),
          sql`${campaignTriggers.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(campaignTriggers.triggerCount));

    const totalTriggers = triggers.length;
    const activeTriggers = triggers.filter((t) => t.status === 'active').length;
    const totalFired = triggers.reduce((sum, t) => sum + t.triggerCount, 0);

    const triggerPerformance = triggers.map((t) => ({
      triggerId: t.id,
      name: t.name,
      eventType: t.triggerEvent,
      firedCount: t.triggerCount,
      lastFired: t.lastTriggeredAt ? t.lastTriggeredAt.toISOString() : null,
    }));

    return {
      totalTriggers,
      activeTriggers,
      totalFired,
      triggerPerformance,
    };
  }

  /**
   * Get approval queue statistics for a workspace.
   */
  async getApprovalStats(db: Database, workspaceId: string): Promise<ApprovalStats> {
    const approvals = await db
      .select()
      .from(crmWorkflowApprovals)
      .where(eq(crmWorkflowApprovals.workspaceId, workspaceId));

    const pending = approvals.filter((a) => a.status === 'pending').length;
    const approved = approvals.filter((a) => a.status === 'approved').length;
    const rejected = approvals.filter((a) => a.status === 'rejected').length;
    const expired = approvals.filter((a) => a.status === 'expired').length;

    // Calculate average decision time for decided approvals
    const decided = approvals.filter(
      (a) => (a.status === 'approved' || a.status === 'rejected') && a.decidedAt && a.requestedAt
    );
    let avgDecisionTimeHours = 0;
    if (decided.length > 0) {
      const totalMs = decided.reduce((sum, a) => {
        const decidedTime = new Date(a.decidedAt!).getTime();
        const requestedTime = new Date(a.requestedAt).getTime();
        return sum + (decidedTime - requestedTime);
      }, 0);
      avgDecisionTimeHours =
        Math.round((totalMs / decided.length / (1000 * 60 * 60)) * 100) / 100;
    }

    return {
      pending,
      approved,
      rejected,
      expired,
      avgDecisionTimeHours,
    };
  }

  /**
   * Get lead routing statistics for a workspace.
   */
  async getRoutingStats(db: Database, workspaceId: string): Promise<RoutingStats> {
    const rules = await db
      .select()
      .from(crmLeadRoutingRules)
      .where(eq(crmLeadRoutingRules.workspaceId, workspaceId))
      .orderBy(desc(crmLeadRoutingRules.matchCount));

    const totalRules = rules.length;
    const activeRules = rules.filter((r) => r.isActive).length;
    const totalMatches = rules.reduce((sum, r) => sum + r.matchCount, 0);

    const rulePerformance = rules.map((r) => ({
      ruleId: r.id,
      name: r.name,
      matchCount: r.matchCount,
      lastMatchedAt: r.lastMatchedAt ? r.lastMatchedAt.toISOString() : null,
      assignToUserId: r.assignToUserId,
    }));

    return {
      totalRules,
      activeRules,
      totalMatches,
      rulePerformance,
    };
  }
}

export const automationAnalyticsService = new AutomationAnalyticsService();
