-- 054_dev_access_keys.sql
-- SSH dev access keys for Connect app containers
-- Per-environment keypairs for SSH shell, git push, rsync

CREATE TABLE IF NOT EXISTS app_dev_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES app_environments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  member_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  public_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  container_name TEXT NOT NULL,
  app_dir TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_keys_env ON app_dev_keys(environment_id);
CREATE INDEX IF NOT EXISTS idx_dev_keys_org ON app_dev_keys(org_id);
