-- Migration: Add Campaign Management & Research Performance Indexes
-- Optimizes queries for production workloads with composite and partial indexes

-- ============================================================================
-- CAMPAIGN TABLES
-- ============================================================================

-- Create campaign tables if they don't exist (in case migration was missed)
CREATE TABLE IF NOT EXISTS "crm_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "objective" text NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "scheduled_start_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "scheduled_end_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "audience_definition" jsonb DEFAULT '{}' NOT NULL,
  "audience_size" integer,
  "audience_last_calculated_at" timestamp with time zone,
  "channels" text[] DEFAULT '{}' NOT NULL,
  "channel_config" jsonb DEFAULT '{}' NOT NULL,
  "total_recipients" integer DEFAULT 0 NOT NULL,
  "total_sent" integer DEFAULT 0 NOT NULL,
  "total_delivered" integer DEFAULT 0 NOT NULL,
  "total_opened" integer DEFAULT 0 NOT NULL,
  "total_clicked" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "crm_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "crm_campaigns"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "status_reason" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "first_opened_at" timestamp with time zone,
  "open_count" integer DEFAULT 0 NOT NULL,
  "first_clicked_at" timestamp with time zone,
  "click_count" integer DEFAULT 0 NOT NULL,
  "added_to_campaign_at" timestamp with time zone DEFAULT now() NOT NULL,
  "added_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "crm_campaign_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "crm_campaigns"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "channel" text NOT NULL,
  "subject" text,
  "body_text" text NOT NULL,
  "body_html" text,
  "preview_text" text,
  "send_from_name" text,
  "send_from_email" text,
  "reply_to_email" text,
  "merge_tags" text[] DEFAULT '{}' NOT NULL,
  "fallback_values" jsonb DEFAULT '{}' NOT NULL,
  "track_opens" boolean DEFAULT true NOT NULL,
  "track_clicks" boolean DEFAULT true NOT NULL,
  "total_sent" integer DEFAULT 0 NOT NULL,
  "total_delivered" integer DEFAULT 0 NOT NULL,
  "total_opened" integer DEFAULT 0 NOT NULL,
  "total_clicked" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================================
-- CAMPAIGN PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for campaign list queries (workspace + status + created_at)
CREATE INDEX IF NOT EXISTS "idx_crm_campaigns_workspace_status_created"
  ON "crm_campaigns"("workspace_id", "status", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Partial index for active campaigns (frequently queried)
CREATE INDEX IF NOT EXISTS "idx_crm_campaigns_active"
  ON "crm_campaigns"("workspace_id", "scheduled_start_at")
  WHERE "status" IN ('active', 'scheduled') AND "deleted_at" IS NULL;

-- Index for campaign status queries
CREATE INDEX IF NOT EXISTS "idx_crm_campaigns_status"
  ON "crm_campaigns"("status")
  WHERE "deleted_at" IS NULL;

-- Index for scheduled campaigns (for background workers)
CREATE INDEX IF NOT EXISTS "idx_crm_campaigns_scheduled_start_at"
  ON "crm_campaigns"("scheduled_start_at")
  WHERE "status" = 'scheduled' AND "deleted_at" IS NULL;

-- ============================================================================
-- CAMPAIGN RECIPIENTS PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for recipient queries (campaign + workspace + status)
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_recipients_campaign_workspace"
  ON "crm_campaign_recipients"("campaign_id", "workspace_id", "status")
  WHERE "deleted_at" IS NULL;

-- Index for contact lookup
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_recipients_contact_id"
  ON "crm_campaign_recipients"("contact_id")
  WHERE "deleted_at" IS NULL;

-- Index for engagement tracking queries
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_recipients_engagement"
  ON "crm_campaign_recipients"("campaign_id", "first_opened_at", "first_clicked_at")
  WHERE "deleted_at" IS NULL AND "status" = 'delivered';

-- Partial index for pending recipients (for job processing)
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_recipients_pending"
  ON "crm_campaign_recipients"("campaign_id", "added_to_campaign_at")
  WHERE "status" = 'pending' AND "deleted_at" IS NULL;

-- ============================================================================
-- CAMPAIGN MESSAGES PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for message list queries
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_messages_campaign_workspace"
  ON "crm_campaign_messages"("campaign_id", "workspace_id")
  WHERE "deleted_at" IS NULL;

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS "idx_crm_campaign_messages_workspace_id"
  ON "crm_campaign_messages"("workspace_id")
  WHERE "deleted_at" IS NULL;

-- ============================================================================
-- RESEARCH SESSION PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for research session queries (workspace + entity + status)
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_workspace_entity"
  ON "crm_research_sessions"("workspace_id", "entity_type", "entity_id", "status")
  WHERE "deleted_at" IS NULL;

-- Partial index for active research sessions
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_active"
  ON "crm_research_sessions"("workspace_id", "started_at")
  WHERE "status" IN ('pending', 'running') AND "deleted_at" IS NULL;

-- Index for cost tracking and analytics
CREATE INDEX IF NOT EXISTS "idx_crm_research_sessions_cost"
  ON "crm_research_sessions"("workspace_id", "created_at", "cost_cents")
  WHERE "deleted_at" IS NULL;

-- ============================================================================
-- RESEARCH FINDINGS PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for findings queries (session + status + confidence)
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_session_status_confidence"
  ON "crm_research_findings"("session_id", "status", "confidence" DESC);

-- Partial index for unapplied approved findings (for apply operations)
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_unapplied_approved"
  ON "crm_research_findings"("session_id", "confidence" DESC)
  WHERE "status" = 'approved' AND "applied_at" IS NULL;

-- Index for field-based lookups
CREATE INDEX IF NOT EXISTS "idx_crm_research_findings_field"
  ON "crm_research_findings"("field", "confidence" DESC);

-- ============================================================================
-- TIMELINE EVENTS PERFORMANCE INDEXES (ENHANCEMENTS)
-- ============================================================================

-- Composite index for timeline queries (workspace + entity + occurred_at)
-- This replaces the basic entity index with a more optimized version
DROP INDEX IF EXISTS "idx_crm_timeline_events_entity";
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_entity_occurred"
  ON "crm_timeline_events"("workspace_id", "entity_type", "entity_id", "occurred_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Partial index for pinned events
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_pinned"
  ON "crm_timeline_events"("workspace_id", "entity_type", "entity_id", "pinned_at" DESC)
  WHERE "is_pinned" = true AND "deleted_at" IS NULL;

-- Index for event category filtering with date range
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_category_occurred"
  ON "crm_timeline_events"("workspace_id", "event_category", "occurred_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Composite index for recent events query pattern
CREATE INDEX IF NOT EXISTS "idx_crm_timeline_events_recent"
  ON "crm_timeline_events"("workspace_id", "occurred_at" DESC, "created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- ============================================================================
-- CONTACT PERFORMANCE INDEXES (ENHANCEMENTS FOR CAMPAIGNS)
-- ============================================================================

-- Composite index for audience calculation queries
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_audience_calc"
  ON "crm_contacts"("workspace_id", "lifecycle_stage", "lead_score")
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;

-- Partial index for contacts with consent (campaign targeting)
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_marketing_consent"
  ON "crm_contacts"("workspace_id", "lifecycle_stage", "lead_score")
  WHERE "consent_marketing" = true AND "deleted_at" IS NULL AND "email" IS NOT NULL;

-- Index for contact status filtering
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_status_email"
  ON "crm_contacts"("workspace_id", "status")
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;

-- ============================================================================
-- VACUUM ANALYZE (Update statistics for query planner)
-- ============================================================================

VACUUM ANALYZE "crm_campaigns";
VACUUM ANALYZE "crm_campaign_recipients";
VACUUM ANALYZE "crm_campaign_messages";
VACUUM ANALYZE "crm_research_sessions";
VACUUM ANALYZE "crm_research_findings";
VACUUM ANALYZE "crm_timeline_events";
VACUUM ANALYZE "crm_contacts";
