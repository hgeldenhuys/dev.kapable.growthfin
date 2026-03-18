-- Migration: Per-Project User Lifecycle Management
-- Purpose: Add feature flag for gradual rollout and lifecycle tracking columns

-- ============================================================================
-- Feature Flag: Control per-project user provisioning per instance
-- ============================================================================

-- Add feature flag to database_instances table
-- When true, new projects on this instance will automatically get per-project users
ALTER TABLE database_instances
ADD COLUMN IF NOT EXISTS per_project_users_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN database_instances.per_project_users_enabled
  IS 'When true, new projects on this instance automatically get per-project PostgreSQL users';

-- ============================================================================
-- Lifecycle Tracking: Track when credentials were created/rotated
-- ============================================================================

-- Add lifecycle tracking to project_databases
ALTER TABLE project_databases
ADD COLUMN IF NOT EXISTS project_user_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS project_user_last_rotated TIMESTAMPTZ;

COMMENT ON COLUMN project_databases.project_user_created_at
  IS 'Timestamp when the per-project PostgreSQL user was created';

COMMENT ON COLUMN project_databases.project_user_last_rotated
  IS 'Timestamp when the per-project user password was last rotated';

-- ============================================================================
-- Indexes: Optimize queries for provisioning status
-- ============================================================================

-- Index for finding projects that have/don't have dedicated users
-- Useful for monitoring and batch provisioning
CREATE INDEX IF NOT EXISTS idx_project_databases_has_user
  ON project_databases ((project_user IS NOT NULL));

-- Index for finding projects on enabled instances without users (need provisioning)
CREATE INDEX IF NOT EXISTS idx_project_databases_needs_provisioning
  ON project_databases (instance_id)
  WHERE project_user IS NULL;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if per-project users are enabled for a project's instance
CREATE OR REPLACE FUNCTION is_per_project_users_enabled(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT di.per_project_users_enabled INTO v_enabled
  FROM project_databases pd
  JOIN database_instances di ON di.id = pd.instance_id
  WHERE pd.project_id = p_project_id;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get provisioning statistics
CREATE OR REPLACE FUNCTION get_project_user_stats()
RETURNS TABLE(
  instance_name TEXT,
  tier TEXT,
  feature_enabled BOOLEAN,
  total_projects BIGINT,
  with_dedicated_user BIGINT,
  without_dedicated_user BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    di.name::TEXT as instance_name,
    di.tier::TEXT,
    COALESCE(di.per_project_users_enabled, false) as feature_enabled,
    COUNT(pd.id) as total_projects,
    COUNT(pd.project_user) as with_dedicated_user,
    COUNT(pd.id) - COUNT(pd.project_user) as without_dedicated_user
  FROM database_instances di
  LEFT JOIN project_databases pd ON pd.instance_id = di.id AND pd.status = 'active'
  GROUP BY di.id, di.name, di.tier, di.per_project_users_enabled
  ORDER BY di.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update lifecycle timestamps
-- ============================================================================

-- Function to update lifecycle timestamps when credentials change
CREATE OR REPLACE FUNCTION update_project_user_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- If project_user is being set for the first time
  IF OLD.project_user IS NULL AND NEW.project_user IS NOT NULL THEN
    NEW.project_user_created_at := NOW();
    NEW.project_user_last_rotated := NOW();
  -- If password is being updated (encrypted password changed)
  ELSIF OLD.project_password_encrypted IS DISTINCT FROM NEW.project_password_encrypted
        AND NEW.project_password_encrypted IS NOT NULL THEN
    NEW.project_user_last_rotated := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lifecycle timestamp updates
DROP TRIGGER IF EXISTS trg_update_project_user_timestamps ON project_databases;
CREATE TRIGGER trg_update_project_user_timestamps
  BEFORE UPDATE ON project_databases
  FOR EACH ROW
  EXECUTE FUNCTION update_project_user_timestamps();

-- ============================================================================
-- Initial State: Leave feature disabled (opt-in per instance)
-- ============================================================================

-- By default, per_project_users_enabled is false for all instances
-- Enable selectively:
-- UPDATE database_instances SET per_project_users_enabled = true WHERE name = 'signaldb-hobbyist';
