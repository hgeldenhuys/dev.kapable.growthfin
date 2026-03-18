-- Migration: Add effective_lead_score column to crm_leads
-- US-CONF-003: Effective Lead Score Calculation
-- Author: backend-dev
-- Date: 2025-11-20

-- Step 1: Add effective_lead_score column (nullable initially for backfill)
ALTER TABLE crm_leads ADD COLUMN effective_lead_score INTEGER;

-- Step 2: Backfill existing leads (effective_score = lead_score for existing data)
UPDATE crm_leads
SET effective_lead_score = lead_score
WHERE effective_lead_score IS NULL AND deleted_at IS NULL;

-- Step 3: Add NOT NULL constraint after backfill
ALTER TABLE crm_leads ALTER COLUMN effective_lead_score SET NOT NULL;

-- Step 4: Set default for new records
ALTER TABLE crm_leads ALTER COLUMN effective_lead_score SET DEFAULT 0;

-- Step 5: Create index for campaign queries (WHERE deleted_at IS NULL)
CREATE INDEX idx_crm_leads_effective_score
ON crm_leads(workspace_id, effective_lead_score)
WHERE deleted_at IS NULL;

-- Verify migration
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM crm_leads
  WHERE deleted_at IS NULL AND effective_lead_score IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration verification failed: % leads have NULL effective_lead_score', null_count;
  END IF;

  RAISE NOTICE 'Migration successful: All active leads have effective_lead_score';
END $$;
