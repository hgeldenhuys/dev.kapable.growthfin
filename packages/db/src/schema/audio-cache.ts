/**
 * Audio Cache Schema
 * Caches generated audio files from TTS providers
 */

import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { hookEvents } from './hook-events';
import { voices } from './voices';

export const audioCache = pgTable('audio_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  hookEventId: uuid('hook_event_id')
    .references(() => hookEvents.id, { onDelete: 'set null' }), // Nullable - audio survives hook event deletion
  role: text('role').notNull(), // 'user' | 'assistant'
  voiceId: uuid('voice_id')
    .notNull()
    .references(() => voices.id, { onDelete: 'restrict' }),
  url: text('url').notNull(), // Relative URL to MP3 file (e.g., /cdn/audio/hookEventId-voiceId.mp3)
  text: text('text').notNull(), // The LLM-prepared text that was converted to audio
  duration: integer('duration'), // Duration in seconds (nullable if unknown)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // Nullable for no expiration
}, (table) => ({
  // Composite unique constraint: one audio per (event, voice) combination
  uniqueEventVoice: unique().on(table.hookEventId, table.voiceId),
}));

export type AudioCache = typeof audioCache.$inferSelect;
export type NewAudioCache = typeof audioCache.$inferInsert;
