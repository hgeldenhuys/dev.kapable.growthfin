-- Migration: Add workspace_invitations table
-- Purpose: Track pending workspace invitations with token-based acceptance
-- Date: 2025-10-28

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "invited_by" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "workspace_invitations_token_idx" ON "workspace_invitations" ("token");
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspace_idx" ON "workspace_invitations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_invitations_email_idx" ON "workspace_invitations" ("email");

-- Enable RLS (Row Level Security)
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;
