/**
 * Claude Sessions Schema
 * Claude Code sessions (different from auth sessions)
 * Tracks conversation state, todos, and transaction boundaries
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { hookEvents } from './hook-events';

// Type for todos JSONB
export interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
}

export const claudeSessions = pgTable(
  'claude_sessions',
  {
    id: text('id').primaryKey(), // Claude Code session_id
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Agent type tracking
    currentAgentType: text('current_agent_type'), // Which agent type is active (e.g., 'Explore', 'ts-lint-fixer', 'main')

    // Transaction tracking (groups events by Stop/Start boundaries)
    currentTransactionId: uuid('current_transaction_id'), // Current Stop ID scoping work
    lastStopId: uuid('last_stop_id').references(() => hookEvents.id),
    lastUserPromptSubmitId: uuid('last_user_prompt_submit_id').references(() => hookEvents.id),
    lastStopTimestamp: timestamp('last_stop_timestamp', { withTimezone: true }),
    lastUserPromptSubmitTimestamp: timestamp('last_user_prompt_submit_timestamp', { withTimezone: true }),

    // Todos (JSONB array of TodoItem)
    todos: jsonb('todos').$type<TodoItem[]>(),
    currentTodoTitle: text('current_todo_title'),
    currentTodoHash: text('current_todo_hash'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('claude_sessions_project_id_idx').on(table.projectId),
    currentTransactionIdIdx: index('claude_sessions_current_transaction_id_idx').on(table.currentTransactionId),
    currentAgentTypeIdx: index('claude_sessions_current_agent_type_idx').on(table.currentAgentType),
  })
);

export type ClaudeSession = typeof claudeSessions.$inferSelect;
export type NewClaudeSession = typeof claudeSessions.$inferInsert;
