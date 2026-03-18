/**
 * LLM Model Catalog Schema
 * Centralized database-driven model catalog with cost information
 *
 * Replaces hardcoded PROVIDER_MODELS constant in frontend
 */

import { pgTable, text, uuid, numeric, boolean, integer, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const llmModelCatalog = pgTable(
  'llm_model_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(), // openai, anthropic, together, openapi
    modelName: text('model_name').notNull(),
    displayName: text('display_name').notNull(),
    inputCostPer1MTokens: numeric('input_cost_per_1m_tokens', { precision: 10, scale: 2 }).notNull(),
    outputCostPer1MTokens: numeric('output_cost_per_1m_tokens', { precision: 10, scale: 2 }).notNull(),
    contextWindow: integer('context_window'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('llm_model_catalog_provider_idx').on(table.provider),
    isActiveIdx: index('llm_model_catalog_is_active_idx').on(table.isActive),
    providerModelUnique: unique('llm_model_catalog_provider_model_unique').on(table.provider, table.modelName),
  })
);

export type LLMModelCatalogEntry = typeof llmModelCatalog.$inferSelect;
export type NewLLMModelCatalogEntry = typeof llmModelCatalog.$inferInsert;
