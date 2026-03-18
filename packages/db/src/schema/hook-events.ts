/**
 * Hook Events Schema
 * Stores captured Claude Code hook events
 *
 * Note: This is a system-wide log without workspace isolation.
 * Each project directory gets a unique projectId.
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const hookEvents = pgTable(
  'hook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id').notNull(), // Generated during hooks install (UUID format string)
    sessionId: text('session_id').notNull(), // Claude Code session ID
    transactionId: uuid('transaction_id'), // Groups events by Stop/Start boundary
    eventName: text('event_name').notNull(), // Hook event type
    toolName: text('tool_name'), // Tool name (for PreToolUse/PostToolUse)
    // Payload structure: { event: hookJson, conversation: transcriptLineJson, timestamp: ... }
    payload: jsonb('payload').notNull(),
    agentType: text('agent_type'), // Extracted from payload.tool_input.subagent_type for Task tools (main, Explore, ts-lint-fixer, etc.)
    tags: text('tags').array().default(sql`'{}'`), // SDLC session tags (e.g., ['backend-dev', 'crm-module'])
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }), // NULL = unprocessed, NOT NULL = processed

    // Performance tracking timestamps
    receivedAt: timestamp('received_at', { withTimezone: true }), // When API received the POST request
    queuedAt: timestamp('queued_at', { withTimezone: true }), // When job was queued in pgboss
    workerStartedAt: timestamp('worker_started_at', { withTimezone: true }), // When worker picked up the job
    workerCompletedAt: timestamp('worker_completed_at', { withTimezone: true }), // When worker finished processing
  },
  (table) => ({
    projectIdIdx: index('hook_events_project_id_idx').on(table.projectId),
    sessionIdIdx: index('hook_events_session_id_idx').on(table.sessionId),
    transactionIdIdx: index('hook_events_transaction_id_idx').on(table.transactionId),
    eventNameIdx: index('hook_events_event_name_idx').on(table.eventName),
    processedAtIdx: index('hook_events_processed_at_idx').on(table.processedAt),
    createdAtIdx: index('hook_events_created_at_idx').on(table.createdAt),
    agentTypeIdx: index('hook_events_agent_type_idx').on(table.agentType),
    // GIN index on tags array for efficient containment queries
    tagsIdx: index('hook_events_tags_idx').using('gin', table.tags),
  })
);

export type HookEvent = typeof hookEvents.$inferSelect;
export type NewHookEvent = typeof hookEvents.$inferInsert;
