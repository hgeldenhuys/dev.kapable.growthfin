-- Migration: Add Lead Health Scoring Tables
-- Story: US-LEAD-AI-013
-- Date: 2025-11-10

-- Create health status enum
DO $$ BEGIN
  CREATE TYPE "health_status" AS ENUM('critical', 'at_risk', 'healthy', 'excellent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create health trend enum
DO $$ BEGIN
  CREATE TYPE "health_trend" AS ENUM('improving', 'stable', 'declining');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lead_health_scores table
CREATE TABLE IF NOT EXISTS "lead_health_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "health_score" integer NOT NULL,
  "health_status" "health_status" NOT NULL,
  "trend" "health_trend" DEFAULT 'stable' NOT NULL,
  "engagement_score" integer,
  "responsiveness_score" integer,
  "activity_score" integer,
  "relationship_score" integer,
  "risk_factors" jsonb,
  "positive_factors" jsonb,
  "recommended_actions" jsonb,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "previous_score" integer,
  "score_changed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unique_lead_health_score" UNIQUE("lead_id")
);

-- Create health_score_history table
CREATE TABLE IF NOT EXISTS "health_score_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "health_score" integer NOT NULL,
  "health_status" "health_status" NOT NULL,
  "score_delta" integer,
  "status_changed" boolean DEFAULT false,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "lead_health_scores_workspace_idx" ON "lead_health_scores"("workspace_id");
CREATE INDEX IF NOT EXISTS "lead_health_scores_score_idx" ON "lead_health_scores"("workspace_id", "health_score", "calculated_at");
CREATE INDEX IF NOT EXISTS "lead_health_scores_status_idx" ON "lead_health_scores"("workspace_id", "health_status", "calculated_at");

CREATE INDEX IF NOT EXISTS "health_score_history_lead_idx" ON "health_score_history"("lead_id", "calculated_at");
CREATE INDEX IF NOT EXISTS "health_score_history_workspace_idx" ON "health_score_history"("workspace_id");

-- Comments for documentation
COMMENT ON TABLE "lead_health_scores" IS 'Tracks current health score for each lead with risk and positive factors';
COMMENT ON TABLE "health_score_history" IS 'Historical record of health score changes over time for trend analysis';
COMMENT ON COLUMN "lead_health_scores"."health_score" IS 'Composite health score 0-100 (higher = healthier relationship)';
COMMENT ON COLUMN "lead_health_scores"."engagement_score" IS 'How frequently lead engages (0-100)';
COMMENT ON COLUMN "lead_health_scores"."responsiveness_score" IS 'How quickly lead responds to communications (0-100)';
COMMENT ON COLUMN "lead_health_scores"."activity_score" IS 'Days since last activity inversely scored (0-100)';
COMMENT ON COLUMN "lead_health_scores"."relationship_score" IS 'Depth and length of relationship (0-100)';
