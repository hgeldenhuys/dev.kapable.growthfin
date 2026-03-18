-- Migration: Fix template type to use enum instead of text
-- Date: 2025-11-18

-- Map old enrichment job types to new template types
-- classification, enhancement, qualification → enrichment
-- scoring → scoring
UPDATE crm_templates SET type = 'enrichment' WHERE type IN ('classification', 'enhancement', 'qualification');
UPDATE crm_templates SET type = 'scoring' WHERE type = 'scoring';

-- Drop the default
ALTER TABLE crm_templates ALTER COLUMN type DROP DEFAULT;

-- Convert the column to use the enum type
ALTER TABLE crm_templates
  ALTER COLUMN type TYPE crm_template_type USING type::crm_template_type;

-- Re-add the default with correct type
ALTER TABLE crm_templates ALTER COLUMN type SET DEFAULT 'enrichment'::crm_template_type;
