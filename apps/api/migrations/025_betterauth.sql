-- Migration 025: BetterAuth integration
-- Adds auth_engine feature flag, new auth method toggles, OAuth providers JSONB,
-- theme config, and theme version history

-- Add new columns to auth_configs for BetterAuth feature flag and auth methods
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS auth_engine TEXT DEFAULT 'legacy';
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS passkey_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS magic_link_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS email_otp_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS phone_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS organizations_enabled BOOLEAN DEFAULT false;

-- Scalable OAuth providers config (replaces per-provider columns for new providers)
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oauth_providers JSONB DEFAULT '{}';

-- Theme configuration
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{}';
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS draft_theme_config JSONB;

-- Theme version history for rollback
CREATE TABLE IF NOT EXISTS auth_theme_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  published_by TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  version_number INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_theme_versions_project ON auth_theme_versions(project_id, version_number DESC);

-- Comment for documentation
COMMENT ON COLUMN auth_configs.auth_engine IS 'Auth engine: legacy (custom) or betterauth. Feature flag for per-project migration.';
COMMENT ON COLUMN auth_configs.oauth_providers IS 'JSONB config for all OAuth providers. Keys: apple, microsoft, twitter, linkedin, facebook, twitch, slack, gitlab, bitbucket, spotify. Each has clientId, clientSecretEncrypted, enabled.';
COMMENT ON COLUMN auth_configs.theme_config IS 'Published theme configuration for hosted auth pages.';
COMMENT ON COLUMN auth_configs.draft_theme_config IS 'Unpublished draft theme for live preview.';
