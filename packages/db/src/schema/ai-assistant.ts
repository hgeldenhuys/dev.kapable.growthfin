/**
 * AI Assistant Schema
 * Chat conversations with AI assistant using OpenRouter
 */

import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  text,
  varchar,
  integer,
  numeric,
  uniqueIndex,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { workspaces } from './workspaces';
import { llmConfigs } from './llm-configs';

/**
 * AI Conversations
 * One active conversation per user per workspace
 */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    clearedAt: timestamp('cleared_at', { withTimezone: true }), // NULL = active conversation
    metadata: jsonb('metadata').default({}),
  },
  (table) => ({
    // Enforce single active conversation per user per workspace
    // Note: We'll add NULLS NOT DISTINCT constraint in the migration manually
    // since Drizzle ORM doesn't support it yet
    uniqueActiveConversation: uniqueIndex('uk_user_workspace_active_conversation').on(
      table.userId,
      table.workspaceId,
      table.clearedAt
    ),
    // Index for querying by workspace
    workspaceIdx: index('ai_conversations_workspace_idx').on(table.workspaceId),
    // Index for querying by user
    userIdx: index('ai_conversations_user_idx').on(table.userId),
  })
);

/**
 * AI Messages
 * Individual messages in conversations
 */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    model: varchar('model', { length: 100 }),
    tokenUsage: jsonb('token_usage'), // { input, output, total }
    context: jsonb('context'), // Route params, user info, etc.
  },
  (table) => ({
    // Index for efficient conversation message retrieval
    conversationMessagesIdx: index('idx_conversation_messages').on(
      table.conversationId,
      table.createdAt
    ),
  })
);

/**
 * AI Configuration
 * Workspace-level AI assistant configuration
 */
export const aiConfig = pgTable(
  'ai_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Option 1: Use existing LLM config (recommended)
    llmConfigId: uuid('llm_config_id')
      .references(() => llmConfigs.id, { onDelete: 'set null' }),

    // Option 2: Direct OpenRouter configuration (legacy, kept for backwards compatibility)
    model: varchar('model', { length: 100 }).default('anthropic/claude-3.5-haiku').notNull(),
    maxTokens: integer('max_tokens').default(4096),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.70'),
    apiKeyEncrypted: text('api_key_encrypted'), // Encrypted with workspace key

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Ensure one config per workspace
    uniqueWorkspaceConfig: unique('uk_workspace_ai_config').on(table.workspaceId),
  })
);

// Relations
export const aiConversationsRelations = relations(aiConversations, ({ many, one }) => ({
  messages: many(aiMessages),
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [aiConversations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const aiConfigRelations = relations(aiConfig, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiConfig.workspaceId],
    references: [workspaces.id],
  }),
  llmConfig: one(llmConfigs, {
    fields: [aiConfig.llmConfigId],
    references: [llmConfigs.id],
  }),
}));

/**
 * AI Tool Invocations
 * Track all tool calls for audit and analytics
 */
export const aiToolInvocations = pgTable(
  'ai_tool_invocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .references(() => aiMessages.id, { onDelete: 'set null' }),
    toolName: varchar('tool_name', { length: 50 }).notNull(), // 'read_file', 'search_code', 'list_directory'
    parameters: jsonb('parameters').notNull(),
    result: jsonb('result'),
    status: varchar('status', { length: 20 }).notNull(), // 'success', 'error', 'rate_limited'
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Index for querying by workspace
    workspaceIdx: index('idx_tool_invocations_workspace').on(
      table.workspaceId,
      table.createdAt
    ),
    // Index for querying by conversation
    conversationIdx: index('idx_tool_invocations_conversation').on(table.conversationId),
  })
);

/**
 * AI Rate Limits
 * Track tool call rate limits per workspace
 */
export const aiRateLimits = pgTable(
  'ai_rate_limits',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    toolCalls: integer('tool_calls').notNull().default(0),
  },
  (table) => ({
    // Primary key: workspace + window
    pk: {
      name: 'pk_ai_rate_limits',
      columns: [table.workspaceId, table.windowStart],
    },
    // Index for querying by window
    windowIdx: index('idx_rate_limits_window').on(table.windowStart),
  })
);

// Relations (continued)
export const aiToolInvocationsRelations = relations(aiToolInvocations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiToolInvocations.workspaceId],
    references: [workspaces.id],
  }),
  conversation: one(aiConversations, {
    fields: [aiToolInvocations.conversationId],
    references: [aiConversations.id],
  }),
  message: one(aiMessages, {
    fields: [aiToolInvocations.messageId],
    references: [aiMessages.id],
  }),
}));

export const aiRateLimitsRelations = relations(aiRateLimits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiRateLimits.workspaceId],
    references: [workspaces.id],
  }),
}));

/**
 * AI Claude Code Sessions
 * Tracks Claude Code command execution sessions for AI assistant (askClaudeTo tool)
 * Separate from observability claude_sessions table
 */
export const aiClaudeCodeSessions = pgTable(
  'ai_claude_code_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
    conversationId: uuid('conversation_id')
      .references(() => aiConversations.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'completed', 'error'
    prompt: text('prompt'),
    result: jsonb('result'),
    filesModified: text('files_modified').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastActive: timestamp('last_active', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    // Index for querying by workspace
    workspaceIdx: index('idx_ai_claude_code_sessions_workspace').on(
      table.workspaceId,
      table.lastActive
    ),
    // Index for session lookup
    sessionIdIdx: index('idx_ai_claude_code_sessions_session_id').on(table.sessionId),
    // Index for cleanup query
    expiresIdx: index('idx_ai_claude_code_sessions_expires').on(table.expiresAt),
  })
);

// Relations (continued)
export const aiClaudeCodeSessionsRelations = relations(aiClaudeCodeSessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiClaudeCodeSessions.workspaceId],
    references: [workspaces.id],
  }),
  conversation: one(aiConversations, {
    fields: [aiClaudeCodeSessions.conversationId],
    references: [aiConversations.id],
  }),
}));

// Types
export type AiConversation = typeof aiConversations.$inferSelect;
export type NewAiConversation = typeof aiConversations.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
export type AiConfig = typeof aiConfig.$inferSelect;
export type NewAiConfig = typeof aiConfig.$inferInsert;
export type AiToolInvocation = typeof aiToolInvocations.$inferSelect;
export type NewAiToolInvocation = typeof aiToolInvocations.$inferInsert;
export type AiRateLimit = typeof aiRateLimits.$inferSelect;
export type NewAiRateLimit = typeof aiRateLimits.$inferInsert;
export type AiClaudeCodeSession = typeof aiClaudeCodeSessions.$inferSelect;
export type NewAiClaudeCodeSession = typeof aiClaudeCodeSessions.$inferInsert;
