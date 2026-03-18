-- Add rbac_mode column to auth_configs
-- Values: 'custom' (current _auth_user_roles table), 'betterauth' (admin plugin on _auth_users.role)
ALTER TABLE auth_configs ADD COLUMN IF NOT EXISTS rbac_mode TEXT DEFAULT 'custom';
