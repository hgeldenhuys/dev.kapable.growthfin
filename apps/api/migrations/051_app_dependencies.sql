-- Migration 051: Inter-app dependencies for service discovery

CREATE TABLE IF NOT EXISTS app_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES app_environments(id) ON DELETE CASCADE,
  target_app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  target_environment_name TEXT,  -- NULL = same env name, fallback to 'production'
  alias TEXT NOT NULL,           -- SIGNALDB_SVC_{ALIAS}_URL
  resolved_url TEXT,
  resolved_at TIMESTAMPTZ,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(environment_id, alias),
  CHECK (app_id != target_app_id),
  CHECK (alias ~ '^[A-Z][A-Z0-9_]{0,49}$')
);

CREATE INDEX IF NOT EXISTS idx_app_deps_app ON app_dependencies(app_id);
CREATE INDEX IF NOT EXISTS idx_app_deps_env ON app_dependencies(environment_id);
CREATE INDEX IF NOT EXISTS idx_app_deps_target ON app_dependencies(target_app_id);

-- Trigger: ensure both apps belong to the same organization
CREATE OR REPLACE FUNCTION check_same_org_dependency()
RETURNS TRIGGER AS $$
DECLARE
  source_org_id UUID;
  target_org_id UUID;
BEGIN
  SELECT org_id INTO source_org_id FROM apps WHERE id = NEW.app_id;
  SELECT org_id INTO target_org_id FROM apps WHERE id = NEW.target_app_id;

  IF source_org_id IS DISTINCT FROM target_org_id THEN
    RAISE EXCEPTION 'app_dependencies: app_id and target_app_id must belong to the same organization (source org: %, target org: %)',
      source_org_id, target_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_same_org_dependency
  BEFORE INSERT OR UPDATE ON app_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION check_same_org_dependency();
