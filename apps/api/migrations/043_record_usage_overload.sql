-- Migration 043: Add 3-parameter overload for record_usage
--
-- The original record_usage(uuid, uuid, text, bigint) requires a project_id.
-- The usage tracking code calls it with 3 params (no project_id) for org-level metrics.
-- This adds an overload that defaults project_id to NULL.

-- 3-parameter overload for org-level metrics (no project_id)
CREATE OR REPLACE FUNCTION record_usage(
  p_org_id UUID,
  p_metric_type TEXT,
  p_value BIGINT
)
RETURNS VOID AS $$
BEGIN
  -- Use COALESCE in the conflict target to handle NULL project_id
  INSERT INTO usage_metrics (org_id, project_id, metric_date, metric_type, value)
  VALUES (p_org_id, NULL, CURRENT_DATE, p_metric_type, p_value)
  ON CONFLICT (org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_date, metric_type)
  DO UPDATE SET value = usage_metrics.value + EXCLUDED.value;
END;
$$ LANGUAGE plpgsql;

-- Fix the unique constraint to handle NULL project_id properly
-- Drop existing constraint and create a new one using COALESCE
-- First, check if we need to drop and recreate
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_metrics_org_id_project_id_metric_date_metric_type_key'
  ) THEN
    ALTER TABLE usage_metrics DROP CONSTRAINT usage_metrics_org_id_project_id_metric_date_metric_type_key;
  END IF;
END $$;

-- Create unique index that handles NULL project_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_metrics_unique
ON usage_metrics (org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_date, metric_type);

-- Update the 4-param version to use the same COALESCE pattern
CREATE OR REPLACE FUNCTION record_usage(
  p_org_id UUID,
  p_project_id UUID,
  p_metric_type TEXT,
  p_value BIGINT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_metrics (org_id, project_id, metric_date, metric_type, value)
  VALUES (p_org_id, p_project_id, CURRENT_DATE, p_metric_type, p_value)
  ON CONFLICT (org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_date, metric_type)
  DO UPDATE SET value = usage_metrics.value + EXCLUDED.value;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION record_usage(UUID, TEXT, BIGINT) IS 'Record org-level usage metric (no project_id)';
COMMENT ON FUNCTION record_usage(UUID, UUID, TEXT, BIGINT) IS 'Record project-level usage metric';
