/**
 * AI Intelligence Schema
 * Database schema for semantic codebase indexing, workspace memory, and intelligent suggestions
 */

import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, check, index, pgEnum, vector, real } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { aiConversations } from './ai-assistant';
import { users } from './users';

// =======================
// Workspace Memory
// =======================

export const memoryTypeEnum = pgEnum('memory_type_enum', ['pattern', 'decision', 'preference', 'fact']);
export const memoryStatusEnum = pgEnum('memory_status_enum', ['active', 'deprecated', 'superseded']);

export const workspaceMemory = pgTable('workspace_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  // Memory classification
  memoryType: varchar('memory_type', { length: 50 }).notNull(), // 'pattern', 'decision', 'preference', 'fact'
  category: varchar('category', { length: 100 }), // 'architecture', 'testing', 'styling', 'deployment'

  // Content
  key: varchar('key', { length: 255 }).notNull(), // 'auth_pattern', 'api_framework', 'test_runner'
  value: text('value').notNull(), // "We use JWT with refresh tokens"
  confidence: real('confidence').default(1.0), // 0.0 to 1.0

  // Context
  sourceConversationId: uuid('source_conversation_id').references(() => aiConversations.id),
  relatedFiles: text('related_files').array(), // Files this memory relates to
  tags: text('tags').array(), // Searchable tags

  // Lifecycle
  status: varchar('status', { length: 20 }).default('active'), // 'active', 'deprecated', 'superseded'
  supersededBy: uuid('superseded_by').references((): any => workspaceMemory.id),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessed: timestamp('last_accessed').defaultNow(),
}, (table) => ({
  workspaceIdx: index('idx_workspace_memory_workspace').on(table.workspaceId),
  typeIdx: index('idx_workspace_memory_type').on(table.memoryType, table.category),
  keyIdx: index('idx_workspace_memory_key').on(table.key),
  statusIdx: index('idx_workspace_memory_status').on(table.status),
  // GIN index on tags array handled by migration
}));

export const workspaceMemoryRelations = relations(workspaceMemory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemory.workspaceId],
    references: [workspaces.id],
  }),
  sourceConversation: one(aiConversations, {
    fields: [workspaceMemory.sourceConversationId],
    references: [aiConversations.id],
  }),
  supersededByMemory: one(workspaceMemory, {
    fields: [workspaceMemory.supersededBy],
    references: [workspaceMemory.id],
  }),
}));

export type WorkspaceMemory = typeof workspaceMemory.$inferSelect;
export type NewWorkspaceMemory = typeof workspaceMemory.$inferInsert;
export type MemoryType = 'pattern' | 'decision' | 'preference' | 'fact';
export type MemoryStatus = 'active' | 'deprecated' | 'superseded';

// =======================
// Conversation Summaries
// =======================

export const conversationSummaries = pgTable('conversation_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }).unique(),

  // Summary content
  summary: text('summary').notNull(), // AI-generated summary (500-1000 chars)
  topics: text('topics').array(), // Main topics discussed
  decisionsMade: text('decisions_made').array(), // Key decisions
  filesDiscussed: text('files_discussed').array(), // Files read/modified

  // Search
  keywords: text('keywords').array(), // Extracted keywords for search

  // Metadata
  messageCount: integer('message_count').notNull(),
  tokenCount: integer('token_count').notNull(),
  durationSeconds: integer('duration_seconds'), // Conversation duration

  // Links
  relatedCommits: varchar('related_commits', { length: 40 }).array(), // Git commits during conversation
  relatedMemories: uuid('related_memories').array(), // Workspace memories created

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  conversationIdx: index('idx_conversation_summaries_conversation').on(table.conversationId),
  // GIN indexes handled by migration
}));

export const conversationSummariesRelations = relations(conversationSummaries, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [conversationSummaries.conversationId],
    references: [aiConversations.id],
  }),
}));

export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type NewConversationSummary = typeof conversationSummaries.$inferInsert;

// =======================
// Workspace Suggestions
// =======================

export const suggestionTypeEnum = pgEnum('suggestion_type_enum', ['test_coverage', 'documentation', 'code_quality']);
export const suggestionSeverityEnum = pgEnum('suggestion_severity_enum', ['low', 'medium', 'high', 'critical']);
export const suggestionStatusEnum = pgEnum('suggestion_status_enum', ['pending', 'accepted', 'dismissed', 'applied']);

export const workspaceSuggestions = pgTable('workspace_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  // Suggestion details
  suggestionType: varchar('suggestion_type', { length: 50 }).notNull(), // 'test_coverage', 'documentation', 'code_quality'
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // Target
  filePath: text('file_path'),
  lineStart: integer('line_start'),
  lineEnd: integer('line_end'),

  // Suggestion
  suggestedAction: text('suggested_action'), // What to do
  codeExample: text('code_example'), // Example fix

  // Status
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'accepted', 'dismissed', 'applied'

  // Metadata
  detectedAt: timestamp('detected_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdx: index('idx_workspace_suggestions_workspace').on(table.workspaceId),
  statusIdx: index('idx_workspace_suggestions_status').on(table.status),
  typeIdx: index('idx_workspace_suggestions_type').on(table.suggestionType),
  severityIdx: index('idx_workspace_suggestions_severity').on(table.severity),
}));

export const workspaceSuggestionsRelations = relations(workspaceSuggestions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceSuggestions.workspaceId],
    references: [workspaces.id],
  }),
  resolvedByUser: one(users, {
    fields: [workspaceSuggestions.resolvedBy],
    references: [users.id],
  }),
}));

export type WorkspaceSuggestion = typeof workspaceSuggestions.$inferSelect;
export type NewWorkspaceSuggestion = typeof workspaceSuggestions.$inferInsert;
export type SuggestionType = 'test_coverage' | 'documentation' | 'code_quality';
export type SuggestionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'applied';

// =======================
// SDLC Session Tags
// =======================

export const tags = pgTable('tags', {
  tagName: text('tag_name').primaryKey(),
  firstUsedAt: timestamp('first_used_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
  eventCount: integer('event_count').notNull().default(0),
}, (table) => ({
  lastUsedIdx: index('idx_tags_last_used').on(table.lastUsedAt),
  // CHECK constraint for tag name format validation (^[a-z0-9_-]{1,50}$)
  // Note: Dash at end of character class to avoid "invalid character range" error
  tagNameCheck: check('tag_name_format', sql`tag_name ~ '^[a-z0-9_-]{1,50}$'`),
}));

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
