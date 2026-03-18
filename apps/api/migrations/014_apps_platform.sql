-- Migration 014: Apps Platform
-- Creates tables for deployable applications with environment management

-- Apps table - represents a deployable application
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,  -- URL-safe identifier
  description TEXT,
  git_repo TEXT,  -- GitHub/GitLab repo URL
  git_branch TEXT DEFAULT 'main',  -- Default branch to deploy from
  framework TEXT DEFAULT 'react-router',  -- 'react-router', 'nextjs', 'sveltekit'
  settings JSONB NOT NULL DEFAULT '{}',  -- App-specific settings
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- App environments - dev, staging, production instances of an app
CREATE TABLE IF NOT EXISTS app_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- 'development', 'staging', 'production'
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Linked SignalDB project (database)

  -- Container/deployment info
  container_name TEXT UNIQUE,  -- Docker container name
  container_id TEXT,  -- Docker container ID
  port INTEGER,  -- Internal port the container listens on

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'building', 'deploying', 'running', 'stopped', 'failed'
  last_deployed_at TIMESTAMPTZ,
  last_deploy_commit TEXT,  -- Git commit SHA
  last_deploy_message TEXT,  -- Commit message or error

  -- Environment variables (encrypted)
  env_vars_encrypted BYTEA,  -- Encrypted JSON of env vars

  -- Health
  health_check_url TEXT DEFAULT '/health',
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',  -- 'healthy', 'unhealthy', 'unknown'

  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(app_id, name)
);

-- App deployments - deployment history
CREATE TABLE IF NOT EXISTS app_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES app_environments(id) ON DELETE CASCADE,

  -- What was deployed
  commit_sha TEXT,
  commit_message TEXT,
  git_branch TEXT,

  -- Who deployed (no FK - users table may be in different schema/database)
  deployed_by UUID,
  deployment_type TEXT NOT NULL DEFAULT 'manual',  -- 'manual', 'auto', 'rollback', 'ai'

  -- Result
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'building', 'deploying', 'success', 'failed', 'cancelled'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Logs
  build_log TEXT,
  deploy_log TEXT,
  error_message TEXT,

  -- Docker image
  image_tag TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App domains - custom domains for apps
CREATE TABLE IF NOT EXISTS app_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES app_environments(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,  -- e.g., 'myapp.example.com'
  is_primary BOOLEAN NOT NULL DEFAULT false,
  ssl_status TEXT DEFAULT 'pending',  -- 'pending', 'active', 'failed'
  ssl_expires_at TIMESTAMPTZ,
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apps_org ON apps(org_id);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_app_environments_app ON app_environments(app_id);
CREATE INDEX IF NOT EXISTS idx_app_environments_project ON app_environments(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_environments_status ON app_environments(status);
CREATE INDEX IF NOT EXISTS idx_app_environments_container ON app_environments(container_name) WHERE container_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_deployments_env ON app_deployments(environment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_deployments_status ON app_deployments(status) WHERE status IN ('pending', 'building', 'deploying');
CREATE INDEX IF NOT EXISTS idx_app_domains_env ON app_domains(environment_id);
CREATE INDEX IF NOT EXISTS idx_app_domains_domain ON app_domains(domain);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_apps_updated_at ON apps;
CREATE TRIGGER trigger_apps_updated_at
  BEFORE UPDATE ON apps
  FOR EACH ROW
  EXECUTE FUNCTION update_apps_updated_at();

DROP TRIGGER IF EXISTS trigger_app_environments_updated_at ON app_environments;
CREATE TRIGGER trigger_app_environments_updated_at
  BEFORE UPDATE ON app_environments
  FOR EACH ROW
  EXECUTE FUNCTION update_apps_updated_at();

DROP TRIGGER IF EXISTS trigger_app_domains_updated_at ON app_domains;
CREATE TRIGGER trigger_app_domains_updated_at
  BEFORE UPDATE ON app_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_apps_updated_at();

-- Function to generate subdomain for an environment
-- Pattern: {org}--{app}--{env}.apps.signaldb.live
CREATE OR REPLACE FUNCTION get_app_subdomain(
  p_environment_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_org_slug TEXT;
  v_app_slug TEXT;
  v_env_name TEXT;
BEGIN
  SELECT o.slug, a.slug, ae.name
  INTO v_org_slug, v_app_slug, v_env_name
  FROM app_environments ae
  JOIN apps a ON a.id = ae.app_id
  JOIN organizations o ON o.id = a.org_id
  WHERE ae.id = p_environment_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- For production, use shorter URL: {org}--{app}.apps.signaldb.live
  IF v_env_name = 'production' THEN
    RETURN v_org_slug || '--' || v_app_slug || '.apps.signaldb.live';
  ELSE
    RETURN v_org_slug || '--' || v_app_slug || '--' || v_env_name || '.apps.signaldb.live';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to parse subdomain into org/app/env
-- Input: 'acme--crm--dev' or 'acme--crm' (production)
-- Returns: {org_slug, app_slug, env_name}
CREATE OR REPLACE FUNCTION parse_app_subdomain(
  p_subdomain TEXT
)
RETURNS TABLE (
  org_slug TEXT,
  app_slug TEXT,
  env_name TEXT
) AS $$
DECLARE
  v_parts TEXT[];
BEGIN
  -- Split by '--'
  v_parts := string_to_array(p_subdomain, '--');

  IF array_length(v_parts, 1) = 2 THEN
    -- {org}--{app} -> production
    RETURN QUERY SELECT v_parts[1], v_parts[2], 'production'::TEXT;
  ELSIF array_length(v_parts, 1) = 3 THEN
    -- {org}--{app}--{env}
    RETURN QUERY SELECT v_parts[1], v_parts[2], v_parts[3];
  ELSE
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to find environment by subdomain
CREATE OR REPLACE FUNCTION find_environment_by_subdomain(
  p_subdomain TEXT
)
RETURNS TABLE (
  environment_id UUID,
  app_id UUID,
  org_id UUID,
  container_name TEXT,
  port INTEGER,
  status TEXT
) AS $$
DECLARE
  v_org_slug TEXT;
  v_app_slug TEXT;
  v_env_name TEXT;
BEGIN
  -- Parse the subdomain
  SELECT * INTO v_org_slug, v_app_slug, v_env_name
  FROM parse_app_subdomain(p_subdomain);

  IF v_org_slug IS NULL THEN
    RETURN;
  END IF;

  -- Find the environment
  RETURN QUERY
  SELECT ae.id, a.id, o.id, ae.container_name, ae.port, ae.status
  FROM app_environments ae
  JOIN apps a ON a.id = ae.app_id
  JOIN organizations o ON o.id = a.org_id
  WHERE o.slug = v_org_slug
    AND a.slug = v_app_slug
    AND ae.name = v_env_name;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate next available port for app containers
-- Port range: 4000-4999 (reserved for user apps)
CREATE OR REPLACE FUNCTION allocate_app_port()
RETURNS INTEGER AS $$
DECLARE
  v_port INTEGER;
BEGIN
  -- Find the lowest available port starting from 4000
  SELECT generate_series INTO v_port
  FROM generate_series(4000, 4999)
  WHERE generate_series NOT IN (
    SELECT port FROM app_environments WHERE port IS NOT NULL
  )
  ORDER BY generate_series
  LIMIT 1;

  IF v_port IS NULL THEN
    RAISE EXCEPTION 'No available ports in range 4000-4999';
  END IF;

  RETURN v_port;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE apps IS 'Deployable applications owned by organizations';
COMMENT ON TABLE app_environments IS 'Environment instances (dev/staging/prod) of apps with container info';
COMMENT ON TABLE app_deployments IS 'Deployment history for app environments';
COMMENT ON TABLE app_domains IS 'Custom domain mappings for app environments';
COMMENT ON FUNCTION get_app_subdomain(UUID) IS 'Generate SignalDB subdomain for an app environment';
COMMENT ON FUNCTION parse_app_subdomain(TEXT) IS 'Parse subdomain into org/app/env components';
COMMENT ON FUNCTION find_environment_by_subdomain(TEXT) IS 'Look up environment details from subdomain';
COMMENT ON FUNCTION allocate_app_port() IS 'Allocate next available port for app containers (4000-4999)';
