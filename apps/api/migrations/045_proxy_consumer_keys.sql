-- Migration 045: Proxy Consumer Keys
-- Consumer key management for the Anthropic proxy
-- Each org gets a unique consumer token (cmp_* prefix) for proxy authentication
-- with configurable weekly token quotas

CREATE TABLE IF NOT EXISTS proxy_consumer_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash TEXT NOT NULL,
  weekly_token_limit BIGINT DEFAULT 0,
  weekly_tokens_used BIGINT DEFAULT 0,
  weekly_requests BIGINT DEFAULT 0,
  weekly_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id)
);

-- Fast lookup by key prefix during auth validation
CREATE INDEX IF NOT EXISTS idx_proxy_consumer_keys_prefix ON proxy_consumer_keys(key_prefix);

-- Filter by status (active/suspended/revoked)
CREATE INDEX IF NOT EXISTS idx_proxy_consumer_keys_status ON proxy_consumer_keys(status);

-- Index for weekly reset cron (find expired quotas)
CREATE INDEX IF NOT EXISTS idx_proxy_consumer_keys_reset ON proxy_consumer_keys(weekly_reset_at)
  WHERE status = 'active';

-- Comments
COMMENT ON TABLE proxy_consumer_keys IS 'Consumer keys for Anthropic proxy authentication, one per org';
COMMENT ON COLUMN proxy_consumer_keys.key_prefix IS 'First 12 chars of token (cmp_ + 8 hex chars) for efficient DB lookup';
COMMENT ON COLUMN proxy_consumer_keys.key_hash IS 'bcrypt hash of full token for verification';
COMMENT ON COLUMN proxy_consumer_keys.weekly_token_limit IS '0 = unlimited; positive value = hard cap on weekly tokens';
COMMENT ON COLUMN proxy_consumer_keys.weekly_tokens_used IS 'Running total of tokens consumed this week (input + output)';
COMMENT ON COLUMN proxy_consumer_keys.weekly_requests IS 'Running total of proxy requests this week';
COMMENT ON COLUMN proxy_consumer_keys.weekly_reset_at IS 'When the weekly counters will be reset';
COMMENT ON COLUMN proxy_consumer_keys.status IS 'active | suspended | revoked';
