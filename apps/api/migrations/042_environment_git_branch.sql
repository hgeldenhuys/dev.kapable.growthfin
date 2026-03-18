-- Migration 042: Per-environment git branch configuration
-- Allows each environment to have its own branch, overriding the app default

-- Add git_branch column to app_environments
ALTER TABLE app_environments 
ADD COLUMN IF NOT EXISTS git_branch TEXT;

-- Comment
COMMENT ON COLUMN app_environments.git_branch IS 'Git branch to deploy from. If NULL, uses the app default branch.';

-- Update existing dev environments to use app default (explicitly set for clarity)
-- Production environments stay NULL (inherits app default which is typically main)
