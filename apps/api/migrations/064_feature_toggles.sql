-- 064_feature_toggles.sql
-- Feature Toggles platform service: flag definitions, usage tracking, audit logs

BEGIN;

-- Feature flags (org-scoped)
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  flag_type TEXT NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean', 'rollout')),
  default_value BOOLEAN NOT NULL DEFAULT false,
  rollout_config JSONB DEFAULT '{}',
  environment_overrides JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'console' CHECK (source IN ('yaml', 'console')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org ON feature_flags(organization_id);

-- Monthly evaluation counter (atomic upsert)
CREATE TABLE IF NOT EXISTS feature_toggle_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  evaluations BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

-- Sampled evaluation audit log
CREATE TABLE IF NOT EXISTS feature_toggle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID,
  flag_name TEXT NOT NULL,
  user_id TEXT,
  environment TEXT,
  result BOOLEAN,
  matched_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_toggle_logs_org_created
  ON feature_toggle_logs(organization_id, created_at DESC);

-- Billing limits for feature toggles
UPDATE billing_plans SET limits = jsonb_set(
  COALESCE(limits, '{}'::jsonb),
  '{feature_toggle_monthly_limit}',
  '100000'
) WHERE name = 'hobbyist';

UPDATE billing_plans SET limits = jsonb_set(
  COALESCE(limits, '{}'::jsonb),
  '{feature_toggle_monthly_limit}',
  '1000000'
) WHERE name = 'pro';

UPDATE billing_plans SET limits = jsonb_set(
  COALESCE(limits, '{}'::jsonb),
  '{feature_toggle_monthly_limit}',
  '5000000'
) WHERE name = 'business';

UPDATE billing_plans SET limits = jsonb_set(
  COALESCE(limits, '{}'::jsonb),
  '{feature_toggle_monthly_limit}',
  '0'
) WHERE name = 'enterprise';

-- pg_notify trigger for real-time flag change push
CREATE OR REPLACE FUNCTION notify_feature_flag_change() RETURNS trigger AS $$
DECLARE
  payload JSONB;
  org_id UUID;
  flag_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    org_id := OLD.organization_id;
    flag_name := OLD.name;
  ELSE
    org_id := NEW.organization_id;
    flag_name := NEW.name;
  END IF;

  payload := jsonb_build_object(
    'action', TG_OP,
    'flag_name', flag_name,
    'enabled', CASE WHEN TG_OP = 'DELETE' THEN false ELSE NEW.enabled END,
    'timestamp', extract(epoch from now()) * 1000
  );

  PERFORM pg_notify('org_' || replace(org_id::text, '-', '_') || '_flags', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flag_notify ON feature_flags;
CREATE TRIGGER feature_flag_notify
  AFTER INSERT OR UPDATE OR DELETE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION notify_feature_flag_change();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_feature_flag_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flag_updated_at ON feature_flags;
CREATE TRIGGER feature_flag_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_feature_flag_timestamp();

COMMIT;
