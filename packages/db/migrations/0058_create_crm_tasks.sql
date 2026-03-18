-- Migration: Create crm_tasks table
-- Story: US-2.1 Task Data Model & Registry
-- Date: 2025-11-18

-- Create task type enum
DO $$ BEGIN
  CREATE TYPE "crm_task_type" AS ENUM (
    'enrichment',
    'export',
    'segmentation',
    'scoring'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create task status enum
DO $$ BEGIN
  CREATE TYPE "crm_task_status" AS ENUM (
    'planned',
    'scheduled',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create crm_tasks table
CREATE TABLE IF NOT EXISTS "crm_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "list_id" uuid NOT NULL REFERENCES "crm_contact_lists"("id") ON DELETE CASCADE,
  "type" "crm_task_type" NOT NULL,
  "status" "crm_task_status" DEFAULT 'planned' NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scheduled_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "can_be_revived" boolean DEFAULT true NOT NULL,
  "revival_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_workspace_id" ON "crm_tasks" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_list_id" ON "crm_tasks" ("list_id");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_status" ON "crm_tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_type" ON "crm_tasks" ("type");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_scheduled_at" ON "crm_tasks" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_created_by" ON "crm_tasks" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_workspace_list" ON "crm_tasks" ("workspace_id", "list_id");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_workspace_status" ON "crm_tasks" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_workspace_type" ON "crm_tasks" ("workspace_id", "type");
