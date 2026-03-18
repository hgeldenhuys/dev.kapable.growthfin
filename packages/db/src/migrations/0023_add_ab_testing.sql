-- Migration 0023: Add A/B Testing support for campaigns
-- Add variant fields to campaign messages and create A/B test results table

-- Add variant fields to campaign messages
ALTER TABLE crm_campaign_messages ADD COLUMN variant_name TEXT;
ALTER TABLE crm_campaign_messages ADD COLUMN is_control BOOLEAN DEFAULT false;
ALTER TABLE crm_campaign_messages ADD COLUMN test_percentage INTEGER;

-- Add variant tracking to campaign recipients
ALTER TABLE crm_campaign_recipients ADD COLUMN variant_name TEXT;
ALTER TABLE crm_campaign_recipients ADD COLUMN message_id UUID REFERENCES crm_campaign_messages(id) ON DELETE SET NULL;

-- Create A/B test results table
CREATE TABLE crm_ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES crm_campaign_messages(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,

  -- Engagement metrics
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,

  -- Calculated rates (stored as decimal percentages, e.g., 0.25 = 25%)
  open_rate DECIMAL(5,4),
  click_rate DECIMAL(5,4),
  bounce_rate DECIMAL(5,4),

  -- Winner declaration
  winner_declared_at TIMESTAMP WITH TIME ZONE,
  is_winner BOOLEAN DEFAULT false,
  winning_criteria TEXT, -- 'open_rate', 'click_rate', 'manual', etc.

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for A/B test results
CREATE INDEX idx_crm_ab_test_results_campaign_id ON crm_ab_test_results(campaign_id);
CREATE INDEX idx_crm_ab_test_results_message_id ON crm_ab_test_results(message_id);
CREATE INDEX idx_crm_ab_test_results_workspace_id ON crm_ab_test_results(workspace_id);
CREATE INDEX idx_crm_ab_test_results_is_winner ON crm_ab_test_results(is_winner);

-- Index for variant_name on messages (for querying)
CREATE INDEX idx_crm_campaign_messages_variant_name ON crm_campaign_messages(variant_name);

-- Index for message_id on recipients (for tracking which variant was sent)
CREATE INDEX idx_crm_campaign_recipients_message_id ON crm_campaign_recipients(message_id);

-- Add check constraint to ensure test_percentage is between 0 and 100
ALTER TABLE crm_campaign_messages ADD CONSTRAINT chk_test_percentage_range
  CHECK (test_percentage IS NULL OR (test_percentage >= 0 AND test_percentage <= 100));
