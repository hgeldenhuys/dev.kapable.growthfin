-- Migration 018: Status page tables for service health monitoring
-- Work Item: WI-4 (Status Page)

CREATE TABLE IF NOT EXISTS service_status (
  service_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'operational',
  last_check TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_time_ms INT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',
  affected_services TEXT[] NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updates JSONB DEFAULT '[]'
);

INSERT INTO service_status (service_name) VALUES
  ('api'), ('console'), ('auth'), ('database-hobbyist'), ('database-pro')
ON CONFLICT DO NOTHING;
