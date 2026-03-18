/**
 * Chat Messages Schema
 * Derived chat-style messages from event summaries
 */

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { hookEvents } from './hook-events';
import { claudeSessions } from './claude-sessions';
import { projects } from './projects';

export type ChatRole = 'user' | 'assistant';
export type ChatMessageType = 'thinking' | 'message';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hookEventId: uuid('hook_event_id')
      .notNull()
      .references(() => hookEvents.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => claudeSessions.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id'),
    role: text('role').notNull().$type<ChatRole>(),
    message: text('message').notNull(),
    type: text('type').notNull().$type<ChatMessageType>(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('chat_messages_session_id_idx').on(table.sessionId),
    projectIdIdx: index('chat_messages_project_id_idx').on(table.projectId),
    transactionIdIdx: index('chat_messages_transaction_id_idx').on(table.transactionId),
    timestampIdx: index('chat_messages_timestamp_idx').on(table.timestamp),
  })
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
