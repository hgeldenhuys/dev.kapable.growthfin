-- Migration: Add AI Voice Calls Tables
-- Purpose: Support ElevenLabs AI voice calling integration
-- Story: Phase 3 - AI Voice Integration

-- Create base calls table if not exists
CREATE TABLE IF NOT EXISTS crm_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Contact/Lead references
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,

  -- Call details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, initiated, ringing, in_progress, completed, failed, busy, no_answer
  purpose TEXT, -- sales, support, follow_up, ai_outreach

  -- External references
  external_call_id TEXT, -- Twilio SID or other provider ID

  -- Timing
  duration INTEGER, -- Duration in seconds
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for calls table
CREATE INDEX IF NOT EXISTS idx_crm_calls_workspace_id ON crm_calls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_calls_contact_id ON crm_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_calls_lead_id ON crm_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_calls_status ON crm_calls(status);
CREATE INDEX IF NOT EXISTS idx_crm_calls_created_at ON crm_calls(created_at DESC);

-- Add trigger for calls table
CREATE TRIGGER update_crm_calls_updated_at
  BEFORE UPDATE ON crm_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create table for AI voice call tracking
CREATE TABLE IF NOT EXISTS crm_ai_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id UUID REFERENCES crm_calls(id) ON DELETE CASCADE,

  -- ElevenLabs identifiers
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,

  -- Call outcome and analysis
  call_outcome TEXT, -- interested, not_interested, callback, voicemail, no_answer
  sentiment TEXT, -- positive, neutral, negative
  key_points JSONB DEFAULT '[]'::jsonb, -- Array of conversation highlights

  -- AI Analysis
  transcript TEXT, -- Full call transcript
  analysis JSONB, -- { intent, objections, nextSteps, leadQuality }

  -- Cost tracking
  audio_seconds INTEGER,
  cost DECIMAL(10, 4), -- Cost in dollars

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create table for AI call events (user speech, agent responses, tool usage)
CREATE TABLE IF NOT EXISTS crm_ai_call_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_call_id UUID NOT NULL REFERENCES crm_ai_calls(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL, -- user_speech, agent_response, tool_use, conversation_ended
  timestamp TIMESTAMPTZ NOT NULL,
  content TEXT, -- Transcript or description
  metadata JSONB, -- Additional event-specific data

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create table for AI agent configurations
CREATE TABLE IF NOT EXISTS crm_ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Agent details
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'elevenlabs', -- elevenlabs, custom
  agent_id TEXT NOT NULL, -- Provider's agent ID
  phone_number_id TEXT, -- Provider's phone number ID

  -- Configuration
  first_message TEXT,
  voice_settings JSONB, -- Voice configuration
  personality JSONB, -- Agent personality traits
  knowledge_base JSONB, -- Custom knowledge for the agent
  client_tools JSONB, -- Tools the agent can use during calls

  -- Settings
  is_active BOOLEAN DEFAULT true,
  max_call_duration INTEGER DEFAULT 600, -- Max call duration in seconds

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create table for AI call templates/scripts
CREATE TABLE IF NOT EXISTS crm_ai_call_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES crm_ai_agents(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Script content
  opening TEXT NOT NULL,
  objection_handlers JSONB, -- Map of objections to responses
  qualifying_questions JSONB, -- Array of questions to ask
  closing TEXT,

  -- Settings
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2), -- Success percentage

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_crm_ai_calls_workspace_id ON crm_ai_calls(workspace_id);
CREATE INDEX idx_crm_ai_calls_call_id ON crm_ai_calls(call_id);
CREATE INDEX idx_crm_ai_calls_conversation_id ON crm_ai_calls(conversation_id);
CREATE INDEX idx_crm_ai_calls_created_at ON crm_ai_calls(created_at DESC);
CREATE INDEX idx_crm_ai_calls_call_outcome ON crm_ai_calls(call_outcome);

CREATE INDEX idx_crm_ai_call_events_ai_call_id ON crm_ai_call_events(ai_call_id);
CREATE INDEX idx_crm_ai_call_events_event_type ON crm_ai_call_events(event_type);
CREATE INDEX idx_crm_ai_call_events_timestamp ON crm_ai_call_events(timestamp DESC);

CREATE INDEX idx_crm_ai_agents_workspace_id ON crm_ai_agents(workspace_id);
CREATE INDEX idx_crm_ai_agents_is_active ON crm_ai_agents(is_active);

CREATE INDEX idx_crm_ai_call_scripts_workspace_id ON crm_ai_call_scripts(workspace_id);
CREATE INDEX idx_crm_ai_call_scripts_agent_id ON crm_ai_call_scripts(agent_id);
CREATE INDEX idx_crm_ai_call_scripts_is_active ON crm_ai_call_scripts(is_active);

-- Comments for documentation
COMMENT ON TABLE crm_ai_calls IS 'Tracks AI-powered voice calls made through providers like ElevenLabs';
COMMENT ON TABLE crm_ai_call_events IS 'Detailed event log for AI calls including speech, responses, and tool usage';
COMMENT ON TABLE crm_ai_agents IS 'Configuration for AI voice agents used in outbound calling';
COMMENT ON TABLE crm_ai_call_scripts IS 'Reusable scripts and objection handlers for AI voice calls';

COMMENT ON COLUMN crm_ai_calls.call_outcome IS 'Final outcome of the call: interested, not_interested, callback, voicemail, no_answer';
COMMENT ON COLUMN crm_ai_calls.sentiment IS 'Overall sentiment detected: positive, neutral, negative';
COMMENT ON COLUMN crm_ai_calls.analysis IS 'Structured analysis: {intent, objections[], nextSteps[], leadQuality}';
COMMENT ON COLUMN crm_ai_calls.cost IS 'Total cost in dollars for the call (audio generation + telephony)';

COMMENT ON COLUMN crm_ai_call_events.event_type IS 'Type of event: user_speech, agent_response, tool_use, conversation_ended';
COMMENT ON COLUMN crm_ai_agents.client_tools IS 'Tools the agent can call during conversation (API endpoints for CRM actions)';

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_crm_ai_calls_updated_at
  BEFORE UPDATE ON crm_ai_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_ai_agents_updated_at
  BEFORE UPDATE ON crm_ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_ai_call_scripts_updated_at
  BEFORE UPDATE ON crm_ai_call_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();