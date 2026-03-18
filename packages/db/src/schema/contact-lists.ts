/**
 * Contact Lists Schema
 * Tables for managing contact lists, memberships, and enrichment data
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
import { crmContacts } from './crm';

// ============================================================================
// ENUMS
// ============================================================================

export const crmEntityTypeEnum = pgEnum('crm_entity_type', [
  'lead',
  'contact',
  'account',
  'opportunity',
]);

export const contactListTypeEnum = pgEnum('crm_contact_list_type', [
  'manual',
  'import',
  'campaign',
  'enrichment',
  'segment',
  'derived',
]);

export const contactListStatusEnum = pgEnum('crm_contact_list_status', [
  'active',
  'archived',
  'processing',
]);

export const membershipSourceEnum = pgEnum('crm_membership_source', [
  'manual',
  'import',
  'campaign',
  'enrichment',
  'segment',
  'api',
  'operation',
]);

// ============================================================================
// CONTACT LISTS TABLE
// ============================================================================

export const crmContactLists = pgTable(
  'crm_contact_lists',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Polymorphic entity type (NEW)
    entityType: crmEntityTypeEnum('entity_type').notNull().default('contact'),

    // Basic information
    name: text('name').notNull(),
    description: text('description'),
    type: contactListTypeEnum('type').notNull().default('manual'),
    status: contactListStatusEnum('status').notNull().default('active'),

    // Parent list support for refinements
    parentListId: uuid('parent_list_id'), // Self-referencing for list refinements

    // Source list for filtered/derived lists
    sourceListId: uuid('source_list_id'), // Original list if created from filters/operations

    // Import tracking
    importBatchId: text('import_batch_id'), // External import batch identifier
    importSource: text('import_source'), // e.g., 'csv', 'api', 'salesforce'
    importedAt: timestamp('imported_at', { withTimezone: true }),

    // Budget configuration
    budgetLimit: numeric('budget_limit', { precision: 15, scale: 2 }), // Max budget for enrichment
    budgetPerContact: numeric('budget_per_contact', { precision: 15, scale: 2 }), // Cost per contact enrichment

    // Custom field schema (NEW - stores field definitions for this list)
    customFieldSchema: jsonb('custom_field_schema').notNull().default({}),

    // Cached statistics (updated periodically)
    totalContacts: integer('total_contacts').notNull().default(0),
    activeContacts: integer('active_contacts').notNull().default(0),

    // Enrichment statistics
    enrichedContacts: integer('enriched_contacts').notNull().default(0),
    enrichmentScore: numeric('enrichment_score', { precision: 5, scale: 2 }), // Average enrichment score

    // Ownership
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Extensibility
    tags: text('tags').array().notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}), // Flexible metadata storage

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
    workspaceIdIdx: index('idx_crm_contact_lists_workspace_id').on(table.workspaceId),

    // NEW: Composite index on entity_type and workspace_id for performance
    entityTypeIdx: index('idx_crm_lists_entity_type').on(table.entityType, table.workspaceId),

    // Performance indexes
    ownerIdIdx: index('idx_crm_contact_lists_owner_id').on(table.ownerId),
    typeIdx: index('idx_crm_contact_lists_type').on(table.type),
    statusIdx: index('idx_crm_contact_lists_status').on(table.status),
    parentListIdIdx: index('idx_crm_contact_lists_parent_list_id').on(table.parentListId),
    sourceListIdIdx: index('idx_crm_contact_lists_source_list_id').on(table.sourceListId),
    importBatchIdIdx: index('idx_crm_contact_lists_import_batch_id').on(table.importBatchId),
  })
);

// ============================================================================
// CONTACT LIST MEMBERSHIPS TABLE (Junction)
// ============================================================================

export const crmContactListMemberships = pgTable(
  'crm_contact_list_memberships',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (for performance, though redundant via foreign keys)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Junction relationships
    listId: uuid('list_id')
      .notNull()
      .references(() => crmContactLists.id, { onDelete: 'cascade' }),

    // Polymorphic entity reference (NEW)
    entityType: crmEntityTypeEnum('entity_type').notNull().default('contact'),
    entityId: uuid('entity_id').notNull(), // No FK - polymorphic (validated in app)

    // Membership tracking
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    source: membershipSourceEnum('source').notNull().default('manual'),

    // Enrichment data per membership
    enrichmentScore: numeric('enrichment_score', { precision: 5, scale: 2 }), // 0-100
    enrichmentData: jsonb('enrichment_data').notNull().default({}), // Provider-specific enrichment results
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),
    enrichmentCost: numeric('enrichment_cost', { precision: 15, scale: 4 }), // Cost for enriching this contact

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Extensibility
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
    workspaceIdIdx: index('idx_crm_contact_list_memberships_workspace_id').on(table.workspaceId),

    // NEW: Composite index on entity_type and entity_id for polymorphic queries
    entityIdx: index('idx_crm_list_memberships_entity').on(table.entityType, table.entityId),

    // Performance indexes
    listIdIdx: index('idx_crm_contact_list_memberships_list_id').on(table.listId),
    contactIdIdx: index('idx_crm_contact_list_memberships_contact_id').on(table.entityId),
    addedByIdx: index('idx_crm_contact_list_memberships_added_by').on(table.addedBy),
    sourceIdx: index('idx_crm_contact_list_memberships_source').on(table.source),
    isActiveIdx: index('idx_crm_contact_list_memberships_is_active').on(table.isActive),

    // Unique constraint: an entity can only be in a list once
    uniqueListContact: unique('unique_list_contact').on(table.listId, table.entityId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const crmContactListsRelations = relations(crmContactLists, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmContactLists.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [crmContactLists.ownerId],
    references: [users.id],
  }),
  parentList: one(crmContactLists, {
    fields: [crmContactLists.parentListId],
    references: [crmContactLists.id],
  }),
  childLists: many(crmContactLists),
  memberships: many(crmContactListMemberships),
}));

export const crmContactListMembershipsRelations = relations(
  crmContactListMemberships,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [crmContactListMemberships.workspaceId],
      references: [workspaces.id],
    }),
    list: one(crmContactLists, {
      fields: [crmContactListMemberships.listId],
      references: [crmContactLists.id],
    }),
    // Note: Polymorphic relation - entityId can reference different tables based on entityType
    // For backward compatibility, we keep 'contact' relation name but it points to entityId
    // Application code must check entityType before using this relation
    contact: one(crmContacts, {
      fields: [crmContactListMemberships.entityId],
      references: [crmContacts.id],
    }),
    addedByUser: one(users, {
      fields: [crmContactListMemberships.addedBy],
      references: [users.id],
    }),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type CrmContactList = typeof crmContactLists.$inferSelect;
export type NewCrmContactList = typeof crmContactLists.$inferInsert;

export type CrmContactListMembership = typeof crmContactListMemberships.$inferSelect;
export type NewCrmContactListMembership = typeof crmContactListMemberships.$inferInsert;

export type CrmEntityType = (typeof crmEntityTypeEnum.enumValues)[number];
export type ContactListType = (typeof contactListTypeEnum.enumValues)[number];
export type ContactListStatus = (typeof contactListStatusEnum.enumValues)[number];
export type MembershipSource = (typeof membershipSourceEnum.enumValues)[number];
