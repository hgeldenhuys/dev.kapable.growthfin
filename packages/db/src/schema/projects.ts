/**
 * Projects Schema
 * Maps to workspace directories where hooks are installed
 */

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(), // Same as projectId from .agent/config.json (UUID format)
    name: text('name').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    gitRepo: text('git_repo'), // Repository name (e.g., "agios")
    machineHost: text('machine_host'), // Machine hostname (e.g., "mbp-studio")
    gitUser: text('git_user'), // Git username (e.g., "hgeldenhuys")
    gitBranch: text('git_branch'), // Current git branch (e.g., "main", "feature/xyz")
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
