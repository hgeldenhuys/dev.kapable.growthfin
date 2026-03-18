CREATE TYPE "public"."api_alert_level" AS ENUM('info', 'warning', 'critical', 'depleted');--> statement-breakpoint
CREATE TYPE "public"."api_provider" AS ENUM('twilio', 'elevenlabs', 'openai', 'anthropic', 'zerobounce', 'rapidapi', 'brave', 'perplexity', 'resend', 'google_maps');--> statement-breakpoint
CREATE TYPE "public"."api_tracking_method" AS ENUM('api', 'heuristic');--> statement-breakpoint
CREATE TABLE "api_usage_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "api_provider" NOT NULL,
	"alert_level" "api_alert_level" NOT NULL,
	"message" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"discord_sent" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "api_provider" NOT NULL,
	"tracking_method" "api_tracking_method" NOT NULL,
	"balance_remaining" numeric(15, 4),
	"balance_unit" text,
	"quota_used" numeric(15, 4),
	"quota_limit" numeric(15, 4),
	"quota_unit" text,
	"quota_reset_at" timestamp with time zone,
	"call_count_period" integer,
	"estimated_cost_period" numeric(15, 6),
	"usage_percent" numeric(5, 2),
	"is_reachable" boolean DEFAULT true NOT NULL,
	"last_error" text,
	"latency_ms" integer,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage_alerts" ADD CONSTRAINT "api_usage_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_alerts" ADD CONSTRAINT "api_usage_alerts_snapshot_id_api_usage_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."api_usage_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_usage_alerts_provider_idx" ON "api_usage_alerts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "api_usage_alerts_level_idx" ON "api_usage_alerts" USING btree ("alert_level");--> statement-breakpoint
CREATE INDEX "api_usage_alerts_unresolved_idx" ON "api_usage_alerts" USING btree ("provider","alert_level","resolved_at");--> statement-breakpoint
CREATE INDEX "api_usage_snapshots_provider_idx" ON "api_usage_snapshots" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "api_usage_snapshots_created_at_idx" ON "api_usage_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_usage_snapshots_provider_created_idx" ON "api_usage_snapshots" USING btree ("provider","created_at");