-- CLI Sessions Table
-- Tracks active CLI sessions for heartbeat monitoring and reconnection

CREATE TABLE IF NOT EXISTS "cli_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "command" text NOT NULL,
  "last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_cli_sessions_project" ON "cli_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_cli_sessions_heartbeat" ON "cli_sessions" ("last_heartbeat");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_cli_sessions_unique" ON "cli_sessions" ("session_id", "command");
