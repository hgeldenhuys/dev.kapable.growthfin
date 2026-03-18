-- Migration: 0052_add_crm_addresses.sql
-- Description: Add address fields to crm_accounts and crm_leads tables
-- Story: US-CRM-ADDR-001
-- Date: 2025-11-17

-- Add address fields to Accounts (billing + shipping)
ALTER TABLE crm_accounts
  ADD COLUMN billing_address_line1 TEXT,
  ADD COLUMN billing_address_line2 TEXT,
  ADD COLUMN billing_city TEXT,
  ADD COLUMN billing_state_province TEXT,
  ADD COLUMN billing_postal_code TEXT,
  ADD COLUMN billing_country TEXT,
  ADD COLUMN shipping_address_line1 TEXT,
  ADD COLUMN shipping_address_line2 TEXT,
  ADD COLUMN shipping_city TEXT,
  ADD COLUMN shipping_state_province TEXT,
  ADD COLUMN shipping_postal_code TEXT,
  ADD COLUMN shipping_country TEXT;

-- Add address fields to Leads
ALTER TABLE crm_leads
  ADD COLUMN address_line1 TEXT,
  ADD COLUMN address_line2 TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state_province TEXT,
  ADD COLUMN postal_code TEXT,
  ADD COLUMN country TEXT;

-- Add indexes for location-based filtering (Accounts)
CREATE INDEX idx_accounts_billing_city ON crm_accounts(workspace_id, billing_city) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_billing_state ON crm_accounts(workspace_id, billing_state_province) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_billing_country ON crm_accounts(workspace_id, billing_country) WHERE deleted_at IS NULL;

-- Add indexes for location-based filtering (Leads)
CREATE INDEX idx_leads_city ON crm_leads(workspace_id, city) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_state ON crm_leads(workspace_id, state_province) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_country ON crm_leads(workspace_id, country) WHERE deleted_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN crm_accounts.billing_address_line1 IS 'Billing address line 1 (street address)';
COMMENT ON COLUMN crm_accounts.billing_address_line2 IS 'Billing address line 2 (suite, apt, etc)';
COMMENT ON COLUMN crm_accounts.billing_city IS 'Billing address city';
COMMENT ON COLUMN crm_accounts.billing_state_province IS 'Billing address state/province';
COMMENT ON COLUMN crm_accounts.billing_postal_code IS 'Billing address postal/zip code';
COMMENT ON COLUMN crm_accounts.billing_country IS 'Billing address country';

COMMENT ON COLUMN crm_accounts.shipping_address_line1 IS 'Shipping address line 1 (street address)';
COMMENT ON COLUMN crm_accounts.shipping_address_line2 IS 'Shipping address line 2 (suite, apt, etc)';
COMMENT ON COLUMN crm_accounts.shipping_city IS 'Shipping address city';
COMMENT ON COLUMN crm_accounts.shipping_state_province IS 'Shipping address state/province';
COMMENT ON COLUMN crm_accounts.shipping_postal_code IS 'Shipping address postal/zip code';
COMMENT ON COLUMN crm_accounts.shipping_country IS 'Shipping address country';

COMMENT ON COLUMN crm_leads.address_line1 IS 'Address line 1 (street address)';
COMMENT ON COLUMN crm_leads.address_line2 IS 'Address line 2 (suite, apt, etc)';
COMMENT ON COLUMN crm_leads.city IS 'City';
COMMENT ON COLUMN crm_leads.state_province IS 'State/province';
COMMENT ON COLUMN crm_leads.postal_code IS 'Postal/zip code';
COMMENT ON COLUMN crm_leads.country IS 'Country';
