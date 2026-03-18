-- Migration: Add Enrichment Jobs and Results
-- Description: Tables for AI-powered contact enrichment with sample/batch modes

-- Create ENUMs
CREATE TYPE "public"."crm_enrichment_job_type" AS ENUM('scoring', 'classification', 'enhancement', 'qualification');
CREATE TYPE "public"."crm_enrichment_job_mode" AS ENUM('sample', 'batch');
CREATE TYPE "public"."crm_enrichment_job_status" AS ENUM('draft', 'sampling', 'review', 'running', 'completed', 'cancelled', 'failed');
CREATE TYPE "public"."crm_enrichment_result_status" AS ENUM('success', 'failed', 'skipped');

-- Create crm_enrichment_jobs table
CREATE TABLE IF NOT EXISTS "crm_enrichment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "crm_enrichment_job_type" DEFAULT 'scoring' NOT NULL,
	"mode" "crm_enrichment_job_mode" DEFAULT 'sample' NOT NULL,
	"sample_size" integer DEFAULT 1 NOT NULL,
	"source_list_id" uuid NOT NULL,
	"model" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"prompt" text NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 500,
	"status" "crm_enrichment_job_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"processed_contacts" integer DEFAULT 0 NOT NULL,
	"failed_contacts" integer DEFAULT 0 NOT NULL,
	"skipped_contacts" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(15, 4),
	"actual_cost" numeric(15, 4) DEFAULT '0' NOT NULL,
	"budget_limit" numeric(15, 4),
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"owner_id" uuid,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- Create crm_enrichment_results table
CREATE TABLE IF NOT EXISTS "crm_enrichment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "crm_enrichment_result_status" DEFAULT 'success' NOT NULL,
	"score" numeric(5, 2),
	"enrichment_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text,
	"error_message" text,
	"tokens_used" integer,
	"cost" numeric(15, 6),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints for crm_enrichment_jobs
DO $$ BEGIN
 ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_source_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("source_list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for crm_enrichment_results
DO $$ BEGIN
 ALTER TABLE "crm_enrichment_results" ADD CONSTRAINT "crm_enrichment_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_results" ADD CONSTRAINT "crm_enrichment_results_job_id_crm_enrichment_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crm_enrichment_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_enrichment_results" ADD CONSTRAINT "crm_enrichment_results_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for crm_enrichment_jobs
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_jobs_workspace_id" ON "crm_enrichment_jobs" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_jobs_source_list_id" ON "crm_enrichment_jobs" USING btree ("source_list_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_jobs_status" ON "crm_enrichment_jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_jobs_owner_id" ON "crm_enrichment_jobs" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_jobs_created_at" ON "crm_enrichment_jobs" USING btree ("created_at");

-- Create indexes for crm_enrichment_results
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_results_workspace_id" ON "crm_enrichment_results" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_results_job_id" ON "crm_enrichment_results" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_results_contact_id" ON "crm_enrichment_results" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_results_status" ON "crm_enrichment_results" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_crm_enrichment_results_score" ON "crm_enrichment_results" USING btree ("score");
