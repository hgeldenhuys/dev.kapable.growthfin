/**
 * Workspace Members Schema
 * Junction table for user-workspace relationships
 */

import { index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { workspaces } from './workspaces';

export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member', 'viewer']);
export const workspaceMemberStatusEnum = pgEnum('workspace_member_status', ['pending', 'active', 'inactive']);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRoleEnum('role').notNull().default('member'),
    status: workspaceMemberStatusEnum('status').notNull().default('active'),
    invitedBy: uuid('invited_by').references(() => users.id),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueWorkspaceUser: unique().on(table.workspaceId, table.userId),
    workspaceIdx: index('workspace_members_workspace_idx').on(table.workspaceId),
    userIdx: index('workspace_members_user_idx').on(table.userId),
    statusIdx: index('workspace_members_status_idx').on(table.status),
  })
).enableRLS();

// Relations
export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [workspaceMembers.invitedBy],
    references: [users.id],
  }),
}));

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type WorkspaceRole = typeof workspaceMembers.$inferSelect.role;
export type WorkspaceMemberStatus = typeof workspaceMembers.$inferSelect.status;
