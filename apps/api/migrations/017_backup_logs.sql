-- Migration 017: Backup logs table for automated backup tracking
-- Work Item: WI-3 (Automated Backups)

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  file_key TEXT,
  file_size_bytes BIGINT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_instance ON backup_logs(instance_name, started_at DESC);
