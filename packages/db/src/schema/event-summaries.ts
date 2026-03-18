/**
 * Event Summaries Schema
 * LLM-generated summaries of hook events
 */

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { hookEvents } from './hook-events';
import { claudeSessions } from './claude-sessions';
import { projects } from './projects';
import { llmConfigs } from './llm-configs';

export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd';

export const eventSummaries = pgTable(
  'event_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hookEventId: uuid('hook_event_id')
      .notNull()
      .references(() => hookEvents.id, { onDelete: 'cascade' }),
    hookEventType: text('hook_event_type').notNull().$type<HookEventName>(),
    summary: text('summary').notNull(),

    // Context
    sessionId: text('session_id')
      .notNull()
      .references(() => claudeSessions.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id'), // Groups by Stop boundary (nullable - not all events have transaction)
    agentType: text('agent_type'), // Agent type (e.g., 'Explore', 'ts-lint-fixer', 'main')
    role: text('role').notNull(), // 'assistant', 'user', 'system'
    llmConfigId: uuid('llm_config_id')
      .notNull()
      .references(() => llmConfigs.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hookEventIdIdx: index('event_summaries_hook_event_id_idx').on(table.hookEventId),
    sessionIdIdx: index('event_summaries_session_id_idx').on(table.sessionId),
    projectIdIdx: index('event_summaries_project_id_idx').on(table.projectId),
    transactionIdIdx: index('event_summaries_transaction_id_idx').on(table.transactionId),
  })
);

export type EventSummary = typeof eventSummaries.$inferSelect;
export type NewEventSummary = typeof eventSummaries.$inferInsert;
