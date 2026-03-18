-- Lead Scoring & Data Quality Tables Migration
-- Epic 5: Enhanced Lead Management - Sprint 2
-- Stories: US-LEAD-SCORE-005, US-LEAD-QUALITY-006

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Scoring Model Type Enum
CREATE TYPE "scoring_model_type" AS ENUM ('propensity', 'engagement', 'fit', 'composite');

-- ============================================================================
-- LEAD SCORING MODELS TABLE (US-LEAD-SCORE-005)
-- ============================================================================

CREATE TABLE "lead_scoring_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "model_type" "scoring_model_type" NOT NULL,
  "propensity_weight" numeric(5,4) DEFAULT 0.4000,
  "engagement_weight" numeric(5,4) DEFAULT 0.3000,
  "fit_weight" numeric(5,4) DEFAULT 0.3000,
  "engagement_factors" jsonb,
  "fit_criteria" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Indexes for lead_scoring_models
CREATE INDEX "idx_scoring_models_workspace" ON "lead_scoring_models"("workspace_id");
CREATE INDEX "idx_scoring_models_type" ON "lead_scoring_models"("workspace_id", "model_type");

-- Only one active model per type per workspace
-- Note: Partial unique index with WHERE clause
CREATE UNIQUE INDEX "unique_active_model"
  ON "lead_scoring_models"("workspace_id", "model_type")
  WHERE "is_active" = true;

-- ============================================================================
-- LEAD SCORES TABLE (US-LEAD-SCORE-005)
-- ============================================================================

CREATE TABLE "lead_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "propensity_score" numeric(5,2),
  "engagement_score" numeric(5,2),
  "fit_score" numeric(5,2),
  "composite_score" numeric(5,2),
  "score_breakdown" jsonb,
  "calculated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "model_version" text
);

-- Only keep latest score per lead (idempotency)
CREATE UNIQUE INDEX "unique_lead_score" ON "lead_scores"("lead_id");

-- Performance indexes for sorting/filtering
CREATE INDEX "idx_lead_scores_composite" ON "lead_scores"("workspace_id", "composite_score");
CREATE INDEX "idx_lead_scores_engagement" ON "lead_scores"("workspace_id", "engagement_score");
CREATE INDEX "idx_lead_scores_fit" ON "lead_scores"("workspace_id", "fit_score");

-- ============================================================================
-- LEAD SCORE HISTORY TABLE (US-LEAD-SCORE-005)
-- ============================================================================

CREATE TABLE "lead_score_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "propensity_score" numeric(5,2),
  "engagement_score" numeric(5,2),
  "fit_score" numeric(5,2),
  "composite_score" numeric(5,2),
  "score_breakdown" jsonb,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Indexes for lead_score_history
CREATE INDEX "idx_new_score_history_lead_date" ON "lead_score_history"("lead_id", "recorded_at");
CREATE INDEX "idx_new_score_history_workspace" ON "lead_score_history"("workspace_id", "recorded_at");

-- ============================================================================
-- LEAD DATA QUALITY TABLE (US-LEAD-QUALITY-006)
-- ============================================================================

CREATE TABLE "lead_data_quality" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "overall_score" numeric(5,2) NOT NULL,
  "completeness_score" numeric(5,2),
  "validity_score" numeric(5,2),
  "validation_results" jsonb NOT NULL,
  "issue_count" integer NOT NULL DEFAULT 0,
  "critical_issues" text[],
  "last_validated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Only keep latest quality record per lead (idempotency)
CREATE UNIQUE INDEX "unique_lead_quality" ON "lead_data_quality"("lead_id");

-- Performance indexes for quality filtering
CREATE INDEX "idx_lead_data_quality_score" ON "lead_data_quality"("workspace_id", "overall_score");
CREATE INDEX "idx_lead_data_quality_workspace" ON "lead_data_quality"("workspace_id", "last_validated_at");

-- ============================================================================
-- POSTGRESQL NOTIFY TRIGGERS
-- ============================================================================

-- Trigger function for lead score updates (SSE streaming)
CREATE OR REPLACE FUNCTION notify_lead_score_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'lead_score_updates',
    json_build_object(
      'lead_id', NEW.lead_id,
      'workspace_id', NEW.workspace_id,
      'scores', json_build_object(
        'propensity', NEW.propensity_score,
        'engagement', NEW.engagement_score,
        'fit', NEW.fit_score,
        'composite', NEW.composite_score
      ),
      'calculated_at', NEW.calculated_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to lead_scores table
CREATE TRIGGER lead_score_update_trigger
  AFTER INSERT OR UPDATE ON "lead_scores"
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_score_update();

-- Trigger function for data quality updates (SSE streaming)
-- Only notify if score changed significantly (>10 points)
CREATE OR REPLACE FUNCTION notify_data_quality_update()
RETURNS trigger AS $$
BEGIN
  -- Check if score changed significantly
  IF ABS(COALESCE(NEW.overall_score, 0) - COALESCE(OLD.overall_score, 0)) > 10 THEN
    PERFORM pg_notify(
      'data_quality_updates',
      json_build_object(
        'lead_id', NEW.lead_id,
        'workspace_id', NEW.workspace_id,
        'overall_score', NEW.overall_score,
        'critical_issues', NEW.critical_issues
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to lead_data_quality table
CREATE TRIGGER data_quality_update_trigger
  AFTER UPDATE ON "lead_data_quality"
  FOR EACH ROW
  EXECUTE FUNCTION notify_data_quality_update();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE "lead_scoring_models" IS 'Scoring model configurations per workspace';
COMMENT ON TABLE "lead_scores" IS 'Current lead scores (latest snapshot)';
COMMENT ON TABLE "lead_score_history" IS 'Historical lead scores for trend analysis';
COMMENT ON TABLE "lead_data_quality" IS 'Data quality metrics and validation results';

COMMENT ON COLUMN "lead_scoring_models"."engagement_factors" IS 'Points per activity type (email_open: 5, email_click: 10, etc.)';
COMMENT ON COLUMN "lead_scoring_models"."fit_criteria" IS 'ICP criteria (company size range, industries, etc.)';
COMMENT ON COLUMN "lead_scores"."score_breakdown" IS 'Detailed breakdown showing how each score was calculated';
COMMENT ON COLUMN "lead_data_quality"."validation_results" IS 'Detailed validation results per field';
COMMENT ON COLUMN "lead_data_quality"."critical_issues" IS 'Array of critical issues (missing required fields, invalid emails, etc.)';
