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
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_workspace_id" ON "crm_sms_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_category" ON "crm_sms_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_crm_sms_templates_is_active" ON "crm_sms_templates" USING btree ("is_active");