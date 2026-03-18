-- Campaign Templates & Workflows Schema Migration
-- Epic 4: Advanced Campaign Management - Sprint 3
-- Stories: US-CAMPAIGN-TEMPLATE-006, US-CAMPAIGN-WORKFLOW-007, US-CAMPAIGN-WORKFLOW-008

-- Create ENUMs for Templates
CREATE TYPE "campaign_template_category" AS ENUM('onboarding', 'nurture', 're-engagement', 'promotion', 'event', 'feedback', 'custom');
CREATE TYPE "campaign_template_status" AS ENUM('draft', 'active', 'archived');

-- Create ENUMs for Workflows
CREATE TYPE "campaign_workflow_status" AS ENUM('draft', 'active', 'paused', 'archived');
CREATE TYPE "campaign_workflow_step_type" AS ENUM('send_campaign', 'wait', 'condition', 'update_lead_field', 'add_tag', 'remove_tag', 'send_notification');
CREATE TYPE "campaign_workflow_step_status" AS ENUM('pending', 'active', 'completed', 'skipped', 'failed');
CREATE TYPE "campaign_workflow_enrollment_status" AS ENUM('active', 'paused', 'completed', 'failed', 'cancelled');

-- ============================================================================
-- CAMPAIGN TEMPLATES TABLE (US-CAMPAIGN-TEMPLATE-006)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "campaign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "campaign_template_category" DEFAULT 'custom' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_template_id" uuid,
	"is_latest_version" boolean DEFAULT true NOT NULL,
	"status" "campaign_template_status" DEFAULT 'draft' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);

-- Add foreign key constraints for campaign_templates
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_workspace_id_workspaces_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_parent_template_id_campaign_templates_id_fk"
	FOREIGN KEY ("parent_template_id") REFERENCES "public"."campaign_templates"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_updated_by_users_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for campaign_templates
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_workspace" ON "campaign_templates" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_category_status" ON "campaign_templates" USING btree ("category", "status");
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_parent" ON "campaign_templates" USING btree ("parent_template_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_latest" ON "campaign_templates" USING btree ("parent_template_id", "is_latest_version");

-- ============================================================================
-- CAMPAIGN WORKFLOWS TABLE (US-CAMPAIGN-WORKFLOW-007)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "campaign_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"entry_conditions" jsonb,
	"exit_conditions" jsonb,
	"status" "campaign_workflow_status" DEFAULT 'draft' NOT NULL,
	"enrollment_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"active_enrollment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);

-- Add foreign key constraints for campaign_workflows
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_workspace_id_workspaces_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_created_by_users_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_updated_by_users_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for campaign_workflows
CREATE INDEX IF NOT EXISTS "idx_campaign_workflows_workspace" ON "campaign_workflows" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflows_status" ON "campaign_workflows" USING btree ("status");

-- ============================================================================
-- CAMPAIGN WORKFLOW ENROLLMENTS TABLE (US-CAMPAIGN-WORKFLOW-008)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "campaign_workflow_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"current_step_id" text,
	"current_step_started_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "campaign_workflow_enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"current_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints for campaign_workflow_enrollments
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_workspace_id_workspaces_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_workflow_id_campaign_workflows_id_fk"
	FOREIGN KEY ("workflow_id") REFERENCES "public"."campaign_workflows"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_lead_id_crm_leads_id_fk"
	FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes for campaign_workflow_enrollments
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_enrollments_workspace" ON "campaign_workflow_enrollments" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_enrollments_workflow" ON "campaign_workflow_enrollments" USING btree ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_enrollments_lead" ON "campaign_workflow_enrollments" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_enrollments_status" ON "campaign_workflow_enrollments" USING btree ("status");

-- Create unique constraint for idempotency (one active enrollment per lead per workflow)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_workflow_enrollment" ON "campaign_workflow_enrollments"
	USING btree ("workflow_id", "lead_id", "status");

-- ============================================================================
-- CAMPAIGN WORKFLOW EXECUTIONS TABLE (US-CAMPAIGN-WORKFLOW-008)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "campaign_workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"step_type" "campaign_workflow_step_type" NOT NULL,
	"step_config" jsonb NOT NULL,
	"status" "campaign_workflow_step_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration" integer,
	"transitioned_to" text,
	"transition_reason" text,
	"output" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints for campaign_workflow_executions
ALTER TABLE "campaign_workflow_executions" ADD CONSTRAINT "campaign_workflow_executions_workspace_id_workspaces_id_fk"
	FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_workflow_executions" ADD CONSTRAINT "campaign_workflow_executions_enrollment_id_campaign_workflow_enrollments_id_fk"
	FOREIGN KEY ("enrollment_id") REFERENCES "public"."campaign_workflow_enrollments"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes for campaign_workflow_executions
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_executions_workspace" ON "campaign_workflow_executions" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_executions_enrollment" ON "campaign_workflow_executions" USING btree ("enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_workflow_executions_started" ON "campaign_workflow_executions" USING btree ("started_at");
