/**
 * Dev Module
 *
 * Development and testing utilities.
 * Only active when TEST_MODE=true or NODE_ENV=development.
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { crmMockMessages } from '@agios/db';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { simulateInboundMessage, clearMockMessages, isTestModeEnabled } from '../../test/mocks/webhook-server';

/**
 * Check if dev routes should be enabled
 */
function isDevEnabled(): boolean {
  return isTestModeEnabled() || process.env.NODE_ENV === 'development';
}

export const devModule = new Elysia({ prefix: '/dev' })
  // Guard: Only enable in dev/test mode
  .onBeforeHandle(({ set }) => {
    if (!isDevEnabled()) {
      set.status = 403;
      return { error: 'Dev routes are only available in TEST_MODE or development' };
    }
  })

  // GET /api/v1/dev/mock-inbox - List mock messages
  .get(
    '/mock-inbox',
    async ({ query }) => {
      const { workspaceId, channel } = query;

      if (!workspaceId) {
        return { error: 'workspaceId is required' };
      }

      const conditions = [
        eq(crmMockMessages.workspaceId, workspaceId),
        isNull(crmMockMessages.deletedAt),
      ];

      if (channel) {
        conditions.push(eq(crmMockMessages.channel, channel));
      }

      const messages = await db.query.crmMockMessages.findMany({
        where: and(...conditions),
        orderBy: [desc(crmMockMessages.createdAt)],
      });

      return messages;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        channel: t.Optional(t.Union([t.Literal('email'), t.Literal('sms')])),
      }),
      detail: {
        summary: 'List mock messages',
        description: 'Get all mock messages for a workspace',
        tags: ['Dev'],
      },
    }
  )

  // POST /api/v1/dev/mock-inbox/reply - Simulate inbound reply
  .post(
    '/mock-inbox/reply',
    async ({ body }) => {
      const { workspaceId, channel, from, to, content, subject, inReplyTo } = body;

      const event = await simulateInboundMessage({
        workspaceId,
        channel,
        from,
        to,
        content,
        subject,
        inReplyTo,
      });

      return {
        success: true,
        event,
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        channel: t.Union([t.Literal('email'), t.Literal('sms')]),
        from: t.String(),
        to: t.String(),
        content: t.String(),
        subject: t.Optional(t.String()),
        inReplyTo: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Simulate inbound reply',
        description: 'Inject an inbound message as if the recipient replied',
        tags: ['Dev'],
      },
    }
  )

  // DELETE /api/v1/dev/mock-inbox - Clear mock messages
  .delete(
    '/mock-inbox',
    async ({ query }) => {
      const { workspaceId } = query;

      if (!workspaceId) {
        return { error: 'workspaceId is required' };
      }

      await clearMockMessages(workspaceId);

      return { success: true };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        summary: 'Clear mock messages',
        description: 'Delete all mock messages for a workspace',
        tags: ['Dev'],
      },
    }
  )

  // GET /api/v1/dev/test-mode - Check if test mode is enabled
  .get(
    '/test-mode',
    async () => {
      return {
        testMode: isTestModeEnabled(),
        devEnabled: isDevEnabled(),
        nodeEnv: process.env.NODE_ENV,
      };
    },
    {
      detail: {
        summary: 'Check test mode',
        description: 'Check if TEST_MODE is enabled',
        tags: ['Dev'],
      },
    }
  );
