-- Crescendo: Conversational App Builder
-- Stores AI conversation sessions that guide users from idea → spec → running app

CREATE TABLE crescendo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New App',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL DEFAULT 'conversing'
    CHECK (state IN ('conversing','spec_ready','approved','scaffolding','forging','deploying','complete','failed')),
  spec JSONB,
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  story_id UUID,
  deployment_id UUID,
  build_error TEXT,
  target_app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  target_env_name TEXT DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crescendo_org ON crescendo_sessions(org_id);
CREATE INDEX idx_crescendo_state ON crescendo_sessions(state);
