-- Add agent_type column to hook_events table
-- Extracted from payload.event.tool_input.subagent_type for Task tool events

ALTER TABLE "hook_events" ADD COLUMN "agent_type" text;

-- Create index for efficient querying by agent type
CREATE INDEX "hook_events_agent_type_idx" ON "hook_events" ("agent_type");

-- Backfill existing Task events with agent_type from payload
-- Correct path: payload.event.tool_input.subagent_type
UPDATE "hook_events"
SET "agent_type" = payload->'event'->'tool_input'->>'subagent_type'
WHERE "tool_name" = 'Task'
  AND payload->'event'->'tool_input'->>'subagent_type' IS NOT NULL;

-- Set agent_type to 'main' for non-Task events (optional - can be NULL)
-- UPDATE "hook_events"
-- SET "agent_type" = 'main'
-- WHERE "tool_name" IS NULL OR "tool_name" != 'Task';
