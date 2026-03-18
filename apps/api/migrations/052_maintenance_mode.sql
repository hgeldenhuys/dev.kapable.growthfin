-- 052_maintenance_mode.sql
-- Add maintenance mode columns to app_environments
-- Dedicated columns (not JSONB) because the proxy queries this on every request.

ALTER TABLE app_environments
  ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_url TEXT;
