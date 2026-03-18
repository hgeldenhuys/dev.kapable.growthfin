/**
 * Pronunciation Dictionaries Schema
 * Pronunciation dictionaries from multiple providers
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const pronunciationDictionaries = pgTable(
  'pronunciation_dictionaries',
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
    providerIdx: index('pronunciation_dictionaries_provider_idx').on(table.provider),
    externalIdIdx: index('pronunciation_dictionaries_external_id_idx').on(table.externalId),
    // Unique constraint on provider + externalId
    providerExternalIdIdx: index('pronunciation_dictionaries_provider_external_id_idx').on(
      table.provider,
      table.externalId
    ),
  })
);

export type PronunciationDictionary = typeof pronunciationDictionaries.$inferSelect;
export type NewPronunciationDictionary = typeof pronunciationDictionaries.$inferInsert;
