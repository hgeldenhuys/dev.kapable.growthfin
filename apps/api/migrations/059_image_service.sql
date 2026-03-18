-- 059: Platform Image Service
-- Quota-tracked, org-scoped image generation via Gemini

CREATE TABLE IF NOT EXISTS image_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  images_generated INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

CREATE TABLE IF NOT EXISTS image_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
  prompt_summary TEXT,
  aspect_ratio TEXT DEFAULT '3:2',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'quota_exceeded', 'rate_limited', 'safety_blocked')),
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_image_usage_org ON image_usage(organization_id, month);
CREATE INDEX idx_image_logs_org ON image_logs(organization_id, created_at DESC);

-- Add image quota limits to billing plans
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"image_monthly_limit": 50}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"image_monthly_limit": 500}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"image_monthly_limit": 2000}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits, '{}'::jsonb) || '{"image_monthly_limit": 0}'::jsonb WHERE name = 'enterprise';
