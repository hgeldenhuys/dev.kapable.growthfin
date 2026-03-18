/**
 * Sandbox API Routes
 * Endpoints for managing sandbox mode — intercepted messages, event simulation, configuration.
 */

import { Elysia, t } from 'elysia';
import { sandboxService } from '../../../lib/channels/sandbox-service';

export const sandboxRoutes = new Elysia({ prefix: '/sandbox' })
  /**
   * GET /api/v1/crm/sandbox/config
   * Get workspace sandbox configuration
   */
  .get(
    '/config',
    async ({ query }) => {
      const { workspaceId } = query;
      const config = await sandboxService.getConfig(workspaceId);
      const enabled = await sandboxService.isSandboxEnabled(workspaceId);

      return {
        enabled,
        config: config || {
          enabled: false,
          voiceTestNumber: null,
          autoSimulateDelivery: true,
          autoSimulateDelayMs: 2000,
        },
        envOverride: process.env.SANDBOX_MODE === 'true',
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  /**
   * POST /api/v1/crm/sandbox/config
   * Update workspace sandbox configuration
   */
  .post(
    '/config',
    async ({ query, body }) => {
      const { workspaceId } = query;

      await sandboxService.updateConfig(workspaceId, body);
      const config = await sandboxService.getConfig(workspaceId);

      return {
        success: true,
        config,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        voiceTestNumber: t.Optional(t.String()),
        autoSimulateDelivery: t.Optional(t.Boolean()),
        autoSimulateDelayMs: t.Optional(t.Number()),
      }),
    }
  )

  /**
   * GET /api/v1/crm/sandbox/messages
   * List sandbox messages with optional filters
   */
  .get(
    '/messages',
    async ({ query }) => {
      const { workspaceId, channel, direction, contactId, campaignId, status, limit, offset } = query;

      const messages = await sandboxService.listMessages(
        workspaceId,
        {
          channel: channel || undefined,
          direction: direction || undefined,
          contactId: contactId || undefined,
          campaignId: campaignId || undefined,
          status: status || undefined,
        },
        limit ? parseInt(limit) : 50,
        offset ? parseInt(offset) : 0
      );

      return { messages, count: messages.length };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        channel: t.Optional(t.String()),
        direction: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        campaignId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )

  /**
   * GET /api/v1/crm/sandbox/messages/:id
   * Get a single sandbox message with full content
   */
  .get(
    '/messages/:id',
    async ({ params, query }) => {
      const { id } = params;
      const { workspaceId } = query;

      const message = await sandboxService.getMessage(id, workspaceId);
      if (!message) {
        return { error: 'Message not found' };
      }

      return { message };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  /**
   * POST /api/v1/crm/sandbox/messages/:id/reply
   * Simulate an inbound reply to a sandbox message
   */
  .post(
    '/messages/:id/reply',
    async ({ params, query, body }) => {
      const { id } = params;
      const { workspaceId } = query;
      const { content } = body;

      const replyId = await sandboxService.simulateReply(id, content, workspaceId);

      return { success: true, replyId };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        content: t.String(),
      }),
    }
  )

  /**
   * POST /api/v1/crm/sandbox/messages/:id/event
   * Simulate a webhook event (delivered, opened, clicked, bounced, etc.)
   */
  .post(
    '/messages/:id/event',
    async ({ params, query, body }) => {
      const { id } = params;
      const { workspaceId } = query;
      const { eventType, metadata } = body;

      await sandboxService.simulateEvent(id, eventType, workspaceId, metadata);

      return { success: true, eventType };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        eventType: t.String(),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }
  )

  /**
   * GET /api/v1/crm/sandbox/stats
   * Get aggregate sandbox activity stats by channel
   */
  .get(
    '/stats',
    async ({ query }) => {
      const { workspaceId } = query;
      const stats = await sandboxService.getStats(workspaceId);

      return { stats };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  /**
   * DELETE /api/v1/crm/sandbox/messages
   * Clear all sandbox data for workspace
   */
  .delete(
    '/messages',
    async ({ query }) => {
      const { workspaceId } = query;
      const count = await sandboxService.clearMessages(workspaceId);

      return { success: true, deletedCount: count };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
    }
  );
