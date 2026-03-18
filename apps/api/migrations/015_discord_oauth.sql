-- Migration: Add Discord OAuth support to auth_configs
-- Date: 2026-01-24

-- Add Discord OAuth columns to auth_configs
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oauth_discord_client_id TEXT;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oauth_discord_client_secret_encrypted TEXT;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oauth_discord_enabled BOOLEAN DEFAULT false;

-- Add Discord OAuth ID to _auth_users table template
-- Note: This needs to be added to each project's _auth_users table
-- The auth service will handle this via ensureAuthTables()

COMMENT ON COLUMN auth_configs.oauth_discord_client_id IS 'Discord OAuth Application Client ID';
COMMENT ON COLUMN auth_configs.oauth_discord_client_secret_encrypted IS 'Discord OAuth Client Secret (encrypted with pgp_sym_encrypt)';
COMMENT ON COLUMN auth_configs.oauth_discord_enabled IS 'Whether Discord OAuth is enabled for this project';
