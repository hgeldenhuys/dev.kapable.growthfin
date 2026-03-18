-- Add SDK routing support to ai_chat_jobs
-- Tracks whether messages were routed via direct CLI spawn or SDK (SignalDB)

ALTER TABLE ai_chat_jobs
ADD COLUMN IF NOT EXISTS route_mode TEXT DEFAULT 'direct'
CHECK (route_mode IN ('direct', 'sdk'));

-- Index for analyzing routing mode usage
CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_route_mode ON ai_chat_jobs(route_mode);

COMMENT ON COLUMN ai_chat_jobs.route_mode IS 'Message routing: direct=CLI spawn, sdk=SignalDB→AgentDaemon→MessageRouter';
