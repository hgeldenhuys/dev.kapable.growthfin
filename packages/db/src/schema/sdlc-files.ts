/**
 * SDLC Files Schema
 * Tracks SDLC file changes for real-time sync via ElectricSQL
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { claudeSessions } from './claude-sessions';

// Operation enum
export const sdlcFileOperationEnum = pgEnum('sdlc_file_operation', [
  'created',
  'updated',
  'deleted',
]);

// Category enum
export const sdlcFileCategoryEnum = pgEnum('sdlc_file_category', [
  'stories',
  'epics',
  'kanban',
  'knowledgeGraph',
  'coherence',
  'retrospectives',
  'backlog',
  'prds',
  'unknown',
]);

export const sdlcFiles = pgTable(
  'sdlc_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Session reference
    sessionId: text('session_id')
      .notNull()
      .references(() => claudeSessions.id, { onDelete: 'cascade' }),

    // File identification
    path: text('path').notNull(), // Relative path from .claude/sdlc/
    category: sdlcFileCategoryEnum('category').notNull().default('unknown'),
    operation: sdlcFileOperationEnum('operation').notNull().default('updated'),

    // File content (null if deleted)
    content: text('content'),

    // Parsed file content (JSONB for faster queries)
    parsedData: jsonb('parsed_data'),

    // Timestamps
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(), // When file changed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index for efficient session queries
    sessionIdIdx: index('idx_sdlc_files_session_id').on(table.sessionId),

    // Index for category filtering
    categoryIdx: index('idx_sdlc_files_category').on(table.category),

    // Index for chronological ordering
    eventTimestampIdx: index('idx_sdlc_files_event_timestamp').on(table.eventTimestamp),

    // Composite index for session + chronological
    sessionTimestampIdx: index('idx_sdlc_files_session_timestamp').on(
      table.sessionId,
      table.eventTimestamp
    ),
  })
);

// Relations
export const sdlcFilesRelations = relations(sdlcFiles, ({ one }) => ({
  session: one(claudeSessions, {
    fields: [sdlcFiles.sessionId],
    references: [claudeSessions.id],
  }),
}));

// Types
export type SdlcFile = typeof sdlcFiles.$inferSelect;
export type NewSdlcFile = typeof sdlcFiles.$inferInsert;
export type SdlcFileOperation = typeof sdlcFileOperationEnum.enumValues[number];
export type SdlcFileCategory = typeof sdlcFileCategoryEnum.enumValues[number];
