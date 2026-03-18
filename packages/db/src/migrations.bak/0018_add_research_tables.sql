-- Migration: Add Research Tables
-- Phase 3: AI-powered contact enrichment

-- Create research sessions table
CREATE TABLE IF NOT EXISTS "crm_research_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "objective" text NOT NULL,
  "scope" text DEFAULT 'basic' NOT NULL,
  "llm_config" text DEFAULT 'research-assistant',
  "max_queries" integer DEFAULT 10,
  "budget_cents" integer DEFAULT 100,
  "total_queries" integer DEFAULT 0,
  "total_findings" integer DEFAULT 0,
  "cost_cents" integer DEFAULT 0,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error_message" text,
  "deleted_at" timestamp with time zone,
  "can_be_revived" boolean DEFAULT true NOT NULL,
  "revival_count" integer DEFAULT 0 NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create research queries table
CREATE TABLE IF NOT EXISTS "crm_research_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "crm_research_sessions"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "query" text NOT NULL,
  "query_type" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "results" jsonb,
  "summary" text,
  "executed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create research findings table
CREATE TABLE IF NOT EXISTS "crm_research_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "crm_research_sessions"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "field" text NOT NULL,
  "value" text NOT NULL,
  "confidence" integer NOT NULL,
  "reasoning" text,
  "sources" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "applied" boolean DEFAULT false,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for research sessions
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_workspace_id" ON "crm_research_sessions"("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_entity" ON "crm_research_sessions"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_status" ON "crm_research_sessions"("status");

-- Create indexes for research queries
CREATE INDEX IF NOT EXISTS "idx_crm_research_queries_session_id" ON "crm_research_queries"("session_id");
CREATE INDEX IF NOT EXISTS "idx_crm_research_queries_status" ON "crm_research_queries"("status");

-- Create indexes for research findings
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_session_id" ON "crm_research_findings"("session_id");
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_status" ON "crm_research_findings"("status");
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_confidence" ON "crm_research_findings"("confidence");
