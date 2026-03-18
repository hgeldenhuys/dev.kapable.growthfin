-- Phase M: AI Call Training/Feedback
-- Add feedback and A/B testing tables for AI calls

-- New feedback table
CREATE TABLE IF NOT EXISTS crm_ai_call_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_call_id UUID NOT NULL REFERENCES crm_ai_calls(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  feedback_tags JSONB DEFAULT '[]', -- ['good_opening', 'poor_closing']
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for feedback lookups
CREATE INDEX IF NOT EXISTS idx_crm_ai_call_feedback_ai_call_id ON crm_ai_call_feedback(ai_call_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_call_feedback_workspace_id ON crm_ai_call_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_call_feedback_rating ON crm_ai_call_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_crm_ai_call_feedback_created_at ON crm_ai_call_feedback(created_at);

-- Add script A/B testing fields
ALTER TABLE crm_ai_call_scripts ADD COLUMN IF NOT EXISTS parent_script_id UUID REFERENCES crm_ai_call_scripts(id);
ALTER TABLE crm_ai_call_scripts ADD COLUMN IF NOT EXISTS variant_name TEXT; -- 'Control', 'Variant A', etc.
ALTER TABLE crm_ai_call_scripts ADD COLUMN IF NOT EXISTS is_control BOOLEAN DEFAULT false;
ALTER TABLE crm_ai_call_scripts ADD COLUMN IF NOT EXISTS variant_weight INTEGER DEFAULT 100; -- Weight for random selection

-- Add script_id to AI calls for tracking which script was used
ALTER TABLE crm_ai_calls ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES crm_ai_call_scripts(id);

-- Index for script tracking
CREATE INDEX IF NOT EXISTS idx_crm_ai_calls_script_id ON crm_ai_calls(script_id);

-- Comments for documentation
COMMENT ON TABLE crm_ai_call_feedback IS 'User feedback on AI call quality for training and improvement';
COMMENT ON COLUMN crm_ai_call_feedback.rating IS 'Quality rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN crm_ai_call_feedback.feedback_tags IS 'Predefined tags like good_opening, poor_closing, handled_objections';
COMMENT ON COLUMN crm_ai_call_scripts.parent_script_id IS 'Reference to parent script for A/B test variants';
COMMENT ON COLUMN crm_ai_call_scripts.variant_name IS 'Name of the variant: Control, Variant A, Variant B, etc.';
COMMENT ON COLUMN crm_ai_call_scripts.is_control IS 'Whether this is the control variant in A/B test';
COMMENT ON COLUMN crm_ai_call_scripts.variant_weight IS 'Weight for random variant selection (0-100)';
