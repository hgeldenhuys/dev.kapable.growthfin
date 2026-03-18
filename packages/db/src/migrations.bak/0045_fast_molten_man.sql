CREATE TYPE "public"."ticket_category" AS ENUM('support', 'product_feedback', 'feature_request', 'bug_report');--> statement-breakpoint
CREATE TYPE "public"."ticket_entity_type" AS ENUM('lead', 'contact', 'account');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('ai_chat', 'manual', 'email', 'api');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "crm_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ticket_number" serial NOT NULL,
	"category" "ticket_category" DEFAULT 'support' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"resolution" text,
	"entity_type" "ticket_entity_type",
	"entity_id" uuid,
	"assignee_id" uuid,
	"reported_by_id" uuid,
	"source" "ticket_source" DEFAULT 'manual' NOT NULL,
	"ai_conversation_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "crm_ticket_comments" ADD CONSTRAINT "crm_ticket_comments_ticket_id_crm_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."crm_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ticket_comments" ADD CONSTRAINT "crm_ticket_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ticket_comments" ADD CONSTRAINT "crm_ticket_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tickets" ADD CONSTRAINT "crm_tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tickets" ADD CONSTRAINT "crm_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tickets" ADD CONSTRAINT "crm_tickets_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tickets" ADD CONSTRAINT "crm_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tickets" ADD CONSTRAINT "crm_tickets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_ticket_comments_ticket_id" ON "crm_ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ticket_comments_workspace_id" ON "crm_ticket_comments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_workspace_id" ON "crm_tickets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_workspace_status" ON "crm_tickets" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_workspace_category" ON "crm_tickets" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_workspace_assignee_status" ON "crm_tickets" USING btree ("workspace_id","assignee_id","status");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_entity" ON "crm_tickets" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tickets_ticket_number" ON "crm_tickets" USING btree ("workspace_id","ticket_number");