-- ============================================================================
-- Row-Level Security (RLS) Policies for SignalDB
-- ============================================================================
--
-- These policies enable fine-grained access control using JWT token claims.
-- Session variables are set by the API before each query:
--   - app.auth_type: 'jwt' or 'api_key'
--   - app.user_id: User ID from JWT 'sub' claim
--   - app.scopes: JSON object of custom scopes
--
-- Policy Logic:
-- 1. API keys (backend requests) get full access - no RLS filtering
-- 2. JWT tokens (end-user requests) are filtered based on:
--    - user_id match (if row has user_id/owner_id column)
--    - scope match (if row has matching scope field like team_id)
--
-- USAGE:
-- Run this on each project database/schema where you want RLS.
-- For hobbyist tier: Run with SET search_path to the project schema first.
-- For pro/enterprise tier: Run directly on the project database.
-- ============================================================================

-- Helper function to safely get config value (returns empty string if not set)
CREATE OR REPLACE FUNCTION get_app_setting(setting_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.' || setting_name, true), '');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if current request is from API key (full access)
CREATE OR REPLACE FUNCTION is_api_key_request()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_app_setting('auth_type') = 'api_key' OR get_app_setting('auth_type') = '';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current user ID from JWT
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN get_app_setting('user_id');
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get scopes JSON from JWT
CREATE OR REPLACE FUNCTION current_scopes()
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE(NULLIF(get_app_setting('scopes'), '')::JSONB, '{}'::JSONB);
EXCEPTION WHEN OTHERS THEN
  RETURN '{}'::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if a scope matches
-- Usage: has_scope('team_id', 'sales') checks if scopes.team_id = 'sales'
CREATE OR REPLACE FUNCTION has_scope(scope_key TEXT, scope_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_scopes()->>scope_key = scope_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if user has any of the given roles
-- Usage: has_role('admin', 'editor') checks if 'admin' or 'editor' in scopes.roles
CREATE OR REPLACE FUNCTION has_role(VARIADIC roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  user_roles JSONB;
  role TEXT;
BEGIN
  user_roles := current_scopes()->'roles';
  IF user_roles IS NULL THEN
    RETURN FALSE;
  END IF;

  FOREACH role IN ARRAY roles LOOP
    IF user_roles ? role THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RLS Policy for JSONB Storage (_data table)
-- ============================================================================
--
-- This is a PERMISSIVE policy that can be customized per-project.
-- By default, it allows:
-- 1. Full access for API key requests
-- 2. For JWT requests: access to rows where data->>'user_id' matches the JWT user
--
-- Projects can add additional policies for more complex authorization.
-- ============================================================================

-- Enable RLS on _data table (if it exists)
DO $$
BEGIN
  -- Check if _data table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_data') THEN
    -- Enable RLS
    ALTER TABLE _data ENABLE ROW LEVEL SECURITY;

    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS rls_data_policy ON _data;

    -- Create policy: API keys get full access, JWT filtered by user_id in data
    CREATE POLICY rls_data_policy ON _data
      FOR ALL
      USING (
        -- API key requests bypass RLS
        is_api_key_request()
        OR
        -- JWT requests: check user_id in JSONB data
        (data->>'user_id' = current_user_id() AND current_user_id() != '')
        OR
        -- JWT requests: check owner_id in JSONB data
        (data->>'owner_id' = current_user_id() AND current_user_id() != '')
        OR
        -- JWT requests: check team_id scope match
        (data->>'team_id' IS NOT NULL AND has_scope('team_id', data->>'team_id'))
        OR
        -- JWT requests: check org_id scope match
        (data->>'org_id' IS NOT NULL AND has_scope('org_id', data->>'org_id'))
      );

    RAISE NOTICE 'RLS policy created for _data table';
  END IF;

  -- Also check for legacy 'data' table name
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data' AND table_schema = current_schema()) THEN
    ALTER TABLE data ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rls_data_policy ON data;

    CREATE POLICY rls_data_policy ON data
      FOR ALL
      USING (
        is_api_key_request()
        OR
        (data->>'user_id' = current_user_id() AND current_user_id() != '')
        OR
        (data->>'owner_id' = current_user_id() AND current_user_id() != '')
        OR
        (data->>'team_id' IS NOT NULL AND has_scope('team_id', data->>'team_id'))
        OR
        (data->>'org_id' IS NOT NULL AND has_scope('org_id', data->>'org_id'))
      );

    RAISE NOTICE 'RLS policy created for data table';
  END IF;
END $$;

-- ============================================================================
-- RLS Policy for Tokens Table (_tokens)
-- ============================================================================
-- Tokens should only be visible to API key requests (backend management)
-- End-users should not be able to list or manipulate tokens

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tokens') THEN
    ALTER TABLE _tokens ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rls_tokens_policy ON _tokens;

    -- Only API key requests can access tokens
    CREATE POLICY rls_tokens_policy ON _tokens
      FOR ALL
      USING (is_api_key_request());

    RAISE NOTICE 'RLS policy created for _tokens table';
  END IF;
END $$;

-- ============================================================================
-- RLS Policy for Tables Registry (_tables)
-- ============================================================================
-- Table metadata should be readable by all authenticated users
-- Only API key requests can create/modify tables

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tables') THEN
    ALTER TABLE _tables ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rls_tables_read_policy ON _tables;
    DROP POLICY IF EXISTS rls_tables_write_policy ON _tables;

    -- Anyone authenticated can read table metadata
    CREATE POLICY rls_tables_read_policy ON _tables
      FOR SELECT
      USING (TRUE);

    -- Only API key requests can modify tables
    CREATE POLICY rls_tables_write_policy ON _tables
      FOR ALL
      USING (is_api_key_request())
      WITH CHECK (is_api_key_request());

    RAISE NOTICE 'RLS policies created for _tables table';
  END IF;

  -- Legacy 'tables' table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tables' AND table_schema = current_schema()) THEN
    ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rls_tables_read_policy ON tables;
    DROP POLICY IF EXISTS rls_tables_write_policy ON tables;

    CREATE POLICY rls_tables_read_policy ON tables
      FOR SELECT
      USING (TRUE);

    CREATE POLICY rls_tables_write_policy ON tables
      FOR ALL
      USING (is_api_key_request())
      WITH CHECK (is_api_key_request());

    RAISE NOTICE 'RLS policies created for tables table';
  END IF;
END $$;

-- ============================================================================
-- Example: Creating RLS for a Typed Table
-- ============================================================================
--
-- For typed tables (real PostgreSQL columns), you need to create policies
-- specific to that table. Here's a template:
--
-- CREATE POLICY user_data_policy ON my_typed_table
--   FOR ALL
--   USING (
--     is_api_key_request()
--     OR user_id = current_user_id()
--     OR has_scope('team_id', team_id)
--   );
--
-- ============================================================================

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = current_schema()
  AND tablename IN ('_data', 'data', '_tables', 'tables', '_tokens');

-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = current_schema();
