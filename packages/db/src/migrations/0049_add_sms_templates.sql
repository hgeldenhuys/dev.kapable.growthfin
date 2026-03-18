-- Migration: Add SMS Templates table for CRM
-- Story: CRM-001 - Add SMS Template Support for Lead Communications

-- Create crm_sms_templates table
CREATE TABLE IF NOT EXISTS "crm_sms_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "body" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "category" text,
  "max_segments" integer NOT NULL DEFAULT 3,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "deleted_at" timestamp
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_crm_sms_templates_workspace_id" ON "crm_sms_templates" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_sms_templates_category" ON "crm_sms_templates" ("category");
CREATE INDEX IF NOT EXISTS "idx_crm_sms_templates_is_active" ON "crm_sms_templates" ("is_active");
