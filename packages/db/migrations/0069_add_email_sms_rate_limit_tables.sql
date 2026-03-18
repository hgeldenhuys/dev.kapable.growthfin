-- Migration: Create email suppressions and SMS/email rate limit tables
-- Fixes: BUG-09-001 (email suppressions 500) and BUG-09-003 (SMS rate limit 500)

-- ============================================================================
-- EMAIL SUPPRESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  source_type TEXT NOT NULL,
  source_campaign_id UUID,
  source_recipient_id UUID,
  soft_bounce_count INTEGER NOT NULL DEFAULT 0,
  last_soft_bounce_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reactivated_at TIMESTAMPTZ,
  reactivated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_email_supp_workspace_email_idx
  ON crm_email_suppressions (workspace_id, email);
CREATE INDEX IF NOT EXISTS crm_email_supp_workspace_idx
  ON crm_email_suppressions (workspace_id);
CREATE INDEX IF NOT EXISTS crm_email_supp_reason_idx
  ON crm_email_suppressions (reason);
CREATE INDEX IF NOT EXISTS crm_email_supp_active_idx
  ON crm_email_suppressions (is_active);
CREATE INDEX IF NOT EXISTS crm_email_supp_campaign_idx
  ON crm_email_suppressions (source_campaign_id);

-- ============================================================================
-- SMS RATE LIMITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_sms_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_type TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_sms_rate_workspace_window_idx
  ON crm_sms_rate_limits (workspace_id, window_start, window_type);
CREATE INDEX IF NOT EXISTS crm_sms_rate_window_start_idx
  ON crm_sms_rate_limits (window_start);
CREATE INDEX IF NOT EXISTS crm_sms_rate_workspace_idx
  ON crm_sms_rate_limits (workspace_id);

-- ============================================================================
-- EMAIL RATE LIMITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_email_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_type TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_email_rate_workspace_window_idx
  ON crm_email_rate_limits (workspace_id, window_start, window_type);
CREATE INDEX IF NOT EXISTS crm_email_rate_window_start_idx
  ON crm_email_rate_limits (window_start);
CREATE INDEX IF NOT EXISTS crm_email_rate_workspace_idx
  ON crm_email_rate_limits (workspace_id);
