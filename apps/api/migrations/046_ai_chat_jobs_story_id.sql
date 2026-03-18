-- Add story_id to ai_chat_jobs for per-story job tracking in Forge Board
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS story_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_story_active
  ON ai_chat_jobs(story_id, done) WHERE story_id IS NOT NULL AND done = false;
