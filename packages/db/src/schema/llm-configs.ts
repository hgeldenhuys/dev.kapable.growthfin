/**
 * LLM Configs Schema
 * Multi-provider LLM service configurations
 *
 * NOTE: API keys are stored separately in llm_credentials table (encrypted)
 */

import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { llmCredentials } from './llm-credentials';

export type LLMProvider = 'openrouter' | 'openai' | 'anthropic' | 'together' | 'openapi';

export const llmConfigs = pgTable('llm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // e.g., 'summarizer', 'todo-title-generator'
  provider: text('provider').notNull().$type<LLMProvider>(),
  model: text('model').notNull(), // e.g., 'gpt-4', 'claude-3-sonnet'
  systemPrompt: text('system_prompt').notNull(),
  temperature: integer('temperature').notNull().default(70), // Stored as int (0-100), divide by 100 for API
  maxTokens: integer('max_tokens').notNull().default(1000),

  // Optional API URL for custom/generic OpenAPI providers
  apiUrl: text('api_url'), // e.g., 'https://api.groq.com/v1/chat/completions'

  // Reference to encrypted credentials
  credentialId: uuid('credential_id')
    .notNull()
    .references(() => llmCredentials.id, { onDelete: 'restrict' }), // Prevent deletion if in use

  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }), // NULL = global
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const llmConfigsRelations = relations(llmConfigs, ({ one }) => ({
  credential: one(llmCredentials, {
    fields: [llmConfigs.credentialId],
    references: [llmCredentials.id],
  }),
  project: one(projects, {
    fields: [llmConfigs.projectId],
    references: [projects.id],
  }),
}));

export type LLMConfig = typeof llmConfigs.$inferSelect;
export type NewLLMConfig = typeof llmConfigs.$inferInsert;
