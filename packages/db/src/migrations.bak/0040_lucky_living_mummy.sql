CREATE TABLE "crm_booking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 15 NOT NULL,
	"available_hours" jsonb,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_bookings_per_day" integer DEFAULT 8 NOT NULL,
	"min_notice_hours" integer DEFAULT 24 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	"confirmation_email_enabled" boolean DEFAULT true NOT NULL,
	"reminder_email_enabled" boolean DEFAULT true NOT NULL,
	"reminder_minutes_before" integer DEFAULT 60 NOT NULL,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"external_account_id" text,
	"external_calendar_id" text,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_status" text DEFAULT 'active' NOT NULL,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"location" text,
	"meeting_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"type" text DEFAULT 'video' NOT NULL,
	"organizer_id" uuid,
	"lead_id" uuid,
	"contact_id" uuid,
	"opportunity_id" uuid,
	"account_id" uuid,
	"external_event_id" text,
	"calendar_connection_id" uuid,
	"notes" text,
	"outcome" text,
	"booking_link_id" uuid,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_booking_links" ADD CONSTRAINT "crm_booking_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_booking_links" ADD CONSTRAINT "crm_booking_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_calendar_connections" ADD CONSTRAINT "crm_calendar_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_calendar_connections" ADD CONSTRAINT "crm_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_meetings" ADD CONSTRAINT "crm_meetings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_meetings" ADD CONSTRAINT "crm_meetings_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_meetings" ADD CONSTRAINT "crm_meetings_calendar_connection_id_crm_calendar_connections_id_fk" FOREIGN KEY ("calendar_connection_id") REFERENCES "public"."crm_calendar_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_booking_links_slug_unique_idx" ON "crm_booking_links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "crm_booking_links_workspace_idx" ON "crm_booking_links" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_booking_links_user_idx" ON "crm_booking_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_booking_links_active_idx" ON "crm_booking_links" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "crm_cal_conn_workspace_idx" ON "crm_calendar_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_cal_conn_user_idx" ON "crm_calendar_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_cal_conn_sync_status_idx" ON "crm_calendar_connections" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "crm_meetings_workspace_idx" ON "crm_meetings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_meetings_organizer_idx" ON "crm_meetings" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "crm_meetings_lead_idx" ON "crm_meetings" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_meetings_contact_idx" ON "crm_meetings" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_meetings_opportunity_idx" ON "crm_meetings" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "crm_meetings_start_time_idx" ON "crm_meetings" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "crm_meetings_status_idx" ON "crm_meetings" USING btree ("status");