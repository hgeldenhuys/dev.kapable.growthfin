-- Bootstrap tokens for Mac dev setup one-click scripts
-- Single-use, short-lived tokens that exchange for app credentials

CREATE TABLE IF NOT EXISTS bootstrap_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  app_id UUID NOT NULL REFERENCES apps(id),
  env_id UUID NOT NULL REFERENCES app_environments(id),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bootstrap_tokens_hash ON bootstrap_tokens(token_hash) WHERE used_at IS NULL;
