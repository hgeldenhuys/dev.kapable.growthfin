-- Deployment audit trail: structured stage transition history
-- Appended to on each deploy agent callback

ALTER TABLE app_deployments
  ADD COLUMN IF NOT EXISTS stage_history JSONB DEFAULT '[]'::jsonb;
