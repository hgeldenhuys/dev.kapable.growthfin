CREATE TYPE "public"."ai_call_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TABLE "crm_ai_call_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_call_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rating" integer,
	"feedback_text" text,
	"feedback_tags" jsonb DEFAULT '[]'::jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_voice_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"recipient_id" uuid,
	"ai_script_id" uuid,
	"to_number" text NOT NULL,
	"lead_id" uuid,
	"contact_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"attempt_count" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"next_attempt_at" timestamp,
	"last_error" text,
	"ai_call_id" uuid,
	"call_outcome" text,
	"scheduled_at" timestamp,
	"preferred_hours_start" text,
	"preferred_hours_end" text,
	"timezone" text DEFAULT 'UTC',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_ai_voice_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_type" text NOT NULL,
	"call_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_ai_voice_rate_limits_workspace_id_window_start_window_type_unique" UNIQUE("workspace_id","window_start","window_type")
);
--> statement-breakpoint
CREATE TABLE "crm_email_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_type" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"reason_detail" text,
	"source_type" text NOT NULL,
	"source_campaign_id" uuid,
	"source_recipient_id" uuid,
	"soft_bounce_count" integer DEFAULT 0 NOT NULL,
	"last_soft_bounce_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"reactivated_at" timestamp with time zone,
	"reactivated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "parent_script_id" uuid;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "variant_name" text;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "is_control" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "variant_weight" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "direction" text DEFAULT 'outbound';--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "caller_identified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "identified_entity_type" text;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "identified_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "caller_phone_number" text;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "collected_data" jsonb;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD COLUMN "script_id" uuid;--> statement-breakpoint
ALTER TABLE "crm_ai_call_feedback" ADD CONSTRAINT "crm_ai_call_feedback_ai_call_id_crm_ai_calls_id_fk" FOREIGN KEY ("ai_call_id") REFERENCES "public"."crm_ai_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_call_feedback" ADD CONSTRAINT "crm_ai_call_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_call_feedback" ADD CONSTRAINT "crm_ai_call_feedback_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_queue" ADD CONSTRAINT "crm_ai_voice_queue_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_queue" ADD CONSTRAINT "crm_ai_voice_queue_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_queue" ADD CONSTRAINT "crm_ai_voice_queue_recipient_id_crm_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."crm_campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_queue" ADD CONSTRAINT "crm_ai_voice_queue_ai_script_id_crm_ai_call_scripts_id_fk" FOREIGN KEY ("ai_script_id") REFERENCES "public"."crm_ai_call_scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_queue" ADD CONSTRAINT "crm_ai_voice_queue_ai_call_id_crm_ai_calls_id_fk" FOREIGN KEY ("ai_call_id") REFERENCES "public"."crm_ai_calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_voice_rate_limits" ADD CONSTRAINT "crm_ai_voice_rate_limits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_rate_limits" ADD CONSTRAINT "crm_email_rate_limits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_suppressions" ADD CONSTRAINT "crm_email_suppressions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_feedback_ai_call_id" ON "crm_ai_call_feedback" USING btree ("ai_call_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_feedback_workspace_id" ON "crm_ai_call_feedback" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_feedback_rating" ON "crm_ai_call_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_feedback_created_at" ON "crm_ai_call_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_queue_workspace_id" ON "crm_ai_voice_queue" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_queue_campaign_id" ON "crm_ai_voice_queue" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_queue_status" ON "crm_ai_voice_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_queue_next_attempt" ON "crm_ai_voice_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_rate_limits_workspace_id" ON "crm_ai_voice_rate_limits" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_voice_rate_limits_window" ON "crm_ai_voice_rate_limits" USING btree ("workspace_id","window_start","window_type");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_email_rate_workspace_window_idx" ON "crm_email_rate_limits" USING btree ("workspace_id","window_start","window_type");--> statement-breakpoint
CREATE INDEX "crm_email_rate_window_start_idx" ON "crm_email_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "crm_email_rate_workspace_idx" ON "crm_email_rate_limits" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_email_supp_workspace_email_idx" ON "crm_email_suppressions" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "crm_email_supp_workspace_idx" ON "crm_email_suppressions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_email_supp_reason_idx" ON "crm_email_suppressions" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "crm_email_supp_active_idx" ON "crm_email_suppressions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "crm_email_supp_campaign_idx" ON "crm_email_suppressions" USING btree ("source_campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_scripts_parent_id" ON "crm_ai_call_scripts" USING btree ("parent_script_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_direction" ON "crm_ai_calls" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_caller_phone" ON "crm_ai_calls" USING btree ("caller_phone_number");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_script_id" ON "crm_ai_calls" USING btree ("script_id");