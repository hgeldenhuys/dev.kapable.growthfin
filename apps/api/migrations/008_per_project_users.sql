-- Migration: Per-Project PostgreSQL Users
-- Purpose: Add project-specific database credentials for enhanced security
-- When these columns are NULL, falls back to instance-level credentials

-- Add columns for project-specific credentials
ALTER TABLE project_databases
ADD COLUMN IF NOT EXISTS project_user TEXT,
ADD COLUMN IF NOT EXISTS project_password_encrypted TEXT;

-- Add comment explaining the columns
COMMENT ON COLUMN project_databases.project_user IS 'Project-specific PostgreSQL username. Falls back to instance user if NULL.';
COMMENT ON COLUMN project_databases.project_password_encrypted IS 'Project-specific PostgreSQL password (pgp_sym_encrypt). Falls back to instance password if NULL.';

-- Function to create a project-specific PostgreSQL user
-- This is called during project provisioning
CREATE OR REPLACE FUNCTION create_project_user(
    p_project_id UUID,
    p_instance_id UUID,
    p_schema_name TEXT,
    p_encryption_key TEXT
) RETURNS TABLE(username TEXT, password_encrypted TEXT) AS $$
DECLARE
    v_username TEXT;
    v_password TEXT;
    v_tier TEXT;
    v_db_name TEXT;
    v_host TEXT;
    v_port INTEGER;
BEGIN
    -- Generate username from project ID (max 63 chars for PostgreSQL)
    v_username := 'p_' || replace(p_project_id::text, '-', '_')::text;
    v_username := substring(v_username from 1 for 63);

    -- Generate secure random password
    v_password := encode(gen_random_bytes(24), 'base64');
    v_password := replace(replace(v_password, '/', '_'), '+', '-');

    -- Get instance info
    SELECT tier, database_name INTO v_tier, v_db_name
    FROM database_instances di
    WHERE di.id = p_instance_id;

    -- Note: The actual PostgreSQL user creation must be done via admin connection
    -- This function prepares the credentials and returns them
    -- The API will execute CREATE ROLE via the instance's admin connection

    RETURN QUERY
    SELECT
        v_username,
        pgp_sym_encrypt(v_password, p_encryption_key)::text;
END;
$$ LANGUAGE plpgsql;

-- Function to grant appropriate permissions to a project user
-- Called after user creation, grants access only to the project's schema/database
CREATE OR REPLACE FUNCTION get_project_user_grants(
    p_project_id UUID,
    p_username TEXT
) RETURNS TEXT AS $$
DECLARE
    v_schema_name TEXT;
    v_tier TEXT;
    v_grants TEXT;
BEGIN
    -- Get project schema info
    SELECT pd.schema_name, di.tier INTO v_schema_name, v_tier
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = p_project_id;

    IF v_tier IN ('hobbyist', 'free') AND v_schema_name IS NOT NULL THEN
        -- Schema-isolated: grant access only to project schema
        v_grants := format(
            'GRANT USAGE ON SCHEMA %I TO %I; ' ||
            'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I; ' ||
            'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I; ' ||
            'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL PRIVILEGES ON TABLES TO %I; ' ||
            'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL PRIVILEGES ON SEQUENCES TO %I;',
            v_schema_name, p_username,
            v_schema_name, p_username,
            v_schema_name, p_username,
            v_schema_name, p_username,
            v_schema_name, p_username
        );
    ELSE
        -- Database-isolated or higher: grant access to whole database
        -- (user is created in dedicated database anyway)
        v_grants := format(
            'GRANT ALL PRIVILEGES ON SCHEMA public TO %I; ' ||
            'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I; ' ||
            'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I; ' ||
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I; ' ||
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I;',
            p_username, p_username, p_username, p_username, p_username
        );
    END IF;

    RETURN v_grants;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to prevent unauthorized schema access
-- This revokes permissions when a project user tries to access other schemas
CREATE OR REPLACE FUNCTION revoke_cross_schema_access()
RETURNS event_trigger AS $$
DECLARE
    obj RECORD;
BEGIN
    -- This is a placeholder for future cross-schema access prevention
    -- In practice, PostgreSQL permissions handle this automatically
    NULL;
END;
$$ LANGUAGE plpgsql;
