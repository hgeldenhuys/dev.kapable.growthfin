-- Enterprise SSO (SAML + OIDC) Support
-- Enables customers to authenticate via corporate identity providers (Okta, Azure AD, Google Workspace, etc.)

-- SSO Provider configurations (per-org, not per-project)
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,           -- e.g., "acme-okta", unique identifier for this provider
  name TEXT NOT NULL,                  -- Display name (e.g., "Okta", "Azure AD")
  issuer TEXT NOT NULL,                -- IdP issuer URL
  domain TEXT NOT NULL,                -- Email domain (e.g., "acmecorp.com")
  protocol TEXT NOT NULL DEFAULT 'saml', -- 'saml' or 'oidc'

  -- OIDC configuration (encrypted)
  oidc_config_encrypted BYTEA,         -- Encrypted JSON: { clientId, clientSecret, discoveryEndpoint, scopes, pkce, mapping }

  -- SAML configuration (encrypted)
  saml_config_encrypted BYTEA,         -- Encrypted JSON: { entryPoint, cert, callbackUrl, audience, wantAssertionsSigned, signatureAlgorithm, mapping }

  -- Status flags
  enabled BOOLEAN DEFAULT true,
  domain_verified BOOLEAN DEFAULT false,
  domain_verification_token TEXT,      -- DNS TXT record value for verification

  -- Just-in-time provisioning
  jit_provisioning BOOLEAN DEFAULT true,  -- Auto-create users on first SSO login
  default_role TEXT DEFAULT 'member',     -- Role for JIT-provisioned users

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraints
  UNIQUE(org_id, provider_id),
  UNIQUE(org_id, domain)
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_sso_providers_org ON sso_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_sso_providers_domain ON sso_providers(domain);
CREATE INDEX IF NOT EXISTS idx_sso_providers_enabled ON sso_providers(org_id, enabled) WHERE enabled = true;

-- Add SSO-related columns to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enforce BOOLEAN DEFAULT false; -- If true, only SSO login allowed (no email/password)

-- SSO sessions (for tracking SSO-initiated sessions)
CREATE TABLE IF NOT EXISTS sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  idp_user_id TEXT,                    -- User ID from the IdP
  session_index TEXT,                  -- SAML SessionIndex for SLO
  name_id TEXT,                        -- SAML NameID
  attributes JSONB DEFAULT '{}',       -- Additional attributes from IdP
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_org ON sso_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_email ON sso_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_expires ON sso_sessions(expires_at);

-- Clean up expired SSO sessions periodically (can be done by a cron job)
-- DELETE FROM sso_sessions WHERE expires_at < NOW();

COMMENT ON TABLE sso_providers IS 'Enterprise SSO provider configurations (SAML/OIDC)';
COMMENT ON COLUMN sso_providers.protocol IS 'Authentication protocol: saml or oidc';
COMMENT ON COLUMN sso_providers.domain IS 'Email domain for auto-detection (e.g., acmecorp.com)';
COMMENT ON COLUMN sso_providers.jit_provisioning IS 'Whether to auto-create users on first SSO login';
COMMENT ON COLUMN sso_providers.domain_verified IS 'Whether domain ownership has been verified via DNS';
