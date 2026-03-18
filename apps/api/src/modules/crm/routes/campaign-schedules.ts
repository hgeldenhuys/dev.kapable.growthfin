/**
 * Campaign Schedules Routes
 * API endpoints for one-time campaign scheduling
 */

import { Elysia, t } from 'elysia';
import {
  scheduleOneTimeCampaign,
  getCampaignSchedules,
  getScheduleById,
  rescheduleCampaign,
  cancelSchedule,
} from '../services/campaign-scheduling';

export const campaignSchedulesRoutes = new Elysia({ prefix: '/campaign-schedules' })
  // Create a one-time schedule
  .post(
    '/',
    async ({ db, body, set }) => {
      try {
        const schedule = await scheduleOneTimeCampaign(db, {
          campaignId: body.campaignId,
          workspaceId: body.workspaceId,
          scheduledAt: new Date(body.scheduledAt),
          timezone: body.timezone,
          userId: body.userId,
        });

        return schedule;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create schedule',
        };
      }
    },
    {
      body: t.Object({
        campaignId: t.String(),
        workspaceId: t.String(),
        scheduledAt: t.String(), // ISO 8601 date string
        timezone: t.String(), // IANA timezone
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Schedule one-time campaign',
        description: 'Schedule a campaign to execute at a specific time',
      },
    }
  )

  // List all schedules
  .get(
    '/',
    async ({ db, query }) => {
      const filters: any = {};

      if (query.status) {
        filters.status = query.status;
      }

      if (query.scheduledAfter) {
        filters.scheduledAfter = new Date(query.scheduledAfter);
      }

      if (query.scheduledBefore) {
        filters.scheduledBefore = new Date(query.scheduledBefore);
      }

      const schedules = await getCampaignSchedules(db, query.workspaceId, filters);

      return { schedules };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(
          t.Union([
            t.Literal('active'),
            t.Literal('paused'),
            t.Literal('completed'),
            t.Literal('cancelled'),
          ])
        ),
        scheduledAfter: t.Optional(t.String()),
        scheduledBefore: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'List campaign schedules',
        description: 'List all campaign schedules with optional filters',
      },
    }
  )

  // Get schedule by ID
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const schedule = await getScheduleById(db, params.id, query.workspaceId);

      if (!schedule) {
        set.status = 404;
        return { error: 'Schedule not found' };
      }

      return schedule;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Get schedule by ID',
        description: 'Get campaign schedule details',
      },
    }
  )

  // Reschedule a campaign
  .patch(
    '/:id',
    async ({ db, params, query, body, set }) => {
      try {
        const schedule = await rescheduleCampaign(
          db,
          params.id,
          query.workspaceId,
          new Date(body.scheduledAt),
          body.userId
        );

        return schedule;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to reschedule',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        scheduledAt: t.String(), // ISO 8601 date string
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Reschedule campaign',
        description: 'Update the scheduled execution time',
      },
    }
  )

  // Cancel a schedule
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      try {
        const schedule = await cancelSchedule(db, params.id, query.workspaceId, query.userId);

        return { success: true, schedule };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to cancel schedule',
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
        summary: 'Cancel schedule',
        description: 'Cancel a scheduled campaign execution',
      },
    }
  );
