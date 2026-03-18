-- Add columns to ai_chat_jobs for standalone forge daemon tracking
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS daemon_host TEXT;
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS exit_code INTEGER;
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS interrupted BOOLEAN DEFAULT false;
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS command TEXT;
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_daemon_active
  ON ai_chat_jobs(daemon_host, done) WHERE done = false;
