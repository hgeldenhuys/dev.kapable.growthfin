-- Migration: Add Contact Lists and Memberships Tables
-- US-ENRICH-001: Contact Lists Database Schema

-- Create ENUMs
DO $$ BEGIN
  CREATE TYPE "crm_contact_list_type" AS ENUM('manual', 'import', 'campaign', 'enrichment', 'segment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "crm_contact_list_status" AS ENUM('active', 'archived', 'processing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "crm_membership_source" AS ENUM('manual', 'import', 'campaign', 'enrichment', 'segment', 'api');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create contact lists table
CREATE TABLE IF NOT EXISTS "crm_contact_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "type" "crm_contact_list_type" DEFAULT 'manual' NOT NULL,
  "status" "crm_contact_list_status" DEFAULT 'active' NOT NULL,
  "parent_list_id" uuid,
  "import_batch_id" text,
  "import_source" text,
  "imported_at" timestamp with time zone,
  "budget_limit" numeric(15, 2),
  "budget_per_contact" numeric(15, 2),
  "total_contacts" integer DEFAULT 0 NOT NULL,
  "active_contacts" integer DEFAULT 0 NOT NULL,
  "enriched_contacts" integer DEFAULT 0 NOT NULL,
  "enrichment_score" numeric(5, 2),
  "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "deleted_at" timestamp with time zone,
  "can_be_revived" boolean DEFAULT true NOT NULL,
  "revival_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create contact list memberships table (junction)
CREATE TABLE IF NOT EXISTS "crm_contact_list_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "list_id" uuid NOT NULL REFERENCES "crm_contact_lists"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  "added_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "source" "crm_membership_source" DEFAULT 'manual' NOT NULL,
  "enrichment_score" numeric(5, 2),
  "enrichment_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enriched_at" timestamp with time zone,
  "enrichment_cost" numeric(15, 4),
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "deleted_at" timestamp with time zone,
  "can_be_revived" boolean DEFAULT true NOT NULL,
  "revival_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create indexes for contact lists
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_workspace_id" ON "crm_contact_lists"("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_owner_id" ON "crm_contact_lists"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_type" ON "crm_contact_lists"("type");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_status" ON "crm_contact_lists"("status");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_parent_list_id" ON "crm_contact_lists"("parent_list_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_lists_import_batch_id" ON "crm_contact_lists"("import_batch_id");

-- Create indexes for contact list memberships
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_workspace_id" ON "crm_contact_list_memberships"("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_list_id" ON "crm_contact_list_memberships"("list_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_contact_id" ON "crm_contact_list_memberships"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_added_by" ON "crm_contact_list_memberships"("added_by");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_source" ON "crm_contact_list_memberships"("source");
CREATE INDEX IF NOT EXISTS "idx_crm_contact_list_memberships_is_active" ON "crm_contact_list_memberships"("is_active");

-- Create unique constraint: a contact can only be in a list once
ALTER TABLE "crm_contact_list_memberships"
  ADD CONSTRAINT "unique_list_contact" UNIQUE("list_id", "contact_id");
