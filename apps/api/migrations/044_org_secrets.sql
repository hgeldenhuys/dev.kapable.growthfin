-- Migration 044: Organization Secrets
-- Stores encrypted secrets per organization (e.g., ANTHROPIC_API_KEY)

CREATE TABLE IF NOT EXISTS org_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_encrypted BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  description TEXT,
  UNIQUE(org_id, name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_org_secrets_org_id ON org_secrets(org_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_name ON org_secrets(name);

-- Comments
COMMENT ON TABLE org_secrets IS 'Encrypted secrets stored per organization';
COMMENT ON COLUMN org_secrets.name IS 'Secret name (e.g., ANTHROPIC_API_KEY, OPENAI_API_KEY)';
COMMENT ON COLUMN org_secrets.value_encrypted IS 'Secret value encrypted with pgp_sym_encrypt';
COMMENT ON COLUMN org_secrets.description IS 'Optional description of what this secret is used for';

-- Function to upsert a secret
CREATE OR REPLACE FUNCTION upsert_org_secret(
  p_org_id UUID,
  p_name TEXT,
  p_value TEXT,
  p_encryption_key TEXT,
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO org_secrets (org_id, name, value_encrypted, description, created_by)
  VALUES (
    p_org_id,
    p_name,
    pgp_sym_encrypt(p_value, p_encryption_key),
    p_description,
    p_created_by
  )
  ON CONFLICT (org_id, name) DO UPDATE SET
    value_encrypted = pgp_sym_encrypt(p_value, p_encryption_key),
    description = COALESCE(EXCLUDED.description, org_secrets.description),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get a decrypted secret
CREATE OR REPLACE FUNCTION get_org_secret(
  p_org_id UUID,
  p_name TEXT,
  p_encryption_key TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT pgp_sym_decrypt(value_encrypted, p_encryption_key)
  INTO v_value
  FROM org_secrets
  WHERE org_id = p_org_id AND name = p_name;

  RETURN v_value;
END;
$$ LANGUAGE plpgsql;
