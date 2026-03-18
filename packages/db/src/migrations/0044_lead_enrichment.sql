-- Lead Enrichment Tables (US-LEAD-AI-009)
-- AI-powered lead enrichment with confidence scoring

-- Create ENUMs
DO $$ BEGIN
  CREATE TYPE "lead_enrichment_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "lead_enrichment_source" AS ENUM('mock', 'clearbit', 'zoominfo', 'linkedin', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "lead_enrichment_provider" AS ENUM('mock', 'clearbit', 'zoominfo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lead_enrichments table
CREATE TABLE IF NOT EXISTS "lead_enrichments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "status" "lead_enrichment_status" DEFAULT 'pending' NOT NULL,
  "source" "lead_enrichment_source" DEFAULT 'mock' NOT NULL,
  "enriched_fields" jsonb,
  "confidence_scores" jsonb,
  "enriched_at" timestamp with time zone,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unique_lead_enrichment" UNIQUE("lead_id", "source")
);

-- Create indexes for lead_enrichments
CREATE INDEX IF NOT EXISTS "idx_lead_enrichments_status" ON "lead_enrichments" ("workspace_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_lead_enrichments_lead" ON "lead_enrichments" ("lead_id", "created_at");

-- Create lead_enrichment_configs table
CREATE TABLE IF NOT EXISTS "lead_enrichment_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "auto_enrich_new_leads" boolean DEFAULT true NOT NULL,
  "auto_enrich_fields" text[],
  "provider" "lead_enrichment_provider" DEFAULT 'mock' NOT NULL,
  "api_key_encrypted" text,
  "rate_limit_per_hour" integer DEFAULT 100 NOT NULL,
  "min_confidence_to_apply" numeric(3, 2) DEFAULT '0.70' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "unique_workspace_lead_enrichment_config" UNIQUE("workspace_id")
);

-- Create indexes for lead_enrichment_configs
CREATE INDEX IF NOT EXISTS "idx_lead_enrichment_configs_workspace" ON "lead_enrichment_configs" ("workspace_id");

-- Add job queue name if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_name') THEN
    -- Skip if job_name type doesn't exist (will be handled by pg-boss)
    NULL;
  END IF;
END $$;
