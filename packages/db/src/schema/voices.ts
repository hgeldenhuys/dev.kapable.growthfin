/**
 * Voices Schema
 * TTS voice configurations from multiple providers
 */

import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export type VoiceProvider = 'elevenlabs' | 'openai-tts';
export type VoiceGender = 'male' | 'female' | 'neutral';

export const voices = pgTable(
  'voices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull().$type<VoiceProvider>(),
    externalId: text('external_id').notNull(), // Provider's voice ID
    name: text('name').notNull(),
    gender: text('gender').notNull().$type<VoiceGender>(),
    useForSummaries: boolean('use_for_summaries').notNull().default(false), // Flag for summary-suitable voices
    metadata: jsonb('metadata'), // Provider-specific data (accent, age, use case, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('voices_provider_idx').on(table.provider),
    externalIdIdx: index('voices_external_id_idx').on(table.externalId),
    genderIdx: index('voices_gender_idx').on(table.gender),
    useForSummariesIdx: index('voices_use_for_summaries_idx').on(table.useForSummaries),
    // Unique constraint on provider + externalId
    providerExternalIdIdx: index('voices_provider_external_id_idx').on(table.provider, table.externalId),
  })
);

export type Voice = typeof voices.$inferSelect;
export type NewVoice = typeof voices.$inferInsert;
