/**
 * Enrichment Schema
 * Tables for managing AI-powered contact enrichment jobs and results
 * Also includes lead enrichment tables (US-LEAD-AI-009)
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmContactLists } from './contact-lists';
import { crmContacts, crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const enrichmentJobTypeEnum = pgEnum('crm_enrichment_job_type', [
  'scoring', // Score contacts based on AI analysis
  'classification', // Classify contacts into categories
  'enhancement', // Enhance contact data with additional fields
  'qualification', // Qualify leads based on criteria
]);

export const templateTypeEnum = pgEnum('crm_template_type', [
  'enrichment', // Contact enrichment templates
  'scoring', // Scoring/classification templates (migrated from crmScoringModels)
  'export', // Export templates (future use)
]);

export const enrichmentStageTypeEnum = pgEnum('crm_enrichment_stage_type', [
  'validate', // Validate contact data (email, phone, etc.)
  'research', // Research company/person info
  'score', // Score/rank contacts
  'classify', // Classify into categories
  'enrich', // Enrich with additional data
]);

export const enrichmentJobModeEnum = pgEnum('crm_enrichment_job_mode', [
  'sample', // Test mode - process N contacts
  'batch', // Production mode - process all contacts
]);

export const enrichmentJobStatusEnum = pgEnum('crm_enrichment_job_status', [
  'draft', // Job created but not started
  'sampling', // Running sample mode
  'review', // Sample completed, awaiting approval
  'running', // Running batch mode
  'completed', // Successfully completed
  'cancelled', // Cancelled by user
  'failed', // Failed due to error
  'budget_exceeded', // Budget limit exceeded
]);

export const enrichmentResultStatusEnum = pgEnum('crm_enrichment_result_status', [
  'success', // Successfully enriched
  'failed', // Failed to enrich
  'skipped', // Skipped due to budget or other constraints
]);

// ============================================================================
// ENRICHMENT JOBS TABLE
// ============================================================================

export const crmEnrichmentJobs = pgTable(
  'crm_enrichment_jobs',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),
    type: enrichmentJobTypeEnum('type').notNull().default('scoring'),
    mode: enrichmentJobModeEnum('mode').notNull().default('sample'),

    // Sample configuration
    sampleSize: integer('sample_size').notNull().default(1), // Number of contacts to process in sample mode

    // Source
    sourceListId: uuid('source_list_id')
      .notNull()
      .references(() => crmContactLists.id, { onDelete: 'cascade' }),

    // Task relationship (optional - enrichment jobs can be created from tasks)
    taskId: uuid('task_id'),

    // Pipeline (optional - if null, single-stage job)
    // TODO: Uncomment when pipeline migration is run
    // pipelineId: uuid('pipeline_id').references(() => crmEnrichmentPipelines.id, {
    //   onDelete: 'set null',
    // }),
    // currentStageId: uuid('current_stage_id').references(() => crmPipelineStages.id, {
    //   onDelete: 'set null',
    // }),
    // currentStageOrder: integer('current_stage_order').default(0), // Which stage we're on (0-based)

    // AI Configuration
    model: text('model').notNull().default('openai/gpt-4o-mini'), // OpenRouter model ID
    prompt: text('prompt').notNull(), // System prompt for enrichment
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
    maxTokens: integer('max_tokens').default(500),

    // Status
    status: enrichmentJobStatusEnum('status').notNull().default('draft'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Progress tracking
    totalContacts: integer('total_contacts').notNull().default(0), // Total contacts to process
    processedContacts: integer('processed_contacts').notNull().default(0), // Successfully processed
    failedContacts: integer('failed_contacts').notNull().default(0), // Failed to process
    skippedContacts: integer('skipped_contacts').notNull().default(0), // Skipped (budget, etc.)

    // Cost tracking
    estimatedCost: numeric('estimated_cost', { precision: 15, scale: 4 }), // Estimated cost in USD
    actualCost: numeric('actual_cost', { precision: 15, scale: 4 }).notNull().default('0'), // Actual cost in USD
    budgetLimit: numeric('budget_limit', { precision: 15, scale: 4 }), // Maximum budget in USD

    // Error tracking
    lastError: text('last_error'), // Last error message
    errorCount: integer('error_count').notNull().default(0),

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Scheduling (for recurring re-enrichment)
    isScheduled: boolean('is_scheduled').notNull().default(false),
    scheduleCron: text('schedule_cron'), // Cron expression (e.g., '0 9 * * 1' for 9am every Monday)
    scheduleTimezone: text('schedule_timezone').default('UTC'),
    schedulePaused: boolean('schedule_paused').notNull().default(false),
    scheduleEndDate: timestamp('schedule_end_date', { withTimezone: true }), // When to stop scheduling
    scheduleMaxRuns: integer('schedule_max_runs'), // Maximum number of scheduled runs (null = unlimited)
    scheduleRunCount: integer('schedule_run_count').notNull().default(0), // How many times has this been run
    scheduleLastRun: timestamp('schedule_last_run', { withTimezone: true }), // When was this last run
    scheduleNextRun: timestamp('schedule_next_run', { withTimezone: true }), // When is the next scheduled run
    pgbossScheduleName: text('pgboss_schedule_name'), // pg-boss schedule name for tracking

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdIdx: index('idx_crm_enrichment_jobs_workspace_id').on(table.workspaceId),

    // Performance indexes
    sourceListIdIdx: index('idx_crm_enrichment_jobs_source_list_id').on(table.sourceListId),
    taskIdIdx: index('idx_crm_enrichment_jobs_task_id').on(table.taskId),
    statusIdx: index('idx_crm_enrichment_jobs_status').on(table.status),
    ownerIdIdx: index('idx_crm_enrichment_jobs_owner_id').on(table.ownerId),
    createdAtIdx: index('idx_crm_enrichment_jobs_created_at').on(table.createdAt),

    // Scheduling indexes
    scheduledIdx: index('idx_crm_enrichment_jobs_scheduled').on(table.isScheduled, table.schedulePaused, table.scheduleNextRun),
    pgbossScheduleIdx: index('idx_crm_enrichment_jobs_pgboss_schedule').on(table.pgbossScheduleName),
  })
);

// ============================================================================
// ENRICHMENT RESULTS TABLE
// ============================================================================

export const crmEnrichmentResults = pgTable(
  'crm_enrichment_results',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Relationships (nullable for individual lead enrichment without batch job)
    jobId: uuid('job_id')
      .references(() => crmEnrichmentJobs.id, { onDelete: 'cascade' }),

    // Polymorphic relationship - can be contact or lead
    entityId: uuid('entity_id').notNull(),
    entityType: text('entity_type').notNull().default('contact'), // 'contact' or 'lead'

    // Result data
    status: enrichmentResultStatusEnum('status').notNull().default('success'),
    score: numeric('score', { precision: 5, scale: 2 }), // 0-100 (for scoring jobs)
    enrichmentData: jsonb('enrichment_data').notNull().default({}), // Full AI response
    reasoning: text('reasoning'), // AI reasoning/explanation

    // Error tracking
    errorMessage: text('error_message'),

    // Performance metrics
    tokensUsed: integer('tokens_used'), // Total tokens consumed
    cost: numeric('cost', { precision: 15, scale: 6 }), // Cost in USD
    durationMs: integer('duration_ms'), // Processing time in milliseconds

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdIdx: index('idx_crm_enrichment_results_workspace_id').on(table.workspaceId),

    // Performance indexes
    jobIdIdx: index('idx_crm_enrichment_results_job_id').on(table.jobId),
    entityIdx: index('idx_crm_enrichment_results_entity').on(table.entityId, table.entityType),
    entityTypeIdx: index('idx_crm_enrichment_results_entity_type').on(table.entityType),
    statusIdx: index('idx_crm_enrichment_results_status').on(table.status),
    scoreIdx: index('idx_crm_enrichment_results_score').on(table.score),
  })
);

// ============================================================================
// TOOL CALLS TABLE
// ============================================================================

export const crmToolCalls = pgTable(
  'crm_tool_calls',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Relationships
    enrichmentResultId: uuid('enrichment_result_id')
      .notNull()
      .references(() => crmEnrichmentResults.id, { onDelete: 'cascade' }),

    // Tool information
    toolName: text('tool_name').notNull(), // e.g., 'web_search'
    arguments: jsonb('arguments').notNull().default({}), // Tool input
    result: jsonb('result').notNull().default({}), // Tool output
    provider: text('provider').default('brave'), // Search provider: 'brave' ($0.001) or 'perplexity' ($0.005)

    // Performance metrics
    cost: numeric('cost', { precision: 15, scale: 6 }), // Cost in USD
    durationMs: integer('duration_ms'), // Processing time in milliseconds

    // Status
    status: text('status').notNull().default('success'), // success, failed
    error: text('error'), // Error message if failed

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy
    workspaceIdIdx: index('idx_crm_tool_calls_workspace_id').on(table.workspaceId),

    // Performance indexes
    enrichmentResultIdIdx: index('idx_crm_tool_calls_enrichment_result_id').on(table.enrichmentResultId),
    toolNameIdx: index('idx_crm_tool_calls_tool_name').on(table.toolName),
    statusIdx: index('idx_crm_tool_calls_status').on(table.status),
    providerIdx: index('idx_crm_tool_calls_provider').on(table.provider),
  })
);

// ============================================================================
// TEMPLATES TABLE (Reusable Enrichment/Scoring Templates)
// Renamed from crmScoringModels to crmTemplates with template type field
// ============================================================================

export const crmTemplates = pgTable(
  'crm_templates',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (nullable for global templates)
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Template type (enrichment, scoring, export)
    type: templateTypeEnum('type').notNull().default('enrichment'),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),

    // AI Configuration (template)
    model: text('model').notNull().default('openai/gpt-4o-mini'),
    prompt: text('prompt').notNull(),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
    maxTokens: integer('max_tokens').default(500),

    // Usage tracking (moved to metadata for consistency)
    // Metadata contains: { usageCount, lastUsedAt, estimatedCostPerContact, lastTestResults }
    metadata: jsonb('metadata').notNull().default({}),

    // Sharing
    isTemplate: boolean('is_template').notNull().default(false), // If true, available across workspaces

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Tags
    tags: text('tags').array().notNull().default([]),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_templates_workspace_id').on(table.workspaceId),
    typeIdx: index('idx_crm_templates_type').on(table.type),
    deletedAtIdx: index('idx_crm_templates_deleted_at').on(table.deletedAt),
    ownerIdIdx: index('idx_crm_templates_owner_id').on(table.ownerId),
    isTemplateIdx: index('idx_crm_templates_is_template').on(table.isTemplate),
  })
);

// Keep legacy table name as alias for backward compatibility
export const crmScoringModels = crmTemplates;

// ============================================================================
// ENRICHMENT A/B TESTS TABLE
// ============================================================================

export const crmEnrichmentAbTests = pgTable(
  'crm_enrichment_ab_tests',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),
    sampleSize: integer('sample_size').notNull().default(50),
    sourceListId: uuid('source_list_id')
      .notNull()
      .references(() => crmContactLists.id, { onDelete: 'cascade' }),

    // Test configuration
    model: text('model').notNull().default('openai/gpt-4o-mini'),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
    maxTokens: integer('max_tokens').default(500),

    // Variants
    variantAPrompt: text('variant_a_prompt').notNull(),
    variantBPrompt: text('variant_b_prompt').notNull(),
    variantAName: text('variant_a_name').default('Control'),
    variantBName: text('variant_b_name').default('Variant B'),

    // Results
    variantAJobId: uuid('variant_a_job_id').references(() => crmEnrichmentJobs.id, {
      onDelete: 'set null',
    }),
    variantBJobId: uuid('variant_b_job_id').references(() => crmEnrichmentJobs.id, {
      onDelete: 'set null',
    }),
    variantAAvgScore: numeric('variant_a_avg_score', { precision: 5, scale: 2 }),
    variantBAvgScore: numeric('variant_b_avg_score', { precision: 5, scale: 2 }),
    winner: text('winner'), // 'A', 'B', or NULL
    pValue: numeric('p_value', { precision: 10, scale: 6 }),
    isSignificant: boolean('is_significant').default(false),

    // Status
    status: text('status').notNull().default('draft'), // draft, running, completed, cancelled
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Metadata
    metadata: jsonb('metadata').notNull().default({}),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_enrichment_ab_tests_workspace_id').on(table.workspaceId),
    sourceListIdIdx: index('idx_crm_enrichment_ab_tests_source_list_id').on(table.sourceListId),
    statusIdx: index('idx_crm_enrichment_ab_tests_status').on(table.status),
    ownerIdIdx: index('idx_crm_enrichment_ab_tests_owner_id').on(table.ownerId),
  })
);

// ============================================================================
// ENRICHMENT PIPELINES TABLE
// ============================================================================

export const crmEnrichmentPipelines = pgTable(
  'crm_enrichment_pipelines',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),

    // Configuration
    isTemplate: boolean('is_template').notNull().default(false), // If true, can be reused across workspaces

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_enrichment_pipelines_workspace_id').on(table.workspaceId),
    ownerIdIdx: index('idx_crm_enrichment_pipelines_owner_id').on(table.ownerId),
    isTemplateIdx: index('idx_crm_enrichment_pipelines_is_template').on(table.isTemplate),
  })
);

// ============================================================================
// PIPELINE STAGES TABLE
// ============================================================================

export const crmPipelineStages = pgTable(
  'crm_pipeline_stages',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Relationships
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => crmEnrichmentPipelines.id, { onDelete: 'cascade' }),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),
    stageType: enrichmentStageTypeEnum('stage_type').notNull(),
    order: integer('order').notNull(), // Execution order (0-based)

    // AI Configuration for this stage
    model: text('model').notNull().default('openai/gpt-4o-mini'),
    prompt: text('prompt').notNull(),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
    maxTokens: integer('max_tokens').default(500),

    // Stage control
    skipOnError: boolean('skip_on_error').notNull().default(false), // Continue to next stage if this one fails
    requiredScore: numeric('required_score', { precision: 5, scale: 2 }), // Minimum score to proceed (if previous stage was scoring)

    // Extensibility
    metadata: jsonb('metadata').notNull().default({}),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('idx_crm_pipeline_stages_workspace_id').on(table.workspaceId),
    pipelineIdIdx: index('idx_crm_pipeline_stages_pipeline_id').on(table.pipelineId),
    orderIdx: index('idx_crm_pipeline_stages_order').on(table.pipelineId, table.order),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmEnrichmentJobsRelations = relations(crmEnrichmentJobs, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmEnrichmentJobs.workspaceId],
    references: [workspaces.id],
  }),
  sourceList: one(crmContactLists, {
    fields: [crmEnrichmentJobs.sourceListId],
    references: [crmContactLists.id],
  }),
  owner: one(users, {
    fields: [crmEnrichmentJobs.ownerId],
    references: [users.id],
  }),
  // TODO: Uncomment when pipeline migration is run
  // pipeline: one(crmEnrichmentPipelines, {
  //   fields: [crmEnrichmentJobs.pipelineId],
  //   references: [crmEnrichmentPipelines.id],
  // }),
  // currentStage: one(crmPipelineStages, {
  //   fields: [crmEnrichmentJobs.currentStageId],
  //   references: [crmPipelineStages.id],
  // }),
  results: many(crmEnrichmentResults),
}));

export const crmEnrichmentResultsRelations = relations(crmEnrichmentResults, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmEnrichmentResults.workspaceId],
    references: [workspaces.id],
  }),
  job: one(crmEnrichmentJobs, {
    fields: [crmEnrichmentResults.jobId],
    references: [crmEnrichmentJobs.id],
  }),
  // Note: Polymorphic relationship - entity can be either contact or lead
  // Application code is responsible for ensuring referential integrity based on entityType
  toolCalls: many(crmToolCalls),
}));

export const crmToolCallsRelations = relations(crmToolCalls, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmToolCalls.workspaceId],
    references: [workspaces.id],
  }),
  enrichmentResult: one(crmEnrichmentResults, {
    fields: [crmToolCalls.enrichmentResultId],
    references: [crmEnrichmentResults.id],
  }),
}));

export const crmTemplatesRelations = relations(crmTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmTemplates.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [crmTemplates.ownerId],
    references: [users.id],
  }),
}));

// Legacy alias
export const crmScoringModelsRelations = crmTemplatesRelations;

export const crmEnrichmentPipelinesRelations = relations(crmEnrichmentPipelines, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmEnrichmentPipelines.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [crmEnrichmentPipelines.ownerId],
    references: [users.id],
  }),
  stages: many(crmPipelineStages),
  jobs: many(crmEnrichmentJobs),
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmPipelineStages.workspaceId],
    references: [workspaces.id],
  }),
  pipeline: one(crmEnrichmentPipelines, {
    fields: [crmPipelineStages.pipelineId],
    references: [crmEnrichmentPipelines.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmEnrichmentJob = typeof crmEnrichmentJobs.$inferSelect;
export type NewCrmEnrichmentJob = typeof crmEnrichmentJobs.$inferInsert;

export type CrmEnrichmentResult = typeof crmEnrichmentResults.$inferSelect;
export type NewCrmEnrichmentResult = typeof crmEnrichmentResults.$inferInsert;

export type EnrichmentJobType = (typeof enrichmentJobTypeEnum.enumValues)[number];
export type EnrichmentJobMode = (typeof enrichmentJobModeEnum.enumValues)[number];
export type EnrichmentJobStatus = (typeof enrichmentJobStatusEnum.enumValues)[number];
export type EnrichmentResultStatus = (typeof enrichmentResultStatusEnum.enumValues)[number];

export type CrmToolCall = typeof crmToolCalls.$inferSelect;
export type NewCrmToolCall = typeof crmToolCalls.$inferInsert;

export type CrmEnrichmentPipeline = typeof crmEnrichmentPipelines.$inferSelect;
export type NewCrmEnrichmentPipeline = typeof crmEnrichmentPipelines.$inferInsert;

export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type NewCrmPipelineStage = typeof crmPipelineStages.$inferInsert;

export type EnrichmentStageType = (typeof enrichmentStageTypeEnum.enumValues)[number];

export type CrmTemplate = typeof crmTemplates.$inferSelect;
export type NewCrmTemplate = typeof crmTemplates.$inferInsert;
export type TemplateType = (typeof templateTypeEnum.enumValues)[number];

// Legacy aliases
export type CrmScoringModel = CrmTemplate;
export type NewCrmScoringModel = NewCrmTemplate;

export type CrmEnrichmentAbTest = typeof crmEnrichmentAbTests.$inferSelect;
export type NewCrmEnrichmentAbTest = typeof crmEnrichmentAbTests.$inferInsert;

// ============================================================================
// LEAD ENRICHMENT TABLES (US-LEAD-AI-009)
// ============================================================================

export const leadEnrichmentStatusEnum = pgEnum('lead_enrichment_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

export const leadEnrichmentSourceEnum = pgEnum('lead_enrichment_source', [
  'mock',
  'clearbit',
  'zoominfo',
  'linkedin',
  'manual',
]);

export const leadEnrichmentProviderEnum = pgEnum('lead_enrichment_provider', [
  'mock',
  'clearbit',
  'zoominfo',
  'real',
  'hybrid',
]);

// ============================================================================
// LEAD ENRICHMENTS TABLE
// ============================================================================

export const leadEnrichments = pgTable(
  'lead_enrichments',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Enrichment status
    status: leadEnrichmentStatusEnum('status').notNull().default('pending'),
    source: leadEnrichmentSourceEnum('source').notNull().default('mock'),

    // Enriched data (JSONB for flexibility)
    enrichedFields: jsonb('enriched_fields'),
    // Example: { "industry": { "value": "Technology", "confidence": 0.95, "source": "mock" } }

    confidenceScores: jsonb('confidence_scores'),
    // Example: { "industry": 0.95, "employee_count": 0.80 }

    // Audit
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    errorMessage: text('error_message'),

    // Cost tracking (CRM-004)
    estimatedCost: numeric('estimated_cost', { precision: 15, scale: 6 }), // Pre-call estimate in USD
    actualCost: numeric('actual_cost', { precision: 15, scale: 6 }), // Post-call actual in USD
    providerCalls: jsonb('provider_calls'), // Track individual provider calls: { linkedin: { cost, duration }, zerobounce: { cost, duration }, websearch: { cost, duration } }

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One enrichment record per lead per source (idempotency)
    uniqueLeadEnrichment: unique('unique_lead_enrichment').on(table.leadId, table.source),

    // Index for pending/in-progress enrichments
    statusIdx: index('idx_lead_enrichments_status').on(
      table.workspaceId,
      table.status,
      table.createdAt
    ),

    // Index for lead enrichment history
    leadIdIdx: index('idx_lead_enrichments_lead').on(table.leadId, table.createdAt),
  })
);

// ============================================================================
// ENRICHMENT CONFIGS TABLE
// ============================================================================

export const leadEnrichmentConfigs = pgTable(
  'lead_enrichment_configs',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Auto-enrichment settings
    autoEnrichNewLeads: boolean('auto_enrich_new_leads').notNull().default(true),
    autoEnrichFields: text('auto_enrich_fields').array(),
    // Example: ["industry", "employee_count", "revenue", "technologies"]

    // Provider settings
    provider: leadEnrichmentProviderEnum('provider').notNull().default('mock'),
    apiKeyEncrypted: text('api_key_encrypted'), // Encrypted API key
    rateLimitPerHour: integer('rate_limit_per_hour').notNull().default(100),

    // Per-provider rate limits (CRM-004)
    linkedinRateLimitPerHour: integer('linkedin_rate_limit_per_hour').notNull().default(5), // LinkedIn is expensive
    zerobounceRateLimitPerHour: integer('zerobounce_rate_limit_per_hour').notNull().default(20),
    websearchRateLimitPerHour: integer('websearch_rate_limit_per_hour').notNull().default(60),

    // Cost configuration (CRM-004)
    linkedinCostPerCall: numeric('linkedin_cost_per_call', { precision: 10, scale: 4 }).notNull().default('0.0100'), // $0.01
    zerobounceCostPerCall: numeric('zerobounce_cost_per_call', { precision: 10, scale: 4 }).notNull().default('0.0080'), // $0.008
    websearchCostPerCall: numeric('websearch_cost_per_call', { precision: 10, scale: 4 }).notNull().default('0.0050'), // $0.005 (Perplexity)
    budgetLimitMonthly: numeric('budget_limit_monthly', { precision: 10, scale: 2 }), // Optional monthly budget cap in USD
    budgetUsedThisMonth: numeric('budget_used_this_month', { precision: 10, scale: 4 }).notNull().default('0'), // Running total
    budgetResetDay: integer('budget_reset_day').notNull().default(1), // Day of month to reset budget (1-28)

    // Confidence thresholds
    minConfidenceToApply: numeric('min_confidence_to_apply', { precision: 3, scale: 2 })
      .notNull()
      .default('0.70'), // Only apply data with >70% confidence

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // One config per workspace
    uniqueWorkspaceEnrichmentConfig: unique('unique_workspace_lead_enrichment_config').on(
      table.workspaceId
    ),

    workspaceIdIdx: index('idx_lead_enrichment_configs_workspace').on(table.workspaceId),
  })
);

// ============================================================================
// LEAD ENRICHMENT RELATIONS
// ============================================================================

export const leadEnrichmentsRelations = relations(leadEnrichments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadEnrichments.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadEnrichments.leadId],
    references: [crmLeads.id],
  }),
}));

export const leadEnrichmentConfigsRelations = relations(leadEnrichmentConfigs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadEnrichmentConfigs.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [leadEnrichmentConfigs.createdBy],
    references: [users.id],
    relationName: 'leadEnrichmentConfigCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [leadEnrichmentConfigs.updatedBy],
    references: [users.id],
    relationName: 'leadEnrichmentConfigUpdatedBy',
  }),
}));

// ============================================================================
// LEAD ENRICHMENT TYPES
// ============================================================================

export type LeadEnrichment = typeof leadEnrichments.$inferSelect;
export type NewLeadEnrichment = typeof leadEnrichments.$inferInsert;

export type LeadEnrichmentConfig = typeof leadEnrichmentConfigs.$inferSelect;
export type NewLeadEnrichmentConfig = typeof leadEnrichmentConfigs.$inferInsert;

export type LeadEnrichmentStatus = (typeof leadEnrichmentStatusEnum.enumValues)[number];
export type LeadEnrichmentSource = (typeof leadEnrichmentSourceEnum.enumValues)[number];
export type LeadEnrichmentProvider = (typeof leadEnrichmentProviderEnum.enumValues)[number];
