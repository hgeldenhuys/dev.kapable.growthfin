-- Per-user AI chat session tracking
-- Enables multi-user session isolation where multiple console users can share
-- the same OS home folder (~/.claude/sessions/) but have isolated session tracking

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,

  -- Session identification
  name TEXT NOT NULL,
  claude_session_id TEXT,  -- Maps to ~/.claude/sessions/ file
  agent_id UUID,           -- SignalDB agent registry ID (for SDK integration)

  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'org')),

  -- Metadata
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_member ON ai_chat_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_org_app ON ai_chat_sessions(org_id, app_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_status ON ai_chat_sessions(status) WHERE status = 'active';

-- Update ai_chat_jobs to link to sessions
ALTER TABLE ai_chat_jobs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES ai_chat_sessions(id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_session ON ai_chat_jobs(session_id);
