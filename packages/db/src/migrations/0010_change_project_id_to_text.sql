-- Migration: Change project_id from UUID to TEXT
-- Date: 2025-10-15
-- Reason: Project IDs are generated as UUID strings by hooks-SDK, not database-generated UUIDs

-- Drop indexes that depend on the column (if they exist)
DROP INDEX IF EXISTS "idx_hook_events_created_at";
DROP INDEX IF EXISTS "idx_hook_events_project_created";

-- Change column type from UUID to TEXT
ALTER TABLE "hook_events" ALTER COLUMN "project_id" SET DATA TYPE text;
