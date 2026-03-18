/**
 * Batches Schema
 * Generic batch planning framework for CRM operations (enrichment, export, etc.)
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
  pgEnum,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { crmContactLists } from './contact-lists';

// ============================================================================
// ENUMS
// ============================================================================

export const batchTypeEnum = pgEnum('crm_batch_type', [
  'enrichment',
  'export',
  'segmentation',
  'scoring',
]);

export const batchStatusEnum = pgEnum('crm_batch_status', [
  'planned',
  'scheduled',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

// ============================================================================
// BATCHES TABLE
// ============================================================================

export const crmBatches = pgTable(
  'crm_batches',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // List relationship (batches operate on lists)
    listId: uuid('list_id')
      .notNull()
      .references(() => crmContactLists.id, { onDelete: 'cascade' }),

    // Batch type and status
    type: batchTypeEnum('type').notNull(),
    status: batchStatusEnum('status').notNull().default('planned'),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),

    // Type-specific configuration (JSONB for flexibility)
    // For enrichment: { templateId: uuid, budgetLimit: number }
    // For export: { format: string, fields: string[] }
    // For segmentation: { criteria: object }
    // For scoring: { modelId: uuid, threshold: number }
    configuration: jsonb('configuration').notNull().default({}),

    // Scheduling
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Progress tracking (for real-time monitoring and historical records)
    totalEntities: integer('total_entities').default(0),
    processedEntities: integer('processed_entities').default(0),
    successfulEntities: integer('successful_entities').default(0),
    failedEntities: integer('failed_entities').default(0),
    skippedEntities: integer('skipped_entities').default(0),
    actualCost: decimal('actual_cost', { precision: 10, scale: 4 }).default('0'),

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
    workspaceIdIdx: index('idx_crm_batches_workspace_id').on(table.workspaceId),

    // Performance indexes
    listIdIdx: index('idx_crm_batches_list_id').on(table.listId),
    statusIdx: index('idx_crm_batches_status').on(table.status),
    typeIdx: index('idx_crm_batches_type').on(table.type),
    scheduledAtIdx: index('idx_crm_batches_scheduled_at').on(table.scheduledAt),
    createdByIdx: index('idx_crm_batches_created_by').on(table.createdBy),

    // Composite index for filtering
    workspaceListIdx: index('idx_crm_batches_workspace_list').on(table.workspaceId, table.listId),
    workspaceStatusIdx: index('idx_crm_batches_workspace_status').on(table.workspaceId, table.status),
    workspaceTypeIdx: index('idx_crm_batches_workspace_type').on(table.workspaceId, table.type),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmBatchesRelations = relations(crmBatches, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmBatches.workspaceId],
    references: [workspaces.id],
  }),
  list: one(crmContactLists, {
    fields: [crmBatches.listId],
    references: [crmContactLists.id],
  }),
  createdByUser: one(users, {
    fields: [crmBatches.createdBy],
    references: [users.id],
    relationName: 'batchCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [crmBatches.updatedBy],
    references: [users.id],
    relationName: 'batchUpdatedBy',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmBatch = typeof crmBatches.$inferSelect;
export type NewCrmBatch = typeof crmBatches.$inferInsert;
export type BatchType = (typeof batchTypeEnum.enumValues)[number];
export type BatchStatus = (typeof batchStatusEnum.enumValues)[number];
