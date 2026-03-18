/**
 * Models Schema
 * TTS models from multiple providers
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const models = pgTable(
  'models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    provider: text('provider').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('models_provider_idx').on(table.provider),
    externalIdIdx: index('models_external_id_idx').on(table.externalId),
    // Unique constraint on provider + externalId
    providerExternalIdIdx: index('models_provider_external_id_idx').on(table.provider, table.externalId),
  })
);

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
