-- Migration: 0053_create_lead_imports_table.sql
-- Description: Add crm_lead_imports table for tracking CSV import jobs
-- Story: US-LEAD-IMPORT-API-001
-- Date: 2025-11-17

-- Create import status enum
CREATE TYPE crm_import_status AS ENUM ('validating', 'importing', 'completed', 'failed');

-- Create lead imports table
CREATE TABLE crm_lead_imports (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace isolation
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- User who initiated import
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- File information
  filename TEXT NOT NULL,

  -- Import status and progress
  status crm_import_status NOT NULL DEFAULT 'validating',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,

  -- Configuration
  column_mapping JSONB NOT NULL DEFAULT '{}',
  duplicate_strategy TEXT NOT NULL DEFAULT 'skip', -- skip, update, create
  validation_mode TEXT NOT NULL DEFAULT 'lenient', -- strict, lenient

  -- Error handling
  error_file_url TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Audit trail (Agios standard)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for querying
CREATE INDEX idx_lead_imports_workspace ON crm_lead_imports(workspace_id, created_at DESC);
CREATE INDEX idx_lead_imports_status ON crm_lead_imports(workspace_id, status);
CREATE INDEX idx_lead_imports_user ON crm_lead_imports(user_id, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE crm_lead_imports IS 'Tracks CSV lead import jobs with progress and error handling';
COMMENT ON COLUMN crm_lead_imports.workspace_id IS 'Workspace isolation';
COMMENT ON COLUMN crm_lead_imports.user_id IS 'User who initiated the import';
COMMENT ON COLUMN crm_lead_imports.filename IS 'Original filename of uploaded CSV';
COMMENT ON COLUMN crm_lead_imports.status IS 'Current import status (validating, importing, completed, failed)';
COMMENT ON COLUMN crm_lead_imports.total_rows IS 'Total number of rows in CSV (excluding header)';
COMMENT ON COLUMN crm_lead_imports.processed_rows IS 'Number of rows processed so far';
COMMENT ON COLUMN crm_lead_imports.imported_rows IS 'Number of rows successfully imported';
COMMENT ON COLUMN crm_lead_imports.error_rows IS 'Number of rows that failed validation/import';
COMMENT ON COLUMN crm_lead_imports.column_mapping IS 'JSON mapping of CSV columns to lead fields';
COMMENT ON COLUMN crm_lead_imports.duplicate_strategy IS 'How to handle duplicates (skip, update, create)';
COMMENT ON COLUMN crm_lead_imports.validation_mode IS 'Validation strictness (strict, lenient)';
COMMENT ON COLUMN crm_lead_imports.error_file_url IS 'URL to download CSV of failed rows with error messages';
COMMENT ON COLUMN crm_lead_imports.started_at IS 'When import processing started';
COMMENT ON COLUMN crm_lead_imports.completed_at IS 'When import finished (success or failure)';
