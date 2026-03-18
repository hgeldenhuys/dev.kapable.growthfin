/**
 * Workflow Execution Worker
 * US-CAMPAIGN-WORKFLOW-008: Workflow Execution Engine
 *
 * Executes workflow steps with conditional branching, wait conditions, and error handling
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import {
  campaignWorkflows,
  campaignWorkflowEnrollments,
  campaignWorkflowExecutions,
  crmCampaigns,
  crmLeads,
  type WorkflowStepType,
} from '@agios/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  workflowEnrollmentService,
  workflowExecutionService,
} from '../modules/crm/services/campaign-workflows';

// ============================================================================
// TYPES
// ============================================================================

export interface ExecuteWorkflowJob {
  enrollmentId: string;
  workspaceId: string;
}

interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  config: Record<string, any>;
  transitions: Array<{
    to: string | null; // null = end workflow
    condition?: ConditionRule;
  }>;
}

interface ConditionRule {
  field?: string;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains';
  value?: any;
  all?: ConditionRule[];
  any?: ConditionRule[];
}

// ============================================================================
// STEP EXECUTORS
// ============================================================================

class StepExecutors {
  /**
   * Execute "send_campaign" step
   */
  static async executeSendCampaign(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { campaignId } = step.config;

    if (!campaignId) {
      throw new Error('Campaign ID not provided in step config');
    }

    // Get campaign
    const campaign = await db.query.crmCampaigns.findFirst({
      where: (campaigns, { eq }) => eq(campaigns.id, campaignId),
      with: {
        messages: true,
      },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Queue campaign execution for this specific lead
    await jobQueue.send(
      'execute-campaign',
      {
        campaignId,
        messageId: campaign.messages[0]?.id,
        workspaceId: enrollment.workspaceId,
        leadId: enrollment.leadId, // Only send to this lead
      },
      {
        priority: 1,
        retryLimit: 3,
      }
    );

    return {
      output: { campaignId, status: 'queued' },
      nextStep: step.transitions[0]?.to || null,
      reason: 'Campaign queued for execution',
    };
  }

  /**
   * Execute "wait" step
   */
  static async executeWait(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { duration, unit = 'minutes' } = step.config;

    if (!duration) {
      throw new Error('Duration not provided in wait step config');
    }

    // Calculate delay in milliseconds
    const delayMs = this.calculateDelay(duration, unit);

    // Schedule next step execution
    await jobQueue.send(
      'execute-workflow',
      {
        enrollmentId: enrollment.id,
        workspaceId: enrollment.workspaceId,
      },
      {
        priority: 2,
        startAfter: new Date(Date.now() + delayMs),
      }
    );

    return {
      output: { duration, unit, delayMs },
      nextStep: step.transitions[0]?.to || null,
      reason: `Waiting ${duration} ${unit}`,
    };
  }

  /**
   * Execute "condition" step (if-then-else branching)
   */
  static async executeCondition(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { condition } = step.config;

    if (!condition) {
      throw new Error('Condition not provided in condition step config');
    }

    // Get lead data for condition evaluation
    const lead = await db.query.crmLeads.findFirst({
      where: (leads, { eq }) => eq(leads.id, enrollment.leadId),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Evaluate condition
    const conditionMet = this.evaluateCondition(condition, { lead, context });

    // Find matching transition
    const transition = step.transitions.find((t) => {
      if (!t.condition) {
        return !conditionMet; // Default/else branch
      }
      return conditionMet;
    });

    return {
      output: { conditionMet, condition },
      nextStep: transition?.to || null,
      reason: conditionMet ? 'Condition met' : 'Condition not met',
    };
  }

  /**
   * Execute "update_lead_field" step
   */
  static async executeUpdateLeadField(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { field, value } = step.config;

    if (!field) {
      throw new Error('Field not provided in update_lead_field step config');
    }

    // Update lead
    await db
      .update(crmLeads)
      .set({ [field]: value, updatedAt: new Date() })
      .where(eq(crmLeads.id, enrollment.leadId));

    return {
      output: { field, value },
      nextStep: step.transitions[0]?.to || null,
      reason: `Updated lead field: ${field}`,
    };
  }

  /**
   * Execute "add_tag" step
   */
  static async executeAddTag(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { tag } = step.config;

    if (!tag) {
      throw new Error('Tag not provided in add_tag step config');
    }

    // Get current lead
    const lead = await db.query.crmLeads.findFirst({
      where: (leads, { eq }) => eq(leads.id, enrollment.leadId),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentTags = (lead.tags as string[]) || [];
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);

      await db
        .update(crmLeads)
        .set({ tags: currentTags, updatedAt: new Date() })
        .where(eq(crmLeads.id, enrollment.leadId));
    }

    return {
      output: { tag },
      nextStep: step.transitions[0]?.to || null,
      reason: `Added tag: ${tag}`,
    };
  }

  /**
   * Execute "remove_tag" step
   */
  static async executeRemoveTag(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { tag } = step.config;

    if (!tag) {
      throw new Error('Tag not provided in remove_tag step config');
    }

    // Get current lead
    const lead = await db.query.crmLeads.findFirst({
      where: (leads, { eq }) => eq(leads.id, enrollment.leadId),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentTags = (lead.tags as string[]) || [];
    const updatedTags = currentTags.filter((t) => t !== tag);

    await db
      .update(crmLeads)
      .set({ tags: updatedTags, updatedAt: new Date() })
      .where(eq(crmLeads.id, enrollment.leadId));

    return {
      output: { tag },
      nextStep: step.transitions[0]?.to || null,
      reason: `Removed tag: ${tag}`,
    };
  }

  /**
   * Execute "send_notification" step
   */
  static async executeSendNotification(
    step: WorkflowStep,
    enrollment: any,
    context: Record<string, any>
  ): Promise<{ output: any; nextStep: string | null; reason: string }> {
    const { message, channel = 'email' } = step.config;

    console.log(`[Workflow] Sending notification: ${message} via ${channel}`);

    // TODO: Implement actual notification sending

    return {
      output: { message, channel },
      nextStep: step.transitions[0]?.to || null,
      reason: `Sent notification via ${channel}`,
    };
  }

  // Helper: Calculate delay in milliseconds
  private static calculateDelay(duration: number, unit: string): number {
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    return duration * (multipliers[unit] || multipliers.minutes);
  }

  // Helper: Evaluate condition
  private static evaluateCondition(
    condition: ConditionRule,
    data: Record<string, any>
  ): boolean {
    // Logical operators
    if (condition.all) {
      return condition.all.every((c) => this.evaluateCondition(c, data));
    }

    if (condition.any) {
      return condition.any.some((c) => this.evaluateCondition(c, data));
    }

    // Simple field comparison
    const { field, operator, value } = condition;
    if (!field || !operator) {
      return false;
    }

    const fieldValue = this.getFieldValue(field, data);

    switch (operator) {
      case 'eq':
        return fieldValue == value;
      case 'ne':
        return fieldValue != value;
      case 'gt':
        return fieldValue > value;
      case 'gte':
        return fieldValue >= value;
      case 'lt':
        return fieldValue < value;
      case 'lte':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      default:
        return false;
    }
  }

  // Helper: Get field value from nested object
  private static getFieldValue(field: string, data: Record<string, any>): any {
    const parts = field.split('.');
    let value = data;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate step configuration matches step type requirements
 * BUG-006 FIX: Ensure step config is valid before execution
 */
function validateStepConfig(step: WorkflowStep): void {
  const { type, config } = step;

  switch (type) {
    case 'send_campaign':
      if (!config.campaignId) {
        throw new Error(`Step ${step.id}: send_campaign requires 'campaignId' in config`);
      }
      break;

    case 'wait':
      if (!config.duration) {
        throw new Error(`Step ${step.id}: wait requires 'duration' in config`);
      }
      if (config.unit && !['seconds', 'minutes', 'hours', 'days'].includes(config.unit)) {
        throw new Error(`Step ${step.id}: wait unit must be seconds/minutes/hours/days`);
      }
      break;

    case 'condition':
      if (!config.condition) {
        throw new Error(`Step ${step.id}: condition requires 'condition' in config`);
      }
      break;

    case 'update_lead_field':
      if (!config.field) {
        throw new Error(`Step ${step.id}: update_lead_field requires 'field' in config`);
      }
      break;

    case 'add_tag':
      if (!config.tag) {
        throw new Error(`Step ${step.id}: add_tag requires 'tag' in config`);
      }
      break;

    case 'remove_tag':
      if (!config.tag) {
        throw new Error(`Step ${step.id}: remove_tag requires 'tag' in config`);
      }
      break;

    case 'send_notification':
      if (!config.message) {
        throw new Error(`Step ${step.id}: send_notification requires 'message' in config`);
      }
      break;

    default:
      throw new Error(`Step ${step.id}: Unknown step type '${type}'`);
  }
}

// ============================================================================
// WORKFLOW EXECUTOR
// ============================================================================

async function executeWorkflow(job: ExecuteWorkflowJob): Promise<void> {
  const { enrollmentId, workspaceId } = job;

  console.log(`[Workflow Executor] Processing enrollment: ${enrollmentId}`);

  try {
    // Get enrollment
    const enrollment = await workflowEnrollmentService.getById(db, enrollmentId, workspaceId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    // Skip if not active
    if (enrollment.status !== 'active') {
      console.log(`[Workflow Executor] Enrollment ${enrollmentId} is not active, skipping`);
      return;
    }

    // Get workflow
    const workflow = await db.query.campaignWorkflows.findFirst({
      where: (workflows, { eq }) => eq(workflows.id, enrollment.workflowId),
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Get current step or start from beginning
    const steps = workflow.steps as WorkflowStep[];
    const currentStepId = enrollment.currentStepId || steps[0]?.id;

    if (!currentStepId) {
      throw new Error('No steps defined in workflow');
    }

    const currentStep = steps.find((s) => s.id === currentStepId);
    if (!currentStep) {
      throw new Error(`Step ${currentStepId} not found in workflow`);
    }

    console.log(
      `[Workflow Executor] Executing step: ${currentStep.id} (${currentStep.type}) for enrollment ${enrollmentId}`
    );

    // BUG-006 FIX: Validate step configuration before execution
    validateStepConfig(currentStep);

    // Execute step
    const startedAt = new Date();
    let stepStatus: 'completed' | 'failed' = 'completed';
    let output: any = null;
    let errorMessage: string | undefined;
    let nextStepId: string | null = null;
    let transitionReason = '';

    try {
      // Execute based on step type
      let result: { output: any; nextStep: string | null; reason: string };

      switch (currentStep.type) {
        case 'send_campaign':
          result = await StepExecutors.executeSendCampaign(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'wait':
          result = await StepExecutors.executeWait(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'condition':
          result = await StepExecutors.executeCondition(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'update_lead_field':
          result = await StepExecutors.executeUpdateLeadField(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'add_tag':
          result = await StepExecutors.executeAddTag(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'remove_tag':
          result = await StepExecutors.executeRemoveTag(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        case 'send_notification':
          result = await StepExecutors.executeSendNotification(
            currentStep,
            enrollment,
            enrollment.context as Record<string, any>
          );
          break;
        default:
          throw new Error(`Unsupported step type: ${currentStep.type}`);
      }

      output = result.output;
      nextStepId = result.nextStep;
      transitionReason = result.reason;
    } catch (error) {
      stepStatus = 'failed';
      errorMessage = String(error);
      console.error(`[Workflow Executor] Step execution failed:`, error);
    }

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    // Record execution (BUG-001 FIX: enrollmentId is now properly passed)
    await workflowExecutionService.create(db, {
      workspaceId,
      enrollmentId, // This is correctly passed from job.enrollmentId
      stepId: currentStep.id,
      stepType: currentStep.type,
      stepConfig: currentStep.config,
      status: stepStatus,
      startedAt,
      completedAt,
      duration,
      transitionedTo: nextStepId, // BUG-005: Properly set for step transitions
      transitionReason,
      output,
      errorMessage,
    });

    // Handle step result
    if (stepStatus === 'failed') {
      // Retry logic
      const maxRetries = 3;
      if (enrollment.retryCount < maxRetries) {
        await db
          .update(campaignWorkflowEnrollments)
          .set({
            retryCount: enrollment.retryCount + 1,
            lastRetryAt: new Date(),
          })
          .where(eq(campaignWorkflowEnrollments.id, enrollmentId));

        // Re-queue with delay
        await jobQueue.send(
          'execute-workflow',
          { enrollmentId, workspaceId },
          {
            priority: 2,
            startAfter: new Date(Date.now() + 60000), // Retry after 1 minute
          }
        );

        console.log(`[Workflow Executor] Retrying enrollment ${enrollmentId} (attempt ${enrollment.retryCount + 1}/${maxRetries})`);
      } else {
        // Max retries exceeded
        await workflowEnrollmentService.fail(db, enrollmentId, workspaceId, errorMessage || 'Max retries exceeded');
      }

      return;
    }

    // Update enrollment with next step
    if (nextStepId) {
      await db
        .update(campaignWorkflowEnrollments)
        .set({
          currentStepId: nextStepId,
          currentStepStartedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaignWorkflowEnrollments.id, enrollmentId));

      // Queue next step (unless it's a wait step - wait step queues itself)
      if (currentStep.type !== 'wait') {
        await jobQueue.send(
          'execute-workflow',
          { enrollmentId, workspaceId },
          {
            priority: 2,
          }
        );
      }
    } else {
      // Workflow complete
      await workflowEnrollmentService.complete(db, enrollmentId, workspaceId);
      console.log(`[Workflow Executor] Workflow completed for enrollment ${enrollmentId}`);
    }
  } catch (error) {
    console.error(`[Workflow Executor] Error processing enrollment ${enrollmentId}:`, error);
    await workflowEnrollmentService.fail(db, enrollmentId, workspaceId, String(error));
    throw error;
  }
}

// ============================================================================
// WORKER REGISTRATION
// ============================================================================

export async function registerExecuteWorkflowWorker() {
  await jobQueue.work<ExecuteWorkflowJob>(
    'execute-workflow',
    {
      teamSize: 5,
      teamConcurrency: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await executeWorkflow(job.data);
          await job.done();
        } catch (error) {
          console.error('[Workflow Worker] Job failed:', error);
          await job.done(error as Error);
        }
      }
    }
  );

  console.log('✅ Workflow execution worker registered');
}
