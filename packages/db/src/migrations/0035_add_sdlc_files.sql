-- Migration: Add SDLC Files Table
-- Purpose: Track SDLC file changes for real-time sync via ElectricSQL
-- Created: 2025-11-03

-- Create ENUMs
DO $$ BEGIN
  CREATE TYPE "sdlc_file_operation" AS ENUM('created', 'updated', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "sdlc_file_category" AS ENUM('stories', 'epics', 'kanban', 'knowledgeGraph', 'coherence', 'retrospectives', 'backlog', 'prds', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sdlc_files table
CREATE TABLE IF NOT EXISTS "sdlc_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL REFERENCES "claude_sessions"("id") ON DELETE CASCADE,
  "path" text NOT NULL,
  "category" "sdlc_file_category" DEFAULT 'unknown' NOT NULL,
  "operation" "sdlc_file_operation" DEFAULT 'updated' NOT NULL,
  "content" text,
  "event_timestamp" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for sdlc_files
CREATE INDEX IF NOT EXISTS "idx_sdlc_files_session_id" ON "sdlc_files"("session_id");
CREATE INDEX IF NOT EXISTS "idx_sdlc_files_category" ON "sdlc_files"("category");
CREATE INDEX IF NOT EXISTS "idx_sdlc_files_event_timestamp" ON "sdlc_files"("event_timestamp");
CREATE INDEX IF NOT EXISTS "idx_sdlc_files_session_timestamp" ON "sdlc_files"("session_id", "event_timestamp");
