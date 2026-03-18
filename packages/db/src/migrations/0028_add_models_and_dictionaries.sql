-- Migration: Add models and pronunciation_dictionaries tables
-- Purpose: Support TTS models and pronunciation dictionaries sync from providers
-- Date: 2025-10-30

-- Create models table
CREATE TABLE IF NOT EXISTS "models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "provider" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for models
CREATE INDEX IF NOT EXISTS "models_provider_idx" ON "models" ("provider");
CREATE INDEX IF NOT EXISTS "models_external_id_idx" ON "models" ("external_id");
CREATE INDEX IF NOT EXISTS "models_provider_external_id_idx" ON "models" ("provider", "external_id");

-- Create unique constraint on provider + externalId
ALTER TABLE "models" ADD CONSTRAINT "models_provider_external_id_unique" UNIQUE ("provider", "external_id");

-- Create pronunciation_dictionaries table
CREATE TABLE IF NOT EXISTS "pronunciation_dictionaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "provider" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for pronunciation_dictionaries
CREATE INDEX IF NOT EXISTS "pronunciation_dictionaries_provider_idx" ON "pronunciation_dictionaries" ("provider");
CREATE INDEX IF NOT EXISTS "pronunciation_dictionaries_external_id_idx" ON "pronunciation_dictionaries" ("external_id");
CREATE INDEX IF NOT EXISTS "pronunciation_dictionaries_provider_external_id_idx" ON "pronunciation_dictionaries" ("provider", "external_id");

-- Create unique constraint on provider + externalId
ALTER TABLE "pronunciation_dictionaries" ADD CONSTRAINT "pronunciation_dictionaries_provider_external_id_unique" UNIQUE ("provider", "external_id");

-- Add model_id column to global_voice_settings
ALTER TABLE "global_voice_settings" ADD COLUMN IF NOT EXISTS "model_id" uuid REFERENCES "models"("id") ON DELETE RESTRICT;

-- Enable RLS (Row Level Security) for new tables
ALTER TABLE "models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pronunciation_dictionaries" ENABLE ROW LEVEL SECURITY;
