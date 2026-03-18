/**
 * Job Logging Service
 * Generic logging infrastructure for all async job types
 *
 * Design: INSERT-only (immutable) following event-driven architecture pattern
 * Usage: Workers call log() to record progress events that stream to UI via SSE
 *
 * US-008: Generic Job Logs Infrastructure
 */

import type { Database } from '@agios/db';
import {
  jobLogs,
  type NewJobLog,
  type JobLog,
  type JobLogLevel,
  type JobLogMetadata,
} from '@agios/db';
import { eq, and, desc, sql } from 'drizzle-orm';

// Job types that can use this logging infrastructure
export type JobType =
  | 'enrichment'
  | 'export'
  | 'segmentation'
  | 'scoring'
  | 'import'
  | 'bulk-operation';

// Typed log entry for convenience
export interface LogEntry {
  workspaceId: string;
  jobId: string;
  jobType: JobType;
  level: JobLogLevel;
  message: string;
  metadata?: JobLogMetadata;
}

// Tool call specific log entry
export interface ToolCallLogEntry {
  workspaceId: string;
  jobId: string;
  jobType: JobType;
  toolName: string;
  toolStatus: 'started' | 'completed' | 'failed';
  duration?: number;
  cost?: number;
  error?: { code: string; message: string };
  entityId?: string;
  entityType?: 'contact' | 'lead';
}

// Progress log entry
export interface ProgressLogEntry {
  workspaceId: string;
  jobId: string;
  jobType: JobType;
  current: number;
  total: number;
  message?: string;
}

export const jobLoggingService = {
  /**
   * Log a generic message for a job
   */
  async log(db: Database, entry: LogEntry): Promise<JobLog> {
    const [log] = await db
      .insert(jobLogs)
      .values({
        workspaceId: entry.workspaceId,
        jobId: entry.jobId,
        jobType: entry.jobType,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata ?? {},
      })
      .returning();

    return log;
  },

  /**
   * Log info level message
   */
  async info(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    message: string,
    metadata?: JobLogMetadata
  ): Promise<JobLog> {
    return this.log(db, {
      workspaceId,
      jobId,
      jobType,
      level: 'info',
      message,
      metadata,
    });
  },

  /**
   * Log warning level message
   */
  async warn(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    message: string,
    metadata?: JobLogMetadata
  ): Promise<JobLog> {
    return this.log(db, {
      workspaceId,
      jobId,
      jobType,
      level: 'warn',
      message,
      metadata,
    });
  },

  /**
   * Log error level message
   */
  async error(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    message: string,
    metadata?: JobLogMetadata
  ): Promise<JobLog> {
    return this.log(db, {
      workspaceId,
      jobId,
      jobType,
      level: 'error',
      message,
      metadata,
    });
  },

  /**
   * Log debug level message
   */
  async debug(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    message: string,
    metadata?: JobLogMetadata
  ): Promise<JobLog> {
    return this.log(db, {
      workspaceId,
      jobId,
      jobType,
      level: 'debug',
      message,
      metadata,
    });
  },

  /**
   * Log a tool call event (started, completed, or failed)
   */
  async logToolCall(db: Database, entry: ToolCallLogEntry): Promise<JobLog> {
    const statusMessages: Record<string, string> = {
      started: `Tool "${entry.toolName}" started`,
      completed: `Tool "${entry.toolName}" completed${entry.duration ? ` in ${entry.duration}ms` : ''}${entry.cost ? ` ($${entry.cost.toFixed(6)})` : ''}`,
      failed: `Tool "${entry.toolName}" failed: ${entry.error?.message ?? 'Unknown error'}`,
    };

    const message = statusMessages[entry.toolStatus];
    const level: JobLogLevel = entry.toolStatus === 'failed' ? 'error' : 'info';

    return this.log(db, {
      workspaceId: entry.workspaceId,
      jobId: entry.jobId,
      jobType: entry.jobType,
      level,
      message,
      metadata: {
        toolCall: {
          toolName: entry.toolName,
          toolStatus: entry.toolStatus,
          duration: entry.duration,
          cost: entry.cost,
          error: entry.error,
        },
        entity: entry.entityId
          ? {
              entityId: entry.entityId,
              entityType: entry.entityType ?? 'contact',
            }
          : undefined,
      },
    });
  },

  /**
   * Log progress update
   */
  async logProgress(db: Database, entry: ProgressLogEntry): Promise<JobLog> {
    const percentage = Math.round((entry.current / entry.total) * 100);
    const message =
      entry.message ??
      `Progress: ${entry.current}/${entry.total} (${percentage}%)`;

    return this.log(db, {
      workspaceId: entry.workspaceId,
      jobId: entry.jobId,
      jobType: entry.jobType,
      level: 'info',
      message,
      metadata: {
        progress: {
          current: entry.current,
          total: entry.total,
          percentage,
        },
      },
    });
  },

  /**
   * Log job start event
   */
  async logJobStart(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    details?: Record<string, unknown>
  ): Promise<JobLog> {
    return this.info(db, workspaceId, jobId, jobType, `Job started`, details);
  },

  /**
   * Log job completion event
   */
  async logJobComplete(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    summary?: { processed: number; failed: number; cost?: number }
  ): Promise<JobLog> {
    const message = summary
      ? `Job completed: ${summary.processed} processed, ${summary.failed} failed${summary.cost ? `, $${summary.cost.toFixed(4)} cost` : ''}`
      : 'Job completed';

    return this.info(db, workspaceId, jobId, jobType, message, summary);
  },

  /**
   * Log job failure event
   */
  async logJobFailed(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    error: string | Error
  ): Promise<JobLog> {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.error(
      db,
      workspaceId,
      jobId,
      jobType,
      `Job failed: ${errorMessage}`,
      {
        error: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
      }
    );
  },

  /**
   * Log entity processing start
   */
  async logEntityStart(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    entityId: string,
    entityType: 'contact' | 'lead',
    entityName?: string
  ): Promise<JobLog> {
    const name = entityName ? ` "${entityName}"` : '';
    return this.info(
      db,
      workspaceId,
      jobId,
      jobType,
      `Processing ${entityType}${name}`,
      {
        entity: { entityId, entityType, entityName },
      }
    );
  },

  /**
   * Log entity processing complete
   */
  async logEntityComplete(
    db: Database,
    workspaceId: string,
    jobId: string,
    jobType: JobType,
    entityId: string,
    entityType: 'contact' | 'lead',
    result?: { score?: number; cost?: number }
  ): Promise<JobLog> {
    const details = [];
    if (result?.score !== undefined) details.push(`score: ${result.score}`);
    if (result?.cost !== undefined)
      details.push(`cost: $${result.cost.toFixed(6)}`);
    const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';

    return this.info(
      db,
      workspaceId,
      jobId,
      jobType,
      `${entityType} processed${suffix}`,
      {
        entity: { entityId, entityType },
        ...result,
      }
    );
  },

  /**
   * Get recent logs for a job (for initial load before SSE subscription)
   */
  async getRecentLogs(
    db: Database,
    jobId: string,
    limit: number = 100
  ): Promise<JobLog[]> {
    return db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, jobId))
      .orderBy(desc(jobLogs.createdAt))
      .limit(limit);
  },

  /**
   * Get logs for a job with workspace verification
   */
  async getLogsForJob(
    db: Database,
    workspaceId: string,
    jobId: string,
    options?: { limit?: number; since?: Date }
  ): Promise<JobLog[]> {
    const conditions = [
      eq(jobLogs.workspaceId, workspaceId),
      eq(jobLogs.jobId, jobId),
    ];

    if (options?.since) {
      conditions.push(sql`${jobLogs.createdAt} > ${options.since}`);
    }

    return db
      .select()
      .from(jobLogs)
      .where(and(...conditions))
      .orderBy(desc(jobLogs.createdAt))
      .limit(options?.limit ?? 100);
  },

  /**
   * Get job profile (summary of log levels)
   */
  async getJobProfile(
    db: Database,
    workspaceId: string,
    jobId: string
  ): Promise<{
    totalLogs: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    debugCount: number;
    firstLogAt: Date | null;
    lastLogAt: Date | null;
  }> {
    const [result] = await db
      .select({
        totalLogs: sql<number>`count(*)::int`,
        infoCount: sql<number>`count(*) filter (where ${jobLogs.level} = 'info')::int`,
        warnCount: sql<number>`count(*) filter (where ${jobLogs.level} = 'warn')::int`,
        errorCount: sql<number>`count(*) filter (where ${jobLogs.level} = 'error')::int`,
        debugCount: sql<number>`count(*) filter (where ${jobLogs.level} = 'debug')::int`,
        firstLogAt: sql<Date | null>`min(${jobLogs.createdAt})`,
        lastLogAt: sql<Date | null>`max(${jobLogs.createdAt})`,
      })
      .from(jobLogs)
      .where(
        and(eq(jobLogs.workspaceId, workspaceId), eq(jobLogs.jobId, jobId))
      );

    return {
      totalLogs: result?.totalLogs ?? 0,
      infoCount: result?.infoCount ?? 0,
      warnCount: result?.warnCount ?? 0,
      errorCount: result?.errorCount ?? 0,
      debugCount: result?.debugCount ?? 0,
      firstLogAt: result?.firstLogAt ?? null,
      lastLogAt: result?.lastLogAt ?? null,
    };
  },
};
