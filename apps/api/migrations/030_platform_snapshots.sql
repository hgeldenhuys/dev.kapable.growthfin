-- Migration 030: Platform snapshots for historical trends
-- Daily cron captures org/project/database counts per tier for sparkline charts

CREATE TABLE IF NOT EXISTS platform_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  server_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  org_count INTEGER NOT NULL DEFAULT 0,
  project_count INTEGER NOT NULL DEFAULT 0,
  database_count INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one snapshot per server/tier/date
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_snapshots_unique
  ON platform_snapshots(snapshot_date, server_name, tier);

-- Index for time-range queries (30-day trends)
CREATE INDEX IF NOT EXISTS idx_platform_snapshots_date
  ON platform_snapshots(snapshot_date DESC);

-- Function to capture a snapshot (call daily via pg_cron or external scheduler)
CREATE OR REPLACE FUNCTION capture_platform_snapshot()
RETURNS void AS $$
BEGIN
  INSERT INTO platform_snapshots (snapshot_date, server_name, tier, org_count, project_count, database_count, total_size_bytes)
  SELECT
    CURRENT_DATE,
    s.name as server_name,
    o.plan as tier,
    COUNT(DISTINCT o.id) as org_count,
    COUNT(DISTINCT p.id) as project_count,
    COUNT(DISTINCT pd.id) as database_count,
    COALESCE(SUM(pd.size_bytes), 0) as total_size_bytes
  FROM organizations o
  JOIN projects p ON p.org_id = o.id
  JOIN project_databases pd ON pd.project_id = p.id AND pd.status = 'active'
  JOIN database_instances di ON di.id = pd.instance_id
  JOIN servers s ON s.id = di.server_id
  GROUP BY s.name, o.plan
  ON CONFLICT (snapshot_date, server_name, tier)
  DO UPDATE SET
    org_count = EXCLUDED.org_count,
    project_count = EXCLUDED.project_count,
    database_count = EXCLUDED.database_count,
    total_size_bytes = EXCLUDED.total_size_bytes,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;
