CREATE TABLE "crm_field_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"local_field" text NOT NULL,
	"external_field" text NOT NULL,
	"direction" text DEFAULT 'bidirectional' NOT NULL,
	"transform_type" text DEFAULT 'none' NOT NULL,
	"transform_config" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_key" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"instance_url" text,
	"external_account_id" text,
	"sync_direction" text DEFAULT 'bidirectional' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_frequency_minutes" integer DEFAULT 15 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text DEFAULT 'never' NOT NULL,
	"last_sync_error" text,
	"last_sync_stats" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sync_type" text NOT NULL,
	"direction" text NOT NULL,
	"entity_type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"records_errored" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"delta_token" text
);
--> statement-breakpoint
ALTER TABLE "crm_field_mappings" ADD CONSTRAINT "crm_field_mappings_connection_id_crm_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_sync_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_field_mappings" ADD CONSTRAINT "crm_field_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_connections" ADD CONSTRAINT "crm_sync_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_connections" ADD CONSTRAINT "crm_sync_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_logs" ADD CONSTRAINT "crm_sync_logs_connection_id_crm_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_sync_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_logs" ADD CONSTRAINT "crm_sync_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_field_map_connection_idx" ON "crm_field_mappings" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "crm_field_map_entity_type_idx" ON "crm_field_mappings" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "crm_sync_conn_workspace_idx" ON "crm_sync_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_sync_conn_provider_idx" ON "crm_sync_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "crm_sync_log_connection_idx" ON "crm_sync_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_workspace_idx" ON "crm_sync_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_status_idx" ON "crm_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_sync_log_started_at_idx" ON "crm_sync_logs" USING btree ("started_at");