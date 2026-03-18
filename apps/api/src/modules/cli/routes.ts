/**
 * CLI Sessions Routes
 * Endpoints for CLI heartbeat monitoring
 */

import { Elysia, t } from 'elysia';
import { upsertHeartbeat, getActiveSessions, deleteSession } from './service';

export const cliRoutes = new Elysia({ prefix: '/cli' })
  .post(
    '/heartbeat',
    async ({ body }) => {
      const session = await upsertHeartbeat({
        sessionId: body.sessionId,
        projectId: body.projectId,
        command: body.command,
        metadata: body.metadata,
      });

      return {
        success: true,
        session: {
          id: session.id,
          lastHeartbeat: session.lastHeartbeat,
        },
      };
    },
    {
      body: t.Object({
        sessionId: t.String({ description: 'CLI session ID (UUID)' }),
        projectId: t.String({ description: 'Project ID' }),
        command: t.Union([t.Literal('listen'), t.Literal('watch')], {
          description: 'CLI command type',
        }),
        metadata: t.Optional(
          t.Object({
            cliVersion: t.Optional(t.String()),
            os: t.Optional(t.String()),
            nodeVersion: t.Optional(t.String()),
          })
        ),
      }),
      detail: {
        tags: ['CLI'],
        summary: 'Send CLI heartbeat',
        description: 'Upsert CLI session and update last heartbeat timestamp',
      },
    }
  )

  .get(
    '/sessions',
    async ({ query }) => {
      const sessions = await getActiveSessions(query.projectId);

      return {
        sessions,
        count: sessions.length,
      };
    },
    {
      query: t.Object({
        projectId: t.Optional(t.String({ description: 'Filter by project ID' })),
      }),
      detail: {
        tags: ['CLI'],
        summary: 'Get active CLI sessions',
        description: 'Fetch CLI sessions with heartbeat in last 2 minutes',
      },
    }
  )

  .delete(
    '/sessions/:sessionId',
    async ({ params }) => {
      await deleteSession(params.sessionId);

      return {
        success: true,
        message: 'Session deleted',
      };
    },
    {
      params: t.Object({
        sessionId: t.String({ description: 'CLI session ID to delete' }),
      }),
      detail: {
        tags: ['CLI'],
        summary: 'Delete CLI session',
        description: 'Remove CLI session (called on graceful exit)',
      },
    }
  );
