-- Migration: Add filtered list support
-- Adds source_list_id and metadata columns to crm_contact_lists
-- Enables tracking of lists created from filters and other operations

-- Add columns
ALTER TABLE crm_contact_lists
ADD COLUMN IF NOT EXISTS source_list_id UUID REFERENCES crm_contact_lists(id) ON DELETE SET NULL;

-- Note: metadata column already exists, no need to add

-- Add index for source_list_id (partial index - only non-null values)
CREATE INDEX IF NOT EXISTS idx_crm_contact_lists_source_list_id
ON crm_contact_lists(source_list_id) WHERE source_list_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN crm_contact_lists.source_list_id IS 'Original list ID if created from filters or operations';
COMMENT ON COLUMN crm_contact_lists.metadata IS 'JSON metadata including filter criteria, operation details, etc.';
