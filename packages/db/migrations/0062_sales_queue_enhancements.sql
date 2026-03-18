-- Migration 0062: Sales Queue Enhancements
-- Add SMS activity type, channel metadata, and queue optimization indexes
-- Date: 2025-11-19
-- Story: US-SALES-QUEUE-001

-- Step 1: Add 'sms' to activity type enum
ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'sms';

-- Step 2: Add channel-related columns to crm_activities table
ALTER TABLE crm_activities
ADD COLUMN IF NOT EXISTS direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
ADD COLUMN IF NOT EXISTS channel VARCHAR(20) CHECK (channel IN ('call', 'sms', 'email', 'chat', 'social')),
ADD COLUMN IF NOT EXISTS channel_message_id TEXT, -- External ID (Twilio SID, Resend ID, etc)
ADD COLUMN IF NOT EXISTS channel_status VARCHAR(20), -- Provider-specific status
ADD COLUMN IF NOT EXISTS channel_error_code TEXT,
ADD COLUMN IF NOT EXISTS channel_metadata JSONB DEFAULT '{}';

-- Step 3: Add queue performance indexes for crm_leads
-- Index for queue queries (workspace, owner, callback, propensity)
CREATE INDEX IF NOT EXISTS idx_crm_leads_queue_performance
ON crm_leads(workspace_id, owner_id, callback_date, propensity_score DESC)
WHERE deleted_at IS NULL;

-- Index for claiming leads (unassigned leads)
CREATE INDEX IF NOT EXISTS idx_crm_leads_claimable
ON crm_leads(workspace_id, propensity_score DESC, created_at ASC)
WHERE owner_id IS NULL AND deleted_at IS NULL AND status = 'new';

-- Index for callback date filtering
CREATE INDEX IF NOT EXISTS idx_crm_leads_callbacks
ON crm_leads(workspace_id, callback_date)
WHERE deleted_at IS NULL AND callback_date IS NOT NULL;

-- Step 4: Add indexes for activity channel lookups
CREATE INDEX IF NOT EXISTS idx_crm_activities_channel_lookup
ON crm_activities(lead_id, channel, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_channel_status
ON crm_activities(workspace_id, channel, channel_status)
WHERE deleted_at IS NULL;

-- Step 5: Add comment documentation
COMMENT ON COLUMN crm_activities.direction IS 'Communication direction: inbound or outbound';
COMMENT ON COLUMN crm_activities.channel IS 'Communication channel: call, sms, email, chat, social';
COMMENT ON COLUMN crm_activities.channel_message_id IS 'External provider message ID (Twilio SID, Resend ID, etc)';
COMMENT ON COLUMN crm_activities.channel_status IS 'Provider-specific status (sent, delivered, failed, etc)';
COMMENT ON COLUMN crm_activities.channel_error_code IS 'Error code from channel provider if delivery failed';
COMMENT ON COLUMN crm_activities.channel_metadata IS 'Additional channel-specific metadata (call duration, SMS segments, etc)';
