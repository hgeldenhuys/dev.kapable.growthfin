-- Rollback: Remove effective_lead_score column from crm_leads
-- US-CONF-003: Effective Lead Score Calculation (rollback)
-- Author: backend-dev
-- Date: 2025-11-20

-- Drop index first
DROP INDEX IF EXISTS idx_crm_leads_effective_score;

-- Drop column
ALTER TABLE crm_leads DROP COLUMN IF EXISTS effective_lead_score;

-- Verify rollback
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_leads' AND column_name = 'effective_lead_score'
  ) THEN
    RAISE EXCEPTION 'Rollback verification failed: effective_lead_score column still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: effective_lead_score column removed';
END $$;
