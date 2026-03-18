/**
 * Lead Management Schema
 * Bulk operations, segmentation, and advanced lead management features
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
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmLeads } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const bulkOperationTypeEnum = pgEnum('bulk_operation_type', [
  'assign',
  'update',
  'delete',
  'export',
  'rollback',
]);

export const bulkOperationStatusEnum = pgEnum('bulk_operation_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const bulkOperationItemStatusEnum = pgEnum('bulk_operation_item_status', [
  'pending',
  'success',
  'failed',
  'skipped',
]);

// ============================================================================
// BULK OPERATIONS TABLE
// ============================================================================

export const bulkOperations = pgTable(
  'bulk_operations',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Operation metadata
    operationType: bulkOperationTypeEnum('operation_type').notNull(),
    operationName: text('operation_name'), // Human-readable name

    // Operation payload
    payload: jsonb('payload').notNull(),
    // Example for 'update': { "fields": { "lifecycle_stage": "qualified" } }
    // Example for 'assign': { "agent_id": "uuid", "distribution_strategy": "single" }

    // Progress tracking
    status: bulkOperationStatusEnum('status').notNull().default('pending'),
    totalItems: integer('total_items').notNull(),
    processedItems: integer('processed_items').notNull().default(0),
    successfulItems: integer('successful_items').notNull().default(0),
    failedItems: integer('failed_items').notNull().default(0),

    // Error tracking
    errorSummary: text('error_summary'),
    errorDetails: jsonb('error_details'), // Array of errors with item IDs

    // Rollback configuration
    rollbackEnabled: boolean('rollback_enabled').notNull().default(true),
    rollbackWindowMinutes: integer('rollback_window_minutes').default(5),
    rollbackDeadline: timestamp('rollback_deadline', { withTimezone: true }),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_bulk_operations_workspace').on(
      table.workspaceId,
      table.createdAt
    ),
    statusIdx: index('idx_bulk_operations_status').on(table.workspaceId, table.status),
    createdByIdx: index('idx_bulk_operations_created_by').on(table.createdBy),
  })
);

// ============================================================================
// BULK OPERATION ITEMS TABLE
// ============================================================================

export const bulkOperationItems = pgTable(
  'bulk_operation_items',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Operation reference
    operationId: uuid('operation_id')
      .notNull()
      .references(() => bulkOperations.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Item status
    status: bulkOperationItemStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),

    // Before/after state (for rollback)
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),

    // Timing
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    operationIdIdx: index('idx_bulk_operation_items_operation').on(
      table.operationId,
      table.status
    ),
    leadIdIdx: index('idx_bulk_operation_items_lead').on(table.leadId),
    // Idempotency constraint: one item per lead per operation
    uniqueOperationLead: unique('unique_operation_lead').on(table.operationId, table.leadId),
  })
);

// ============================================================================
// LEAD SEGMENTS TABLE
// ============================================================================

export const leadSegments = pgTable(
  'lead_segments',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Segment metadata
    name: text('name').notNull(),
    description: text('description'),
    color: text('color'), // Hex color for UI tags
    icon: text('icon'), // Icon identifier

    // Query definition (JSON-based query builder)
    criteria: jsonb('criteria').notNull(),
    // Example: { "all": [{ "field": "propensity_score", "operator": ">", "value": 70 }] }

    // Refresh configuration
    autoRefresh: boolean('auto_refresh').notNull().default(true),
    refreshIntervalMinutes: integer('refresh_interval_minutes').default(15),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    nextRefreshAt: timestamp('next_refresh_at', { withTimezone: true }),

    // Membership tracking
    memberCount: integer('member_count').notNull().default(0),
    lastMemberCount: integer('last_member_count'), // For change detection

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_lead_segments_workspace').on(table.workspaceId),
    autoRefreshIdx: index('idx_lead_segments_auto_refresh').on(
      table.workspaceId,
      table.lastRefreshedAt
    ),
    nextRefreshIdx: index('idx_lead_segments_next_refresh').on(table.nextRefreshAt),
  })
);

// ============================================================================
// LEAD SEGMENT MEMBERSHIPS TABLE
// ============================================================================

export const leadSegmentMemberships = pgTable(
  'lead_segment_memberships',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Segment reference
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => leadSegments.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Membership metadata
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }), // Soft delete for history
  },
  (table) => ({
    segmentIdIdx: index('idx_segment_memberships_segment').on(table.segmentId),
    leadIdIdx: index('idx_segment_memberships_lead').on(table.leadId),
    // Idempotency constraint: one active membership per lead per segment
    uniqueSegmentLeadActive: unique('unique_segment_lead_active').on(
      table.segmentId,
      table.leadId,
      table.removedAt
    ),
  })
);

// ============================================================================
// SEGMENT METRICS HISTORY TABLE
// ============================================================================

export const segmentMetricsHistory = pgTable(
  'segment_metrics_history',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Segment reference
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => leadSegments.id, { onDelete: 'cascade' }),

    // Snapshot date
    snapshotDate: timestamp('snapshot_date', { withTimezone: true }).notNull(),

    // Core metrics
    totalLeads: integer('total_leads').notNull(),
    newLeads7d: integer('new_leads_7d'),
    newLeads30d: integer('new_leads_30d'),

    // Score metrics
    avgPropensityScore: numeric('avg_propensity_score', { precision: 5, scale: 2 }),
    avgEngagementScore: numeric('avg_engagement_score', { precision: 5, scale: 2 }),
    avgFitScore: numeric('avg_fit_score', { precision: 5, scale: 2 }),
    avgCompositeScore: numeric('avg_composite_score', { precision: 5, scale: 2 }),

    // Funnel metrics (lifecycle stages)
    funnelNew: integer('funnel_new').notNull().default(0),
    funnelContacted: integer('funnel_contacted').notNull().default(0),
    funnelQualified: integer('funnel_qualified').notNull().default(0),
    funnelUnqualified: integer('funnel_unqualified').notNull().default(0),
    funnelConverted: integer('funnel_converted').notNull().default(0),

    // Activity metrics
    activityVolume7d: integer('activity_volume_7d').notNull().default(0),
    activityVolume30d: integer('activity_volume_30d').notNull().default(0),

    // Conversion metrics
    conversionRate: numeric('conversion_rate', { precision: 5, scale: 4 }), // Qualified/total
    conversionCount: integer('conversion_count').notNull().default(0),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    segmentDateIdx: index('idx_segment_metrics_segment_date').on(
      table.segmentId,
      table.snapshotDate
    ),
    workspaceIdx: index('idx_segment_metrics_workspace').on(
      table.workspaceId,
      table.snapshotDate
    ),
    // One snapshot per segment per date
    uniqueSegmentSnapshot: unique('unique_segment_snapshot').on(
      table.segmentId,
      table.snapshotDate
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const bulkOperationsRelations = relations(bulkOperations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [bulkOperations.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [bulkOperations.createdBy],
    references: [users.id],
  }),
  items: many(bulkOperationItems),
}));

export const bulkOperationItemsRelations = relations(bulkOperationItems, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [bulkOperationItems.workspaceId],
    references: [workspaces.id],
  }),
  operation: one(bulkOperations, {
    fields: [bulkOperationItems.operationId],
    references: [bulkOperations.id],
  }),
  lead: one(crmLeads, {
    fields: [bulkOperationItems.leadId],
    references: [crmLeads.id],
  }),
}));

export const leadSegmentsRelations = relations(leadSegments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [leadSegments.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [leadSegments.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [leadSegments.updatedBy],
    references: [users.id],
  }),
  memberships: many(leadSegmentMemberships),
  metricsHistory: many(segmentMetricsHistory),
}));

export const leadSegmentMembershipsRelations = relations(
  leadSegmentMemberships,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [leadSegmentMemberships.workspaceId],
      references: [workspaces.id],
    }),
    segment: one(leadSegments, {
      fields: [leadSegmentMemberships.segmentId],
      references: [leadSegments.id],
    }),
    lead: one(crmLeads, {
      fields: [leadSegmentMemberships.leadId],
      references: [crmLeads.id],
    }),
  })
);

export const segmentMetricsHistoryRelations = relations(segmentMetricsHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [segmentMetricsHistory.workspaceId],
    references: [workspaces.id],
  }),
  segment: one(leadSegments, {
    fields: [segmentMetricsHistory.segmentId],
    references: [leadSegments.id],
  }),
}));

// ============================================================================
// LEAD SCORING MODELS TABLE
// ============================================================================

export const scoringModelTypeEnum = pgEnum('scoring_model_type', [
  'propensity',
  'engagement',
  'fit',
  'composite',
]);

export const leadScoringModels = pgTable(
  'lead_scoring_models',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Model configuration
    name: text('name').notNull(),
    modelType: scoringModelTypeEnum('model_type').notNull(),

    // Weights (for composite model)
    propensityWeight: numeric('propensity_weight', { precision: 5, scale: 4 }).default('0.4000'),
    engagementWeight: numeric('engagement_weight', { precision: 5, scale: 4 }).default('0.3000'),
    fitWeight: numeric('fit_weight', { precision: 5, scale: 4 }).default('0.3000'),

    // Engagement score factors
    engagementFactors: jsonb('engagement_factors'),
    // Example: { "email_open": 5, "email_click": 10, "website_visit": 15, "activity": 8 }

    // Fit score criteria
    fitCriteria: jsonb('fit_criteria'),
    // Example: { "company_size": { "min": 50, "max": 500, "weight": 0.3 }, "industries": ["Finance"], "weight": 0.4 }

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_scoring_models_workspace').on(table.workspaceId),
    modelTypeIdx: index('idx_scoring_models_type').on(table.workspaceId, table.modelType),
    // Only one active model per type per workspace
    uniqueActiveModel: unique('unique_active_model').on(
      table.workspaceId,
      table.modelType,
      table.isActive
    ),
  })
);

// ============================================================================
// LEAD SCORES TABLE
// ============================================================================

export const leadScores = pgTable(
  'lead_scores',
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

    // Scores (0-100)
    propensityScore: numeric('propensity_score', { precision: 5, scale: 2 }),
    engagementScore: numeric('engagement_score', { precision: 5, scale: 2 }),
    fitScore: numeric('fit_score', { precision: 5, scale: 2 }),
    compositeScore: numeric('composite_score', { precision: 5, scale: 2 }),

    // Score breakdown (JSONB for flexibility)
    scoreBreakdown: jsonb('score_breakdown'),
    // Example: { "engagement": { "email_opens": 20, "activities": 15 }, "fit": { "company_size": 30, "industry": 25 } }

    // Metadata
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    modelVersion: text('model_version'), // Track model version for debugging
  },
  (table) => ({
    // Only keep latest score per lead (idempotency)
    uniqueLeadScore: unique('unique_lead_score').on(table.leadId),
    compositeScoreIdx: index('idx_lead_scores_composite').on(
      table.workspaceId,
      table.compositeScore
    ),
    engagementScoreIdx: index('idx_lead_scores_engagement').on(
      table.workspaceId,
      table.engagementScore
    ),
    fitScoreIdx: index('idx_lead_scores_fit').on(table.workspaceId, table.fitScore),
  })
);

// ============================================================================
// LEAD SCORE HISTORY TABLE
// ============================================================================

export const leadScoreHistory = pgTable(
  'lead_score_history',
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

    // Historical scores
    propensityScore: numeric('propensity_score', { precision: 5, scale: 2 }),
    engagementScore: numeric('engagement_score', { precision: 5, scale: 2 }),
    fitScore: numeric('fit_score', { precision: 5, scale: 2 }),
    compositeScore: numeric('composite_score', { precision: 5, scale: 2 }),

    // Score breakdown (historical snapshot)
    scoreBreakdown: jsonb('score_breakdown'),

    // Timestamp
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadDateIdx: index('idx_new_score_history_lead_date').on(table.leadId, table.recordedAt),
    workspaceIdx: index('idx_new_score_history_workspace').on(
      table.workspaceId,
      table.recordedAt
    ),
  })
);

// ============================================================================
// LEAD DATA QUALITY TABLE
// ============================================================================

export const leadDataQuality = pgTable(
  'lead_data_quality',
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

    // Quality scores (0-100)
    overallScore: numeric('overall_score', { precision: 5, scale: 2 }).notNull(),
    completenessScore: numeric('completeness_score', { precision: 5, scale: 2 }),
    validityScore: numeric('validity_score', { precision: 5, scale: 2 }),

    // Validation results
    validationResults: jsonb('validation_results').notNull(),
    // Example: { "email": { "valid": true }, "phone": { "valid": false, "reason": "invalid format" }, "required_fields": { "missing": ["industry"] } }

    // Issue summary
    issueCount: integer('issue_count').notNull().default(0),
    criticalIssues: text('critical_issues').array(), // Array of critical issue descriptions

    // Metadata
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Only keep latest quality record per lead (idempotency)
    uniqueLeadQuality: unique('unique_lead_quality').on(table.leadId),
    qualityScoreIdx: index('idx_lead_data_quality_score').on(
      table.workspaceId,
      table.overallScore
    ),
    workspaceIdx: index('idx_lead_data_quality_workspace').on(
      table.workspaceId,
      table.lastValidatedAt
    ),
  })
);

// ============================================================================
// RELATIONS (SCORING & QUALITY)
// ============================================================================

export const leadScoringModelsRelations = relations(leadScoringModels, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadScoringModels.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [leadScoringModels.createdBy],
    references: [users.id],
    relationName: 'scoringModelCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [leadScoringModels.updatedBy],
    references: [users.id],
    relationName: 'scoringModelUpdatedBy',
  }),
}));

export const leadScoresRelations = relations(leadScores, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadScores.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadScores.leadId],
    references: [crmLeads.id],
  }),
}));

export const leadScoreHistoryRelations = relations(leadScoreHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadScoreHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadScoreHistory.leadId],
    references: [crmLeads.id],
  }),
}));

export const leadDataQualityRelations = relations(leadDataQuality, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadDataQuality.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadDataQuality.leadId],
    references: [crmLeads.id],
  }),
}));

// ============================================================================
// LEAD NOTES TABLE (Collaborative notes with mentions)
// ============================================================================

export const leadNotes = pgTable(
  'lead_notes',
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

    // Note content
    content: text('content').notNull(),
    contentHtml: text('content_html'), // Rich text HTML version

    // Mentions
    mentionedUserIds: uuid('mentioned_user_ids').array(), // Array of user IDs mentioned

    // Visibility
    isPrivate: boolean('is_private').notNull().default(false),

    // Soft delete (Agios standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    leadIdIdx: index('idx_lead_notes_lead').on(table.leadId, table.createdAt),
    mentionsIdx: index('idx_lead_notes_mentions').using('gin', table.mentionedUserIds),
    workspaceIdx: index('idx_lead_notes_workspace').on(table.workspaceId, table.createdAt),
  })
);

// ============================================================================
// NOTE MENTIONS TABLE (For notification tracking)
// ============================================================================

export const noteMentions = pgTable(
  'note_mentions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Note reference
    noteId: uuid('note_id')
      .notNull()
      .references(() => leadNotes.id, { onDelete: 'cascade' }),

    // User reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Notification status
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    noteIdIdx: index('idx_note_mentions_note').on(table.noteId),
    userIdIdx: index('idx_note_mentions_user').on(table.userId, table.notifiedAt),
    // One mention per user per note
    uniqueNoteMention: unique('unique_note_mention').on(table.noteId, table.userId),
  })
);

// ============================================================================
// LEAD IMPORTS TABLE (CSV import tracking)
// ============================================================================

export const importStatusEnum = pgEnum('import_status', [
  'validating',
  'validated',
  'importing',
  'completed',
  'failed',
]);

export const duplicateStrategyEnum = pgEnum('duplicate_strategy', [
  'skip',
  'update',
  'create',
]);

export const validationModeEnum = pgEnum('validation_mode', ['strict', 'lenient']);

export const leadImports = pgTable(
  'lead_imports',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Import metadata
    filename: text('filename').notNull(),
    fileSize: integer('file_size').notNull(),
    fileUrl: text('file_url'), // S3/storage URL

    // Configuration
    columnMapping: jsonb('column_mapping').notNull(),
    duplicateStrategy: duplicateStrategyEnum('duplicate_strategy').notNull(),
    validationMode: validationModeEnum('validation_mode').notNull(),

    // Status
    status: importStatusEnum('status').notNull().default('validating'),
    totalRows: integer('total_rows').notNull(),
    processedRows: integer('processed_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    errorRows: integer('error_rows').notNull().default(0),

    // Results
    validationErrors: jsonb('validation_errors'),
    importErrors: jsonb('import_errors'),
    errorFileUrl: text('error_file_url'), // CSV of failed rows

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    workspaceIdIdx: index('idx_lead_mgmt_imports_workspace').on(table.workspaceId, table.createdAt),
    statusIdx: index('idx_lead_mgmt_imports_status').on(table.workspaceId, table.status),
    createdByIdx: index('idx_lead_mgmt_imports_created_by').on(table.createdBy),
  })
);

// ============================================================================
// RELATIONS (NOTES & IMPORTS)
// ============================================================================

export const leadNotesRelations = relations(leadNotes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [leadNotes.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadNotes.leadId],
    references: [crmLeads.id],
  }),
  createdByUser: one(users, {
    fields: [leadNotes.createdBy],
    references: [users.id],
    relationName: 'noteCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [leadNotes.updatedBy],
    references: [users.id],
    relationName: 'noteUpdatedBy',
  }),
  mentions: many(noteMentions),
}));

export const noteMentionsRelations = relations(noteMentions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [noteMentions.workspaceId],
    references: [workspaces.id],
  }),
  note: one(leadNotes, {
    fields: [noteMentions.noteId],
    references: [leadNotes.id],
  }),
  user: one(users, {
    fields: [noteMentions.userId],
    references: [users.id],
  }),
}));

export const leadImportsRelations = relations(leadImports, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadImports.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [leadImports.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type BulkOperation = typeof bulkOperations.$inferSelect;
export type NewBulkOperation = typeof bulkOperations.$inferInsert;

export type BulkOperationItem = typeof bulkOperationItems.$inferSelect;
export type NewBulkOperationItem = typeof bulkOperationItems.$inferInsert;

export type LeadSegment = typeof leadSegments.$inferSelect;
export type NewLeadSegment = typeof leadSegments.$inferInsert;

export type LeadSegmentMembership = typeof leadSegmentMemberships.$inferSelect;
export type NewLeadSegmentMembership = typeof leadSegmentMemberships.$inferInsert;

export type SegmentMetricsHistory = typeof segmentMetricsHistory.$inferSelect;
export type NewSegmentMetricsHistory = typeof segmentMetricsHistory.$inferInsert;

export type LeadScoringModel = typeof leadScoringModels.$inferSelect;
export type NewLeadScoringModel = typeof leadScoringModels.$inferInsert;

export type LeadScore = typeof leadScores.$inferSelect;
export type NewLeadScore = typeof leadScores.$inferInsert;

export type LeadScoreHistory = typeof leadScoreHistory.$inferSelect;
export type NewLeadScoreHistory = typeof leadScoreHistory.$inferInsert;

export type LeadDataQuality = typeof leadDataQuality.$inferSelect;
export type NewLeadDataQuality = typeof leadDataQuality.$inferInsert;

export type LeadNote = typeof leadNotes.$inferSelect;
export type NewLeadNote = typeof leadNotes.$inferInsert;

export type NoteMention = typeof noteMentions.$inferSelect;
export type NewNoteMention = typeof noteMentions.$inferInsert;

export type LeadImport = typeof leadImports.$inferSelect;
export type NewLeadImport = typeof leadImports.$inferInsert;

export type BulkOperationType = (typeof bulkOperationTypeEnum.enumValues)[number];
export type BulkOperationStatus = (typeof bulkOperationStatusEnum.enumValues)[number];
export type BulkOperationItemStatus = (typeof bulkOperationItemStatusEnum.enumValues)[number];
export type ScoringModelType = (typeof scoringModelTypeEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
export type DuplicateStrategy = (typeof duplicateStrategyEnum.enumValues)[number];
export type ValidationMode = (typeof validationModeEnum.enumValues)[number];

// ============================================================================
// PREDICTION MODELS TABLE (US-LEAD-AI-010)
// ============================================================================

export const predictionModelTypeEnum = pgEnum('prediction_model_type', [
  'conversion',
  'churn',
  'lifetime_value',
]);

export const predictionAlgorithmEnum = pgEnum('prediction_algorithm', [
  'logistic_regression',
  'random_forest',
  'gradient_boosting',
  'neural_network',
]);

export const predictionModels = pgTable(
  'prediction_models',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Model configuration
    modelType: predictionModelTypeEnum('model_type').notNull(),
    modelVersion: text('model_version').notNull(),
    algorithm: predictionAlgorithmEnum('algorithm').notNull(),

    // Training data
    trainingSamples: integer('training_samples').notNull(),
    trainingStartedAt: timestamp('training_started_at', { withTimezone: true }).notNull(),
    trainingCompletedAt: timestamp('training_completed_at', { withTimezone: true }),

    // Model performance
    accuracy: numeric('accuracy', { precision: 5, scale: 4 }),
    precision: numeric('precision', { precision: 5, scale: 4 }),
    recall: numeric('recall', { precision: 5, scale: 4 }),
    f1Score: numeric('f1_score', { precision: 5, scale: 4 }),

    // Feature importance (JSONB)
    featureImportance: jsonb('feature_importance'),
    // Example: { "engagement_score": 0.35, "fit_score": 0.30, "timing_signals": 0.25, ... }

    // Model weights (for serialization)
    modelWeights: jsonb('model_weights'),
    // Stores the trained model parameters for prediction

    // Status
    isActive: boolean('is_active').notNull().default(false),

    // Audit trail (Agios standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('idx_prediction_models_workspace').on(
      table.workspaceId,
      table.modelType,
      table.isActive
    ),
    // One active model per type per workspace
    uniqueActiveModel: unique('unique_active_prediction_model').on(
      table.workspaceId,
      table.modelType,
      table.isActive
    ),
  })
);

// ============================================================================
// LEAD PREDICTIONS TABLE
// ============================================================================

export const leadPredictions = pgTable(
  'lead_predictions',
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

    // Model reference
    modelId: uuid('model_id')
      .notNull()
      .references(() => predictionModels.id, { onDelete: 'cascade' }),

    // Prediction scores
    predictionScore: numeric('prediction_score', { precision: 5, scale: 2 })
      .notNull()
      .$type<number>(),
    confidenceInterval: numeric('confidence_interval', { precision: 5, scale: 2 }),

    // Explanation
    topFactors: jsonb('top_factors'),
    // Example: [
    //   { "factor": "engagement_score", "contribution": 35, "description": "High email engagement" },
    //   ...
    // ]

    // Metadata
    predictedAt: timestamp('predicted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Keep latest prediction per lead (idempotency)
    uniqueLeadPrediction: unique('unique_lead_prediction').on(table.leadId),
    scoreIdx: index('idx_lead_predictions_score').on(
      table.workspaceId,
      table.predictionScore
    ),
    modelIdx: index('idx_lead_predictions_model').on(table.modelId, table.predictedAt),
  })
);

// ============================================================================
// PREDICTION HISTORY TABLE
// ============================================================================

export const predictionHistory = pgTable(
  'prediction_history',
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

    // Model reference
    modelId: uuid('model_id')
      .notNull()
      .references(() => predictionModels.id, { onDelete: 'cascade' }),

    // Historical prediction
    predictionScore: numeric('prediction_score', { precision: 5, scale: 2 }).notNull(),
    predictedAt: timestamp('predicted_at', { withTimezone: true }).notNull(),

    // Actual outcome (if known)
    actualConverted: boolean('actual_converted'),
    actualConvertedAt: timestamp('actual_converted_at', { withTimezone: true }),

    // Accuracy
    predictionError: numeric('prediction_error', { precision: 5, scale: 2 }),
    predictionCorrect: boolean('prediction_correct'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadDateIdx: index('idx_prediction_history_lead_date').on(
      table.leadId,
      table.predictedAt
    ),
    accuracyIdx: index('idx_prediction_history_accuracy').on(
      table.workspaceId,
      table.modelId,
      table.predictionCorrect
    ),
  })
);

// ============================================================================
// PREDICTION TRAINING DATA TABLE
// ============================================================================

export const predictionTrainingData = pgTable(
  'prediction_training_data',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Model reference
    modelId: uuid('model_id')
      .notNull()
      .references(() => predictionModels.id, { onDelete: 'cascade' }),

    // Lead reference
    leadId: uuid('lead_id')
      .notNull()
      .references(() => crmLeads.id, { onDelete: 'cascade' }),

    // Features snapshot
    features: jsonb('features').notNull(),
    // Snapshot of features at training time

    // Label (outcome)
    converted: boolean('converted').notNull(),
    convertedAt: timestamp('converted_at', { withTimezone: true }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    modelIdx: index('idx_prediction_training_data_model').on(table.modelId),
    workspaceIdx: index('idx_prediction_training_data_workspace').on(
      table.workspaceId,
      table.converted
    ),
  })
);

// ============================================================================
// PREDICTION RELATIONS
// ============================================================================

export const predictionModelsRelations = relations(predictionModels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [predictionModels.workspaceId],
    references: [workspaces.id],
  }),
  predictions: many(leadPredictions),
  history: many(predictionHistory),
  trainingData: many(predictionTrainingData),
}));

export const leadPredictionsRelations = relations(leadPredictions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [leadPredictions.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [leadPredictions.leadId],
    references: [crmLeads.id],
  }),
  model: one(predictionModels, {
    fields: [leadPredictions.modelId],
    references: [predictionModels.id],
  }),
}));

export const predictionHistoryRelations = relations(predictionHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [predictionHistory.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(crmLeads, {
    fields: [predictionHistory.leadId],
    references: [crmLeads.id],
  }),
  model: one(predictionModels, {
    fields: [predictionHistory.modelId],
    references: [predictionModels.id],
  }),
}));

export const predictionTrainingDataRelations = relations(
  predictionTrainingData,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [predictionTrainingData.workspaceId],
      references: [workspaces.id],
    }),
    lead: one(crmLeads, {
      fields: [predictionTrainingData.leadId],
      references: [crmLeads.id],
    }),
    model: one(predictionModels, {
      fields: [predictionTrainingData.modelId],
      references: [predictionModels.id],
    }),
  })
);

// ============================================================================
// PREDICTION TYPES
// ============================================================================

export type PredictionModel = typeof predictionModels.$inferSelect;
export type NewPredictionModel = typeof predictionModels.$inferInsert;

export type LeadPrediction = typeof leadPredictions.$inferSelect;
export type NewLeadPrediction = typeof leadPredictions.$inferInsert;

export type PredictionHistory = typeof predictionHistory.$inferSelect;
export type NewPredictionHistory = typeof predictionHistory.$inferInsert;

export type PredictionTrainingData = typeof predictionTrainingData.$inferSelect;
export type NewPredictionTrainingData = typeof predictionTrainingData.$inferInsert;

export type PredictionModelType = (typeof predictionModelTypeEnum.enumValues)[number];
export type PredictionAlgorithm = (typeof predictionAlgorithmEnum.enumValues)[number];
