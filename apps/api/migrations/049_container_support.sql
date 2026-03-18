-- Migration 049: Container-per-App Support
-- Adds columns for Incus container deployments, snapshots, and deployment mode

-- Track which snapshot corresponds to each deployment (for instant rollback)
ALTER TABLE app_deployments
  ADD COLUMN IF NOT EXISTS snapshot_name TEXT;

-- Track deployment mode per environment (container vs legacy systemd)
-- Existing apps default to 'systemd', new apps default to 'container'
ALTER TABLE app_environments
  ADD COLUMN IF NOT EXISTS deployment_mode TEXT NOT NULL DEFAULT 'systemd'
  CHECK (deployment_mode IN ('systemd', 'container'));

-- Track the Incus container IP (assigned on incusbr0)
ALTER TABLE app_environments
  ADD COLUMN IF NOT EXISTS container_ip TEXT;

-- Comments
COMMENT ON COLUMN app_deployments.snapshot_name IS 'Incus snapshot name for pre-deploy checkpoint (instant rollback)';
COMMENT ON COLUMN app_environments.deployment_mode IS 'Deployment mode: systemd (bare host) or container (Incus container)';
COMMENT ON COLUMN app_environments.container_ip IS 'IPv4 address of the Incus container on incusbr0 bridge';
