-- Migration: Add collected_data column to crm_ai_calls
-- Purpose: Store structured data extracted by AI during conversations (Phase J)
--
-- This column stores ElevenLabs data collection results including:
-- - interest_level: high/medium/low/none
-- - callback_requested: boolean
-- - preferred_callback_time: ISO datetime string
-- - meeting_scheduled: boolean
-- - meeting_datetime: ISO datetime string
-- - sentiment: positive/neutral/negative
-- - key_pain_points: array of strings
-- - next_steps: agreed actions
-- - objections_raised: array of objection strings
-- - budget_mentioned: boolean
-- - decision_maker: boolean
-- - timeline: string (e.g., "immediate", "1-3 months", "no timeline")

ALTER TABLE crm_ai_calls
ADD COLUMN IF NOT EXISTS collected_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN crm_ai_calls.collected_data IS 'Structured data extracted by AI during conversation via ElevenLabs data_collection feature';

-- Create index for querying collected data fields
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_collected_data ON crm_ai_calls USING GIN(collected_data);
