-- 061: Platform Voice Service
-- Quota-tracked, org-scoped TTS via ElevenLabs

CREATE TABLE IF NOT EXISTS voice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  characters_used INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

CREATE TABLE IF NOT EXISTS voice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID,
  model TEXT NOT NULL DEFAULT 'eleven_v3',
  voice_id TEXT,
  text_length INT,
  audio_duration_ms INT,
  status TEXT NOT NULL CHECK (status IN ('success','failed','quota_exceeded','rate_limited')),
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_usage_org ON voice_usage(organization_id, month);
CREATE INDEX idx_voice_logs_org ON voice_logs(organization_id, created_at DESC);

-- Quota: characters per month (ElevenLabs bills by character)
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"voice_monthly_chars": 10000}'::jsonb WHERE name = 'hobbyist';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"voice_monthly_chars": 100000}'::jsonb WHERE name = 'pro';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"voice_monthly_chars": 500000}'::jsonb WHERE name = 'business';
UPDATE billing_plans SET limits = COALESCE(limits,'{}'::jsonb) || '{"voice_monthly_chars": 0}'::jsonb WHERE name = 'enterprise';
