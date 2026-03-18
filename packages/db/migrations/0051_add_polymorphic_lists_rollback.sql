-- Rollback: Remove Polymorphic Lists Support
-- Description: Reverse migration 0051_add_polymorphic_lists.sql
-- Author: Backend Developer Agent
-- Date: 2025-11-13
-- Story: US-LISTS-001
-- WARNING: This rollback is DESTRUCTIVE for non-contact lists
-- Only run if you need to revert the polymorphic changes

-- ============================================================================
-- STEP 1: Verify safety (check for non-contact entities)
-- ============================================================================

DO $$
DECLARE
    non_contact_lists INTEGER;
    non_contact_memberships INTEGER;
BEGIN
    -- Check for lists with entity_type != 'contact'
    SELECT COUNT(*) INTO non_contact_lists
    FROM crm_contact_lists
    WHERE entity_type != 'contact';

    SELECT COUNT(*) INTO non_contact_memberships
    FROM crm_contact_list_memberships
    WHERE entity_type != 'contact';

    IF non_contact_lists > 0 OR non_contact_memberships > 0 THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: Found % non-contact lists and % non-contact memberships. Rolling back would lose data!',
            non_contact_lists, non_contact_memberships;
    END IF;

    RAISE NOTICE 'Safety check passed: Only contact entities found';
END $$;

-- ============================================================================
-- STEP 2: Drop indexes
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_crm_lists_entity_type'
    ) THEN
        DROP INDEX idx_crm_lists_entity_type;
        RAISE NOTICE 'Dropped idx_crm_lists_entity_type index';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_crm_list_memberships_entity'
    ) THEN
        DROP INDEX idx_crm_list_memberships_entity;
        RAISE NOTICE 'Dropped idx_crm_list_memberships_entity index';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Rename entity_id back to contact_id
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_list_memberships'
        AND column_name = 'entity_id'
    ) THEN
        -- Rename column
        ALTER TABLE crm_contact_list_memberships
        RENAME COLUMN entity_id TO contact_id;

        -- Restore foreign key constraint
        ALTER TABLE crm_contact_list_memberships
        ADD CONSTRAINT crm_contact_list_memberships_contact_id_crm_contacts_id_fk
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;

        RAISE NOTICE 'Renamed entity_id back to contact_id and restored FK constraint';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop entity_type from crm_contact_list_memberships
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_list_memberships'
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE crm_contact_list_memberships
        DROP COLUMN entity_type;

        RAISE NOTICE 'Dropped entity_type column from crm_contact_list_memberships';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Drop custom_field_schema from crm_contact_lists
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_lists'
        AND column_name = 'custom_field_schema'
    ) THEN
        ALTER TABLE crm_contact_lists
        DROP COLUMN custom_field_schema;

        RAISE NOTICE 'Dropped custom_field_schema column from crm_contact_lists';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Drop entity_type from crm_contact_lists
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_contact_lists'
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE crm_contact_lists
        DROP COLUMN entity_type;

        RAISE NOTICE 'Dropped entity_type column from crm_contact_lists';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Drop ENUM type
-- ============================================================================

-- Note: We don't drop the ENUM because it might be in use by other tables
-- If you need to drop it, run this manually:
-- DROP TYPE IF EXISTS crm_entity_type;

RAISE NOTICE 'Rollback completed successfully!';
RAISE NOTICE 'Note: crm_entity_type ENUM not dropped (may be used elsewhere)';

-- ============================================================================
-- STEP 8: Verify data integrity
-- ============================================================================

DO $$
DECLARE
    list_count INTEGER;
    membership_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO list_count FROM crm_contact_lists;
    SELECT COUNT(*) INTO membership_count FROM crm_contact_list_memberships;

    RAISE NOTICE 'Data verification after rollback:';
    RAISE NOTICE '  - crm_contact_lists: % rows', list_count;
    RAISE NOTICE '  - crm_contact_list_memberships: % rows', membership_count;
END $$;
