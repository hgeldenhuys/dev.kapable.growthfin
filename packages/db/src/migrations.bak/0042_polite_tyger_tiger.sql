CREATE TABLE "crm_lead_routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"conditions" jsonb NOT NULL,
	"assign_to_user_id" uuid,
	"assign_to_team" text,
	"round_robin" boolean DEFAULT false NOT NULL,
	"round_robin_state" jsonb,
	"match_count" integer DEFAULT 0 NOT NULL,
	"last_matched_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_workflow_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"step_id" text NOT NULL,
	"step_name" text,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_notes" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_lead_routing_rules" ADD CONSTRAINT "crm_lead_routing_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_routing_rules" ADD CONSTRAINT "crm_lead_routing_rules_assign_to_user_id_users_id_fk" FOREIGN KEY ("assign_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_routing_rules" ADD CONSTRAINT "crm_lead_routing_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_workflow_approvals" ADD CONSTRAINT "crm_workflow_approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_workflow_approvals" ADD CONSTRAINT "crm_workflow_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_lead_routing_rules_workspace_idx" ON "crm_lead_routing_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_lead_routing_rules_active_idx" ON "crm_lead_routing_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "crm_lead_routing_rules_priority_idx" ON "crm_lead_routing_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "crm_workflow_approvals_workspace_idx" ON "crm_workflow_approvals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_workflow_approvals_status_idx" ON "crm_workflow_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_workflow_approvals_workflow_idx" ON "crm_workflow_approvals" USING btree ("workflow_id");