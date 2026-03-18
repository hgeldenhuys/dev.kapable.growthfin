-- Add lead_notes and lead_imports tables for Sprint 3
-- Migration: 0021_add_lead_notes_and_imports
-- Created: 2025-11-10

-- ============================================================================
-- LEAD NOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "lead_notes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" UUID NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "content_html" TEXT,
  "mentioned_user_ids" UUID[],
  "is_private" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMP WITH TIME ZONE,
  "can_be_revived" BOOLEAN NOT NULL DEFAULT true,
  "revival_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "updated_by" UUID REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_lead_notes_lead" ON "lead_notes"("lead_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_lead_notes_mentions" ON "lead_notes" USING gin ("mentioned_user_ids");
CREATE INDEX IF NOT EXISTS "idx_lead_notes_workspace" ON "lead_notes"("workspace_id", "created_at");

-- ============================================================================
-- NOTE MENTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "note_mentions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" UUID NOT NULL REFERENCES "lead_notes"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "notified_at" TIMESTAMP WITH TIME ZONE,
  "read_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "unique_note_mention" UNIQUE ("note_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_note_mentions_note" ON "note_mentions"("note_id");
CREATE INDEX IF NOT EXISTS "idx_note_mentions_user" ON "note_mentions"("user_id", "notified_at");

-- ============================================================================
-- LEAD IMPORTS TABLE
-- ============================================================================

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE "import_status" AS ENUM ('validating', 'validated', 'importing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "duplicate_strategy" AS ENUM ('skip', 'update', 'create');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "validation_mode" AS ENUM ('strict', 'lenient');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "lead_imports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "filename" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "file_url" TEXT,
  "column_mapping" JSONB NOT NULL,
  "duplicate_strategy" "duplicate_strategy" NOT NULL,
  "validation_mode" "validation_mode" NOT NULL,
  "status" "import_status" NOT NULL DEFAULT 'validating',
  "total_rows" INTEGER NOT NULL,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "imported_rows" INTEGER NOT NULL DEFAULT 0,
  "skipped_rows" INTEGER NOT NULL DEFAULT 0,
  "error_rows" INTEGER NOT NULL DEFAULT 0,
  "validation_errors" JSONB,
  "import_errors" JSONB,
  "error_file_url" TEXT,
  "started_at" TIMESTAMP WITH TIME ZONE,
  "completed_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_lead_imports_workspace" ON "lead_imports"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_lead_imports_status" ON "lead_imports"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "idx_lead_imports_created_by" ON "lead_imports"("created_by");

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
