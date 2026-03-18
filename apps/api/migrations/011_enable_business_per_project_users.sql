-- Migration: Enable Per-Project Users for Business Tier
-- Date: 2026-01-21
-- Description: Enable per_project_users_enabled flag for Business tier instances
--              This allows credential isolation for Business tier projects

-- Enable per-project users for all Business tier instances
UPDATE database_instances
SET per_project_users_enabled = true
WHERE tier = 'business';

-- Verify the change
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM database_instances
  WHERE tier = 'business' AND per_project_users_enabled = true;

  RAISE NOTICE 'Enabled per_project_users for % Business tier instance(s)', updated_count;
END $$;

-- Note: After running this migration, existing Business tier projects need their
-- per-project users synced to PgBouncer. Run:
--   ssh deploy@172.232.188.216 'cd /opt/signaldb/apps/api && bun scripts/pgbouncer-manage.ts sync-users'
