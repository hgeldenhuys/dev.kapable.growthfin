-- 031: Auth gate for Connect apps
-- Proxy-level authentication gate that redirects unauthenticated users to login
-- before they can access the app. Uses existing BetterAuth per-project auth.

ALTER TABLE app_environments
  ADD COLUMN IF NOT EXISTS auth_gate_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_gate_project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS auth_gate_exclude_paths JSONB DEFAULT '[]'::jsonb;

-- Index for quick lookup when proxy checks auth gate
CREATE INDEX IF NOT EXISTS idx_app_env_auth_gate
  ON app_environments(id) WHERE auth_gate_enabled = true;
