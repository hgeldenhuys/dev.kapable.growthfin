CREATE TABLE "crm_mock_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"to" text NOT NULL,
	"from" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"campaign_id" uuid,
	"recipient_id" uuid,
	"contact_id" uuid,
	"lead_id" uuid,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"max_segments" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "crm_mock_messages" ADD CONSTRAINT "crm_mock_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_mock_messages" ADD CONSTRAINT "crm_mock_messages_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_mock_messages" ADD CONSTRAINT "crm_mock_messages_recipient_id_crm_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."crm_campaign_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mock_messages_workspace" ON "crm_mock_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_mock_messages_channel" ON "crm_mock_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_mock_messages_direction" ON "crm_mock_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_mock_messages_status" ON "crm_mock_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mock_messages_created" ON "crm_mock_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_workspace_id" ON "crm_sms_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_category" ON "crm_sms_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_is_active" ON "crm_sms_templates" USING btree ("is_active");