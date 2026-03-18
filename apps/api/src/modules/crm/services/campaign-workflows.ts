/**
 * Campaign Workflows Service
 * US-CAMPAIGN-WORKFLOW-007: Multi-Step Workflow Builder
 * US-CAMPAIGN-WORKFLOW-008: Workflow Execution Engine
 *
 * Handles workflow definition, enrollment, and execution tracking
 */

import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, desc, sql, inArray } from 'drizzle-orm';
import {
  campaignWorkflows,
  campaignWorkflowEnrollments,
  campaignWorkflowExecutions,
  type NewCampaignWorkflow,
  type CampaignWorkflow,
  type NewCampaignWorkflowEnrollment,
  type CampaignWorkflowEnrollment,
  type NewCampaignWorkflowExecution,
  type CampaignWorkflowExecution,
  type WorkflowStatus,
  type WorkflowStepStatus,
} from '@agios/db/schema';

// ============================================================================
// WORKFLOW DEFINITION MANAGEMENT
// ============================================================================

export class CampaignWorkflowService {
  /**
   * Create a new workflow
   */
  static async create(
    db: NodePgDatabase<any>,
    data: NewCampaignWorkflow
  ): Promise<CampaignWorkflow> {
    const workflows = await db.insert(campaignWorkflows).values(data).returning();

    return workflows[0];
  }

  /**
   * Get workflow by ID
   */
  static async getById(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<CampaignWorkflow | null> {
    const workflows = await db
      .select()
      .from(campaignWorkflows)
      .where(
        and(
          eq(campaignWorkflows.id, id),
          eq(campaignWorkflows.workspaceId, workspaceId),
          isNull(campaignWorkflows.deletedAt)
        )
      )
      .limit(1);

    return workflows[0] || null;
  }

  /**
   * List workflows with filtering
   */
  static async list(
    db: NodePgDatabase<any>,
    workspaceId: string,
    options?: {
      status?: WorkflowStatus;
      tags?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<{ workflows: CampaignWorkflow[]; total: number }> {
    const { status, tags, limit = 50, offset = 0 } = options || {};

    const conditions = [
      eq(campaignWorkflows.workspaceId, workspaceId),
      isNull(campaignWorkflows.deletedAt),
    ];

    if (status) {
      conditions.push(eq(campaignWorkflows.status, status));
    }

    const workflows = await db
      .select()
      .from(campaignWorkflows)
      .where(and(...conditions))
      .orderBy(desc(campaignWorkflows.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by tags if provided
    let filteredWorkflows = workflows;
    if (tags && tags.length > 0) {
      filteredWorkflows = workflows.filter((workflow) => {
        const workflowTags = (workflow.tags as string[]) || [];
        return tags.some((tag) => workflowTags.includes(tag));
      });
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignWorkflows)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    return { workflows: filteredWorkflows, total };
  }

  /**
   * Update workflow
   */
  static async update(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string,
    data: Partial<NewCampaignWorkflow>
  ): Promise<CampaignWorkflow | null> {
    const workflows = await db
      .update(campaignWorkflows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignWorkflows.id, id),
          eq(campaignWorkflows.workspaceId, workspaceId),
          isNull(campaignWorkflows.deletedAt)
        )
      )
      .returning();

    return workflows[0] || null;
  }

  /**
   * Soft delete workflow
   */
  static async delete(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<boolean> {
    const workflows = await db
      .update(campaignWorkflows)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignWorkflows.id, id),
          eq(campaignWorkflows.workspaceId, workspaceId),
          isNull(campaignWorkflows.deletedAt)
        )
      )
      .returning();

    return workflows.length > 0;
  }

  /**
   * Activate workflow (change status to active)
   */
  static async activate(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<CampaignWorkflow | null> {
    return this.update(db, id, workspaceId, { status: 'active' });
  }

  /**
   * Pause workflow (change status to paused)
   */
  static async pause(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<CampaignWorkflow | null> {
    return this.update(db, id, workspaceId, { status: 'paused' });
  }

  /**
   * Get recent workflows (by created date)
   */
  static async getRecent(
    db: NodePgDatabase<any>,
    workspaceId: string,
    seconds: number = 86400 // 24 hours
  ): Promise<CampaignWorkflow[]> {
    const cutoffDate = new Date(Date.now() - seconds * 1000);

    const workflows = await db
      .select()
      .from(campaignWorkflows)
      .where(
        and(
          eq(campaignWorkflows.workspaceId, workspaceId),
          isNull(campaignWorkflows.deletedAt),
          sql`${campaignWorkflows.createdAt} > ${cutoffDate}`
        )
      )
      .orderBy(desc(campaignWorkflows.createdAt));

    return workflows;
  }
}

// ============================================================================
// WORKFLOW ENROLLMENT MANAGEMENT
// ============================================================================

export class WorkflowEnrollmentService {
  /**
   * Enroll a lead into a workflow
   */
  static async enroll(
    db: NodePgDatabase<any>,
    data: NewCampaignWorkflowEnrollment
  ): Promise<CampaignWorkflowEnrollment> {
    // Check for existing active enrollment (idempotency)
    const existing = await db
      .select()
      .from(campaignWorkflowEnrollments)
      .where(
        and(
          eq(campaignWorkflowEnrollments.workflowId, data.workflowId),
          eq(campaignWorkflowEnrollments.leadId, data.leadId),
          eq(campaignWorkflowEnrollments.status, 'active')
        )
      )
      .limit(1);

    if (existing[0]) {
      throw new Error('Lead is already enrolled in this workflow');
    }

    // Create enrollment
    const enrollments = await db
      .insert(campaignWorkflowEnrollments)
      .values(data)
      .returning();

    // Increment workflow enrollment count
    await db
      .update(campaignWorkflows)
      .set({
        enrollmentCount: sql`${campaignWorkflows.enrollmentCount} + 1`,
        activeEnrollmentCount: sql`${campaignWorkflows.activeEnrollmentCount} + 1`,
      })
      .where(eq(campaignWorkflows.id, data.workflowId));

    return enrollments[0];
  }

  /**
   * Get enrollment by ID
   */
  static async getById(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<CampaignWorkflowEnrollment | null> {
    const enrollments = await db
      .select()
      .from(campaignWorkflowEnrollments)
      .where(
        and(
          eq(campaignWorkflowEnrollments.id, id),
          eq(campaignWorkflowEnrollments.workspaceId, workspaceId)
        )
      )
      .limit(1);

    return enrollments[0] || null;
  }

  /**
   * List enrollments for a workflow
   */
  static async listByWorkflow(
    db: NodePgDatabase<any>,
    workflowId: string,
    workspaceId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ enrollments: CampaignWorkflowEnrollment[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options || {};

    const conditions = [
      eq(campaignWorkflowEnrollments.workflowId, workflowId),
      eq(campaignWorkflowEnrollments.workspaceId, workspaceId),
    ];

    if (status) {
      conditions.push(eq(campaignWorkflowEnrollments.status, status as any));
    }

    const enrollments = await db
      .select()
      .from(campaignWorkflowEnrollments)
      .where(and(...conditions))
      .orderBy(desc(campaignWorkflowEnrollments.enrolledAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignWorkflowEnrollments)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    return { enrollments, total };
  }

  /**
   * List enrollments for a lead
   */
  static async listByLead(
    db: NodePgDatabase<any>,
    leadId: string,
    workspaceId: string
  ): Promise<CampaignWorkflowEnrollment[]> {
    const enrollments = await db
      .select()
      .from(campaignWorkflowEnrollments)
      .where(
        and(
          eq(campaignWorkflowEnrollments.leadId, leadId),
          eq(campaignWorkflowEnrollments.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(campaignWorkflowEnrollments.enrolledAt));

    return enrollments;
  }

  /**
   * Update enrollment
   */
  static async update(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string,
    data: Partial<NewCampaignWorkflowEnrollment>
  ): Promise<CampaignWorkflowEnrollment | null> {
    const enrollments = await db
      .update(campaignWorkflowEnrollments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignWorkflowEnrollments.id, id),
          eq(campaignWorkflowEnrollments.workspaceId, workspaceId)
        )
      )
      .returning();

    return enrollments[0] || null;
  }

  /**
   * Complete enrollment
   */
  static async complete(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<void> {
    const enrollment = await this.getById(db, id, workspaceId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    await db
      .update(campaignWorkflowEnrollments)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignWorkflowEnrollments.id, id));

    // Update workflow counts
    await db
      .update(campaignWorkflows)
      .set({
        completionCount: sql`${campaignWorkflows.completionCount} + 1`,
        activeEnrollmentCount: sql`${campaignWorkflows.activeEnrollmentCount} - 1`,
      })
      .where(eq(campaignWorkflows.id, enrollment.workflowId));
  }

  /**
   * Fail enrollment
   */
  static async fail(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string,
    errorMessage: string
  ): Promise<void> {
    const enrollment = await this.getById(db, id, workspaceId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    await db
      .update(campaignWorkflowEnrollments)
      .set({
        status: 'failed',
        failedAt: new Date(),
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(campaignWorkflowEnrollments.id, id));

    // Update workflow counts
    await db
      .update(campaignWorkflows)
      .set({
        activeEnrollmentCount: sql`${campaignWorkflows.activeEnrollmentCount} - 1`,
      })
      .where(eq(campaignWorkflows.id, enrollment.workflowId));
  }

  /**
   * Cancel enrollment
   */
  static async cancel(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<void> {
    const enrollment = await this.getById(db, id, workspaceId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    await db
      .update(campaignWorkflowEnrollments)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(campaignWorkflowEnrollments.id, id));

    // Update workflow counts
    await db
      .update(campaignWorkflows)
      .set({
        activeEnrollmentCount: sql`${campaignWorkflows.activeEnrollmentCount} - 1`,
      })
      .where(eq(campaignWorkflows.id, enrollment.workflowId));
  }
}

// ============================================================================
// WORKFLOW EXECUTION HISTORY
// ============================================================================

export class WorkflowExecutionService {
  /**
   * Create execution record
   */
  static async create(
    db: NodePgDatabase<any>,
    data: NewCampaignWorkflowExecution
  ): Promise<CampaignWorkflowExecution> {
    const executions = await db
      .insert(campaignWorkflowExecutions)
      .values(data)
      .returning();

    return executions[0];
  }

  /**
   * Get execution history for an enrollment
   */
  static async listByEnrollment(
    db: NodePgDatabase<any>,
    enrollmentId: string,
    workspaceId: string
  ): Promise<CampaignWorkflowExecution[]> {
    const executions = await db
      .select()
      .from(campaignWorkflowExecutions)
      .where(
        and(
          eq(campaignWorkflowExecutions.enrollmentId, enrollmentId),
          eq(campaignWorkflowExecutions.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(campaignWorkflowExecutions.startedAt));

    return executions;
  }

  /**
   * Get recent executions (for monitoring/debugging)
   */
  static async getRecent(
    db: NodePgDatabase<any>,
    workspaceId: string,
    seconds: number = 3600 // 1 hour
  ): Promise<CampaignWorkflowExecution[]> {
    const cutoffDate = new Date(Date.now() - seconds * 1000);

    const executions = await db
      .select()
      .from(campaignWorkflowExecutions)
      .where(
        and(
          eq(campaignWorkflowExecutions.workspaceId, workspaceId),
          sql`${campaignWorkflowExecutions.startedAt} > ${cutoffDate}`
        )
      )
      .orderBy(desc(campaignWorkflowExecutions.startedAt));

    return executions;
  }

  /**
   * Get failed executions (for error analysis)
   */
  static async getFailedExecutions(
    db: NodePgDatabase<any>,
    workspaceId: string,
    limit: number = 100
  ): Promise<CampaignWorkflowExecution[]> {
    const executions = await db
      .select()
      .from(campaignWorkflowExecutions)
      .where(
        and(
          eq(campaignWorkflowExecutions.workspaceId, workspaceId),
          eq(campaignWorkflowExecutions.status, 'failed')
        )
      )
      .orderBy(desc(campaignWorkflowExecutions.startedAt))
      .limit(limit);

    return executions;
  }
}

export const campaignWorkflowService = CampaignWorkflowService;
export const workflowEnrollmentService = WorkflowEnrollmentService;
export const workflowExecutionService = WorkflowExecutionService;
