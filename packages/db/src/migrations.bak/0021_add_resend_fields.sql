-- Migration: Add Resend email tracking fields
-- Description: Add fields for Resend email ID tracking and webhook processing

-- Add Resend email ID tracking to campaign recipients
ALTER TABLE crm_campaign_recipients
ADD COLUMN resend_email_id TEXT,
ADD COLUMN bounce_type TEXT,
ADD COLUMN bounce_description TEXT;

-- Create index for webhook lookups (WHERE clause for partial index)
CREATE INDEX idx_recipients_resend_email
ON crm_campaign_recipients(resend_email_id)
WHERE resend_email_id IS NOT NULL;

-- Add Resend configuration to campaigns (for email-specific settings)
ALTER TABLE crm_campaigns
ADD COLUMN email_config JSONB;

-- Add comment for documentation
COMMENT ON COLUMN crm_campaign_recipients.resend_email_id IS 'Resend email ID returned from API, used for webhook tracking';
COMMENT ON COLUMN crm_campaign_recipients.bounce_type IS 'Type of bounce: hard_bounce, soft_bounce, spam_complaint';
COMMENT ON COLUMN crm_campaign_recipients.bounce_description IS 'Description of bounce reason from Resend';
COMMENT ON COLUMN crm_campaigns.email_config IS 'Email-specific configuration: {from_email, from_name, reply_to}';
