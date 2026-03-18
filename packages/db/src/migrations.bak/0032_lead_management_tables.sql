-- Lead Management Tables Migration
-- Epic 5: Enhanced Lead Management - Bulk Operations & Segmentation

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Bulk Operation Type Enum
CREATE TYPE "bulk_operation_type" AS ENUM ('assign', 'update', 'delete', 'export', 'rollback');

-- Bulk Operation Status Enum
CREATE TYPE "bulk_operation_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Bulk Operation Item Status Enum
CREATE TYPE "bulk_operation_item_status" AS ENUM ('pending', 'success', 'failed', 'skipped');

-- ============================================================================
-- BULK OPERATIONS TABLE
-- ============================================================================

CREATE TABLE "bulk_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "operation_type" "bulk_operation_type" NOT NULL,
  "operation_name" text,
  "payload" jsonb NOT NULL,
  "status" "bulk_operation_status" NOT NULL DEFAULT 'pending',
  "total_items" integer NOT NULL,
  "processed_items" integer NOT NULL DEFAULT 0,
  "successful_items" integer NOT NULL DEFAULT 0,
  "failed_items" integer NOT NULL DEFAULT 0,
  "error_summary" text,
  "error_details" jsonb,
  "rollback_enabled" boolean NOT NULL DEFAULT true,
  "rollback_window_minutes" integer DEFAULT 5,
  "rollback_deadline" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);

-- Indexes for bulk_operations
CREATE INDEX "idx_bulk_operations_workspace" ON "bulk_operations"("workspace_id", "created_at");
CREATE INDEX "idx_bulk_operations_status" ON "bulk_operations"("workspace_id", "status");
CREATE INDEX "idx_bulk_operations_created_by" ON "bulk_operations"("created_by");

-- ============================================================================
-- BULK OPERATION ITEMS TABLE
-- ============================================================================

CREATE TABLE "bulk_operation_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "operation_id" uuid NOT NULL REFERENCES "bulk_operations"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "status" "bulk_operation_item_status" NOT NULL DEFAULT 'pending',
  "error_message" text,
  "before_state" jsonb,
  "after_state" jsonb,
  "processed_at" timestamp with time zone
);

-- Indexes for bulk_operation_items
CREATE INDEX "idx_bulk_operation_items_operation" ON "bulk_operation_items"("operation_id", "status");
CREATE INDEX "idx_bulk_operation_items_lead" ON "bulk_operation_items"("lead_id");

-- Idempotency constraint: one item per lead per operation
CREATE UNIQUE INDEX "unique_operation_lead" ON "bulk_operation_items"("operation_id", "lead_id");

-- ============================================================================
-- LEAD SEGMENTS TABLE
-- ============================================================================

CREATE TABLE "lead_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "criteria" jsonb NOT NULL,
  "auto_refresh" boolean NOT NULL DEFAULT true,
  "refresh_interval_minutes" integer DEFAULT 15,
  "last_refreshed_at" timestamp with time zone,
  "next_refresh_at" timestamp with time zone,
  "member_count" integer NOT NULL DEFAULT 0,
  "last_member_count" integer,
  "deleted_at" timestamp with time zone,
  "can_be_revived" boolean NOT NULL DEFAULT true,
  "revival_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Indexes for lead_segments
CREATE INDEX "idx_lead_segments_workspace" ON "lead_segments"("workspace_id");
CREATE INDEX "idx_lead_segments_auto_refresh" ON "lead_segments"("workspace_id", "last_refreshed_at");
CREATE INDEX "idx_lead_segments_next_refresh" ON "lead_segments"("next_refresh_at");

-- ============================================================================
-- LEAD SEGMENT MEMBERSHIPS TABLE
-- ============================================================================

CREATE TABLE "lead_segment_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "segment_id" uuid NOT NULL REFERENCES "lead_segments"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
  "added_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "removed_at" timestamp with time zone
);

-- Indexes for lead_segment_memberships
CREATE INDEX "idx_segment_memberships_segment" ON "lead_segment_memberships"("segment_id");
CREATE INDEX "idx_segment_memberships_lead" ON "lead_segment_memberships"("lead_id");

-- Idempotency constraint: one active membership per lead per segment
-- NULL values are treated as distinct in unique constraints, so this works for removed_at
CREATE UNIQUE INDEX "unique_segment_lead_active" ON "lead_segment_memberships"("segment_id", "lead_id", "removed_at");

-- ============================================================================
-- SEGMENT METRICS HISTORY TABLE
-- ============================================================================

CREATE TABLE "segment_metrics_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "segment_id" uuid NOT NULL REFERENCES "lead_segments"("id") ON DELETE CASCADE,
  "snapshot_date" timestamp with time zone NOT NULL,
  "total_leads" integer NOT NULL,
  "new_leads_7d" integer,
  "new_leads_30d" integer,
  "avg_propensity_score" numeric(5,2),
  "avg_engagement_score" numeric(5,2),
  "avg_fit_score" numeric(5,2),
  "avg_composite_score" numeric(5,2),
  "funnel_new" integer NOT NULL DEFAULT 0,
  "funnel_contacted" integer NOT NULL DEFAULT 0,
  "funnel_qualified" integer NOT NULL DEFAULT 0,
  "funnel_unqualified" integer NOT NULL DEFAULT 0,
  "funnel_converted" integer NOT NULL DEFAULT 0,
  "activity_volume_7d" integer NOT NULL DEFAULT 0,
  "activity_volume_30d" integer NOT NULL DEFAULT 0,
  "conversion_rate" numeric(5,4),
  "conversion_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Indexes for segment_metrics_history
CREATE INDEX "idx_segment_metrics_segment_date" ON "segment_metrics_history"("segment_id", "snapshot_date");
CREATE INDEX "idx_segment_metrics_workspace" ON "segment_metrics_history"("workspace_id", "snapshot_date");

-- One snapshot per segment per date
CREATE UNIQUE INDEX "unique_segment_snapshot" ON "segment_metrics_history"("segment_id", "snapshot_date");

-- ============================================================================
-- PostgreSQL NOTIFY TRIGGERS FOR SSE STREAMING
-- ============================================================================

-- Trigger for bulk operation progress updates
CREATE OR REPLACE FUNCTION notify_bulk_operation_progress()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'bulk_operation_progress',
    json_build_object(
      'operation_id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'status', NEW.status,
      'processed_items', NEW.processed_items,
      'successful_items', NEW.successful_items,
      'failed_items', NEW.failed_items
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulk_operation_progress_trigger
  AFTER UPDATE ON bulk_operations
  FOR EACH ROW
  WHEN (OLD.processed_items IS DISTINCT FROM NEW.processed_items OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_bulk_operation_progress();

-- Trigger for segment membership updates
CREATE OR REPLACE FUNCTION notify_segment_membership()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_notify(
      'segment_membership_updates',
      json_build_object(
        'segment_id', NEW.segment_id,
        'workspace_id', NEW.workspace_id,
        'lead_id', NEW.lead_id,
        'action', 'added'
      )::text
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    PERFORM pg_notify(
      'segment_membership_updates',
      json_build_object(
        'segment_id', NEW.segment_id,
        'workspace_id', NEW.workspace_id,
        'lead_id', NEW.lead_id,
        'action', 'removed'
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER segment_membership_trigger
  AFTER INSERT OR UPDATE ON lead_segment_memberships
  FOR EACH ROW
  EXECUTE FUNCTION notify_segment_membership();

-- Trigger for segment metrics updates
CREATE OR REPLACE FUNCTION notify_segment_metrics()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'segment_metrics_updates',
    json_build_object(
      'segment_id', NEW.segment_id,
      'workspace_id', NEW.workspace_id,
      'snapshot_date', NEW.snapshot_date,
      'total_leads', NEW.total_leads,
      'conversion_rate', NEW.conversion_rate
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER segment_metrics_trigger
  AFTER INSERT OR UPDATE ON segment_metrics_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_segment_metrics();

-- ============================================================================
-- CLEANUP OLD SEGMENT METRICS (90 DAY RETENTION)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_segment_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM segment_metrics_history
  WHERE snapshot_date < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Note: Actual cleanup scheduling should be done via pg-boss or cron job
-- Example: SELECT cleanup_old_segment_metrics();
