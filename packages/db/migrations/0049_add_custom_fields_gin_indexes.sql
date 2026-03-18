-- Migration: Add GIN indexes for custom_fields JSONB columns
-- Purpose: Optimize queries on custom fields for CRM contacts and leads
-- Story: US-CUSTOMFIELDS-001

-- Add GIN index on crm_contacts.custom_fields
-- This enables efficient querying of JSONB custom fields using @>, ?, ?&, ?| operators
-- Example queries:
--   WHERE custom_fields @> '{"industry": "Technology"}'::jsonb
--   WHERE custom_fields ? 'employee_count'
CREATE INDEX IF NOT EXISTS idx_crm_contacts_custom_fields_gin
  ON crm_contacts USING GIN (custom_fields);

-- Add GIN index on crm_leads.custom_fields
-- Same performance optimization for leads table
CREATE INDEX IF NOT EXISTS idx_crm_leads_custom_fields_gin
  ON crm_leads USING GIN (custom_fields);

-- Add GIN index on crm_accounts.custom_fields
-- Optimize custom fields queries on accounts as well
CREATE INDEX IF NOT EXISTS idx_crm_accounts_custom_fields_gin
  ON crm_accounts USING GIN (custom_fields);

-- Note: GIN indexes are ideal for JSONB columns with:
-- - Contains queries (@>)
-- - Exists queries (?, ?&, ?|)
-- - Path/value queries (jsonb_path_query)
--
-- GIN indexes may slow down inserts/updates slightly, but dramatically
-- improve query performance on JSONB data.
