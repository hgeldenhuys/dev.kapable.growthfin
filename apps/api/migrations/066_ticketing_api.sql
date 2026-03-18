-- 066: Ticketing API — extend support_tickets for platform service use
-- Adds app context, source tracking, error capture, and usage quotas

-- Add columns to support_tickets for app context and source tracking
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'console',
  ADD COLUMN IF NOT EXISTS error_stack TEXT,
  ADD COLUMN IF NOT EXISTS error_context JSONB,
  ADD COLUMN IF NOT EXISTS error_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tickets_app ON support_tickets(app_id) WHERE app_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_source ON support_tickets(source);
CREATE INDEX IF NOT EXISTS idx_tickets_fingerprint ON support_tickets(org_id, error_fingerprint) WHERE error_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_tags ON support_tickets USING GIN(tags) WHERE array_length(tags, 1) > 0;

-- Ticket usage tracking (monthly quotas)
CREATE TABLE IF NOT EXISTS ticket_usage (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  tickets_created INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, month)
);

-- Update billing_plans limits with ticket quotas
-- hobbyist=50, pro=500, business=2000, enterprise=unlimited (0 means unlimited)
UPDATE billing_plans
SET limits = limits || '{"ticket_monthly_limit": 50}'::jsonb
WHERE name = 'hobbyist' AND NOT (limits ? 'ticket_monthly_limit');

UPDATE billing_plans
SET limits = limits || '{"ticket_monthly_limit": 500}'::jsonb
WHERE name = 'pro' AND NOT (limits ? 'ticket_monthly_limit');

UPDATE billing_plans
SET limits = limits || '{"ticket_monthly_limit": 2000}'::jsonb
WHERE name = 'business' AND NOT (limits ? 'ticket_monthly_limit');

UPDATE billing_plans
SET limits = limits || '{"ticket_monthly_limit": 0}'::jsonb
WHERE name = 'enterprise' AND NOT (limits ? 'ticket_monthly_limit');
