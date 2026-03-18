-- Migration 0024: Add Drip Campaigns
-- Adds drip sequence fields to campaign messages and drip enrollments table

-- Add drip sequence fields to crm_campaign_messages
ALTER TABLE crm_campaign_messages
ADD COLUMN sequence_order INTEGER,
ADD COLUMN delay_amount INTEGER,
ADD COLUMN delay_unit TEXT CHECK (delay_unit IN ('minutes', 'hours', 'days', 'weeks')),
ADD COLUMN trigger_type TEXT CHECK (trigger_type IN ('time_based', 'action_based')),
ADD COLUMN trigger_action TEXT CHECK (trigger_action IN ('opened', 'clicked', 'not_opened', 'not_clicked')),
ADD COLUMN trigger_message_id UUID REFERENCES crm_campaign_messages(id) ON DELETE SET NULL,
ADD COLUMN fallback_delay_days INTEGER DEFAULT 7;

-- Create unique constraint for sequence order within campaign (sparse index - only where sequence_order is not null)
CREATE UNIQUE INDEX idx_campaign_messages_sequence
ON crm_campaign_messages(campaign_id, sequence_order)
WHERE sequence_order IS NOT NULL;

-- Create drip enrollments table
CREATE TABLE crm_drip_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES crm_campaign_recipients(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  current_sequence_step INTEGER NOT NULL DEFAULT 1,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed', 'failed')),
  next_message_id UUID REFERENCES crm_campaign_messages(id) ON DELETE SET NULL,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for drip enrollments
CREATE INDEX idx_drip_enrollments_campaign ON crm_drip_enrollments(campaign_id);
CREATE INDEX idx_drip_enrollments_status ON crm_drip_enrollments(status);
CREATE INDEX idx_drip_enrollments_next_scheduled ON crm_drip_enrollments(next_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_drip_enrollments_workspace ON crm_drip_enrollments(workspace_id);
CREATE INDEX idx_drip_enrollments_recipient ON crm_drip_enrollments(recipient_id);
CREATE INDEX idx_drip_enrollments_contact ON crm_drip_enrollments(contact_id);

-- Unique constraint: one enrollment per campaign+recipient combination
CREATE UNIQUE INDEX idx_drip_enrollments_unique ON crm_drip_enrollments(campaign_id, recipient_id);
