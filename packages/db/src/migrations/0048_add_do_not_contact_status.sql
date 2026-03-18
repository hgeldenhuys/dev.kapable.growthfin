-- Migration: Add 'do_not_contact' status to crm_lead_status enum
-- Epic 5: SMS Compliance & Opt-Out (US-SMS-014, US-SMS-015)

-- Add new status to the enum
ALTER TYPE crm_lead_status ADD VALUE IF NOT EXISTS 'do_not_contact';

-- Add comment documenting compliance requirement
COMMENT ON TYPE crm_lead_status IS 'Lead statuses including compliance status do_not_contact (TCPA/GDPR)';
