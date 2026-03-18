-- US-LEAD-AI-011: Automated Lead Routing
-- Migration: Add routing tables for agent profiles, routing history, and routing rules

-- Create ENUMs
CREATE TYPE "availability_status" AS ENUM('available', 'busy', 'unavailable', 'offline');
CREATE TYPE "routing_strategy" AS ENUM('balanced', 'skill_match', 'round_robin', 'predictive', 'rule_based');

-- Agent Profiles Table
CREATE TABLE IF NOT EXISTS "agent_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skills" text[],
  "industries" text[],
  "languages" text[],
  "max_concurrent_leads" integer DEFAULT 50 NOT NULL,
  "current_lead_count" integer DEFAULT 0 NOT NULL,
  "availability_status" "availability_status" DEFAULT 'available' NOT NULL,
  "timezone" text,
  "working_hours" jsonb,
  "avg_response_time_minutes" integer,
  "conversion_rate" numeric(5, 4),
  "satisfaction_score" numeric(3, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Lead Routing History Table
CREATE TABLE IF NOT EXISTS "lead_routing_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "from_agent_id" uuid REFERENCES "users"("id"),
  "to_agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "routing_strategy" "routing_strategy" NOT NULL,
  "routing_score" numeric(5, 4),
  "routing_reason" text,
  "agent_workload_snapshot" jsonb,
  "lead_score_snapshot" jsonb,
  "routed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  "was_manual_override" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Routing Rules Table
CREATE TABLE IF NOT EXISTS "routing_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "priority" integer DEFAULT 0 NOT NULL,
  "conditions" jsonb NOT NULL,
  "assign_to_agent_id" uuid REFERENCES "users"("id"),
  "assign_to_team" text,
  "routing_strategy" "routing_strategy",
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);

-- Indexes for agent_profiles
CREATE INDEX IF NOT EXISTS "idx_agent_profile_unique" ON "agent_profiles" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_agent_profiles_capacity" ON "agent_profiles" ("workspace_id", "availability_status", "current_lead_count");

-- Indexes for lead_routing_history
CREATE INDEX IF NOT EXISTS "idx_lead_routing_history_lead" ON "lead_routing_history" ("lead_id", "routed_at");
CREATE INDEX IF NOT EXISTS "idx_lead_routing_history_agent" ON "lead_routing_history" ("to_agent_id", "routed_at");
CREATE INDEX IF NOT EXISTS "idx_lead_routing_history_workspace" ON "lead_routing_history" ("workspace_id");

-- Indexes for routing_rules
CREATE INDEX IF NOT EXISTS "idx_routing_rules_active" ON "routing_rules" ("workspace_id", "priority", "is_active");
