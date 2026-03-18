-- Migration: Add LLM Model Catalog
-- Purpose: Centralized model catalog with cost information
-- Date: 2025-10-30

CREATE TABLE "llm_model_catalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "input_cost_per_1m_tokens" NUMERIC(10, 2) NOT NULL,
  "output_cost_per_1m_tokens" NUMERIC(10, 2) NOT NULL,
  "context_window" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for fast filtering
CREATE INDEX "llm_model_catalog_provider_idx" ON "llm_model_catalog" ("provider");
CREATE INDEX "llm_model_catalog_is_active_idx" ON "llm_model_catalog" ("is_active");

-- Create unique constraint to prevent duplicate models
ALTER TABLE "llm_model_catalog"
ADD CONSTRAINT "llm_model_catalog_provider_model_unique"
UNIQUE ("provider", "model_name");
