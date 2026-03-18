-- Replace Personas with Agent Type
-- This migration removes the persona concept and replaces it with agent type tracking
-- Agent types are derived from Claude Code's Task tool subagent_type (e.g., 'Explore', 'ts-lint-fixer')

-- Step 1: Drop foreign key constraints
ALTER TABLE "claude_sessions" DROP CONSTRAINT IF EXISTS "claude_sessions_current_persona_id_personas_id_fk";
ALTER TABLE "event_summaries" DROP CONSTRAINT IF EXISTS "event_summaries_persona_id_personas_id_fk";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_default_persona_id_personas_id_fk";

-- Step 2: Drop indexes on persona columns
DROP INDEX IF EXISTS "claude_sessions_current_persona_id_idx";
DROP INDEX IF EXISTS "projects_default_persona_idx";

-- Step 3: Drop persona-related columns
ALTER TABLE "claude_sessions" DROP COLUMN IF EXISTS "current_persona_id";
ALTER TABLE "event_summaries" DROP COLUMN IF EXISTS "persona_id";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "default_persona_id";

-- Step 4: Add agent type columns
ALTER TABLE "claude_sessions" ADD COLUMN "current_agent_type" text;
ALTER TABLE "event_summaries" ADD COLUMN "agent_type" text;

-- Step 5: Create indexes for agent type columns
CREATE INDEX "claude_sessions_current_agent_type_idx" ON "claude_sessions" ("current_agent_type");

-- Step 6: Drop persona tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS "persona_skills" CASCADE;
DROP TABLE IF EXISTS "personas" CASCADE;

-- Migration complete: Personas replaced with agent types
