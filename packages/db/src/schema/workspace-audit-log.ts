/**
 * Workspace Audit Log Schema
 * Immutable log of all workspace changes for compliance and debugging
 *
 * This is an append-only table - no updates or deletes.
 * Tracks who changed what, when, and the before/after state.
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export const workspaceAuditLog = pgTable(
  'workspace_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Action performed (created, updated, deleted, invited_member, etc.)
    action: text('action').notNull(),

    // Type of resource affected (contact, account, campaign, member, etc.)
    resourceType: text('resource_type').notNull(),

    // ID of the specific resource (nullable for workspace-level actions)
    resourceId: uuid('resource_id'),

    // JSONB storing before/after state:
    // { "before": {...}, "after": {...} }
    // For creates: before = null
    // For deletes: after = null or final state
    changes: jsonb('changes'),

    // When the action occurred
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Required indexes for efficient querying
    workspaceIdx: index('workspace_audit_log_workspace_idx').on(table.workspaceId),
    userIdx: index('workspace_audit_log_user_idx').on(table.userId),
    createdAtIdx: index('workspace_audit_log_created_at_idx').on(table.createdAt.desc()),
    resourceTypeIdx: index('workspace_audit_log_resource_type_idx').on(table.resourceType),

    // Composite index for common query patterns
    workspaceResourceIdx: index('workspace_audit_log_workspace_resource_idx')
      .on(table.workspaceId, table.resourceType, table.resourceId),
  })
);

// Relations
export const workspaceAuditLogRelations = relations(workspaceAuditLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceAuditLog.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceAuditLog.userId],
    references: [users.id],
  }),
}));

export type WorkspaceAuditLog = typeof workspaceAuditLog.$inferSelect;
export type NewWorkspaceAuditLog = typeof workspaceAuditLog.$inferInsert;

/**
 * Common Action Types (examples):
 *
 * Resource Actions:
 * - created
 * - updated
 * - deleted
 * - restored (for soft-deleted resources)
 *
 * Member Actions:
 * - invited_member
 * - removed_member
 * - changed_role
 * - accepted_invite
 * - declined_invite
 *
 * Campaign Actions:
 * - activated_campaign
 * - paused_campaign
 * - archived_campaign
 * - sent_campaign
 *
 * Integration Actions:
 * - connected_integration
 * - disconnected_integration
 * - synced_data
 *
 * Settings Actions:
 * - updated_settings
 * - enabled_feature
 * - disabled_feature
 */

/**
 * Changes JSONB Structure Examples:
 *
 * Update:
 * {
 *   "before": { "status": "draft", "name": "Old Name" },
 *   "after": { "status": "active", "name": "New Name" }
 * }
 *
 * Create:
 * {
 *   "before": null,
 *   "after": { "status": "draft", "name": "New Campaign" }
 * }
 *
 * Delete:
 * {
 *   "before": { "status": "active", "name": "Campaign" },
 *   "after": null
 * }
 *
 * Member Invitation:
 * {
 *   "email": "user@example.com",
 *   "role": "member"
 * }
 *
 * Role Change:
 * {
 *   "before": { "role": "member" },
 *   "after": { "role": "admin" }
 * }
 */
