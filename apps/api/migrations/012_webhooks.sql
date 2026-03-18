-- Migration 012: Webhooks System
-- Creates tables for webhook configurations, delivery queue, and delivery logs

-- Webhook configurations
CREATE TABLE IF NOT EXISTS project_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- HMAC signing secret
  events TEXT[] NOT NULL DEFAULT '{}',  -- ['insert', 'update', 'delete', 'bulk']
  tables TEXT[] DEFAULT NULL,  -- NULL = all tables
  enabled BOOLEAN NOT NULL DEFAULT true,
  headers JSONB DEFAULT '{}',  -- Custom headers to include
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery queue (pending webhooks)
CREATE TABLE IF NOT EXISTS project_webhooks_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES project_webhooks(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery log (history)
CREATE TABLE IF NOT EXISTS project_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES project_webhooks(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES project_webhooks_queue(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  response_headers JSONB,
  duration_ms INT,
  success BOOLEAN NOT NULL,
  error TEXT,
  attempt_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON project_webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON project_webhooks(project_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_queue_next ON project_webhooks_queue(next_attempt_at)
  WHERE attempts < 5;
CREATE INDEX IF NOT EXISTS idx_webhooks_queue_webhook ON project_webhooks_queue(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_webhook ON project_webhooks_log(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_success ON project_webhooks_log(webhook_id, success, created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_webhook_updated_at ON project_webhooks;
CREATE TRIGGER trigger_webhook_updated_at
  BEFORE UPDATE ON project_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_updated_at();

-- Function to get active webhooks for a project and event
CREATE OR REPLACE FUNCTION get_active_webhooks(
  p_project_id UUID,
  p_event TEXT,
  p_table TEXT
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  secret TEXT,
  headers JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.url,
    w.secret,
    w.headers
  FROM project_webhooks w
  WHERE w.project_id = p_project_id
    AND w.enabled = true
    AND p_event = ANY(w.events)
    AND (w.tables IS NULL OR p_table = ANY(w.tables));
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next retry time with exponential backoff
-- Retry delays: 1min, 5min, 15min, 1hr, 4hr
CREATE OR REPLACE FUNCTION calculate_next_retry(attempt_count INT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  delays INT[] := ARRAY[60, 300, 900, 3600, 14400];  -- seconds
  delay_index INT;
BEGIN
  delay_index := LEAST(attempt_count, array_length(delays, 1));
  RETURN now() + (delays[delay_index] || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to queue a webhook delivery
CREATE OR REPLACE FUNCTION queue_webhook_delivery(
  p_webhook_id UUID,
  p_payload JSONB
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO project_webhooks_queue (webhook_id, payload)
  VALUES (p_webhook_id, p_payload)
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark delivery as failed and reschedule or archive
CREATE OR REPLACE FUNCTION mark_delivery_failed(
  p_queue_id UUID,
  p_error TEXT,
  p_response_status INT DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_response_headers JSONB DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue RECORD;
  v_archived BOOLEAN := false;
BEGIN
  -- Get current queue item
  SELECT * INTO v_queue FROM project_webhooks_queue WHERE id = p_queue_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Log the failed attempt
  INSERT INTO project_webhooks_log (
    webhook_id, queue_id, payload, response_status, response_body,
    response_headers, duration_ms, success, error, attempt_number
  ) VALUES (
    v_queue.webhook_id, p_queue_id, v_queue.payload, p_response_status,
    p_response_body, p_response_headers, p_duration_ms, false, p_error,
    v_queue.attempts + 1
  );

  -- Check if max attempts reached
  IF v_queue.attempts + 1 >= v_queue.max_attempts THEN
    -- Archive: remove from queue
    DELETE FROM project_webhooks_queue WHERE id = p_queue_id;
    v_archived := true;
  ELSE
    -- Reschedule with exponential backoff
    UPDATE project_webhooks_queue
    SET
      attempts = attempts + 1,
      next_attempt_at = calculate_next_retry(attempts + 1),
      last_error = p_error
    WHERE id = p_queue_id;
  END IF;

  RETURN v_archived;
END;
$$ LANGUAGE plpgsql;

-- Function to mark delivery as successful
CREATE OR REPLACE FUNCTION mark_delivery_success(
  p_queue_id UUID,
  p_response_status INT,
  p_response_body TEXT DEFAULT NULL,
  p_response_headers JSONB DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue RECORD;
BEGIN
  -- Get current queue item
  SELECT * INTO v_queue FROM project_webhooks_queue WHERE id = p_queue_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Log the successful delivery
  INSERT INTO project_webhooks_log (
    webhook_id, queue_id, payload, response_status, response_body,
    response_headers, duration_ms, success, attempt_number
  ) VALUES (
    v_queue.webhook_id, p_queue_id, v_queue.payload, p_response_status,
    p_response_body, p_response_headers, p_duration_ms, true, v_queue.attempts + 1
  );

  -- Remove from queue
  DELETE FROM project_webhooks_queue WHERE id = p_queue_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE project_webhooks IS 'Webhook configurations for projects';
COMMENT ON TABLE project_webhooks_queue IS 'Pending webhook deliveries with retry logic';
COMMENT ON TABLE project_webhooks_log IS 'Historical log of all webhook delivery attempts';
COMMENT ON COLUMN project_webhooks.events IS 'Array of events to trigger: insert, update, delete, bulk';
COMMENT ON COLUMN project_webhooks.tables IS 'Array of table names to filter, NULL means all tables';
COMMENT ON COLUMN project_webhooks.headers IS 'Custom HTTP headers to include in webhook requests';
