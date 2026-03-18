/**
 * Job Logs Schema
 * Generic job logging infrastructure for real-time progress streaming
 *
 * This table provides a unified logging layer for all async job types:
 * - Enrichment jobs
 * - Export jobs
 * - Segmentation jobs
 * - Scoring jobs
 * - Future task types
 *
 * Design: INSERT-only (immutable) following event-driven architecture pattern
 * Streaming: ElectricSQL shape subscription with jobId filtering
 *
 * US-008: Generic Job Logs Infrastructure
 */

import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

// ============================================================================
// ENUMS
// ============================================================================

export const jobLogLevelEnum = pgEnum('job_log_level', [
  'debug', // Detailed debugging information
  'info', // General information about job progress
  'warn', // Warning conditions
  'error', // Error conditions
]);

// ============================================================================
// JOB LOGS TABLE
// ============================================================================

export const jobLogs = pgTable(
  'job_logs',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Workspace isolation (multi-tenancy)
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Job reference (polymorphic - can be any job type)
    jobId: uuid('job_id').notNull(),
    jobType: text('job_type').notNull(), // 'enrichment', 'export', 'segmentation', 'scoring', etc.

    // Log entry
    level: jobLogLevelEnum('level').notNull().default('info'),
    message: text('message').notNull(),

    // Metadata for tool calls and additional context
    // Structure for tool calls:
    // {
    //   toolName?: string,      // e.g., 'web_search', 'linkedin_lookup'
    //   toolStatus?: 'started' | 'completed' | 'failed',
    //   duration?: number,      // milliseconds
    //   cost?: number,          // USD
    //   entityId?: string,      // contact/lead being processed
    //   entityType?: string,    // 'contact' | 'lead'
    //   progress?: { current: number, total: number },
    //   error?: { code: string, message: string },
    //   [key: string]: unknown
    // }
    metadata: jsonb('metadata').notNull().default({}),

    // Timestamp (INSERT-only, no updatedAt)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // REQUIRED: Index on workspace_id for multi-tenancy filtering
    workspaceIdIdx: index('idx_job_logs_workspace_id').on(table.workspaceId),

    // Primary query index: Get logs for a specific job
    jobIdIdx: index('idx_job_logs_job_id').on(table.jobId),

    // Composite index for efficient job + time queries
    jobIdCreatedAtIdx: index('idx_job_logs_job_id_created_at').on(table.jobId, table.createdAt),

    // Index for filtering by job type
    jobTypeIdx: index('idx_job_logs_job_type').on(table.jobType),

    // Index for time-based queries and cleanup
    createdAtIdx: index('idx_job_logs_created_at').on(table.createdAt),

    // Index for level filtering (e.g., show only errors)
    levelIdx: index('idx_job_logs_level').on(table.level),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type JobLog = typeof jobLogs.$inferSelect;
export type NewJobLog = typeof jobLogs.$inferInsert;
export type JobLogLevel = (typeof jobLogLevelEnum.enumValues)[number];

// Typed metadata interfaces for common use cases
export interface ToolCallMetadata {
  toolName: string;
  toolStatus: 'started' | 'completed' | 'failed';
  duration?: number; // milliseconds
  cost?: number; // USD
  error?: {
    code: string;
    message: string;
  };
}

export interface EntityProcessingMetadata {
  entityId: string;
  entityType: 'contact' | 'lead';
  entityName?: string;
}

export interface ProgressMetadata {
  current: number;
  total: number;
  percentage?: number;
}

export interface JobLogMetadata {
  toolCall?: ToolCallMetadata;
  entity?: EntityProcessingMetadata;
  progress?: ProgressMetadata;
  [key: string]: unknown;
}
