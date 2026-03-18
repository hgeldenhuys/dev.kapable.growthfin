-- Campaign Automation Schema Migration
-- Epic 4: Advanced Campaign Management - Sprint 1

-- Create ENUMs
CREATE TYPE "campaign_schedule_type" AS ENUM('once', 'recurring');
CREATE TYPE "campaign_schedule_status" AS ENUM('active', 'paused', 'completed', 'cancelled');
CREATE TYPE "campaign_recurrence_pattern" AS ENUM('daily', 'weekly', 'monthly');
CREATE TYPE "campaign_recurrence_end_condition" AS ENUM('never', 'after_executions', 'end_date');
CREATE TYPE "campaign_trigger_event" AS ENUM('lead_created', 'score_changed', 'stage_changed', 'activity_created', 'email_opened', 'link_clicked');
CREATE TYPE "campaign_trigger_status" AS ENUM('active', 'paused', 'deleted');

-- Create campaign_schedules table
CREATE TABLE IF NOT EXISTS "campaign_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"schedule_type" "campaign_schedule_type" NOT NULL,
	"scheduled_time" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "campaign_schedule_status" DEFAULT 'active' NOT NULL,
	"executed_at" timestamp with time zone,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);

-- Create campaign_recurrences table
CREATE TABLE IF NOT EXISTS "campaign_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"pattern" "campaign_recurrence_pattern" NOT NULL,
	"config" jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"end_condition" "campaign_recurrence_end_condition" DEFAULT 'never' NOT NULL,
	"max_executions" integer,
	"end_date" timestamp with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_execution_at" timestamp with time zone,
	"next_execution_at" timestamp with time zone,
	"status" "campaign_schedule_status" DEFAULT 'active' NOT NULL,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);

-- Create campaign_triggers table
CREATE TABLE IF NOT EXISTS "campaign_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_event" "campaign_trigger_event" NOT NULL,
	"conditions" jsonb NOT NULL,
	"max_triggers_per_lead_per_day" integer DEFAULT 1 NOT NULL,
	"status" "campaign_trigger_status" DEFAULT 'active' NOT NULL,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);

-- Create campaign_trigger_executions table
CREATE TABLE IF NOT EXISTS "campaign_trigger_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"trigger_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_execution_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_trigger_id_campaign_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."campaign_triggers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_campaign_schedules_workspace" ON "campaign_schedules" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_schedules_scheduled_time" ON "campaign_schedules" USING btree ("scheduled_time","status");
CREATE INDEX IF NOT EXISTS "idx_campaign_schedules_campaign" ON "campaign_schedules" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "idx_campaign_recurrences_workspace" ON "campaign_recurrences" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_recurrences_next_execution" ON "campaign_recurrences" USING btree ("next_execution_at","status");
CREATE INDEX IF NOT EXISTS "idx_campaign_recurrences_campaign" ON "campaign_recurrences" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "idx_campaign_triggers_workspace" ON "campaign_triggers" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_triggers_event_status" ON "campaign_triggers" USING btree ("trigger_event","status");
CREATE INDEX IF NOT EXISTS "idx_campaign_triggers_campaign" ON "campaign_triggers" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "idx_campaign_trigger_executions_workspace" ON "campaign_trigger_executions" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_trigger_executions_trigger_lead" ON "campaign_trigger_executions" USING btree ("trigger_id","lead_id","triggered_at");

-- Create unique constraints (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_campaign_schedule" ON "campaign_schedules" USING btree ("campaign_id","status") WHERE ("deleted_at" IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_campaign_recurrence" ON "campaign_recurrences" USING btree ("campaign_id","status") WHERE ("deleted_at" IS NULL);
