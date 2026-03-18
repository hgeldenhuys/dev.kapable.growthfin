-- Migration 034: AI Dev Configuration
-- Per-organization AI Dev feature configuration with storage tracking and external project support

-- AI Dev configuration per organization
CREATE TABLE IF NOT EXISTS ai_dev_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Status
  enabled BOOLEAN NOT NULL DEFAULT false,

  -- SignalDB project for agent data (managed or external)
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  external_api_url TEXT,                    -- For connecting to external Tapestry project
  external_api_key_encrypted BYTEA,         -- Encrypted with pgp_sym_encrypt

  -- Storage tracking
  storage_used_bytes BIGINT DEFAULT 0,
  session_count INTEGER DEFAULT 0,

  -- Archiving
  auto_archive_days INTEGER DEFAULT 30,     -- Archive sessions older than N days

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_dev_configs_org ON ai_dev_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_dev_configs_enabled ON ai_dev_configs(enabled) WHERE enabled = true;

-- Add storage_bytes column to ai_chat_sessions for per-session storage tracking
ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS storage_bytes BIGINT DEFAULT 0;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_ai_dev_configs_updated_at ON ai_dev_configs;
CREATE TRIGGER trigger_ai_dev_configs_updated_at
  BEFORE UPDATE ON ai_dev_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

-- Update billing_plans to include AI Dev limits
-- Pro, Business, Enterprise get AI Dev enabled with storage limits
UPDATE billing_plans
SET limits = limits || jsonb_build_object(
  'ai_dev_enabled', true,
  'ai_dev_storage_limit_mb', 500
)
WHERE name = 'pro';

UPDATE billing_plans
SET limits = limits || jsonb_build_object(
  'ai_dev_enabled', true,
  'ai_dev_storage_limit_mb', 2000
)
WHERE name = 'business';

UPDATE billing_plans
SET limits = limits || jsonb_build_object(
  'ai_dev_enabled', true,
  'ai_dev_storage_limit_mb', 0  -- 0 = unlimited
)
WHERE name = 'enterprise';

-- Hobbyist does NOT get AI Dev
UPDATE billing_plans
SET limits = limits || jsonb_build_object(
  'ai_dev_enabled', false,
  'ai_dev_storage_limit_mb', 0
)
WHERE name = 'hobbyist';

-- Comments
COMMENT ON TABLE ai_dev_configs IS 'Per-organization AI Dev feature configuration';
COMMENT ON COLUMN ai_dev_configs.project_id IS 'SignalDB project used for agent data (managed project)';
COMMENT ON COLUMN ai_dev_configs.external_api_url IS 'External Tapestry/SignalDB API URL for agent routing';
COMMENT ON COLUMN ai_dev_configs.external_api_key_encrypted IS 'Encrypted API key for external project';
COMMENT ON COLUMN ai_dev_configs.storage_used_bytes IS 'Total storage used by Claude sessions in ~/.claude/';
COMMENT ON COLUMN ai_dev_configs.auto_archive_days IS 'Auto-archive sessions older than N days (null = disabled)';
