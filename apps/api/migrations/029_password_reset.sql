-- Migration 029: Add password reset columns to org_members
-- Enables forgot-password flow for console users

ALTER TABLE org_members ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64);
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- Partial index for fast token lookups (only non-null tokens)
CREATE INDEX IF NOT EXISTS idx_org_members_reset_token
  ON org_members(password_reset_token)
  WHERE password_reset_token IS NOT NULL;
