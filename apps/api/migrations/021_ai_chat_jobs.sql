-- AI Chat Jobs table for persistent Claude CLI session tracking
-- Replaces in-memory job store in api.console.ai.chat.tsx

CREATE TABLE IF NOT EXISTS ai_chat_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  member_id UUID NOT NULL,
  app_id UUID REFERENCES apps(id),
  session_name TEXT,
  events JSONB DEFAULT '[]'::jsonb,
  done BOOLEAN DEFAULT false,
  pid INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_org ON ai_chat_jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_done ON ai_chat_jobs(done) WHERE done = false;
