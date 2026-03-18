/**
 * Migration 0061: Rename Lifecycle Stages (Marketing-Focused)
 *
 * Purpose: Clarify the distinction between contacts (marketing) and leads (sales)
 *
 * Old lifecycle stages (ambiguous):
 * - raw       → Imported, unverified
 * - lead      → ??? (conflicts with crm_leads table)
 * - qualified → ??? (conflicts with lead status)
 * - customer  → Paying customer
 *
 * New lifecycle stages (marketing-focused):
 * - raw       → Imported, unverified (no change)
 * - verified  → Phone/email verified, marketing ready (was 'lead')
 * - engaged   → High engagement score, sales-ready (was 'qualified')
 * - customer  → Paying customer (no change)
 *
 * Architecture:
 * - Contacts (crm_contacts) = Marketing database with lifecycle progression
 * - Leads (crm_leads) = Sales queue with routing and assignment
 * - Bridge: Engaged contacts can spawn leads for sales follow-up
 */

-- Step 1: Add new enum values (PostgreSQL requires this approach)
ALTER TYPE crm_lifecycle_stage ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE crm_lifecycle_stage ADD VALUE IF NOT EXISTS 'engaged';

-- Step 2: Update existing data
UPDATE crm_contacts
SET lifecycle_stage = 'verified'
WHERE lifecycle_stage = 'lead' AND deleted_at IS NULL;

UPDATE crm_contacts
SET lifecycle_stage = 'engaged'
WHERE lifecycle_stage = 'qualified' AND deleted_at IS NULL;

-- Step 3: Note about old enum values
-- PostgreSQL does not allow dropping enum values directly
-- The old 'lead' and 'qualified' values will remain in the enum type definition
-- but should not be used in application code going forward
-- Future migration can recreate the enum type if needed

-- Step 4: Update indexes (if they reference the enum values directly)
-- No index changes needed - indexes use the column, not specific enum values

-- Step 5: Add comment to track migration
COMMENT ON TYPE crm_lifecycle_stage IS
'Contact lifecycle stages (marketing-focused). Updated 2025-11: Renamed lead→verified, qualified→engaged to avoid confusion with crm_leads table. Old values (lead, qualified) deprecated but remain in enum.';

COMMENT ON COLUMN crm_contacts.lifecycle_stage IS
'Marketing lifecycle progression: raw (imported) → verified (phone/email verified) → engaged (high engagement, sales-ready) → customer (paying). Use crm_leads table for sales queue/routing.';
