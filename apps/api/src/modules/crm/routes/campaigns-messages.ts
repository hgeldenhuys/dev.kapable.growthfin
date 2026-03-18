/**
 * Campaign Messages Routes
 * Message creation, management, and preview
 */

import { Elysia, t } from 'elysia';
import { campaignService, campaignMessageService } from '../services/campaigns';

export const campaignsMessagesRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // CAMPAIGN MESSAGES
  // ============================================================================
  .post(
    '/:id/messages',
    async ({ db, params, body, set }) => {
      const campaign = await campaignService.getById(db, params.id, body.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      // Validate email-specific fields
      if (body.channel === 'email') {
        if (!body.subject) {
          set.status = 400;
          return { error: 'Subject is required for email messages' };
        }
        if (!body.sendFromEmail) {
          set.status = 400;
          return { error: 'Send from email is required for email messages' };
        }
      }

      // Validate A/B testing fields if provided
      if (body.testPercentage !== undefined && body.testPercentage !== null) {
        if (body.testPercentage < 0 || body.testPercentage > 100) {
          set.status = 400;
          return { error: 'Test percentage must be between 0 and 100' };
        }

        // Check if other messages exist for this campaign
        const existingMessages = await campaignMessageService.list(db, params.id, body.workspaceId);

        // Calculate total percentage including this new message
        const totalPercentage =
          existingMessages.reduce((sum, m) => sum + (m.testPercentage || 0), 0) + body.testPercentage;

        if (totalPercentage > 100) {
          set.status = 400;
          return {
            error: `Test percentages would exceed 100% (currently ${totalPercentage}%). Adjust existing messages first.`,
          };
        }
      }

      const message = await campaignMessageService.create(db, {
        ...body,
        campaignId: params.id,
      });

      return message;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        channel: t.String(), // email|sms|whatsapp
        subject: t.Optional(t.String()),
        bodyText: t.String(),
        bodyHtml: t.Optional(t.String()),
        previewText: t.Optional(t.String()),
        sendFromName: t.Optional(t.String()),
        sendFromEmail: t.Optional(t.String()),
        replyToEmail: t.Optional(t.String()),
        mergeTags: t.Optional(t.Array(t.String())),
        fallbackValues: t.Optional(t.Any()),
        trackOpens: t.Optional(t.Boolean()),
        trackClicks: t.Optional(t.Boolean()),
        // A/B Testing fields
        variantName: t.Optional(t.String()),
        isControl: t.Optional(t.Boolean()),
        testPercentage: t.Optional(t.Number()),
        // Drip Campaign sequence fields
        sequenceOrder: t.Optional(t.Number()),
        delayAmount: t.Optional(t.Number()),
        delayUnit: t.Optional(t.Union([
          t.Literal('minutes'),
          t.Literal('hours'),
          t.Literal('days'),
          t.Literal('weeks'),
        ])),
        triggerType: t.Optional(t.Union([
          t.Literal('time_based'),
          t.Literal('action_based'),
        ])),
        triggerAction: t.Optional(t.Union([
          t.Literal('opened'),
          t.Literal('clicked'),
          t.Literal('not_opened'),
          t.Literal('not_clicked'),
        ])),
        fallbackDelayDays: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Create message',
        description: 'Create campaign message with optional A/B testing parameters',
      },
    }
  )
  .get(
    '/:id/messages',
    async ({ db, params, query, set }) => {
      const campaign = await campaignService.getById(db, params.id, query.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      return campaignMessageService.list(db, params.id, query.workspaceId);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'List messages',
        description: 'List campaign messages',
      },
    }
  )
  .patch(
    '/:id/messages/:msgId',
    async ({ db, params, query, body, set }) => {
      const message = await campaignMessageService.update(
        db,
        params.msgId,
        query.workspaceId,
        body
      );

      if (!message) {
        set.status = 404;
        return { error: 'Message not found' };
      }

      return message;
    },
    {
      params: t.Object({ id: t.String(), msgId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        subject: t.Optional(t.String()),
        bodyText: t.Optional(t.String()),
        bodyHtml: t.Optional(t.String()),
        previewText: t.Optional(t.String()),
        sendFromName: t.Optional(t.String()),
        sendFromEmail: t.Optional(t.String()),
        replyToEmail: t.Optional(t.String()),
        mergeTags: t.Optional(t.Array(t.String())),
        fallbackValues: t.Optional(t.Any()),
        trackOpens: t.Optional(t.Boolean()),
        trackClicks: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Update message',
        description: 'Update campaign message',
      },
    }
  )
  .delete(
    '/:id/messages/:msgId',
    async ({ db, params, query, set }) => {
      const message = await campaignMessageService.delete(db, params.msgId, query.workspaceId);

      if (!message) {
        set.status = 404;
        return { error: 'Message not found or already deleted' };
      }

      return { success: true };
    },
    {
      params: t.Object({ id: t.String(), msgId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Delete message',
        description: 'Soft delete campaign message',
      },
    }
  )

  // ============================================================================
  // MESSAGE PREVIEW
  // ============================================================================
  .get(
    '/:id/preview-message',
    async ({ db, params, query, set }) => {
      if (!query.messageId || !query.contactId) {
        set.status = 400;
        return { error: 'messageId and contactId are required' };
      }

      const preview = await campaignMessageService.previewMessage(
        db,
        query.messageId,
        query.contactId,
        query.workspaceId
      );

      if (!preview) {
        set.status = 404;
        return { error: 'Message or contact not found' };
      }

      return preview;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        messageId: t.String(),
        contactId: t.String(),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Preview message',
        description: 'Preview message with merge tags replaced for a specific contact',
      },
    }
  );
