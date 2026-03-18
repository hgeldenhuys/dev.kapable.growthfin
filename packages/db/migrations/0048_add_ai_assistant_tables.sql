-- AI Assistant Tables Migration
-- Epic 1: Foundation & Infrastructure for AI Assistant Feature

-- Create ai_conversations table
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cleared_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb
);

-- Create ai_messages table
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "model" varchar(100),
  "token_usage" jsonb,
  "context" jsonb
);

-- Create ai_config table
CREATE TABLE IF NOT EXISTS "ai_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "model" varchar(100) DEFAULT 'anthropic/claude-3.5-haiku' NOT NULL,
  "max_tokens" integer DEFAULT 4096,
  "temperature" numeric(3, 2) DEFAULT 0.70,
  "api_key_encrypted" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for ai_conversations
CREATE INDEX IF NOT EXISTS "ai_conversations_workspace_idx" ON "ai_conversations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_user_idx" ON "ai_conversations" ("user_id");

-- Create unique index for active conversations (NULLS NOT DISTINCT)
-- This ensures only one active conversation (where cleared_at IS NULL) per user+workspace
CREATE UNIQUE INDEX IF NOT EXISTS "uk_user_workspace_active_conversation"
  ON "ai_conversations" ("user_id", "workspace_id", "cleared_at") NULLS NOT DISTINCT;

-- Create indexes for ai_messages
CREATE INDEX IF NOT EXISTS "idx_conversation_messages" ON "ai_messages" ("conversation_id", "created_at");

-- Create unique constraint for ai_config
ALTER TABLE "ai_config" ADD CONSTRAINT "uk_workspace_ai_config" UNIQUE ("workspace_id");
