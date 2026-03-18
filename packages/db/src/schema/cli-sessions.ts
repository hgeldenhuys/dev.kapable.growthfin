/**
 * CLI Sessions Schema
 * Tracks active CLI sessions for heartbeat monitoring and reconnection
 */

import { index, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { relations } from 'drizzle-orm';

export const cliSessions = pgTable(
  'cli_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(), // CLI's unique session ID
    command: text('command').notNull(), // 'listen' or 'watch'
    lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata'), // CLI version, OS, etc.
  },
  (table) => ({
    projectIdIdx: index('idx_cli_sessions_project').on(table.projectId),
    heartbeatIdx: index('idx_cli_sessions_heartbeat').on(table.lastHeartbeat),
    uniqueSession: index('idx_cli_sessions_unique').on(table.sessionId, table.command),
  })
);

export const cliSessionsRelations = relations(cliSessions, ({ one }) => ({
  project: one(projects, {
    fields: [cliSessions.projectId],
    references: [projects.id],
  }),
}));

export type CliSession = typeof cliSessions.$inferSelect;
export type NewCliSession = typeof cliSessions.$inferInsert;
