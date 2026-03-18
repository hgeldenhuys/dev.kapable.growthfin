/**
 * Todos Schema
 * Persistent todos that survive across sessions
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { claudeSessions } from './claude-sessions';
import { projects } from './projects';

// Todo status enum
export const todoStatusEnum = pgEnum('todo_status', ['pending', 'in_progress', 'completed']);

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Session reference (for history)
    sessionId: text('session_id')
      .notNull()
      .references(() => claudeSessions.id, { onDelete: 'cascade' }),

    // Project and agent scoping (for persistence)
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(), // Agent type identifier

    // Todo content
    content: text('content').notNull(),
    activeForm: text('active_form').notNull(),
    status: todoStatusEnum('status').notNull().default('pending'),
    order: integer('order').notNull().default(0),

    // Persistence flags
    isLatest: boolean('is_latest').notNull().default(true),
    migratedFrom: text('migrated_from'), // Source session if migrated

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Composite index for efficient latest todos query
    projectAgentLatestIdx: index('idx_todos_project_agent_latest')
      .on(table.projectId, table.agentId, table.isLatest),

    // Other indexes
    sessionIdIdx: index('idx_todos_session_id').on(table.sessionId),
    createdAtIdx: index('idx_todos_created_at').on(table.createdAt),
  })
);

// Relations
export const todosRelations = relations(todos, ({ one }) => ({
  session: one(claudeSessions, {
    fields: [todos.sessionId],
    references: [claudeSessions.id],
  }),
  project: one(projects, {
    fields: [todos.projectId],
    references: [projects.id],
  }),
}));

// Types
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

// Helper type for API responses
export interface TodoWithMetadata extends Todo {
  fromPreviousSession?: boolean;
  sessionCount?: number;
}