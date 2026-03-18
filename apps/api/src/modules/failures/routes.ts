/**
 * Job Failures Routes
 * Real-time streaming of failed PgBoss jobs
 */

import { Elysia, t } from 'elysia';
import { sql } from 'drizzle-orm';

export const failuresRoutes = new Elysia({ prefix: '/failures' })
  /**
   * Get recent failed jobs
   */
  .get(
    '/recent',
    async ({ query, db }) => {
      const seconds = query.seconds || 300; // Default 5 minutes
      const since = new Date(Date.now() - seconds * 1000);
      const serverTimestamp = new Date().toISOString();

      // Query PgBoss failed jobs
      const failures = await db.execute<{
        id: string;
        name: string;
        data: any;
        output: any;
        retry_count: number;
        retry_limit: number;
        completed_on: Date;
        dead_letter: string | null;
      }>(sql`
        SELECT
          id,
          name,
          data,
          output,
          retry_count,
          retry_limit,
          completed_on,
          dead_letter
        FROM pgboss.job
        WHERE state = 'failed'
          AND completed_on >= ${since.toISOString()}
        ORDER BY completed_on DESC
        LIMIT 100
      `);

      return {
        serverTimestamp,
        failures: failures.rows,
      };
    },
    {
      query: t.Object({
        seconds: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Failures'],
        summary: 'Get recent failed jobs',
        description: 'Returns failed PgBoss jobs from last N seconds.',
      },
    }
  );
