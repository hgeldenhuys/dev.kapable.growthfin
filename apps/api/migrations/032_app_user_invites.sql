-- App User Invites
-- Allows console admins to invite specific users by email when allow_signup is disabled.
-- Lives in control plane (not per-project schema) since Console admins manage it.

CREATE TABLE IF NOT EXISTS app_user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  invited_by UUID,  -- console member who sent invite
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, revoked
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_app_user_invites_token ON app_user_invites(token);
CREATE INDEX IF NOT EXISTS idx_app_user_invites_project ON app_user_invites(project_id, status);
