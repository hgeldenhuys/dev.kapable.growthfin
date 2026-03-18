-- 055_app_schedules.sql
-- Platform scheduler: cron jobs for Connect app environments
-- Supports webhook (HTTP call to container) and bash (exec in container) actions

CREATE TABLE IF NOT EXISTS app_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES app_environments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  action_type TEXT NOT NULL CHECK (action_type IN ('webhook', 'bash')),
  action_config JSONB NOT NULL DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'timeout', NULL)),
  last_run_duration_ms INTEGER,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'console' CHECK (source IN ('console', 'yaml')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment_id, name)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON app_scheduled_jobs(next_run_at)
  WHERE enabled = true AND next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_env ON app_scheduled_jobs(environment_id);

CREATE TABLE IF NOT EXISTS app_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES app_scheduled_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'timeout')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON app_job_runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_cleanup ON app_job_runs(created_at)
  WHERE status IN ('success', 'failed', 'timeout');
