-- Add error_details column to store detailed error information for each failed row
ALTER TABLE crm_lead_imports
ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN crm_lead_imports.error_details IS 'Array of error objects with line number, field, and message for each failed row';