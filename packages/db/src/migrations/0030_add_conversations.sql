-- Migration: Add Conversations and Messages Tables
-- Purpose: Interactive chat conversations with AI assistant
-- Date: 2025-10-31

CREATE TABLE "conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE CASCADE,
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for workspace queries
CREATE INDEX "conversations_workspace_created_at_idx" ON "conversations" ("workspace_id", "created_at");

CREATE TABLE "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for conversation queries
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" ("conversation_id", "created_at");
