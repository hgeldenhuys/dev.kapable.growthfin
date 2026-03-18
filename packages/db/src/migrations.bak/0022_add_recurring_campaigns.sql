-- Migration: Add recurring campaigns support
-- Add schedule tracking fields to crm_campaigns table

-- Add schedule column for cron expressions
ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS schedule TEXT;

-- Add last_executed_at to track when campaign last ran
ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE;

-- Add next_execution_at to track when campaign should run next
ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMP WITH TIME ZONE;

-- Create index on next_execution_at for efficient scheduler queries
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_next_execution_at ON crm_campaigns(next_execution_at)
WHERE type = 'recurring' AND status = 'active' AND deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN crm_campaigns.schedule IS 'Cron expression for recurring campaigns (e.g., "0 9 * * 1" for every Monday at 9 AM)';
COMMENT ON COLUMN crm_campaigns.last_executed_at IS 'Timestamp of the last execution for recurring campaigns';
COMMENT ON COLUMN crm_campaigns.next_execution_at IS 'Timestamp of the next scheduled execution for recurring campaigns';
