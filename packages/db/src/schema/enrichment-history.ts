/**
 * Enrichment History Schema
 * Versioned tracking of enrichment operations with content deduplication
 *
 * Epic: Database Foundation for Enrichment History
 * Story: US-ENRICH-HIST-001
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  char,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { crmBatches } from './batches';
import { crmEnrichmentJobs } from './enrichment';

// ============================================================================
// ENRICHMENT HISTORY TABLE
// ============================================================================

/**
 * Tracks historical enrichment operations with versioning
 *
 * Key features:
 * - Full versioning of all enrichment operations
 * - Links to deduplicated content via enrichment_report_id
 * - Stores template snapshot at time of enrichment
 * - Polymorphic relationship to contacts/leads via entity_id + entity_type
 * - Audit trail linking to tasks and jobs
 */
export const crmEnrichmentHistory = pgTable(
  'crm_enrichment_history',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (REQUIRED for multi-tenancy)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Polymorphic entity relationship (contact or lead)
    entityId: uuid('entity_id').notNull(),
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    // Note: No foreign key for polymorphic relationship - application enforces integrity

    // Link to deduplicated content (nullable - content may be purged)
    enrichmentReportId: uuid('enrichment_report_id').references(
      () => crmEnrichmentContent.id,
      { onDelete: 'set null' }
    ),

    // Template snapshot at time of enrichment (JSONB for flexibility)
    // Stores full template config so we can see exactly what was used
    templateSnapshot: jsonb('template_snapshot').notNull(),

    // Optional links to batch and job (column still named task_id for compatibility)
    taskId: uuid('task_id').references(() => crmBatches.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => crmEnrichmentJobs.id, { onDelete: 'cascade' }),

    // Human-readable summary fields
    enrichmentSummary: text('enrichment_summary'), // Brief summary of enrichment
    changesSinceLast: text('changes_since_last'), // What changed from previous enrichment

    // Extensibility for future metadata
    metadata: jsonb('metadata').notNull().default('{}'),

    // Audit timestamp (only created_at - history is immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Workspace index for multi-tenancy
    workspaceIdx: index('idx_enrichment_history_workspace').on(table.workspaceId),

    // Fast entity lookup (entity_id + entity_type)
    entityIdx: index('idx_enrichment_history_entity').on(table.entityId, table.entityType),

    // Chronological sorting (DESC for recent-first queries)
    createdIdx: index('idx_enrichment_history_created').on(table.createdAt),

    // Template filtering via GIN index for JSONB queries
    // Enables: WHERE template_snapshot->>'templateId' = 'xyz'
    templateGinIdx: index('idx_enrichment_history_template').using('gin', table.templateSnapshot),

    // Task/Job lookups
    taskIdx: index('idx_enrichment_history_task').on(table.taskId),
    jobIdx: index('idx_enrichment_history_job').on(table.jobId),

    // Composite index for common query pattern: entity + chronological
    entityCreatedIdx: index('idx_enrichment_history_entity_created').on(
      table.entityId,
      table.entityType,
      table.createdAt
    ),
  })
);

// ============================================================================
// ENRICHMENT CONTENT TABLE (Deduplication)
// ============================================================================

/**
 * Stores deduplicated enrichment report content
 *
 * Key features:
 * - SHA-256 hash-based deduplication
 * - Reference counting for safe deletion
 * - Optional compression for large reports
 * - Workspace-scoped with unique constraint on hash
 *
 * How it works:
 * 1. Before saving enrichment, compute SHA-256 hash of markdown report
 * 2. Check if content_hash exists for workspace
 * 3. If exists: Reuse existing content, increment reference_count
 * 4. If not exists: Insert new content with reference_count = 1
 * 5. Link enrichment_history.enrichment_report_id to content.id
 */
export const crmEnrichmentContent = pgTable(
  'crm_enrichment_content',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (REQUIRED for multi-tenancy)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // SHA-256 hash of enrichment_report (64 hex characters)
    contentHash: char('content_hash', { length: 64 }).notNull(),

    // The actual markdown enrichment report
    enrichmentReport: text('enrichment_report').notNull(),

    // Optional compression flag (future enhancement)
    compressed: boolean('compressed').notNull().default(false),

    // Reference counting for safe garbage collection
    // Increment when new history entry references this content
    // Decrement when history entry is deleted
    // Delete content when reference_count reaches 0
    referenceCount: integer('reference_count').notNull().default(1),

    // Audit timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Workspace index for multi-tenancy
    workspaceIdx: index('idx_enrichment_content_workspace').on(table.workspaceId),

    // Fast hash lookup for deduplication
    hashIdx: index('idx_enrichment_content_hash').on(table.contentHash),

    // UNIQUE constraint: One hash per workspace (deduplication)
    // This ensures we never store duplicate content for the same workspace
    uniqueWorkspaceHash: unique('uniq_workspace_content_hash').on(
      table.workspaceId,
      table.contentHash
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmEnrichmentHistoryRelations = relations(crmEnrichmentHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEnrichmentHistory.workspaceId],
    references: [workspaces.id],
  }),
  batch: one(crmBatches, {
    fields: [crmEnrichmentHistory.taskId],
    references: [crmBatches.id],
  }),
  job: one(crmEnrichmentJobs, {
    fields: [crmEnrichmentHistory.jobId],
    references: [crmEnrichmentJobs.id],
  }),
  enrichmentContent: one(crmEnrichmentContent, {
    fields: [crmEnrichmentHistory.enrichmentReportId],
    references: [crmEnrichmentContent.id],
  }),
}));

export const crmEnrichmentContentRelations = relations(crmEnrichmentContent, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEnrichmentContent.workspaceId],
    references: [workspaces.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmEnrichmentHistory = typeof crmEnrichmentHistory.$inferSelect;
export type NewCrmEnrichmentHistory = typeof crmEnrichmentHistory.$inferInsert;

export type CrmEnrichmentContent = typeof crmEnrichmentContent.$inferSelect;
export type NewCrmEnrichmentContent = typeof crmEnrichmentContent.$inferInsert;
