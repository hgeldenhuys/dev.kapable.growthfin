-- Rollback for Migration 0062: Sales Queue Enhancements
-- Date: 2025-11-19

-- Remove indexes
DROP INDEX IF EXISTS idx_crm_activities_channel_status;
DROP INDEX IF EXISTS idx_crm_activities_channel_lookup;
DROP INDEX IF EXISTS idx_crm_leads_callbacks;
DROP INDEX IF EXISTS idx_crm_leads_claimable;
DROP INDEX IF EXISTS idx_crm_leads_queue_performance;

-- Remove columns from crm_activities
ALTER TABLE crm_activities
DROP COLUMN IF EXISTS channel_metadata,
DROP COLUMN IF EXISTS channel_error_code,
DROP COLUMN IF EXISTS channel_status,
DROP COLUMN IF EXISTS channel_message_id,
DROP COLUMN IF EXISTS channel,
DROP COLUMN IF EXISTS direction;

-- Note: Cannot remove enum value 'sms' from crm_activity_type without recreating the enum
-- This is a PostgreSQL limitation. To fully rollback, you would need to:
-- 1. Ensure no activities have type='sms'
-- 2. Drop and recreate the enum without 'sms'
-- 3. Recreate the column with the new enum
-- This is rarely worth it in practice - better to leave the enum value.
