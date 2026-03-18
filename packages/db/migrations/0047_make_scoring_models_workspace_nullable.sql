-- Migration: Make crm_scoring_models.workspace_id nullable for global templates
-- Issue: BUG-ENRICH-001
-- Reason: Scoring model templates need to be accessible across all workspaces

-- 1. Make workspace_id nullable
ALTER TABLE crm_scoring_models
ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Update existing templates to be global (workspace_id = NULL)
UPDATE crm_scoring_models
SET workspace_id = NULL
WHERE is_template = true;

-- 3. Add comment for documentation
COMMENT ON COLUMN crm_scoring_models.workspace_id IS
'Workspace ID for workspace-specific models. NULL for global templates (is_template = true).';
