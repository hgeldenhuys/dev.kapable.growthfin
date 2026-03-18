/**
 * Context Usage Events Schema
 * Tracks token usage and context consumption for Claude Code sessions
 */

import { index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { hookEvents } from './hook-events';
import { claudeSessions } from './claude-sessions';
import { projects } from './projects';

export const contextUsageEvents = pgTable(
  'context_usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hookEventId: uuid('hook_event_id')
      .notNull()
      .references(() => hookEvents.id, { onDelete: 'cascade' }),

    // Context
    sessionId: text('session_id')
      .notNull()
      .references(() => claudeSessions.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id'), // Groups by Stop boundary
    agentType: text('agent_type'), // Agent type (e.g., 'Explore', 'ts-lint-fixer', 'main')

    // Token usage metrics (from conversation.message.usage)
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheCreationInputTokens: integer('cache_creation_input_tokens').notNull().default(0),
    cacheReadInputTokens: integer('cache_read_input_tokens').notNull().default(0),
    cacheCreation5mTokens: integer('cache_creation_5m_tokens').notNull().default(0),
    cacheCreation1hTokens: integer('cache_creation_1h_tokens').notNull().default(0),

    // Derived metrics
    totalTokens: integer('total_tokens').notNull().default(0), // input + output
    cacheHitRate: numeric('cache_hit_rate', { precision: 5, scale: 2 }), // Percentage 0-100
    costEstimate: numeric('cost_estimate', { precision: 10, scale: 6 }), // USD cost estimate

    // Transaction context
    toolsUsed: jsonb('tools_used').$type<string[]>(), // List of tools used in this transaction
    toolUseCount: integer('tool_use_count').notNull().default(0),

    // Timing
    durationMs: integer('duration_ms'), // Transaction duration from first event to Stop
    transactionStartedAt: timestamp('transaction_started_at', { withTimezone: true }),

    // Model info
    model: text('model'), // e.g., 'claude-sonnet-4-5-20250929'
    serviceTier: text('service_tier'), // Service tier from usage info

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hookEventIdIdx: index('context_usage_events_hook_event_id_idx').on(table.hookEventId),
    sessionIdIdx: index('context_usage_events_session_id_idx').on(table.sessionId),
    projectIdIdx: index('context_usage_events_project_id_idx').on(table.projectId),
    transactionIdIdx: index('context_usage_events_transaction_id_idx').on(table.transactionId),
    agentTypeIdx: index('context_usage_events_agent_type_idx').on(table.agentType),
    createdAtIdx: index('context_usage_events_created_at_idx').on(table.createdAt),
  })
);

export type ContextUsageEvent = typeof contextUsageEvents.$inferSelect;
export type NewContextUsageEvent = typeof contextUsageEvents.$inferInsert;
