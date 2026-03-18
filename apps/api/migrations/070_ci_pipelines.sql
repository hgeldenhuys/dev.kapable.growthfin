-- CI/CD Pipeline tables for SignalDB Relay
-- Stores pipeline definitions, run history, and per-stage status

-- Pipeline definitions (built-in + custom)
CREATE TABLE IF NOT EXISTS ci_pipeline_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  name varchar(100) NOT NULL,
  description text,
  pipeline_type varchar(30) NOT NULL,  -- 'platform' | 'connect-app' | 'custom'
  config jsonb NOT NULL DEFAULT '{}',
  app_id uuid REFERENCES apps(id),
  source varchar(20) DEFAULT 'system', -- 'system' | 'console'
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pipeline runs (each execution)
CREATE TABLE IF NOT EXISTS ci_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid REFERENCES ci_pipeline_definitions(id),
  org_id uuid REFERENCES organizations(id),
  triggered_by varchar(100),
  status varchar(20) DEFAULT 'pending',
  git_branch varchar(100),
  git_commit varchar(40),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  error text,
  relay_host varchar(100),
  created_at timestamptz DEFAULT now()
);

-- Per-stage status within a run
CREATE TABLE IF NOT EXISTS ci_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES ci_pipeline_runs(id) ON DELETE CASCADE,
  stage_name varchar(100) NOT NULL,
  stage_order integer NOT NULL,
  status varchar(20) DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  log_lines integer DEFAULT 0,
  error text
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_org ON ci_pipeline_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON ci_pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON ci_pipeline_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_run ON ci_pipeline_stages(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_defs_org ON ci_pipeline_definitions(org_id);

-- Seed built-in pipeline definitions
INSERT INTO ci_pipeline_definitions (name, description, pipeline_type, source, config) VALUES
  ('platform-api', 'Build and deploy the SignalDB Platform API', 'platform', 'system', '{"stages":["git-pull","install","typecheck","rsync","remote-install","restart","health-check"]}'),
  ('platform-admin', 'Build and deploy the SignalDB Admin Console', 'platform', 'system', '{"stages":["git-pull","install","typecheck","build","rsync","remote-install","restart","health-check"]}'),
  ('connect-app', 'Build a Connect app on Mac Studio and deploy to Linode', 'connect-app', 'system', '{"stages":["git-pull","install","build","rsync","restart","health-check"]}')
ON CONFLICT DO NOTHING;
