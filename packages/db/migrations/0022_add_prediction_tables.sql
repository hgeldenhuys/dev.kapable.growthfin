-- US-LEAD-AI-010: Predictive Conversion Scoring
-- Migration: Add prediction models, predictions, history, and training data tables

-- Create enum types
DO $$ BEGIN
  CREATE TYPE "public"."prediction_model_type" AS ENUM('conversion', 'churn', 'lifetime_value');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."prediction_algorithm" AS ENUM('logistic_regression', 'random_forest', 'gradient_boosting', 'neural_network');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create prediction_models table
CREATE TABLE IF NOT EXISTS "prediction_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "model_type" "prediction_model_type" NOT NULL,
  "model_version" text NOT NULL,
  "algorithm" "prediction_algorithm" NOT NULL,
  "training_samples" integer NOT NULL,
  "training_started_at" timestamp with time zone NOT NULL,
  "training_completed_at" timestamp with time zone,
  "accuracy" numeric(5, 4),
  "precision" numeric(5, 4),
  "recall" numeric(5, 4),
  "f1_score" numeric(5, 4),
  "feature_importance" jsonb,
  "model_weights" jsonb,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create lead_predictions table
CREATE TABLE IF NOT EXISTS "lead_predictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "model_id" uuid NOT NULL REFERENCES "prediction_models"("id") ON DELETE CASCADE,
  "prediction_score" numeric(5, 2) NOT NULL,
  "confidence_interval" numeric(5, 2),
  "top_factors" jsonb,
  "predicted_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create prediction_history table
CREATE TABLE IF NOT EXISTS "prediction_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "model_id" uuid NOT NULL REFERENCES "prediction_models"("id") ON DELETE CASCADE,
  "prediction_score" numeric(5, 2) NOT NULL,
  "predicted_at" timestamp with time zone NOT NULL,
  "actual_converted" boolean,
  "actual_converted_at" timestamp with time zone,
  "prediction_error" numeric(5, 2),
  "prediction_correct" boolean,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create prediction_training_data table
CREATE TABLE IF NOT EXISTS "prediction_training_data" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "model_id" uuid NOT NULL REFERENCES "prediction_models"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "features" jsonb NOT NULL,
  "converted" boolean NOT NULL,
  "converted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for prediction_models
CREATE INDEX IF NOT EXISTS "idx_prediction_models_workspace" ON "prediction_models" ("workspace_id", "model_type", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_prediction_model" ON "prediction_models" ("workspace_id", "model_type", "is_active") WHERE "is_active" = true;

-- Create indexes for lead_predictions
CREATE UNIQUE INDEX IF NOT EXISTS "unique_lead_prediction" ON "lead_predictions" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_lead_predictions_score" ON "lead_predictions" ("workspace_id", "prediction_score");

CREATE INDEX IF NOT EXISTS "idx_lead_predictions_model" ON "lead_predictions" ("model_id", "predicted_at");

-- Create indexes for prediction_history
CREATE INDEX IF NOT EXISTS "idx_prediction_history_lead_date" ON "prediction_history" ("lead_id", "predicted_at");

CREATE INDEX IF NOT EXISTS "idx_prediction_history_accuracy" ON "prediction_history" ("workspace_id", "model_id", "prediction_correct");

-- Create indexes for prediction_training_data
CREATE INDEX IF NOT EXISTS "idx_prediction_training_data_model" ON "prediction_training_data" ("model_id");

CREATE INDEX IF NOT EXISTS "idx_prediction_training_data_workspace" ON "prediction_training_data" ("workspace_id", "converted");

-- Add constraints validation
DO $$ BEGIN
  ALTER TABLE "lead_predictions" ADD CONSTRAINT "lead_predictions_score_check" CHECK ("prediction_score" >= 0 AND "prediction_score" <= 100);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
