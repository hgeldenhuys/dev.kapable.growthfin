-- Migration: Add Campaign-List Integration
-- Date: 2025-11-18
-- Description: Add support for campaigns to reference contact lists as audience sources

-- Step 1: Add list_id column to crm_campaigns (nullable, foreign key with ON DELETE RESTRICT)
ALTER TABLE crm_campaigns
ADD COLUMN list_id UUID REFERENCES crm_contact_lists(id) ON DELETE RESTRICT;

-- Step 2: Add recipient_selection JSONB column for configuration
ALTER TABLE crm_campaigns
ADD COLUMN recipient_selection JSONB DEFAULT NULL;

-- Step 3: Create index on list_id for performance
CREATE INDEX idx_crm_campaigns_list_id ON crm_campaigns(list_id);

-- Step 4: Add CHECK constraint to ensure either list_id OR audience_definition is set
-- Note: For backward compatibility, we allow empty audience_definition for existing campaigns
-- The constraint will be enforced at the application layer for new campaigns
-- Constraint commented out for backward compatibility:
-- ALTER TABLE crm_campaigns
-- ADD CONSTRAINT check_campaign_audience_source
-- CHECK (
--   list_id IS NOT NULL OR
--   (audience_definition IS NOT NULL AND audience_definition != '{}'::jsonb)
-- );

-- Step 5: Create crm_campaign_snapshots table for immutable audit trail
CREATE TABLE crm_campaign_snapshots (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  list_id UUID NOT NULL,  -- No FK - list may be deleted after snapshot
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Snapshot data
  snapshot_data JSONB NOT NULL,      -- { memberIds: [], totalListSize, selectedCount }
  snapshot_metadata JSONB,           -- { selectionStrategy, sortCriteria, excludedCount }

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint: one snapshot per campaign per timestamp
  UNIQUE(campaign_id, created_at)
);

-- Step 6: Create indexes on snapshots table for performance
CREATE INDEX idx_campaign_snapshots_campaign ON crm_campaign_snapshots(campaign_id);
CREATE INDEX idx_campaign_snapshots_workspace ON crm_campaign_snapshots(workspace_id);
CREATE INDEX idx_campaign_snapshots_list ON crm_campaign_snapshots(list_id);
CREATE INDEX idx_campaign_snapshots_created ON crm_campaign_snapshots(created_at DESC);

-- Step 7: Add comment for documentation
COMMENT ON TABLE crm_campaign_snapshots IS 'Immutable snapshots of list membership when campaign is created/sent';
COMMENT ON COLUMN crm_campaigns.list_id IS 'Reference to contact list (mutually exclusive with audience_definition filters)';
COMMENT ON COLUMN crm_campaigns.recipient_selection IS 'Configuration for recipient selection: {maxRecipients, selectionStrategy, sortCriteria, excludePreviousRecipients}';
