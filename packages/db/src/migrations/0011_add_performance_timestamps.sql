-- Add performance tracking timestamps to hook_events
ALTER TABLE hook_events
  ADD COLUMN received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN queued_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN worker_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN worker_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance queries
CREATE INDEX hook_events_received_at_idx ON hook_events(received_at);
