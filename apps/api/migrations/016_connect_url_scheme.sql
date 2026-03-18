-- Migration 016: SignalDB Connect URL Scheme
-- Updates app_environments with subdomain column and new URL parsing functions
-- Domain: signaldb.app
-- URL pattern: {org}.signaldb.app (production)
--              {org}-{env}.signaldb.app (non-production)

-- Add subdomain column for direct lookups
ALTER TABLE app_environments
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Create index on subdomain for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_environments_subdomain
ON app_environments(subdomain)
WHERE subdomain IS NOT NULL;

-- Function to compute subdomain for an environment
-- Pattern: {org} for production, {org}-{env} for non-production
-- Note: app_slug is not used in subdomain (one app per org for now)
CREATE OR REPLACE FUNCTION compute_connect_subdomain(
  p_app_slug TEXT,
  p_org_slug TEXT,
  p_env_name TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- For production, just org: {org}.signaldb.app
  IF p_env_name = 'production' THEN
    RETURN p_org_slug;
  ELSE
    -- For non-production: {org}-{env}.signaldb.app
    RETURN p_org_slug || '-' || p_env_name;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-compute subdomain on insert/update
CREATE OR REPLACE FUNCTION trigger_compute_connect_subdomain()
RETURNS TRIGGER AS $$
DECLARE
  v_app_slug TEXT;
  v_org_slug TEXT;
BEGIN
  -- Get app and org slugs
  SELECT a.slug, o.slug
  INTO v_app_slug, v_org_slug
  FROM apps a
  JOIN organizations o ON o.id = a.org_id
  WHERE a.id = NEW.app_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Compute and set subdomain
  NEW.subdomain := compute_connect_subdomain(v_app_slug, v_org_slug, NEW.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_env_compute_subdomain ON app_environments;
CREATE TRIGGER trigger_env_compute_subdomain
  BEFORE INSERT OR UPDATE OF app_id, name ON app_environments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_connect_subdomain();

-- Update existing function to use new URL pattern
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

  -- For production: {org}.signaldb.app
  IF v_env_name = 'production' THEN
    RETURN v_org_slug || '.signaldb.app';
  ELSE
    -- For non-production: {org}-{env}.signaldb.app
    RETURN v_org_slug || '-' || v_env_name || '.signaldb.app';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Parse Connect subdomain into org/app/env components
-- Input formats:
--   Production: '{org}' (e.g., 'demo')
--   Non-prod: '{org}-{env}' (e.g., 'demo-dev', 'demo-staging')
-- Returns: {org_slug, app_slug, env_name}
-- Note: app_slug is looked up from org, not parsed from subdomain
CREATE OR REPLACE FUNCTION parse_connect_subdomain(
  p_subdomain TEXT
)
RETURNS TABLE (
  org_slug TEXT,
  app_slug TEXT,
  env_name TEXT
) AS $$
DECLARE
  v_dash_pos INTEGER;
  v_potential_org TEXT;
  v_potential_env TEXT;
  v_found_app_slug TEXT;
BEGIN
  -- Check if subdomain contains environment suffix (e.g., 'demo-dev')
  -- Look for last dash
  v_dash_pos := length(p_subdomain) - position('-' in reverse(p_subdomain)) + 1;

  IF position('-' in p_subdomain) > 0 THEN
    -- Has a dash - extract potential org and env
    v_potential_org := left(p_subdomain, v_dash_pos - 1);
    v_potential_env := substring(p_subdomain from v_dash_pos + 1);

    -- Check if this org-env combination exists
    SELECT a.slug INTO v_found_app_slug
    FROM app_environments ae
    JOIN apps a ON a.id = ae.app_id
    JOIN organizations o ON o.id = a.org_id
    WHERE o.slug = v_potential_org
      AND ae.name = v_potential_env
    LIMIT 1;

    IF v_found_app_slug IS NOT NULL THEN
      -- It's a non-production environment
      RETURN QUERY SELECT v_potential_org, v_found_app_slug, v_potential_env;
      RETURN;
    END IF;
  END IF;

  -- No dash, or dash is part of org name - treat as production
  -- Look up the default/primary app for this org
  SELECT a.slug INTO v_found_app_slug
  FROM app_environments ae
  JOIN apps a ON a.id = ae.app_id
  JOIN organizations o ON o.id = a.org_id
  WHERE o.slug = p_subdomain
    AND ae.name = 'production'
  LIMIT 1;

  IF v_found_app_slug IS NOT NULL THEN
    RETURN QUERY SELECT p_subdomain, v_found_app_slug, 'production'::TEXT;
  ELSE
    -- Org not found
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update find_environment_by_subdomain to use new parsing
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
  -- First try direct subdomain lookup (fast path)
  RETURN QUERY
  SELECT ae.id, a.id, o.id, ae.container_name, ae.port, ae.status
  FROM app_environments ae
  JOIN apps a ON a.id = ae.app_id
  JOIN organizations o ON o.id = a.org_id
  WHERE ae.subdomain = p_subdomain;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Fallback to parsing (for environments created before migration)
  SELECT * INTO v_org_slug, v_app_slug, v_env_name
  FROM parse_connect_subdomain(p_subdomain);

  IF v_org_slug IS NULL THEN
    RETURN;
  END IF;

  -- Find the environment by slugs
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

-- Backfill subdomain for existing environments
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ae.id, ae.name, a.slug as app_slug, o.slug as org_slug
    FROM app_environments ae
    JOIN apps a ON a.id = ae.app_id
    JOIN organizations o ON o.id = a.org_id
    WHERE ae.subdomain IS NULL
  LOOP
    UPDATE app_environments
    SET subdomain = compute_connect_subdomain(r.app_slug, r.org_slug, r.name)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Comments
COMMENT ON COLUMN app_environments.subdomain IS 'Pre-computed subdomain for fast lookups. Format: {app}.{org} or {app}-{env}.{org}';
COMMENT ON FUNCTION compute_connect_subdomain(TEXT, TEXT, TEXT) IS 'Compute Connect subdomain from app/org/env slugs';
COMMENT ON FUNCTION parse_connect_subdomain(TEXT) IS 'Parse Connect subdomain into org/app/env components';
