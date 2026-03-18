-- Phase O: Full-Text Search
-- Add full-text search capabilities across leads, contacts, and transcripts

-- Add tsvector columns for full-text search
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS transcript_vector tsvector;

-- GIN indexes for fast search
CREATE INDEX IF NOT EXISTS idx_crm_leads_search ON crm_leads USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_search ON crm_contacts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_transcript ON crm_ai_calls USING GIN(transcript_vector);

-- Function to update lead search vector
CREATE OR REPLACE FUNCTION update_lead_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NEW.last_name, '') || ' ' ||
    COALESCE(NEW.email, '') || ' ' ||
    COALESCE(NEW.company_name, '') || ' ' ||
    COALESCE(NEW.phone, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.industry, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.state, '') || ' ' ||
    COALESCE(NEW.country, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update contact search vector
CREATE OR REPLACE FUNCTION update_contact_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NEW.last_name, '') || ' ' ||
    COALESCE(NEW.email, '') || ' ' ||
    COALESCE(NEW.phone, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.department, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update AI call transcript search vector
CREATE OR REPLACE FUNCTION update_ai_call_transcript_vector() RETURNS TRIGGER AS $$
BEGIN
  -- Only update if transcript changed
  IF NEW.transcript IS DISTINCT FROM OLD.transcript OR OLD.transcript IS NULL THEN
    NEW.transcript_vector := to_tsvector('english', COALESCE(NEW.transcript, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain search vectors
DROP TRIGGER IF EXISTS trg_lead_search_vector ON crm_leads;
CREATE TRIGGER trg_lead_search_vector
  BEFORE INSERT OR UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_lead_search_vector();

DROP TRIGGER IF EXISTS trg_contact_search_vector ON crm_contacts;
CREATE TRIGGER trg_contact_search_vector
  BEFORE INSERT OR UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_contact_search_vector();

DROP TRIGGER IF EXISTS trg_ai_call_transcript_vector ON crm_ai_calls;
CREATE TRIGGER trg_ai_call_transcript_vector
  BEFORE INSERT OR UPDATE ON crm_ai_calls
  FOR EACH ROW EXECUTE FUNCTION update_ai_call_transcript_vector();

-- Backfill existing records
UPDATE crm_leads SET search_vector = to_tsvector('english',
  COALESCE(first_name, '') || ' ' ||
  COALESCE(last_name, '') || ' ' ||
  COALESCE(email, '') || ' ' ||
  COALESCE(company_name, '') || ' ' ||
  COALESCE(phone, '') || ' ' ||
  COALESCE(title, '') || ' ' ||
  COALESCE(industry, '') || ' ' ||
  COALESCE(city, '') || ' ' ||
  COALESCE(state, '') || ' ' ||
  COALESCE(country, '')
) WHERE search_vector IS NULL;

UPDATE crm_contacts SET search_vector = to_tsvector('english',
  COALESCE(first_name, '') || ' ' ||
  COALESCE(last_name, '') || ' ' ||
  COALESCE(email, '') || ' ' ||
  COALESCE(phone, '') || ' ' ||
  COALESCE(title, '') || ' ' ||
  COALESCE(department, '')
) WHERE search_vector IS NULL;

UPDATE crm_ai_calls SET transcript_vector = to_tsvector('english', COALESCE(transcript, ''))
WHERE transcript IS NOT NULL AND transcript_vector IS NULL;

-- Comments for documentation
COMMENT ON COLUMN crm_leads.search_vector IS 'Full-text search vector for lead fields';
COMMENT ON COLUMN crm_contacts.search_vector IS 'Full-text search vector for contact fields';
COMMENT ON COLUMN crm_ai_calls.transcript_vector IS 'Full-text search vector for call transcripts';
