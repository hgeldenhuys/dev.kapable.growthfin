-- Add propensity score fields to crm_leads table
ALTER TABLE "crm_leads"
  ADD COLUMN IF NOT EXISTS "propensity_score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "propensity_score_updated_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "score_breakdown" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add check constraint for propensity score (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_propensity_score_check'
  ) THEN
    ALTER TABLE "crm_leads"
      ADD CONSTRAINT "crm_leads_propensity_score_check"
      CHECK ("propensity_score" >= 0 AND "propensity_score" <= 100);
  END IF;
END $$;

-- Create composite index for agent call list sorting by propensity score
CREATE INDEX IF NOT EXISTS "idx_crm_leads_propensity_score"
  ON "crm_leads"("workspace_id", "propensity_score" DESC)
  WHERE "deleted_at" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "crm_leads"."propensity_score" IS 'AI-calculated propensity score (0-100), higher = more likely to convert';
COMMENT ON COLUMN "crm_leads"."propensity_score_updated_at" IS 'Timestamp when score was last calculated';
COMMENT ON COLUMN "crm_leads"."score_breakdown" IS 'JSONB breakdown of score components for transparency';

-- Create crm_lead_score_history table (immutable audit trail)
CREATE TABLE IF NOT EXISTS "crm_lead_score_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" UUID NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,

  -- Score data
  "score_before" INTEGER,
  "score_after" INTEGER NOT NULL,
  "score_delta" INTEGER GENERATED ALWAYS AS ("score_after" - COALESCE("score_before", 0)) STORED,
  "score_breakdown" JSONB NOT NULL,

  -- Context
  "trigger_type" TEXT NOT NULL CHECK ("trigger_type" IN ('created', 'updated', 'manual', 'scheduled')),
  "trigger_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "trigger_reason" TEXT,

  -- Audit trail (immutable)
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for lead score history queries (get history for a lead)
CREATE INDEX IF NOT EXISTS "idx_lead_score_history_lead_id"
  ON "crm_lead_score_history"("lead_id", "created_at" DESC);

-- Index for workspace-level analytics
CREATE INDEX IF NOT EXISTS "idx_lead_score_history_workspace"
  ON "crm_lead_score_history"("workspace_id", "created_at" DESC);

-- Add comments for documentation
COMMENT ON TABLE "crm_lead_score_history" IS 'Immutable audit trail of all lead score changes';
COMMENT ON COLUMN "crm_lead_score_history"."score_delta" IS 'Calculated column: score_after - score_before';
COMMENT ON COLUMN "crm_lead_score_history"."trigger_type" IS 'Why score was recalculated: created, updated, manual, scheduled';
