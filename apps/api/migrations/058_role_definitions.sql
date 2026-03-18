-- Add role_definitions JSONB column to auth_configs
-- Stores custom role names and their associated permissions
-- Structure per role: { "permissions": string[], "description"?: string }
-- Wildcard "*" = all permissions. Empty array = no permissions beyond basic auth.
ALTER TABLE auth_configs
  ADD COLUMN IF NOT EXISTS role_definitions JSONB DEFAULT '{
    "owner": { "permissions": ["*"] },
    "admin": { "permissions": ["*"] },
    "member": { "permissions": [] },
    "viewer": { "permissions": ["read"] }
  }'::jsonb;
