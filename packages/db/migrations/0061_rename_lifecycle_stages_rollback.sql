/**
 * Migration 0061 Rollback: Restore Original Lifecycle Stages
 *
 * Reverts the lifecycle stage renaming:
 * - verified → lead
 * - engaged → qualified
 */

-- Restore original values
UPDATE crm_contacts
SET lifecycle_stage = 'lead'
WHERE lifecycle_stage = 'verified' AND deleted_at IS NULL;

UPDATE crm_contacts
SET lifecycle_stage = 'qualified'
WHERE lifecycle_stage = 'engaged' AND deleted_at IS NULL;

-- Remove comments
COMMENT ON TYPE crm_lifecycle_stage IS NULL;
COMMENT ON COLUMN crm_contacts.lifecycle_stage IS NULL;

-- Note: New enum values (verified, engaged) will remain in the type
-- This is a PostgreSQL limitation - enum values cannot be removed
-- The rollback simply restores the data to use old values
