-- 056: Platform Email Service
-- Adds platform keys for Connect apps, email usage tracking, and email audit logs

-- Platform keys for Connect apps (org-scoped, not project-scoped)
-- Encrypted (not hashed) so we can decrypt + inject on each deploy
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS platform_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS platform_key_prefix TEXT;

-- Monthly email usage (auto-partitioned by month via unique constraint)
CREATE TABLE IF NOT EXISTS email_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  emails_sent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

-- Email audit log
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'quota_exceeded', 'rate_limited')),
  provider_id TEXT,
  error_message TEXT,
  sent_via TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_usage_org ON email_usage(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_platform_key_prefix ON organizations(platform_key_prefix) WHERE platform_key_prefix IS NOT NULL;

-- Add email limits to billing plans
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"email_monthly_limit": 100}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"email_monthly_limit": 1000}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"email_monthly_limit": 5000}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"email_monthly_limit": 0}'::jsonb WHERE name = 'enterprise';
