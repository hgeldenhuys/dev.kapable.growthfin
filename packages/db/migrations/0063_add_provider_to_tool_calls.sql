-- Migration: Add provider column to crm_tool_calls table
-- Purpose: Track which search provider was used (brave, perplexity) for cost tracking

-- Add provider column with default 'brave'
ALTER TABLE crm_tool_calls ADD COLUMN provider TEXT DEFAULT 'brave';

-- Update existing web_search tool calls to explicitly set provider
UPDATE crm_tool_calls
SET provider = 'brave'
WHERE tool_name = 'web_search' AND provider IS NULL;

-- Add index for querying by provider
CREATE INDEX idx_crm_tool_calls_provider ON crm_tool_calls(provider);

-- Add comment for documentation
COMMENT ON COLUMN crm_tool_calls.provider IS 'Search provider used: brave ($0.001/search) or perplexity ($0.005/search)';
