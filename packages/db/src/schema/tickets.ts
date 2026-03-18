/**
 * Tickets Schema
 * Support tickets and product feedback system with AI integration
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
  serial,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Ticket category — differentiates support tickets from product feedback
 */
export const ticketCategoryEnum = pgEnum('ticket_category', [
  'support',
  'product_feedback',
  'feature_request',
  'bug_report',
]);

/**
 * Ticket priority levels
 */
export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

/**
 * Ticket status lifecycle
 */
export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
]);

/**
 * Entity types that tickets can reference (CRM linkage)
 */
export const ticketEntityTypeEnum = pgEnum('ticket_entity_type', [
  'lead',
  'contact',
  'account',
]);

/**
 * Source of ticket creation
 */
export const ticketSourceEnum = pgEnum('ticket_source', [
  'ai_chat',
  'manual',
  'email',
  'api',
]);

// ============================================================================
// CRM TICKETS TABLE
// ============================================================================

export const crmTickets = pgTable(
  'crm_tickets',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (standard)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Human-readable ticket number (auto-increment per workspace, managed by trigger/app logic)
    ticketNumber: serial('ticket_number').notNull(),

    // Classification
    category: ticketCategoryEnum('category').notNull().default('support'),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('open'),

    // Content
    title: text('title').notNull(),
    description: text('description'),
    resolution: text('resolution'), // Filled when resolved

    // CRM linkage (nullable — product tickets won't have these)
    entityType: ticketEntityTypeEnum('entity_type'),
    entityId: uuid('entity_id'),

    // Assignment
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    reportedById: uuid('reported_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Source tracking
    source: ticketSourceEnum('source').notNull().default('manual'),
    aiConversationId: uuid('ai_conversation_id'), // Links back to AI conversation that created it

    // Extensibility (standard)
    tags: text('tags').array().notNull().default([]),
    customFields: jsonb('custom_fields').notNull().default({}),

    // Soft delete (standard)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    canBeRevived: boolean('can_be_revived').notNull().default(true),
    revivalCount: integer('revival_count').notNull().default(0),

    // Audit trail (standard)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // REQUIRED: Workspace index for multi-tenancy
    workspaceIdIdx: index('idx_crm_tickets_workspace_id').on(table.workspaceId),

    // Common query patterns
    workspaceStatusIdx: index('idx_crm_tickets_workspace_status').on(
      table.workspaceId,
      table.status
    ),
    workspaceCategoryIdx: index('idx_crm_tickets_workspace_category').on(
      table.workspaceId,
      table.category
    ),
    workspaceAssigneeStatusIdx: index('idx_crm_tickets_workspace_assignee_status').on(
      table.workspaceId,
      table.assigneeId,
      table.status
    ),

    // CRM entity reference index
    entityIdx: index('idx_crm_tickets_entity').on(table.entityType, table.entityId),

    // Ticket number lookup
    ticketNumberIdx: index('idx_crm_tickets_ticket_number').on(table.workspaceId, table.ticketNumber),
  })
);

// ============================================================================
// TICKET COMMENTS TABLE
// ============================================================================

export const crmTicketComments = pgTable(
  'crm_ticket_comments',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Parent ticket
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => crmTickets.id, { onDelete: 'cascade' }),

    // Workspace isolation (standard)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Content
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(false), // Internal notes vs customer-visible

    // Audit trail
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // Ticket comments lookup
    ticketIdIdx: index('idx_crm_ticket_comments_ticket_id').on(table.ticketId),

    // Workspace index
    workspaceIdIdx: index('idx_crm_ticket_comments_workspace_id').on(table.workspaceId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmTicketsRelations = relations(crmTickets, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmTickets.workspaceId],
    references: [workspaces.id],
  }),
  assignee: one(users, {
    fields: [crmTickets.assigneeId],
    references: [users.id],
    relationName: 'assignedTickets',
  }),
  reportedBy: one(users, {
    fields: [crmTickets.reportedById],
    references: [users.id],
    relationName: 'reportedTickets',
  }),
  createdByUser: one(users, {
    fields: [crmTickets.createdBy],
    references: [users.id],
    relationName: 'createdTickets',
  }),
  updatedByUser: one(users, {
    fields: [crmTickets.updatedBy],
    references: [users.id],
    relationName: 'updatedTickets',
  }),
  comments: many(crmTicketComments),
}));

export const crmTicketCommentsRelations = relations(crmTicketComments, ({ one }) => ({
  ticket: one(crmTickets, {
    fields: [crmTicketComments.ticketId],
    references: [crmTickets.id],
  }),
  workspace: one(workspaces, {
    fields: [crmTicketComments.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [crmTicketComments.createdBy],
    references: [users.id],
    relationName: 'ticketComments',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CrmTicket = typeof crmTickets.$inferSelect;
export type NewCrmTicket = typeof crmTickets.$inferInsert;
export type CrmTicketComment = typeof crmTicketComments.$inferSelect;
export type NewCrmTicketComment = typeof crmTicketComments.$inferInsert;

export type TicketCategory = (typeof ticketCategoryEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];
export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketEntityType = (typeof ticketEntityTypeEnum.enumValues)[number];
export type TicketSource = (typeof ticketSourceEnum.enumValues)[number];
