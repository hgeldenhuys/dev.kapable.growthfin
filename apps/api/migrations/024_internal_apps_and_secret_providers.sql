-- Migration 024: Internal-Only App Routing + Infisical Secret Providers
-- Two Connect features sharing one migration.

-- Feature 1: visibility column on app_environments
ALTER TABLE app_environments
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
CHECK (visibility IN ('public', 'internal'));

-- Feature 2: secret providers table
CREATE TABLE IF NOT EXISTS organization_secret_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Infisical',
  provider TEXT NOT NULL DEFAULT 'infisical',
  credentials_encrypted BYTEA NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Feature 2: link environments to secret providers
ALTER TABLE app_environments
ADD COLUMN IF NOT EXISTS secret_provider_id UUID REFERENCES organization_secret_providers(id) ON DELETE SET NULL;

ALTER TABLE app_environments
ADD COLUMN IF NOT EXISTS secret_provider_config JSONB DEFAULT '{}';
