-- Migration: IP Allowlist for Direct Database Access
-- Purpose: Allow Business/Enterprise tier customers to manage IP allowlist for direct database connections

-- IP allowlist for direct database access (Business/Enterprise)
CREATE TABLE IF NOT EXISTS ip_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  description TEXT,
  created_by UUID REFERENCES org_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  CONSTRAINT unique_project_ip UNIQUE (project_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlist_project ON ip_allowlist(project_id);
CREATE INDEX IF NOT EXISTS idx_ip_allowlist_ip ON ip_allowlist(ip_address);

-- Add Business tier to plan_limits if missing
INSERT INTO plan_limits (tier, max_projects, max_tables_per_project, max_rows_per_table, max_api_keys)
VALUES ('business', 50, 500, 10000000, 100)
ON CONFLICT (tier) DO NOTHING;

-- RLS policy for ip_allowlist
ALTER TABLE ip_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_allowlist_isolation ON ip_allowlist
  FOR ALL TO signaldb
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN organizations o ON p.org_id = o.id
    WHERE o.id = current_setting('app.org_id', true)::uuid
  ));

-- Add comments
COMMENT ON TABLE ip_allowlist IS 'IP addresses allowed for direct database access (Business/Enterprise tiers)';
COMMENT ON COLUMN ip_allowlist.ip_address IS 'IP address in INET format (supports CIDR notation)';
COMMENT ON COLUMN ip_allowlist.last_used_at IS 'Last time a connection was made from this IP';
