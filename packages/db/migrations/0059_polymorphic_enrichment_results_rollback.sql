-- Rollback Migration: Revert crm_enrichment_results back to contact-only relationship
-- WARNING: This will delete all enrichment results for leads!

-- Step 1: Delete all lead enrichment results (data loss!)
DELETE FROM crm_enrichment_results WHERE entity_type = 'lead';

-- Step 2: Drop the new indexes
DROP INDEX IF EXISTS idx_crm_enrichment_results_entity_type;
DROP INDEX IF EXISTS idx_crm_enrichment_results_entity;

-- Step 3: Drop the check constraint
ALTER TABLE crm_enrichment_results
  DROP CONSTRAINT IF EXISTS crm_enrichment_results_entity_type_check;

-- Step 4: Drop the entity_type column
ALTER TABLE crm_enrichment_results
  DROP COLUMN entity_type;

-- Step 5: Rename column back from entity_id to contact_id
ALTER TABLE crm_enrichment_results
  RENAME COLUMN entity_id TO contact_id;

-- Step 6: Re-add the foreign key constraint to crm_contacts
ALTER TABLE crm_enrichment_results
  ADD CONSTRAINT crm_enrichment_results_contact_id_crm_contacts_id_fk
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;

-- Step 7: Re-add the contact_id index
CREATE INDEX idx_crm_enrichment_results_contact_id
  ON crm_enrichment_results(contact_id);
