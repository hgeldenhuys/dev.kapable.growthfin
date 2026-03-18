-- 028: Git provider installations for private repo deployment
-- Stores GitHub App (and future GitLab/Bitbucket) installations per organization

CREATE TABLE IF NOT EXISTS organization_git_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'github',
  installation_id TEXT NOT NULL,
  account_login TEXT,
  account_type TEXT,
  account_avatar_url TEXT,
  permissions JSONB DEFAULT '{}',
  repository_selection TEXT DEFAULT 'selected',
  permissions_level TEXT NOT NULL DEFAULT 'read',  -- 'read' or 'read-write'
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, provider, installation_id)
);

-- Index for quick lookup by org + provider
CREATE INDEX IF NOT EXISTS idx_git_installations_org_provider
  ON organization_git_installations(organization_id, provider);
