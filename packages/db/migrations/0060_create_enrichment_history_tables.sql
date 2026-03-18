-- Migration: Create enrichment history tracking tables
-- Story: US-ENRICH-HIST-001
-- Epic: Database Foundation for Enrichment History
--
-- Purpose: Enable versioned enrichment tracking with content deduplication
--
-- Tables:
--   - crm_enrichment_history: Historical enrichment snapshots with versioning
--   - crm_enrichment_content: Deduplicated content storage via SHA-256 hashing
--
-- Features:
--   - Full audit trail of all enrichment operations
--   - Content deduplication saves >25% storage
--   - Polymorphic entity relationship (contacts + leads)
--   - Template snapshots preserve configuration at enrichment time
--   - Workspace-level isolation with GDPR-compliant CASCADE deletes
--
-- Dependencies:
--   - workspaces table (CASCADE delete)
--   - crm_tasks table (SET NULL on delete)
--   - crm_enrichment_jobs table (CASCADE delete)

-- =============================================================================
-- TABLE: crm_enrichment_content (Create first due to FK dependency)
-- =============================================================================

CREATE TABLE crm_enrichment_content (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace isolation (REQUIRED for multi-tenancy)
  workspace_id UUID NOT NULL,

  -- SHA-256 hash of enrichment_report content (64 hex characters)
  -- Used for deduplication: same content = same hash
  content_hash CHAR(64) NOT NULL,

  -- The actual markdown enrichment report
  -- Can be large (100KB+), hence deduplication is important
  enrichment_report TEXT NOT NULL,

  -- Optional compression flag for future optimization
  compressed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Reference counting for safe garbage collection
  -- Incremented when new history entry references this content
  -- Decremented when history entry is deleted
  -- Content can be deleted when reference_count reaches 0
  reference_count INTEGER NOT NULL DEFAULT 1,

  -- Audit timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key: workspace with CASCADE delete for GDPR compliance
  CONSTRAINT fk_enrichment_content_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  -- UNIQUE constraint: One hash per workspace (enables deduplication)
  -- This ensures we never store duplicate content for the same workspace
  CONSTRAINT uniq_workspace_content_hash
    UNIQUE (workspace_id, content_hash)
);

-- =============================================================================
-- TABLE: crm_enrichment_history
-- =============================================================================

CREATE TABLE crm_enrichment_history (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace isolation (REQUIRED for multi-tenancy)
  workspace_id UUID NOT NULL,

  -- Polymorphic entity relationship (contact or lead)
  -- No foreign key - application enforces referential integrity
  entity_id UUID NOT NULL,
  entity_type VARCHAR(20) NOT NULL,

  -- Link to deduplicated content (nullable - content may be purged)
  enrichment_report_id UUID,

  -- Template snapshot at time of enrichment (JSONB for flexibility)
  -- Preserves exact template configuration used for this enrichment
  -- Enables: "What prompt was used for this enrichment?"
  template_snapshot JSONB NOT NULL,

  -- Optional task that created this enrichment
  task_id UUID,

  -- Job that created this enrichment (CASCADE delete - job owns history)
  job_id UUID,

  -- Human-readable summary fields
  enrichment_summary TEXT,      -- Brief summary of enrichment results
  changes_since_last TEXT,       -- What changed from previous enrichment

  -- Extensibility for future metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Audit timestamp (only created_at - history is immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Check constraint: entity_type must be valid
  CONSTRAINT chk_enrichment_history_entity_type
    CHECK (entity_type IN ('contact', 'lead')),

  -- Foreign key: workspace with CASCADE delete for GDPR compliance
  CONSTRAINT fk_enrichment_history_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  -- Foreign key: content with SET NULL (preserve history if content purged)
  CONSTRAINT fk_enrichment_history_content
    FOREIGN KEY (enrichment_report_id)
    REFERENCES crm_enrichment_content(id)
    ON DELETE SET NULL,

  -- Foreign key: task with SET NULL (preserve history if task deleted)
  CONSTRAINT fk_enrichment_history_task
    FOREIGN KEY (task_id)
    REFERENCES crm_tasks(id)
    ON DELETE SET NULL,

  -- Foreign key: job with CASCADE (job owns history)
  CONSTRAINT fk_enrichment_history_job
    FOREIGN KEY (job_id)
    REFERENCES crm_enrichment_jobs(id)
    ON DELETE CASCADE
);

-- =============================================================================
-- INDEXES: crm_enrichment_content
-- =============================================================================

-- Fast hash lookup for deduplication
-- Used when: Checking if content already exists before inserting
CREATE INDEX idx_enrichment_content_hash
  ON crm_enrichment_content(content_hash);

-- Workspace scoping (REQUIRED for multi-tenancy performance)
-- Used when: Querying all content for a workspace
CREATE INDEX idx_enrichment_content_workspace
  ON crm_enrichment_content(workspace_id);

-- =============================================================================
-- INDEXES: crm_enrichment_history
-- =============================================================================

-- Workspace scoping (REQUIRED for multi-tenancy performance)
-- Used when: Querying all history for a workspace
CREATE INDEX idx_enrichment_history_workspace
  ON crm_enrichment_history(workspace_id);

-- Fast entity lookup (composite index on both columns)
-- Used when: "Show me all enrichment history for contact X"
CREATE INDEX idx_enrichment_history_entity
  ON crm_enrichment_history(entity_id, entity_type);

-- Chronological sorting (DESC for recent-first queries)
-- Used when: "Show me recent enrichments" or "Enrichments from last 30 days"
CREATE INDEX idx_enrichment_history_created
  ON crm_enrichment_history(created_at DESC);

-- Template filtering via GIN index for JSONB queries
-- Enables flexible querying: template_snapshot->>'templateId' = 'xyz'
-- Used when: "Show me all enrichments that used template X"
CREATE INDEX idx_enrichment_history_template
  ON crm_enrichment_history
  USING GIN(template_snapshot);

-- Task/Job lookups
-- Used when: "Show me all enrichments from task/job X"
CREATE INDEX idx_enrichment_history_task
  ON crm_enrichment_history(task_id);

CREATE INDEX idx_enrichment_history_job
  ON crm_enrichment_history(job_id);

-- Composite index for common query pattern: entity + chronological
-- Optimizes: "Show me recent enrichments for contact X"
CREATE INDEX idx_enrichment_history_entity_created
  ON crm_enrichment_history(entity_id, entity_type, created_at DESC);

-- =============================================================================
-- COMMENTS (Documentation in database)
-- =============================================================================

COMMENT ON TABLE crm_enrichment_content IS
  'Deduplicated storage for enrichment report content using SHA-256 hashing. Reference counted for safe garbage collection.';

COMMENT ON TABLE crm_enrichment_history IS
  'Historical enrichment operations with versioning. Polymorphic relationship to contacts/leads. Preserves template snapshot at enrichment time.';

COMMENT ON COLUMN crm_enrichment_content.content_hash IS
  'SHA-256 hash of enrichment_report. Used for deduplication - same content produces same hash.';

COMMENT ON COLUMN crm_enrichment_content.reference_count IS
  'Number of crm_enrichment_history records referencing this content. Enables safe garbage collection when count reaches 0.';

COMMENT ON COLUMN crm_enrichment_history.entity_type IS
  'Type of entity enriched. Valid values: contact, lead. No foreign key - application enforces referential integrity.';

COMMENT ON COLUMN crm_enrichment_history.template_snapshot IS
  'Full template configuration at enrichment time. Enables historical analysis: "What prompt was used?"';

COMMENT ON COLUMN crm_enrichment_history.changes_since_last IS
  'Human-readable summary of what changed from previous enrichment. Enables: "What''s new?"';
