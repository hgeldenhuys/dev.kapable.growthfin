-- Phase L: Inbound AI Calls
-- Add direction and caller identification columns to crm_ai_calls table

-- Add direction column to track inbound vs outbound calls
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound';
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_direction ON crm_ai_calls(direction);

-- Add inbound-specific fields for caller identification
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS caller_identified boolean DEFAULT false;
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS identified_entity_type text; -- 'lead' or 'contact'
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS identified_entity_id uuid;
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS caller_phone_number text; -- The incoming phone number

-- Add index for caller lookups
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_caller_phone ON crm_ai_calls(caller_phone_number);
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_identified_entity ON crm_ai_calls(identified_entity_type, identified_entity_id);

-- Add comment for documentation
COMMENT ON COLUMN crm_ai_calls.direction IS 'Call direction: outbound (initiated by us) or inbound (received from caller)';
COMMENT ON COLUMN crm_ai_calls.caller_identified IS 'Whether the caller was identified as an existing lead or contact';
COMMENT ON COLUMN crm_ai_calls.identified_entity_type IS 'Type of identified entity: lead or contact';
COMMENT ON COLUMN crm_ai_calls.identified_entity_id IS 'ID of the identified lead or contact';
COMMENT ON COLUMN crm_ai_calls.caller_phone_number IS 'The phone number of the caller (for inbound calls)';
