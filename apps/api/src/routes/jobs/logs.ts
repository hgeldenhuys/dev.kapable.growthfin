/**
 * Job Logs Routes (US-008)
 * REST endpoints for job log retrieval (CQRS query side)
 *
 * Endpoints:
 * - GET /jobs/:jobId/logs - Get recent logs for a job (initial load)
 * - GET /jobs/:jobId/profile - Get job log statistics
 *
 * Architecture:
 * - Follows CQRS pattern: GET /logs (snapshot) + GET /sse (deltas)
 * - Uses JobLoggingService for database queries
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { jobLoggingService } from '../../services/job-logging.service';

export const jobLogsRoutes = new Elysia({ prefix: '/jobs' })
  /**
   * GET /:jobId/logs - Get recent logs for a job
   *
   * Returns most recent logs for initial load before subscribing to SSE.
   * Supports pagination via limit and since parameters.
   */
  .get(
    '/:jobId/logs',
    async ({ params, query }) => {
      const { jobId } = params;
      const { workspaceId, limit, since } = query;

      const logs = await jobLoggingService.getLogsForJob(db, workspaceId, jobId, {
        limit: limit ? parseInt(limit, 10) : 100,
        since: since ? new Date(since) : undefined,
      });

      return {
        jobId,
        workspaceId,
        logs,
        count: logs.length,
      };
    },
    {
      params: t.Object({
        jobId: t.String({ description: 'Job ID (UUID)', format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({
          description: 'Workspace ID for authorization',
          format: 'uuid',
        }),
        limit: t.Optional(
          t.String({ description: 'Maximum number of logs to return (default: 100)' })
        ),
        since: t.Optional(
          t.String({ description: 'ISO timestamp to filter logs after' })
        ),
      }),
      detail: {
        tags: ['Job Observability'],
        summary: 'Get recent logs for a job',
        description:
          'Returns most recent logs for initial load. Use SSE endpoint for real-time updates.',
      },
    }
  )

  /**
   * GET /:jobId/profile - Get job log statistics
   *
   * Returns summary statistics about a job's logs.
   * Useful for dashboards and quick status checks.
   */
  .get(
    '/:jobId/profile',
    async ({ params, query }) => {
      const { jobId } = params;
      const { workspaceId } = query;

      const profile = await jobLoggingService.getJobProfile(db, workspaceId, jobId);

      return {
        jobId,
        workspaceId,
        ...profile,
      };
    },
    {
      params: t.Object({
        jobId: t.String({ description: 'Job ID (UUID)', format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({
          description: 'Workspace ID for authorization',
          format: 'uuid',
        }),
      }),
      detail: {
        tags: ['Job Observability'],
        summary: 'Get job log statistics',
        description:
          'Returns summary statistics including log counts by level, first/last log times.',
      },
    }
  );
