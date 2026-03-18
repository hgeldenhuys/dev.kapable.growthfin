-- Migration: Add PostgreSQL NOTIFY trigger for lead score changes
-- Real-time SSE notifications when propensity scores update

-- Function: Notify on score change
CREATE OR REPLACE FUNCTION notify_lead_score_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if score actually changed
  IF NEW.propensity_score IS DISTINCT FROM OLD.propensity_score THEN
    PERFORM pg_notify('lead_score_update', json_build_object(
      'lead_id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'score_before', COALESCE(OLD.propensity_score, 0),
      'score_after', NEW.propensity_score,
      'updated_at', NEW.propensity_score_updated_at
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Fire on UPDATE of crm_leads
DROP TRIGGER IF EXISTS trigger_lead_score_change ON crm_leads;
CREATE TRIGGER trigger_lead_score_change
AFTER UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION notify_lead_score_change();

COMMENT ON FUNCTION notify_lead_score_change() IS 'Triggers PostgreSQL NOTIFY on lead score changes for real-time SSE streaming';
COMMENT ON TRIGGER trigger_lead_score_change ON crm_leads IS 'Sends real-time notifications when propensity scores change';
