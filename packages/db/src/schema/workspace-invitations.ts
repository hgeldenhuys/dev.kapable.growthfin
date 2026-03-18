/**
 * Workspace Invitations Schema
 * Tracks pending invitations to workspaces
 */

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(), // 'admin', 'member', 'viewer' (NOT 'owner')
    token: text('token').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: index('workspace_invitations_token_idx').on(table.token),
    workspaceIdx: index('workspace_invitations_workspace_idx').on(table.workspaceId),
    emailIdx: index('workspace_invitations_email_idx').on(table.email),
  })
).enableRLS();

// Relations
export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
  inviter: one(users, {
    fields: [workspaceInvitations.invitedBy],
    references: [users.id],
  }),
}));

export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;
