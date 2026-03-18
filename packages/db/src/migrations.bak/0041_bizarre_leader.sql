CREATE TABLE "crm_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"permissions" text[] DEFAULT '{"read"}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"response_body" text,
	"response_time_ms" integer,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"headers" jsonb,
	"retry_policy" jsonb DEFAULT '{"maxRetries":3,"backoffMs":1000}'::jsonb NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_api_keys" ADD CONSTRAINT "crm_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_api_keys" ADD CONSTRAINT "crm_api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhook_deliveries" ADD CONSTRAINT "crm_webhook_deliveries_subscription_id_crm_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."crm_webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhook_deliveries" ADD CONSTRAINT "crm_webhook_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhook_subscriptions" ADD CONSTRAINT "crm_webhook_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhook_subscriptions" ADD CONSTRAINT "crm_webhook_subscriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_api_keys_workspace_idx" ON "crm_api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_api_keys_key_hash_idx" ON "crm_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "crm_api_keys_active_idx" ON "crm_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "crm_webhook_del_subscription_idx" ON "crm_webhook_deliveries" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "crm_webhook_del_workspace_idx" ON "crm_webhook_deliveries" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_webhook_del_status_idx" ON "crm_webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_webhook_del_event_type_idx" ON "crm_webhook_deliveries" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "crm_webhook_del_created_at_idx" ON "crm_webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crm_webhook_sub_workspace_idx" ON "crm_webhook_subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_webhook_sub_active_idx" ON "crm_webhook_subscriptions" USING btree ("is_active");