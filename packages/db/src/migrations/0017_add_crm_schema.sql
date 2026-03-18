-- CRM Schema Migration
-- Creates all CRM tables: accounts, contacts, leads, opportunities, activities, timeline_events

-- ============================================================================
-- CREATE ENUMS
-- ============================================================================

DO $$ BEGIN
 CREATE TYPE "public"."crm_contact_status" AS ENUM('active', 'inactive', 'do_not_contact');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_lifecycle_stage" AS ENUM('raw', 'lead', 'qualified', 'customer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_lead_status" AS ENUM('new', 'contacted', 'qualified', 'unqualified', 'converted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_opportunity_stage" AS ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_opportunity_status" AS ENUM('open', 'won', 'lost');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_activity_type" AS ENUM('call', 'email', 'meeting', 'task', 'note');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_activity_status" AS ENUM('planned', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_activity_priority" AS ENUM('low', 'medium', 'high');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_timeline_entity_type" AS ENUM('contact', 'account', 'lead', 'opportunity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_timeline_event_category" AS ENUM('communication', 'milestone', 'data', 'system', 'compliance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."crm_timeline_actor_type" AS ENUM('user', 'system', 'integration');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CREATE ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"employee_count" integer,
	"annual_revenue" numeric(15, 2),
	"website" text,
	"parent_account_id" uuid,
	"owner_id" uuid,
	"health_score" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- ============================================================================
-- CREATE CONTACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"email_secondary" text,
	"phone" text,
	"phone_secondary" text,
	"mobile" text,
	"title" text,
	"department" text,
	"account_id" uuid,
	"status" "crm_contact_status" DEFAULT 'active' NOT NULL,
	"lifecycle_stage" "crm_lifecycle_stage" DEFAULT 'raw' NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"lead_source" text,
	"owner_id" uuid,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"consent_marketing_date" timestamp with time zone,
	"consent_marketing_version" text,
	"consent_transactional" boolean DEFAULT false NOT NULL,
	"consent_transactional_date" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- ============================================================================
-- CREATE LEADS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" "crm_lead_status" DEFAULT 'new' NOT NULL,
	"source" text NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"estimated_value" numeric(15, 2),
	"expected_close_date" timestamp with time zone,
	"owner_id" uuid,
	"converted_contact_id" uuid,
	"converted_at" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- ============================================================================
-- CREATE OPPORTUNITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"stage" "crm_opportunity_stage" DEFAULT 'prospecting' NOT NULL,
	"status" "crm_opportunity_status" DEFAULT 'open' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"actual_close_date" timestamp with time zone,
	"win_loss_reason" text,
	"owner_id" uuid,
	"lead_source" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- ============================================================================
-- CREATE ACTIVITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "crm_activity_type" NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" "crm_activity_status" DEFAULT 'planned' NOT NULL,
	"priority" "crm_activity_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"duration" integer,
	"contact_id" uuid,
	"account_id" uuid,
	"opportunity_id" uuid,
	"lead_id" uuid,
	"assignee_id" uuid NOT NULL,
	"outcome" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- ============================================================================
-- CREATE TIMELINE EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "crm_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" "crm_timeline_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_category" "crm_timeline_event_category" NOT NULL,
	"event_label" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" "crm_timeline_actor_type" NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"communication" jsonb,
	"data_changes" jsonb,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pinned_by" uuid,
	"pinned_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);

-- ============================================================================
-- ADD FOREIGN KEYS
-- ============================================================================

DO $$ BEGIN
 ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_contact_id_crm_contacts_id_fk" FOREIGN KEY ("converted_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_crm_accounts_workspace_id" ON "crm_accounts" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_accounts_owner_id" ON "crm_accounts" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_accounts_parent_account_id" ON "crm_accounts" USING btree ("parent_account_id");

CREATE INDEX IF NOT EXISTS "idx_crm_contacts_workspace_id" ON "crm_contacts" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_email" ON "crm_contacts" USING btree ("email");
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_phone" ON "crm_contacts" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_account_id" ON "crm_contacts" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_owner_id" ON "crm_contacts" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_lifecycle_stage" ON "crm_contacts" USING btree ("lifecycle_stage");

CREATE INDEX IF NOT EXISTS "idx_crm_leads_workspace_id" ON "crm_leads" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_leads_status" ON "crm_leads" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_crm_leads_owner_id" ON "crm_leads" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_leads_converted_contact_id" ON "crm_leads" USING btree ("converted_contact_id");

CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_workspace_id" ON "crm_opportunities" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_account_id" ON "crm_opportunities" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_contact_id" ON "crm_opportunities" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_stage" ON "crm_opportunities" USING btree ("stage");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_status" ON "crm_opportunities" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_owner_id" ON "crm_opportunities" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_crm_opportunities_expected_close_date" ON "crm_opportunities" USING btree ("expected_close_date");

CREATE INDEX IF NOT EXISTS "idx_crm_activities_workspace_id" ON "crm_activities" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_assignee_id" ON "crm_activities" USING btree ("assignee_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_contact_id" ON "crm_activities" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_account_id" ON "crm_activities" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_opportunity_id" ON "crm_activities" USING btree ("opportunity_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_lead_id" ON "crm_activities" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_due_date" ON "crm_activities" USING btree ("due_date");
CREATE INDEX IF NOT EXISTS "idx_crm_activities_status" ON "crm_activities" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_workspace_id" ON "crm_timeline_events" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_entity" ON "crm_timeline_events" USING btree ("entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_occurred_at" ON "crm_timeline_events" USING btree ("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_event_category" ON "crm_timeline_events" USING btree ("event_category");
