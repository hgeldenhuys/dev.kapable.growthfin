-- Migration: Add custom_fields_source to track data origin
-- This distinguishes between imported custom data vs enrichment API data

-- Add custom_fields_source to crm_leads
ALTER TABLE crm_leads
ADD COLUMN IF NOT EXISTS custom_fields_source TEXT;

COMMENT ON COLUMN crm_leads.custom_fields_source IS 'Source of custom fields: import (CSV), enrichment (API), or manual';

-- Add custom_fields_source to crm_contacts
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS custom_fields_source TEXT;

COMMENT ON COLUMN crm_contacts.custom_fields_source IS 'Source of custom fields: import (CSV), enrichment (API), or manual';

-- Set default for existing records with custom fields
-- If they have custom fields but no enrichment data, assume import
UPDATE crm_leads
SET custom_fields_source = 'import'
WHERE custom_fields IS NOT NULL
  AND custom_fields != '{}'::jsonb
  AND custom_fields_source IS NULL;

UPDATE crm_contacts
SET custom_fields_source = 'import'
WHERE custom_fields IS NOT NULL
  AND custom_fields != '{}'::jsonb
  AND custom_fields_source IS NULL;
