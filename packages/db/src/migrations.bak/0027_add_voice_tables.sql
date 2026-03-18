-- Migration: Add voice tables and update audio_cache
-- Purpose: Support multi-provider TTS with voice settings hierarchy
-- Date: 2025-10-29

-- Create voices table
CREATE TABLE IF NOT EXISTS "voices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "gender" text NOT NULL,
  "use_for_summaries" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for voices
CREATE INDEX IF NOT EXISTS "voices_provider_idx" ON "voices" ("provider");
CREATE INDEX IF NOT EXISTS "voices_external_id_idx" ON "voices" ("external_id");
CREATE INDEX IF NOT EXISTS "voices_gender_idx" ON "voices" ("gender");
CREATE INDEX IF NOT EXISTS "voices_use_for_summaries_idx" ON "voices" ("use_for_summaries");
CREATE INDEX IF NOT EXISTS "voices_provider_external_id_idx" ON "voices" ("provider", "external_id");

-- Create global_voice_settings table (singleton)
CREATE TABLE IF NOT EXISTS "global_voice_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_voice_id" uuid NOT NULL REFERENCES "voices"("id") ON DELETE RESTRICT,
  "assistant_voice_id" uuid NOT NULL REFERENCES "voices"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create project_voice_settings table
CREATE TABLE IF NOT EXISTS "project_voice_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_voice_id" uuid REFERENCES "voices"("id") ON DELETE RESTRICT,
  "assistant_voice_id" uuid REFERENCES "voices"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Update audio_cache table to use hook_event_id and voice_id FK
-- Step 1: Add new columns
ALTER TABLE "audio_cache" ADD COLUMN IF NOT EXISTS "hook_event_id_new" uuid;
ALTER TABLE "audio_cache" ADD COLUMN IF NOT EXISTS "voice_id_new" uuid;

-- Step 2: Drop old foreign key constraint if exists
ALTER TABLE "audio_cache" DROP CONSTRAINT IF EXISTS "audio_cache_event_summary_id_event_summaries_id_fk";

-- Step 3: Drop old columns (after confirming no data or migrating data)
ALTER TABLE "audio_cache" DROP COLUMN IF EXISTS "event_summary_id";
ALTER TABLE "audio_cache" DROP COLUMN IF EXISTS "voice_id";

-- Step 4: Rename new columns to final names
ALTER TABLE "audio_cache" RENAME COLUMN "hook_event_id_new" TO "hook_event_id";
ALTER TABLE "audio_cache" RENAME COLUMN "voice_id_new" TO "voice_id";

-- Step 5: Set NOT NULL constraints
ALTER TABLE "audio_cache" ALTER COLUMN "hook_event_id" SET NOT NULL;
ALTER TABLE "audio_cache" ALTER COLUMN "voice_id" SET NOT NULL;

-- Step 6: Add foreign key constraints
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_hook_event_id_hook_events_id_fk"
  FOREIGN KEY ("hook_event_id") REFERENCES "hook_events"("id") ON DELETE CASCADE;
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_voice_id_voices_id_fk"
  FOREIGN KEY ("voice_id") REFERENCES "voices"("id") ON DELETE RESTRICT;

-- Enable RLS (Row Level Security) for new tables
ALTER TABLE "voices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "global_voice_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_voice_settings" ENABLE ROW LEVEL SECURITY;
