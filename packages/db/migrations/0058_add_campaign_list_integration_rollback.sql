-- Rollback Migration: Remove Campaign-List Integration
-- Date: 2025-11-18
-- Description: Revert campaign-list integration changes

-- Step 1: Drop crm_campaign_snapshots table
DROP TABLE IF EXISTS crm_campaign_snapshots;

-- Step 2: Drop CHECK constraint from crm_campaigns
ALTER TABLE crm_campaigns
DROP CONSTRAINT IF EXISTS check_campaign_audience_source;

-- Step 3: Drop index on list_id
DROP INDEX IF EXISTS idx_crm_campaigns_list_id;

-- Step 4: Drop recipient_selection column
ALTER TABLE crm_campaigns
DROP COLUMN IF EXISTS recipient_selection;

-- Step 5: Drop list_id column
ALTER TABLE crm_campaigns
DROP COLUMN IF EXISTS list_id;
