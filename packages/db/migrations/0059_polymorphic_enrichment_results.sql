-- Migration: Make crm_enrichment_results support both contacts and leads
-- This enables polymorphic relationship where enrichment results can be linked to either entity type

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE crm_enrichment_results
  DROP CONSTRAINT IF EXISTS crm_enrichment_results_contact_id_crm_contacts_id_fk;

-- Step 2: Rename column from contact_id to entity_id
ALTER TABLE crm_enrichment_results
  RENAME COLUMN contact_id TO entity_id;

-- Step 3: Add entity_type column with default value 'contact' for existing records
ALTER TABLE crm_enrichment_results
  ADD COLUMN entity_type VARCHAR(20) NOT NULL DEFAULT 'contact';

-- Step 4: Add check constraint to ensure only valid entity types
ALTER TABLE crm_enrichment_results
  ADD CONSTRAINT crm_enrichment_results_entity_type_check
  CHECK (entity_type IN ('contact', 'lead'));

-- Step 5: Drop the old contact_id index (if it exists)
DROP INDEX IF EXISTS idx_crm_enrichment_results_contact_id;

-- Step 6: Add composite index on (entity_id, entity_type) for polymorphic lookups
CREATE INDEX idx_crm_enrichment_results_entity
  ON crm_enrichment_results(entity_id, entity_type);

-- Step 7: Add individual index on entity_type for filtering
CREATE INDEX idx_crm_enrichment_results_entity_type
  ON crm_enrichment_results(entity_type);

-- Note: We do NOT add foreign keys for polymorphic relationships
-- Application code is responsible for ensuring referential integrity
