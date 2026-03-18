-- Phase N: Campaign AI Calling
-- Extend campaigns for AI voice and add rate limiting

-- Add AI voice fields to campaign messages
ALTER TABLE crm_campaign_messages ADD COLUMN IF NOT EXISTS ai_script_id UUID REFERENCES crm_ai_call_scripts(id);
ALTER TABLE crm_campaign_messages ADD COLUMN IF NOT EXISTS ai_call_config JSONB;
-- ai_call_config: { maxAttempts: 3, retryDelayMinutes: 60, preferredHours: "09:00-17:00" }

-- Add index for AI voice campaigns
CREATE INDEX IF NOT EXISTS idx_crm_campaign_messages_ai_script_id ON crm_campaign_messages(ai_script_id);

-- AI Voice rate limiting table (separate from SMS)
CREATE TABLE IF NOT EXISTS crm_ai_voice_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_type TEXT NOT NULL, -- 'hour', 'day'
  call_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(workspace_id, window_start, window_type)
);

-- Indexes for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_rate_limits_workspace_id ON crm_ai_voice_rate_limits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_rate_limits_window ON crm_ai_voice_rate_limits(workspace_id, window_start, window_type);

-- AI Voice call queue table for sequential execution
CREATE TABLE IF NOT EXISTS crm_ai_voice_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES crm_campaign_recipients(id) ON DELETE CASCADE,

  -- Call configuration
  ai_script_id UUID REFERENCES crm_ai_call_scripts(id),
  to_number TEXT NOT NULL,
  lead_id UUID,
  contact_id UUID,

  -- Queue state
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, scheduled
  priority INTEGER DEFAULT 0,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,

  -- Call result
  ai_call_id UUID REFERENCES crm_ai_calls(id),
  call_outcome TEXT,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  preferred_hours_start TEXT, -- "09:00"
  preferred_hours_end TEXT,   -- "17:00"
  timezone TEXT DEFAULT 'UTC',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_queue_workspace_id ON crm_ai_voice_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_queue_campaign_id ON crm_ai_voice_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_queue_status ON crm_ai_voice_queue(status);
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_queue_next_attempt ON crm_ai_voice_queue(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_crm_ai_voice_queue_pending ON crm_ai_voice_queue(workspace_id, status, priority DESC, created_at ASC) WHERE status = 'pending';

-- Add ai_voice to campaign channel enum if not exists
DO $$
BEGIN
  -- Check if ai_voice already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ai_voice'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'campaign_channel_type')
  ) THEN
    -- Add ai_voice to the enum
    ALTER TYPE campaign_channel_type ADD VALUE IF NOT EXISTS 'ai_voice';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Enum doesn't exist, that's fine
    NULL;
END
$$;

-- Comments for documentation
COMMENT ON TABLE crm_ai_voice_rate_limits IS 'Rate limiting counters for AI voice calls per workspace';
COMMENT ON COLUMN crm_ai_voice_rate_limits.window_type IS 'Rate limit window: hour or day';
COMMENT ON TABLE crm_ai_voice_queue IS 'Sequential queue for AI voice campaign calls';
COMMENT ON COLUMN crm_ai_voice_queue.status IS 'Queue item status: pending, processing, completed, failed, scheduled';
COMMENT ON COLUMN crm_ai_voice_queue.preferred_hours_start IS 'Start of preferred calling hours (HH:MM)';
COMMENT ON COLUMN crm_ai_voice_queue.preferred_hours_end IS 'End of preferred calling hours (HH:MM)';
