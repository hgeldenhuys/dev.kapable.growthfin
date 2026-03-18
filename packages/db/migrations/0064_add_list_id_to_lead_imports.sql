-- Migration: Add list_id to crm_lead_imports table
-- Purpose: Track which list was created during CSV import for better navigation

-- Add list_id column
ALTER TABLE crm_lead_imports ADD COLUMN list_id UUID;

-- Add foreign key constraint to lists table
ALTER TABLE crm_lead_imports
  ADD CONSTRAINT crm_lead_imports_list_id_fkey
  FOREIGN KEY (list_id)
  REFERENCES crm_contact_lists(id)
  ON DELETE SET NULL;

-- Add index for querying by list_id
CREATE INDEX idx_lead_imports_list_id ON crm_lead_imports(list_id);

-- Add comment for documentation
COMMENT ON COLUMN crm_lead_imports.list_id IS 'ID of the list auto-created during import containing all imported leads';
