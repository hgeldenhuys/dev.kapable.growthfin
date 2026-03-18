-- 027: OIDC Provider support for per-project identity provider
-- Adds columns to auth_configs to enable/configure OIDC Provider per project

ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oidc_provider_enabled BOOLEAN DEFAULT false;
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS oidc_provider_config JSONB DEFAULT '{}';

-- oidc_provider_config JSONB stores:
--   allowDynamicClientRegistration (bool, default false)
--   requirePKCE (bool, default true)
--   accessTokenExpiresIn (number, default 3600)
--   refreshTokenExpiresIn (number, default 604800)
