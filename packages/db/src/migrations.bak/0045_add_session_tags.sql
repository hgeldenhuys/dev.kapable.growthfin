-- Migration: Add session tagging support
-- Story: US-TAG-001
-- Description: Add tags column to hook_events and create tags metadata table

-- AC-001: Add tags TEXT[] column to hook_events with default '{}'
ALTER TABLE hook_events
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- AC-002: Create GIN index on hook_events.tags for efficient array operations
CREATE INDEX hook_events_tags_idx ON hook_events USING GIN(tags);

-- AC-003: Create tags table with tag_name, first_used_at, last_used_at, event_count
CREATE TABLE tags (
  tag_name TEXT PRIMARY KEY,
  first_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  event_count INTEGER NOT NULL DEFAULT 0
);

-- AC-004: Add CHECK constraint for tag name format validation (^[a-z0-9_-]{1,50}$)
-- Note: Dash must be at end of character class to avoid "invalid character range" error
ALTER TABLE tags
ADD CONSTRAINT tag_name_format CHECK (tag_name ~ '^[a-z0-9_-]{1,50}$');

-- AC-005: Create index on tags.last_used_at DESC for quick lookups
CREATE INDEX idx_tags_last_used ON tags(last_used_at DESC);

-- AC-007: Ensure existing hook_events rows have tags = '{}' (already done by DEFAULT)
-- No additional action needed - DEFAULT handles this automatically
