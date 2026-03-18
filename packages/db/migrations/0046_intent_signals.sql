-- Intent Signals Migration (US-LEAD-AI-012)
-- Track and analyze buying intent signals from lead behavior

-- Create ENUMs
CREATE TYPE "public"."intent_level" AS ENUM('low', 'medium', 'high', 'very_high');
CREATE TYPE "public"."intent_action" AS ENUM('wait', 'nurture', 'immediate_outreach', 'schedule_demo');
CREATE TYPE "public"."signal_category" AS ENUM('engagement', 'research', 'comparison', 'decision');

-- Create intent_signal_types table (configuration)
CREATE TABLE IF NOT EXISTS "intent_signal_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"base_weight" numeric(3, 2) DEFAULT '0.50' NOT NULL,
	"decay_rate" numeric(3, 2) DEFAULT '0.90' NOT NULL,
	"decay_period_days" integer DEFAULT 7 NOT NULL,
	"category" "signal_category" DEFAULT 'engagement' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);

-- Create intent_signals table (detected signals)
CREATE TABLE IF NOT EXISTS "intent_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"signal_value" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);

-- Create lead_intent_scores table (computed scores)
CREATE TABLE IF NOT EXISTS "lead_intent_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"intent_score" integer DEFAULT 0 NOT NULL,
	"intent_level" "intent_level" DEFAULT 'low' NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"top_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_action" "intent_action" DEFAULT 'wait' NOT NULL,
	"action_reason" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_score" integer,
	"score_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create intent_score_history table (audit trail)
CREATE TABLE IF NOT EXISTS "intent_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"intent_score" integer NOT NULL,
	"intent_level" "intent_level" NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_signal_type" text,
	"score_delta" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "lead_intent_scores" ADD CONSTRAINT "lead_intent_scores_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lead_intent_scores" ADD CONSTRAINT "lead_intent_scores_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "intent_score_history" ADD CONSTRAINT "intent_score_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "intent_score_history" ADD CONSTRAINT "intent_score_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_intent_signal_types_workspace" ON "intent_signal_types" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_intent_signal_types_category" ON "intent_signal_types" USING btree ("category");
CREATE INDEX IF NOT EXISTS "idx_intent_signal_types_active" ON "intent_signal_types" USING btree ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_workspace_signal_type" ON "intent_signal_types" USING btree ("workspace_id","signal_type");

CREATE INDEX IF NOT EXISTS "idx_intent_signals_workspace" ON "intent_signals" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_intent_signals_lead" ON "intent_signals" USING btree ("lead_id","detected_at");
CREATE INDEX IF NOT EXISTS "idx_intent_signals_type" ON "intent_signals" USING btree ("workspace_id","signal_type","detected_at");
CREATE INDEX IF NOT EXISTS "idx_intent_signals_detected_at" ON "intent_signals" USING btree ("detected_at");

CREATE INDEX IF NOT EXISTS "idx_lead_intent_scores_workspace" ON "lead_intent_scores" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_lead_intent_scores_score" ON "lead_intent_scores" USING btree ("workspace_id","intent_score","calculated_at");
CREATE INDEX IF NOT EXISTS "idx_lead_intent_scores_level" ON "lead_intent_scores" USING btree ("workspace_id","intent_level","calculated_at");
CREATE INDEX IF NOT EXISTS "idx_lead_intent_scores_action" ON "lead_intent_scores" USING btree ("recommended_action");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_lead_intent_score" ON "lead_intent_scores" USING btree ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_intent_score_history_workspace" ON "intent_score_history" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_intent_score_history_lead" ON "intent_score_history" USING btree ("lead_id","calculated_at");
CREATE INDEX IF NOT EXISTS "idx_intent_score_history_score" ON "intent_score_history" USING btree ("intent_score");
CREATE INDEX IF NOT EXISTS "idx_intent_score_history_trigger" ON "intent_score_history" USING btree ("trigger_signal_type");

-- Insert default signal types
INSERT INTO "intent_signal_types" (
  "workspace_id",
  "signal_type",
  "display_name",
  "description",
  "base_weight",
  "decay_rate",
  "decay_period_days",
  "category"
) VALUES
-- High Intent Signals (0.8-1.0)
((SELECT id FROM workspaces LIMIT 1), 'demo_request', 'Demo Request', 'Lead requested a product demo', 1.00, 0.85, 7, 'decision'),
((SELECT id FROM workspaces LIMIT 1), 'pricing_page_visit', 'Pricing Page Visit', 'Lead viewed pricing page', 0.90, 0.90, 7, 'decision'),
((SELECT id FROM workspaces LIMIT 1), 'trial_signup', 'Trial Signup', 'Lead signed up for free trial', 0.95, 0.80, 7, 'decision'),
((SELECT id FROM workspaces LIMIT 1), 'contact_sales', 'Contact Sales', 'Lead contacted sales team', 0.90, 0.85, 7, 'decision'),
((SELECT id FROM workspaces LIMIT 1), 'feature_comparison', 'Feature Comparison', 'Lead compared product features', 0.80, 0.90, 7, 'comparison'),

-- Medium Intent Signals (0.5-0.8)
((SELECT id FROM workspaces LIMIT 1), 'case_study_download', 'Case Study Download', 'Lead downloaded case study', 0.60, 0.95, 14, 'research'),
((SELECT id FROM workspaces LIMIT 1), 'whitepaper_download', 'Whitepaper Download', 'Lead downloaded whitepaper', 0.55, 0.95, 14, 'research'),
((SELECT id FROM workspaces LIMIT 1), 'webinar_registration', 'Webinar Registration', 'Lead registered for webinar', 0.65, 0.90, 7, 'engagement'),
((SELECT id FROM workspaces LIMIT 1), 'multiple_page_visits', 'Multiple Page Visits', 'Lead visited multiple pages in one session', 0.50, 0.95, 7, 'engagement'),
((SELECT id FROM workspaces LIMIT 1), 'email_link_click', 'Email Link Click', 'Lead clicked link in marketing email', 0.50, 0.95, 7, 'engagement'),

-- Low Intent Signals (0.2-0.5)
((SELECT id FROM workspaces LIMIT 1), 'blog_post_read', 'Blog Post Read', 'Lead read blog post', 0.30, 0.98, 14, 'research'),
((SELECT id FROM workspaces LIMIT 1), 'email_open', 'Email Open', 'Lead opened marketing email', 0.20, 0.98, 7, 'engagement'),
((SELECT id FROM workspaces LIMIT 1), 'linkedin_profile_view', 'LinkedIn Profile View', 'Lead viewed company LinkedIn profile', 0.40, 0.95, 7, 'research'),
((SELECT id FROM workspaces LIMIT 1), 'twitter_follow', 'Twitter Follow', 'Lead followed company on Twitter', 0.25, 0.98, 14, 'engagement'),
((SELECT id FROM workspaces LIMIT 1), 'newsletter_subscribe', 'Newsletter Subscribe', 'Lead subscribed to newsletter', 0.35, 0.95, 14, 'engagement')
ON CONFLICT DO NOTHING;
