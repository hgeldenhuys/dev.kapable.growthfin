/**
 * Work Items Schema (US-014)
 * WorkItem system for batch/task semantic separation
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Entity types that work items can reference
 */
export const entityTypeEnum = pgEnum('work_item_entity_type', [
  'lead',
  'contact',
  'opportunity',
  'account',
]);

/**
 * Work item types (what kind of work needs to be done)
 */
export const workItemTypeEnum = pgEnum('work_item_type', [
  'lead_conversion',
  'follow_up',
  'review',
  'qualification',
]);

/**
 * Work item status lifecycle
 */
export const workItemStatusEnum = pgEnum('work_item_status', [
  'pending',
  'claimed',
  'in_progress',
  'completed',
  'expired',
  'cancelled',
]);

/**
 * Who/what completed the work item
 */
export const completedByEnum = pgEnum('work_item_completed_by', [
  'user',
  'ai',
  'system',
]);

/**
 * Source types for provenance tracking (UI-001)
 * Tracks where work items originated from
 */
export const sourceTypeEnum = pgEnum('work_item_source_type', [
  'batch',
  'state_machine',
  'manual',
  'campaign',
  'workflow',
]);

// ============================================================================
// WORK ITEMS TABLE
// ============================================================================

export const workItems = pgTable(
  'work_items',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (Agios standard)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Entity reference (what this work item is about)
    entityType: entityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    // Work item type
    workItemType: workItemTypeEnum('work_item_type').notNull(),

    // Basic info
    title: text('title').notNull(),
    description: text('description'),
    priority: integer('priority').notNull().default(0),

    // Assignment
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

    // Status and lifecycle
    status: workItemStatusEnum('status').notNull().default('pending'),

    // Claiming
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimedBy: uuid('claimed_by').references(() => users.id, { onDelete: 'set null' }),

    // Timing
    dueAt: timestamp('due_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Completion
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: completedByEnum('completed_by'),
    result: jsonb('result'), // Stores completion result

    // Metadata
    metadata: jsonb('metadata').notNull().default({}),

    // Provenance tracking (UI-001)
    // Tracks where this work item originated from
    sourceType: sourceTypeEnum('source_type'),
    sourceId: uuid('source_id'), // References the source entity (batch, campaign, etc.)

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
    workspaceIdIdx: index('idx_work_items_workspace_id').on(table.workspaceId),

    // Status index for querying work items by status
    statusIdx: index('idx_work_items_status').on(table.status),

    // Entity index for finding work items for a specific entity
    entityIdx: index('idx_work_items_entity').on(table.entityType, table.entityId),

    // Expiration index for finding items that need expiration
    expiresAtIdx: index('idx_work_items_expires_at').on(table.expiresAt),

    // Assignment index for finding work items assigned to a user
    assignedToIdx: index('idx_work_items_assigned_to').on(table.assignedTo),

    // Composite index for workspace + status queries (common pattern)
    workspaceStatusIdx: index('idx_work_items_workspace_status').on(
      table.workspaceId,
      table.status
    ),

    // Provenance index for grouping queries (UI-001)
    sourceIdx: index('idx_work_items_source').on(table.sourceType, table.sourceId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const workItemsRelations = relations(workItems, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workItems.workspaceId],
    references: [workspaces.id],
  }),
  assignedToUser: one(users, {
    fields: [workItems.assignedTo],
    references: [users.id],
    relationName: 'assignedWorkItems',
  }),
  claimedByUser: one(users, {
    fields: [workItems.claimedBy],
    references: [users.id],
    relationName: 'claimedWorkItems',
  }),
  createdByUser: one(users, {
    fields: [workItems.createdBy],
    references: [users.id],
    relationName: 'createdWorkItems',
  }),
  updatedByUser: one(users, {
    fields: [workItems.updatedBy],
    references: [users.id],
    relationName: 'updatedWorkItems',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;

export type EntityType = (typeof entityTypeEnum.enumValues)[number];
export type WorkItemType = (typeof workItemTypeEnum.enumValues)[number];
export type WorkItemStatus = (typeof workItemStatusEnum.enumValues)[number];
export type CompletedBy = (typeof completedByEnum.enumValues)[number];
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];
