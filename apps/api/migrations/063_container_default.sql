-- Migration 063: Change deployment_mode default to 'container'
-- All apps use container mode since Feb 2026 standardization.
-- The 'systemd' option is kept for backward compatibility but is no longer the default.

-- Change default for new environments
ALTER TABLE app_environments
  ALTER COLUMN deployment_mode SET DEFAULT 'container';

-- Update any existing environments still set to 'systemd'
UPDATE app_environments
SET deployment_mode = 'container'
WHERE deployment_mode = 'systemd';
