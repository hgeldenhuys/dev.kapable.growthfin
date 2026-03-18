-- Migration 023: Usage & Monitoring Infrastructure
--
-- 1. Alert history table for tracking alerts sent
-- 2. Health history table for uptime calculations
-- 3. Error events table for lightweight error tracking
-- 4. Rate limit per-tier defaults in billing_plans

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  service_name TEXT,
  message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_history_unresolved ON alert_history(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history(alert_type, created_at DESC);

-- Health history (for uptime calculation)
CREATE TABLE IF NOT EXISTS health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INT,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_history_service ON health_history(service_name, checked_at DESC);

-- Error events (lightweight error tracking)
CREATE TABLE IF NOT EXISTS error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  request_path TEXT,
  org_id UUID REFERENCES organizations(id),
  count INT DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_error_events_fp ON error_events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_events_last_seen ON error_events(last_seen DESC);

-- Add rate limit per tier to billing_plans
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"api_calls_per_minute": 100}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"api_calls_per_minute": 1000}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"api_calls_per_minute": 5000}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"api_calls_per_minute": 10000}'::jsonb WHERE name = 'enterprise';

-- Add rows_limit to billing_plans
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"rows_limit": 10000}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"rows_limit": 100000}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"rows_limit": 1000000}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"rows_limit": 0}'::jsonb WHERE name = 'enterprise';

-- Add projects_limit to billing_plans
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"projects_limit": 3}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"projects_limit": 10}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"projects_limit": 50}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"projects_limit": 0}'::jsonb WHERE name = 'enterprise';

-- Partition health_history for efficient cleanup (keep 30 days)
-- Note: Cleanup via cron: DELETE FROM health_history WHERE checked_at < now() - interval '30 days'
