/**
 * Campaign Automation Schema
 * Scheduling, recurrence, and event-based trigger tables for advanced campaign management
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmCampaigns } from './campaigns';
import { crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const scheduleTypeEnum = pgEnum('campaign_schedule_type', ['once', 'recurring']);

export const scheduleStatusEnum = pgEnum('campaign_schedule_status', [
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const recurrencePatternEnum = pgEnum('campaign_recurrence_pattern', [
  'daily',
  'weekly',
  'monthly',
]);

export const recurrenceEndConditionEnum = pgEnum('campaign_recurrence_end_condition', [
  'never',
  'after_executions',
  'end_date',
]);

export const triggerEventEnum = pgEnum('campaign_trigger_event', [
  'lead_created',
  'score_changed',
  'stage_changed',
  'activity_created',
  'email_opened',
  'link_clicked',
]);

export const triggerStatusEnum = pgEnum('campaign_trigger_status', [
  'active',
  'paused',
  'deleted',
]);

// ============================================================================
// CAMPAIGN SCHEDULES TABLE
// ============================================================================

export const campaignSchedules = pgTable(
  'campaign_schedules',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Campaign reference
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),

    // Schedule configuration
    scheduleType: scheduleTypeEnum('schedule_type').notNull(),
    scheduledTime: timestamp('scheduled_time', { withTimezone: true }), // For one-time schedules
    timezone: text('timezone').notNull().default('UTC'), // IANA timezone

    // Status
    status: scheduleStatusEnum('status').notNull().default('active'),
    executedAt: timestamp('executed_at', { withTimezone: true }),

    // pg-boss job tracking
    jobId: text('job_id'), // pg-boss job ID for cancellation

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_schedules_workspace').on(table.workspaceId),

    // Index for finding schedules to execute
    scheduledTimeIdx: index('idx_campaign_schedules_scheduled_time').on(
      table.scheduledTime,
      table.status
    ),

    // Campaign lookup
    campaignIdx: index('idx_campaign_schedules_campaign').on(table.campaignId),

    // Idempotency constraint - only one active schedule per campaign
    uniqueActiveCampaignSchedule: unique('unique_active_campaign_schedule').on(
      table.campaignId,
      table.status
    ),
  })
);

// ============================================================================
// CAMPAIGN RECURRENCES TABLE
// ============================================================================

export const campaignRecurrences = pgTable(
  'campaign_recurrences',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Campaign reference
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),

    // Recurrence pattern
    pattern: recurrencePatternEnum('pattern').notNull(),

    // Pattern configuration (JSONB for flexibility)
    // Daily: { hour: 9, minute: 0 }
    // Weekly: { daysOfWeek: [1, 3, 5], hour: 9, minute: 0 }
    // Monthly: { dayOfMonth: 15, hour: 9, minute: 0 }
    config: jsonb('config').notNull(),

    // Timezone
    timezone: text('timezone').notNull().default('UTC'),

    // End conditions
    endCondition: recurrenceEndConditionEnum('end_condition').notNull().default('never'),
    maxExecutions: integer('max_executions'),
    endDate: timestamp('end_date', { withTimezone: true }),

    // Execution tracking
    executionCount: integer('execution_count').notNull().default(0),
    lastExecutionAt: timestamp('last_execution_at', { withTimezone: true }),
    nextExecutionAt: timestamp('next_execution_at', { withTimezone: true }),

    // Status
    status: scheduleStatusEnum('status').notNull().default('active'),

    // pg-boss job tracking
    jobId: text('job_id'), // pg-boss recurring job ID

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_recurrences_workspace').on(table.workspaceId),

    // Index for finding next executions
    nextExecutionIdx: index('idx_campaign_recurrences_next_execution').on(
      table.nextExecutionAt,
      table.status
    ),

    // Campaign lookup
    campaignIdx: index('idx_campaign_recurrences_campaign').on(table.campaignId),

    // Idempotency constraint - only one active recurrence per campaign
    uniqueActiveCampaignRecurrence: unique('unique_active_campaign_recurrence').on(
      table.campaignId,
      table.status
    ),
  })
);

// ============================================================================
// CAMPAIGN TRIGGERS TABLE
// ============================================================================

export const campaignTriggers = pgTable(
  'campaign_triggers',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Campaign reference
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => crmCampaigns.id, { onDelete: 'cascade' }),

    // Trigger configuration
    name: text('name').notNull(),
    description: text('description'),
    triggerEvent: triggerEventEnum('trigger_event').notNull(),

    // Conditions (JSON-based rule engine)
    // { "all": [{ "field": "propensity_score", "operator": ">", "value": 70 }] }
    // { "any": [{ "field": "lifecycle_stage", "operator": "==", "value": "lead" }] }
    conditions: jsonb('conditions').notNull(),

    // Debouncing - prevent trigger spam
    maxTriggersPerLeadPerDay: integer('max_triggers_per_lead_per_day').notNull().default(1),

    // Status
    status: triggerStatusEnum('status').notNull().default('active'),

    // Statistics
    triggerCount: integer('trigger_count').notNull().default(0),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_triggers_workspace').on(table.workspaceId),

    // Event lookup for trigger evaluation
    eventStatusIdx: index('idx_campaign_triggers_event_status').on(
      table.triggerEvent,
      table.status
    ),

    // Campaign lookup
    campaignIdx: index('idx_campaign_triggers_campaign').on(table.campaignId),
  })
);

// ============================================================================
// CAMPAIGN TRIGGER EXECUTIONS TABLE (for debouncing)
// ============================================================================

export const campaignTriggerExecutions = pgTable(
  'campaign_trigger_executions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Trigger reference
    triggerId: uuid('trigger_id')
      .notNull()
      .references(() => campaignTriggers.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Execution details
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    campaignExecutionId: uuid('campaign_execution_id'), // Link to actual campaign execution

    // Audit trail (immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_trigger_executions_workspace').on(table.workspaceId),

    // Debouncing lookup - find executions for lead/trigger on same day
    triggerLeadIdx: index('idx_campaign_trigger_executions_trigger_lead').on(
      table.triggerId,
      table.leadId,
      table.triggeredAt
    ),

    // Idempotency constraint - max 1 trigger per lead per trigger per day
    // Note: This is handled in application logic + unique partial index in migration
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const campaignSchedulesRelations = relations(campaignSchedules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [campaignSchedules.workspaceId],
    references: [workspaces.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [campaignSchedules.campaignId],
    references: [crmCampaigns.id],
  }),
  createdByUser: one(users, {
    fields: [campaignSchedules.createdBy],
    references: [users.id],
  }),
}));

export const campaignRecurrencesRelations = relations(campaignRecurrences, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [campaignRecurrences.workspaceId],
    references: [workspaces.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [campaignRecurrences.campaignId],
    references: [crmCampaigns.id],
  }),
  createdByUser: one(users, {
    fields: [campaignRecurrences.createdBy],
    references: [users.id],
  }),
}));

export const campaignTriggersRelations = relations(campaignTriggers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [campaignTriggers.workspaceId],
    references: [workspaces.id],
  }),
  campaign: one(crmCampaigns, {
    fields: [campaignTriggers.campaignId],
    references: [crmCampaigns.id],
  }),
  createdByUser: one(users, {
    fields: [campaignTriggers.createdBy],
    references: [users.id],
  }),
  executions: many(campaignTriggerExecutions),
}));

export const campaignTriggerExecutionsRelations = relations(
  campaignTriggerExecutions,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [campaignTriggerExecutions.workspaceId],
      references: [workspaces.id],
    }),
    trigger: one(campaignTriggers, {
      fields: [campaignTriggerExecutions.triggerId],
      references: [campaignTriggers.id],
    }),
    lead: one(crmLeads, {
      fields: [campaignTriggerExecutions.leadId],
      references: [crmLeads.id],
    }),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type CampaignSchedule = typeof campaignSchedules.$inferSelect;
export type NewCampaignSchedule = typeof campaignSchedules.$inferInsert;

export type CampaignRecurrence = typeof campaignRecurrences.$inferSelect;
export type NewCampaignRecurrence = typeof campaignRecurrences.$inferInsert;

export type CampaignTrigger = typeof campaignTriggers.$inferSelect;
export type NewCampaignTrigger = typeof campaignTriggers.$inferInsert;

export type CampaignTriggerExecution = typeof campaignTriggerExecutions.$inferSelect;
export type NewCampaignTriggerExecution = typeof campaignTriggerExecutions.$inferInsert;

export type ScheduleType = (typeof scheduleTypeEnum.enumValues)[number];
export type ScheduleStatus = (typeof scheduleStatusEnum.enumValues)[number];
export type RecurrencePattern = (typeof recurrencePatternEnum.enumValues)[number];
export type RecurrenceEndCondition = (typeof recurrenceEndConditionEnum.enumValues)[number];
export type TriggerEvent = (typeof triggerEventEnum.enumValues)[number];
export type TriggerStatus = (typeof triggerStatusEnum.enumValues)[number];

// ============================================================================
// CAMPAIGN TEMPLATES (US-CAMPAIGN-TEMPLATE-006)
// ============================================================================

export const templateCategoryEnum = pgEnum('campaign_template_category', [
  'onboarding',
  'nurture',
  're-engagement',
  'promotion',
  'event',
  'feedback',
  'custom',
]);

export const templateStatusEnum = pgEnum('campaign_template_status', [
  'draft',
  'active',
  'archived',
]);

export const campaignTemplates = pgTable(
  'campaign_templates',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Template metadata
    name: text('name').notNull(),
    description: text('description'),
    category: templateCategoryEnum('category').notNull().default('custom'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),

    // Template content
    // This includes campaign configuration, messages, and default settings
    // Example: { objective, type, subject, body, channel, defaultSettings }
    templateData: jsonb('template_data').notNull(),

    // Versioning
    version: integer('version').notNull().default(1),
    parentTemplateId: uuid('parent_template_id').references((): any => campaignTemplates.id, {
      onDelete: 'set null',
    }),
    isLatestVersion: boolean('is_latest_version').notNull().default(true),

    // Status
    status: templateStatusEnum('status').notNull().default('draft'),

    // Usage statistics
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_templates_workspace').on(table.workspaceId),

    // Category and status filtering
    categoryStatusIdx: index('idx_campaign_templates_category_status').on(
      table.category,
      table.status
    ),

    // Parent template lookup for versioning
    parentIdx: index('idx_campaign_templates_parent').on(table.parentTemplateId),

    // Latest version lookup
    latestVersionIdx: index('idx_campaign_templates_latest').on(
      table.parentTemplateId,
      table.isLatestVersion
    ),
  })
);

// ============================================================================
// CAMPAIGN WORKFLOWS (US-CAMPAIGN-WORKFLOW-007)
// ============================================================================

export const workflowStatusEnum = pgEnum('campaign_workflow_status', [
  'draft',
  'active',
  'paused',
  'archived',
]);

export const workflowStepTypeEnum = pgEnum('campaign_workflow_step_type', [
  'send_campaign',
  'wait',
  'condition',
  'update_lead_field',
  'add_tag',
  'remove_tag',
  'send_notification',
]);

export const workflowStepStatusEnum = pgEnum('campaign_workflow_step_status', [
  'pending',
  'active',
  'completed',
  'skipped',
  'failed',
]);

export const campaignWorkflows = pgTable(
  'campaign_workflows',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Workflow metadata
    name: text('name').notNull(),
    description: text('description'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),

    // Workflow definition
    // Array of steps with transitions and conditions
    // Example: [{ id, type, config, transitions: [{ to, condition }] }]
    steps: jsonb('steps').notNull(),

    // Entry conditions (who enters this workflow?)
    entryConditions: jsonb('entry_conditions'),

    // Exit conditions (when to stop the workflow?)
    exitConditions: jsonb('exit_conditions'),

    // Status
    status: workflowStatusEnum('status').notNull().default('draft'),

    // Statistics
    enrollmentCount: integer('enrollment_count').notNull().default(0),
    completionCount: integer('completion_count').notNull().default(0),
    activeEnrollmentCount: integer('active_enrollment_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_workflows_workspace').on(table.workspaceId),

    // Status filtering
    statusIdx: index('idx_campaign_workflows_status').on(table.status),
  })
);

// ============================================================================
// WORKFLOW ENROLLMENTS (US-CAMPAIGN-WORKFLOW-008)
// ============================================================================

export const workflowEnrollmentStatusEnum = pgEnum('campaign_workflow_enrollment_status', [
  'active',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export const campaignWorkflowEnrollments = pgTable(
  'campaign_workflow_enrollments',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Workflow reference
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => campaignWorkflows.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Current step in workflow
    currentStepId: text('current_step_id'),
    currentStepStartedAt: timestamp('current_step_started_at', { withTimezone: true }),

    // Execution context (variables, intermediate results)
    context: jsonb('context').$type<Record<string, any>>().notNull().default({}),

    // Status
    status: workflowEnrollmentStatusEnum('status').notNull().default('active'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    errorMessage: text('error_message'),

    // Retry tracking
    retryCount: integer('retry_count').notNull().default(0),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),

    // pg-boss job tracking
    currentJobId: text('current_job_id'),

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_workflow_enrollments_workspace').on(table.workspaceId),

    // Workflow lookup
    workflowIdx: index('idx_campaign_workflow_enrollments_workflow').on(table.workflowId),

    // Lead lookup
    leadIdx: index('idx_campaign_workflow_enrollments_lead').on(table.leadId),

    // Status filtering
    statusIdx: index('idx_campaign_workflow_enrollments_status').on(table.status),

    // Idempotency - one active enrollment per lead per workflow
    uniqueActiveEnrollment: unique('unique_active_workflow_enrollment').on(
      table.workflowId,
      table.leadId,
      table.status
    ),
  })
);

// ============================================================================
// WORKFLOW EXECUTION HISTORY (US-CAMPAIGN-WORKFLOW-008)
// ============================================================================

export const campaignWorkflowExecutions = pgTable(
  'campaign_workflow_executions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Enrollment reference
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => campaignWorkflowEnrollments.id, { onDelete: 'cascade' }),

    // Step execution details
    stepId: text('step_id').notNull(),
    stepType: workflowStepTypeEnum('step_type').notNull(),
    stepConfig: jsonb('step_config').notNull(),

    // Execution results
    status: workflowStepStatusEnum('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    duration: integer('duration'), // milliseconds

    // Transition details
    transitionedTo: text('transitioned_to'), // Next step ID
    transitionReason: text('transition_reason'), // Why this transition was taken

    // Execution output
    output: jsonb('output'),
    errorMessage: text('error_message'),

    // Audit trail (immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Workspace index (REQUIRED for multi-tenancy)
    workspaceIdx: index('idx_campaign_workflow_executions_workspace').on(table.workspaceId),

    // Enrollment lookup
    enrollmentIdx: index('idx_campaign_workflow_executions_enrollment').on(table.enrollmentId),

    // Timeline view (ORDER BY startedAt DESC)
    startedAtIdx: index('idx_campaign_workflow_executions_started').on(table.startedAt),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const campaignTemplatesRelations = relations(campaignTemplates, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [campaignTemplates.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [campaignTemplates.createdBy],
    references: [users.id],
  }),
  parentTemplate: one(campaignTemplates, {
    fields: [campaignTemplates.parentTemplateId],
    references: [campaignTemplates.id],
  }),
  versions: many(campaignTemplates),
}));

export const campaignWorkflowsRelations = relations(campaignWorkflows, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [campaignWorkflows.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [campaignWorkflows.createdBy],
    references: [users.id],
  }),
  enrollments: many(campaignWorkflowEnrollments),
}));

export const campaignWorkflowEnrollmentsRelations = relations(
  campaignWorkflowEnrollments,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [campaignWorkflowEnrollments.workspaceId],
      references: [workspaces.id],
    }),
    workflow: one(campaignWorkflows, {
      fields: [campaignWorkflowEnrollments.workflowId],
      references: [campaignWorkflows.id],
    }),
    lead: one(crmLeads, {
      fields: [campaignWorkflowEnrollments.leadId],
      references: [crmLeads.id],
    }),
    executions: many(campaignWorkflowExecutions),
  })
);

export const campaignWorkflowExecutionsRelations = relations(
  campaignWorkflowExecutions,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [campaignWorkflowExecutions.workspaceId],
      references: [workspaces.id],
    }),
    enrollment: one(campaignWorkflowEnrollments, {
      fields: [campaignWorkflowExecutions.enrollmentId],
      references: [campaignWorkflowEnrollments.id],
    }),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type CampaignTemplate = typeof campaignTemplates.$inferSelect;
export type NewCampaignTemplate = typeof campaignTemplates.$inferInsert;
export type TemplateCategory = (typeof templateCategoryEnum.enumValues)[number];
export type TemplateStatus = (typeof templateStatusEnum.enumValues)[number];

export type CampaignWorkflow = typeof campaignWorkflows.$inferSelect;
export type NewCampaignWorkflow = typeof campaignWorkflows.$inferInsert;
export type WorkflowStatus = (typeof workflowStatusEnum.enumValues)[number];
export type WorkflowStepType = (typeof workflowStepTypeEnum.enumValues)[number];

export type CampaignWorkflowEnrollment = typeof campaignWorkflowEnrollments.$inferSelect;
export type NewCampaignWorkflowEnrollment = typeof campaignWorkflowEnrollments.$inferInsert;
export type WorkflowEnrollmentStatus = (typeof workflowEnrollmentStatusEnum.enumValues)[number];

export type CampaignWorkflowExecution = typeof campaignWorkflowExecutions.$inferSelect;
export type NewCampaignWorkflowExecution = typeof campaignWorkflowExecutions.$inferInsert;
export type WorkflowStepStatus = (typeof workflowStepStatusEnum.enumValues)[number];
