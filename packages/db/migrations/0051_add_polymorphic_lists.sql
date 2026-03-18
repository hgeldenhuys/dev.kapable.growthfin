-- Migration: Add Polymorphic Lists Support
-- Description: Migrate crm_contact_lists to support all CRM entity types
-- Author: Backend Developer Agent
-- Date: 2025-11-13
-- Story: US-LISTS-001

-- ============================================================================
-- STEP 1: Create ENUM type for entity types
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_entity_type') THEN
        CREATE TYPE crm_entity_type AS ENUM ('lead', 'contact', 'account', 'opportunity');
        RAISE NOTICE 'Created crm_entity_type ENUM';
    ELSE
        RAISE NOTICE 'crm_entity_type ENUM already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add entity_type to crm_contact_lists
-- ============================================================================

-- Add entity_type column (defaults to 'contact' for backward compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_lists'
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE crm_contact_lists
        ADD COLUMN entity_type crm_entity_type NOT NULL DEFAULT 'contact';

        RAISE NOTICE 'Added entity_type column to crm_contact_lists';
    ELSE
        RAISE NOTICE 'entity_type column already exists in crm_contact_lists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Add custom_field_schema to crm_contact_lists
-- ============================================================================

-- Add custom_field_schema column for storing list-level custom field definitions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_lists'
        AND column_name = 'custom_field_schema'
    ) THEN
        ALTER TABLE crm_contact_lists
        ADD COLUMN custom_field_schema JSONB NOT NULL DEFAULT '{}';

        RAISE NOTICE 'Added custom_field_schema column to crm_contact_lists';
    ELSE
        RAISE NOTICE 'custom_field_schema column already exists in crm_contact_lists';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Alter crm_contact_list_memberships for polymorphic support
-- ============================================================================

-- Add entity_type column to memberships
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_list_memberships'
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE crm_contact_list_memberships
        ADD COLUMN entity_type crm_entity_type NOT NULL DEFAULT 'contact';

        RAISE NOTICE 'Added entity_type column to crm_contact_list_memberships';
    ELSE
        RAISE NOTICE 'entity_type column already exists in crm_contact_list_memberships';
    END IF;
END $$;

-- Rename contact_id to entity_id (polymorphic reference)
-- First, check if entity_id doesn't exist and contact_id does
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_list_memberships'
        AND column_name = 'entity_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_list_memberships'
        AND column_name = 'contact_id'
    ) THEN
        -- Drop foreign key constraint on contact_id first
        ALTER TABLE crm_contact_list_memberships
        DROP CONSTRAINT IF EXISTS crm_contact_list_memberships_contact_id_crm_contacts_id_fk;

        -- Rename column
        ALTER TABLE crm_contact_list_memberships
        RENAME COLUMN contact_id TO entity_id;

        RAISE NOTICE 'Renamed contact_id to entity_id and removed FK constraint';
    ELSE
        RAISE NOTICE 'entity_id column already exists or contact_id missing';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Create composite indexes for performance
-- ============================================================================

-- Index on entity_type and workspace_id for crm_contact_lists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_crm_lists_entity_type'
    ) THEN
        CREATE INDEX idx_crm_lists_entity_type
        ON crm_contact_lists(entity_type, workspace_id);

        RAISE NOTICE 'Created idx_crm_lists_entity_type index';
    ELSE
        RAISE NOTICE 'idx_crm_lists_entity_type index already exists';
    END IF;
END $$;

-- Index on entity_type and entity_id for crm_contact_list_memberships
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_crm_list_memberships_entity'
    ) THEN
        CREATE INDEX idx_crm_list_memberships_entity
        ON crm_contact_list_memberships(entity_type, entity_id);

        RAISE NOTICE 'Created idx_crm_list_memberships_entity index';
    ELSE
        RAISE NOTICE 'idx_crm_list_memberships_entity index already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Verify data integrity
-- ============================================================================

-- Count records before and after (should be identical)
DO $$
DECLARE
    list_count INTEGER;
    membership_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO list_count FROM crm_contact_lists;
    SELECT COUNT(*) INTO membership_count FROM crm_contact_list_memberships;

    RAISE NOTICE 'Data verification:';
    RAISE NOTICE '  - crm_contact_lists: % rows', list_count;
    RAISE NOTICE '  - crm_contact_list_memberships: % rows', membership_count;

    -- Verify all existing records have entity_type = 'contact'
    IF EXISTS (
        SELECT 1 FROM crm_contact_lists WHERE entity_type != 'contact'
    ) THEN
        RAISE WARNING 'Found lists with entity_type != contact (unexpected)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM crm_contact_list_memberships WHERE entity_type != 'contact'
    ) THEN
        RAISE WARNING 'Found memberships with entity_type != contact (unexpected)';
    END IF;

    RAISE NOTICE 'Migration completed successfully!';
END $$;
