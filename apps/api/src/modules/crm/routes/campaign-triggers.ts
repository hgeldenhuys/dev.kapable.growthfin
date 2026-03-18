/**
 * Campaign Triggers Routes
 * API endpoints for event-based campaign triggers
 */

import { Elysia, t } from 'elysia';
import {
  createTrigger,
  getCampaignTriggers,
  getTriggerById,
  updateTrigger,
  pauseTrigger,
  activateTrigger,
  deleteTrigger,
  previewTriggerMatches,
} from '../services/campaign-triggers';

export const campaignTriggersRoutes = new Elysia({ prefix: '/campaign-triggers' })
  // Create a trigger
  .post(
    '/',
    async ({ db, body, set }) => {
      try {
        const trigger = await createTrigger(db, {
          campaignId: body.campaignId,
          workspaceId: body.workspaceId,
          name: body.name,
          description: body.description,
          triggerEvent: body.triggerEvent,
          conditions: body.conditions,
          maxTriggersPerLeadPerDay: body.maxTriggersPerLeadPerDay,
          userId: body.userId,
        });

        return trigger;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create trigger',
        };
      }
    },
    {
      body: t.Object({
        campaignId: t.String(),
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        triggerEvent: t.Union([
          t.Literal('lead_created'),
          t.Literal('score_changed'),
          t.Literal('stage_changed'),
          t.Literal('activity_created'),
          t.Literal('email_opened'),
          t.Literal('link_clicked'),
        ]),
        conditions: t.Any(), // TriggerConditionGroup { all?: [], any?: [] }
        maxTriggersPerLeadPerDay: t.Optional(t.Number()),
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Create campaign trigger',
        description: 'Create an event-based campaign trigger with conditions',
      },
    }
  )

  // List all triggers
  .get(
    '/',
    async ({ db, query }) => {
      const filters: any = {};

      if (query.status) {
        filters.status = query.status;
      }

      if (query.campaignId) {
        filters.campaignId = query.campaignId;
      }

      if (query.triggerEvent) {
        filters.triggerEvent = query.triggerEvent;
      }

      const triggers = await getCampaignTriggers(db, query.workspaceId, filters);

      return { triggers };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(
          t.Union([t.Literal('active'), t.Literal('paused'), t.Literal('deleted')])
        ),
        campaignId: t.Optional(t.String()),
        triggerEvent: t.Optional(
          t.Union([
            t.Literal('lead_created'),
            t.Literal('score_changed'),
            t.Literal('stage_changed'),
            t.Literal('activity_created'),
            t.Literal('email_opened'),
            t.Literal('link_clicked'),
          ])
        ),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'List campaign triggers',
        description: 'List all campaign triggers with optional filters',
      },
    }
  )

  // Get trigger by ID
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const trigger = await getTriggerById(db, params.id, query.workspaceId);

      if (!trigger) {
        set.status = 404;
        return { error: 'Trigger not found' };
      }

      return trigger;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Get trigger by ID',
        description: 'Get campaign trigger details',
      },
    }
  )

  // Preview trigger matches
  .get(
    '/:id/preview',
    async ({ db, params, query, set }) => {
      try {
        const matchCount = await previewTriggerMatches(db, params.id, query.workspaceId);

        return {
          triggerId: params.id,
          matchingLeads: matchCount,
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to preview matches',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Preview trigger matches',
        description: 'Preview how many leads currently match the trigger conditions',
      },
    }
  )

  // Update trigger
  .patch(
    '/:id',
    async ({ db, params, query, body, set }) => {
      try {
        const trigger = await updateTrigger(
          db,
          params.id,
          query.workspaceId,
          {
            name: body.name,
            description: body.description,
            conditions: body.conditions,
            maxTriggersPerLeadPerDay: body.maxTriggersPerLeadPerDay,
          },
          query.userId
        );

        return trigger;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to update trigger',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        conditions: t.Optional(t.Any()),
        maxTriggersPerLeadPerDay: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Update trigger',
        description: 'Update trigger details and conditions',
      },
    }
  )

  // Pause trigger
  .patch(
    '/:id/pause',
    async ({ db, params, query, set }) => {
      try {
        const trigger = await pauseTrigger(db, params.id, query.workspaceId, query.userId);

        return trigger;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to pause trigger',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Pause trigger',
        description: 'Pause an active trigger',
      },
    }
  )

  // Activate trigger
  .patch(
    '/:id/activate',
    async ({ db, params, query, set }) => {
      try {
        const trigger = await activateTrigger(db, params.id, query.workspaceId, query.userId);

        return trigger;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to activate trigger',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Activate trigger',
        description: 'Activate a paused trigger',
      },
    }
  )

  // Delete trigger
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      try {
        const trigger = await deleteTrigger(db, params.id, query.workspaceId, query.userId);

        return { success: true, trigger };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to delete trigger',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Delete trigger',
        description: 'Soft delete a campaign trigger',
      },
    }
  );
