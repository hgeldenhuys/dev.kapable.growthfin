CREATE TABLE "crm_sms_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_type" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_sms_rate_limits" ADD CONSTRAINT "crm_sms_rate_limits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_sms_rate_workspace_window_idx" ON "crm_sms_rate_limits" USING btree ("workspace_id","window_start","window_type");--> statement-breakpoint
CREATE INDEX "crm_sms_rate_window_start_idx" ON "crm_sms_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "crm_sms_rate_workspace_idx" ON "crm_sms_rate_limits" USING btree ("workspace_id");