-- Migration: Add appliedBy tracking to research findings
-- Phase 4: Research Enrichment Application

-- Add appliedBy field to track who applied the enrichment
ALTER TABLE "crm_research_findings"
  ADD COLUMN IF NOT EXISTS "applied_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Add index for querying applied findings
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_applied"
  ON "crm_research_findings"("applied_at") WHERE "applied_at" IS NOT NULL;
