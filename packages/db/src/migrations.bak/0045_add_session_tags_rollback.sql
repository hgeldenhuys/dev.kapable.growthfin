-- Rollback Migration: Remove session tagging support
-- Story: US-TAG-001
-- Description: Rollback tags column and tags table

-- Remove index on tags.last_used_at
DROP INDEX IF EXISTS idx_tags_last_used;

-- Remove tags table
DROP TABLE IF EXISTS tags;

-- Remove GIN index on hook_events.tags
DROP INDEX IF EXISTS hook_events_tags_idx;

-- Remove tags column from hook_events
ALTER TABLE hook_events
DROP COLUMN IF EXISTS tags;
