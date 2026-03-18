-- Rollback: Remove provider column from crm_tool_calls table

-- Drop index
DROP INDEX IF EXISTS idx_crm_tool_calls_provider;

-- Drop column
ALTER TABLE crm_tool_calls DROP COLUMN IF EXISTS provider;
