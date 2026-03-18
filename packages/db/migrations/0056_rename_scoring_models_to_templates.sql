-- Migration: Rename crm_scoring_models to crm_templates with template type
-- Sprint 1: Enrichment Templates & Tasks System
-- Date: 2025-11-18

-- Step 1: Create the new template_type enum
DO $$ BEGIN
  CREATE TYPE crm_template_type AS ENUM ('enrichment', 'scoring', 'export');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Rename the table
ALTER TABLE IF EXISTS crm_scoring_models RENAME TO crm_templates;

-- Step 3: Add the type column with default 'scoring' for existing records
ALTER TABLE crm_templates
  ADD COLUMN IF NOT EXISTS type crm_template_type NOT NULL DEFAULT 'scoring';

-- Step 4: Migrate metadata structure
-- Move usageCount and lastUsedAt from columns to metadata JSONB
UPDATE crm_templates
SET metadata = jsonb_build_object(
  'usageCount', COALESCE(usage_count, 0),
  'lastUsedAt', to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'estimatedCostPerContact', NULL
)
WHERE metadata = '{}'::jsonb OR metadata IS NULL;

-- Step 5: Drop the old columns (if they exist)
ALTER TABLE crm_templates
  DROP COLUMN IF EXISTS usage_count,
  DROP COLUMN IF EXISTS last_used_at;

-- Step 6: Rename indexes
ALTER INDEX IF EXISTS idx_crm_scoring_models_workspace_id RENAME TO idx_crm_templates_workspace_id;
ALTER INDEX IF EXISTS idx_crm_scoring_models_owner_id RENAME TO idx_crm_templates_owner_id;
ALTER INDEX IF EXISTS idx_crm_scoring_models_type RENAME TO idx_crm_templates_type_old;
ALTER INDEX IF EXISTS idx_crm_scoring_models_is_template RENAME TO idx_crm_templates_is_template;

-- Step 7: Create new indexes
CREATE INDEX IF NOT EXISTS idx_crm_templates_type ON crm_templates(type);
CREATE INDEX IF NOT EXISTS idx_crm_templates_deleted_at ON crm_templates(deleted_at);

-- Step 8: Drop the old type index if it still exists
DROP INDEX IF EXISTS idx_crm_templates_type_old;
