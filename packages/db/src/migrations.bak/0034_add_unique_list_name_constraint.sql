-- Migration: Add unique constraint for list names within workspace
-- Purpose: Prevent duplicate list names within the same workspace (case-insensitive)
-- Created: 2025-11-03

-- Add unique constraint on (workspace_id, LOWER(name))
-- This ensures no two lists in the same workspace can have the same name (case-insensitive)
CREATE UNIQUE INDEX idx_crm_contact_lists_unique_name_per_workspace
ON crm_contact_lists (workspace_id, LOWER(name))
WHERE deleted_at IS NULL;

-- Note: We use a partial index with WHERE deleted_at IS NULL to allow
-- deleted lists to have duplicate names (since they're soft deleted)
