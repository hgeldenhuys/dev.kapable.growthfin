/**
 * Campaign Execution Routes
 * Activate, pause, resume, and cancel campaigns
 */

import { Elysia, t } from 'elysia';
import { campaignService } from '../services/campaigns';
import { timelineService } from '../services/timeline';
import { jobQueue } from '../../../lib/queue';
import type { ExecuteCampaignJob } from '../../../lib/queue';

export const campaignsExecutionRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // CAMPAIGN EXECUTION
  // ============================================================================
  .post(
    '/:id/activate',
    async ({ db, params, query, body, set, userId: ctxUserId }) => {
      const wsId = body.workspaceId || query.workspaceId;
      const actorId = body.userId || ctxUserId;
      const campaign = await campaignService.getById(db, params.id, wsId);

      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      if (campaign.status !== 'draft' && campaign.status !== 'paused') {
        set.status = 400;
        return { error: 'Campaign must be in draft or paused status to activate' };
      }

      // Get campaign with relationships
      const campaignWithData = await db.query.crmCampaigns.findFirst({
        where: (campaigns, { eq, and }) =>
          and(eq(campaigns.id, params.id), eq(campaigns.workspaceId, wsId)),
        with: {
          messages: true,
          recipients: true,
        },
      });

      if (!campaignWithData) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      if (!campaignWithData.messages.length) {
        set.status = 400;
        return { error: 'Campaign must have at least one message' };
      }

      if (!campaignWithData.recipients.length) {
        set.status = 400;
        return { error: 'Campaign must have recipients' };
      }

      // Update campaign status
      await campaignService.update(db, params.id, wsId, {
        status: 'active',
        startedAt: new Date(),
        updatedBy: actorId,
      });

      // Enqueue job for background processing
      await jobQueue.send<ExecuteCampaignJob>(
        'execute-campaign',
        {
          campaignId: params.id,
          messageId: campaignWithData.messages[0].id,
          workspaceId: wsId,
        },
        {
          priority: 1,
          retryLimit: 3,
        }
      );

      // Timeline event
      await timelineService.create(db, {
        workspaceId: wsId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.started',
        eventCategory: 'system',
        eventLabel: 'Campaign Started',
        summary: `Campaign "${campaign.name}" was activated`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: actorId,
        actorName: 'User',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
          totalRecipients: campaignWithData.recipients.length,
        },
      });

      return { success: true, status: 'active' };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.Optional(t.String()) }),
      body: t.Object({
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Activate campaign',
        description: 'Start campaign execution by queuing background job',
      },
    }
  )
  .post(
    '/:id/pause',
    async ({ db, params, query, body, set, userId: ctxUserId }) => {
      const wsId = body.workspaceId || query.workspaceId;
      const actorId = body.userId || ctxUserId;
      const campaign = await campaignService.getById(db, params.id, wsId);

      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      if (campaign.status !== 'active') {
        set.status = 400;
        return { error: 'Only active campaigns can be paused' };
      }

      await campaignService.update(db, params.id, wsId, {
        status: 'paused',
        updatedBy: actorId,
      });

      await timelineService.create(db, {
        workspaceId: wsId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.paused',
        eventCategory: 'system',
        eventLabel: 'Campaign Paused',
        summary: `Campaign "${campaign.name}" was paused`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: actorId,
        actorName: 'User',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
        },
      });

      return { success: true, status: 'paused' };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.Optional(t.String()) }),
      body: t.Object({
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Pause campaign',
        description: 'Pause an active campaign',
      },
    }
  )
  .post(
    '/:id/resume',
    async ({ db, params, query, body, set, userId: ctxUserId }) => {
      const wsId = body.workspaceId || query.workspaceId;
      const actorId = body.userId || ctxUserId;
      const campaign = await campaignService.getById(db, params.id, wsId);

      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      if (campaign.status !== 'paused') {
        set.status = 400;
        return { error: 'Only paused campaigns can be resumed' };
      }

      await campaignService.update(db, params.id, wsId, {
        status: 'active',
        updatedBy: actorId,
      });

      await timelineService.create(db, {
        workspaceId: wsId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.resumed',
        eventCategory: 'system',
        eventLabel: 'Campaign Resumed',
        summary: `Campaign "${campaign.name}" was resumed`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: actorId,
        actorName: 'User',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
        },
      });

      return { success: true, status: 'active' };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.Optional(t.String()) }),
      body: t.Object({
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Resume campaign',
        description: 'Resume a paused campaign',
      },
    }
  )
  .post(
    '/:id/cancel',
    async ({ db, params, query, body, set, userId: ctxUserId }) => {
      const wsId = body.workspaceId || query.workspaceId;
      const actorId = body.userId || ctxUserId;
      const campaign = await campaignService.getById(db, params.id, wsId);

      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      if (campaign.status === 'completed' || campaign.status === 'cancelled') {
        set.status = 400;
        return { error: 'Campaign is already completed or cancelled' };
      }

      await campaignService.update(db, params.id, wsId, {
        status: 'cancelled',
        endedAt: new Date(),
        updatedBy: actorId,
      });

      await timelineService.create(db, {
        workspaceId: wsId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.cancelled',
        eventCategory: 'system',
        eventLabel: 'Campaign Cancelled',
        summary: `Campaign "${campaign.name}" was cancelled`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: actorId,
        actorName: 'User',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
        },
      });

      return { success: true, status: 'cancelled' };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.Optional(t.String()) }),
      body: t.Object({
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Cancel campaign',
        description: 'Cancel an active or paused campaign',
      },
    }
  );
