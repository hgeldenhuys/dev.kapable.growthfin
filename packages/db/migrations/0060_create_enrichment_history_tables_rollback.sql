-- Rollback Migration: Remove enrichment history tracking tables
-- Story: US-ENRICH-HIST-001
-- Epic: Database Foundation for Enrichment History
--
-- Purpose: Clean rollback of enrichment history tables
--
-- IMPORTANT: Order matters - must drop tables with foreign keys first
--
-- Drop order:
--   1. crm_enrichment_history (has FK to crm_enrichment_content)
--   2. crm_enrichment_content (no dependencies)

-- =============================================================================
-- DROP INDEXES: crm_enrichment_history
-- =============================================================================

-- Note: Indexes are automatically dropped when table is dropped, but we
-- explicitly drop them here for clarity and to match forward migration

DROP INDEX IF EXISTS idx_enrichment_history_entity_created;
DROP INDEX IF EXISTS idx_enrichment_history_job;
DROP INDEX IF EXISTS idx_enrichment_history_task;
DROP INDEX IF EXISTS idx_enrichment_history_template;
DROP INDEX IF EXISTS idx_enrichment_history_created;
DROP INDEX IF EXISTS idx_enrichment_history_entity;
DROP INDEX IF EXISTS idx_enrichment_history_workspace;

-- =============================================================================
-- DROP TABLE: crm_enrichment_history (FIRST - has FK to crm_enrichment_content)
-- =============================================================================

DROP TABLE IF EXISTS crm_enrichment_history CASCADE;

-- =============================================================================
-- DROP INDEXES: crm_enrichment_content
-- =============================================================================

DROP INDEX IF EXISTS idx_enrichment_content_workspace;
DROP INDEX IF EXISTS idx_enrichment_content_hash;

-- =============================================================================
-- DROP TABLE: crm_enrichment_content (SECOND - no dependencies)
-- =============================================================================

DROP TABLE IF EXISTS crm_enrichment_content CASCADE;
