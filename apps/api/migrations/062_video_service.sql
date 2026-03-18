-- 062: Platform Video Service
-- Quota-tracked, org-scoped video generation via Google Veo 3.1

CREATE TABLE IF NOT EXISTS video_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  videos_generated INT NOT NULL DEFAULT 0,
  seconds_generated REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

CREATE TABLE IF NOT EXISTS video_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID,
  model TEXT NOT NULL DEFAULT 'veo-3.1-generate-preview',
  duration_sec REAL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','quota_exceeded','rate_limited')),
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_usage_org ON video_usage(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_video_logs_org ON video_logs(organization_id, created_at DESC);

-- Quota: clips per month (Veo auto-selects duration)
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"video_monthly_limit": 10}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"video_monthly_limit": 50}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"video_monthly_limit": 200}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"video_monthly_limit": 0}'::jsonb WHERE name = 'enterprise';
