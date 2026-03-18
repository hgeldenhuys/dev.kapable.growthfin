-- Migration 0047: SMS phone number indexes for fast inbound lookup
-- Purpose: Enable fast SMS webhook lookups to match inbound messages to leads/contacts
-- Reference: US-SMS-002 (SMS Channel Infrastructure Epic)

-- Add phone index for crm_leads (workspace-scoped for multi-tenancy)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_leads_phone
  ON crm_leads(workspace_id, phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX idx_crm_leads_phone IS
  'Fast lookup for inbound SMS to lead mapping. Workspace-scoped for multi-tenancy. Used by Twilio webhook handler.';

-- Note: crm_contacts already has idx_crm_contacts_phone (created in earlier migration)
-- Verified existing index:
-- CREATE INDEX idx_crm_contacts_phone ON crm_contacts(phone);
-- No changes needed for contacts table.

-- Migration complete
