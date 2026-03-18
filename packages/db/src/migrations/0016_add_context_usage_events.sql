-- Create context_usage_events table
-- Tracks token usage and context consumption for Claude Code sessions

CREATE TABLE "context_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hook_event_id" uuid NOT NULL REFERENCES "hook_events"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL REFERENCES "claude_sessions"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "transaction_id" uuid,
  "agent_type" text,

  -- Token usage metrics
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
  "cache_read_input_tokens" integer DEFAULT 0 NOT NULL,
  "cache_creation_5m_tokens" integer DEFAULT 0 NOT NULL,
  "cache_creation_1h_tokens" integer DEFAULT 0 NOT NULL,

  -- Derived metrics
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "cache_hit_rate" numeric(5, 2),
  "cost_estimate" numeric(10, 6),

  -- Transaction context
  "tools_used" jsonb,
  "tool_use_count" integer DEFAULT 0 NOT NULL,

  -- Timing
  "duration_ms" integer,
  "transaction_started_at" timestamp with time zone,

  -- Model info
  "model" text,
  "service_tier" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX "context_usage_events_hook_event_id_idx" ON "context_usage_events" ("hook_event_id");
CREATE INDEX "context_usage_events_session_id_idx" ON "context_usage_events" ("session_id");
CREATE INDEX "context_usage_events_project_id_idx" ON "context_usage_events" ("project_id");
CREATE INDEX "context_usage_events_transaction_id_idx" ON "context_usage_events" ("transaction_id");
CREATE INDEX "context_usage_events_agent_type_idx" ON "context_usage_events" ("agent_type");
CREATE INDEX "context_usage_events_created_at_idx" ON "context_usage_events" ("created_at");
