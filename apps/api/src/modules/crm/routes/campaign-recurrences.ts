/**
 * Campaign Recurrences Routes
 * API endpoints for recurring campaign management
 */

import { Elysia, t } from 'elysia';
import {
  createRecurringCampaign,
  getCampaignRecurrences,
  getRecurrenceById,
  pauseRecurrence,
  resumeRecurrence,
  deleteRecurrence,
  previewNextExecutions,
} from '../services/campaign-recurrence';

export const campaignRecurrencesRoutes = new Elysia({ prefix: '/campaign-recurrences' })
  // Create a recurring campaign
  .post(
    '/',
    async ({ db, body, set }) => {
      try {
        const recurrence = await createRecurringCampaign(db, {
          campaignId: body.campaignId,
          workspaceId: body.workspaceId,
          pattern: body.pattern,
          config: body.config,
          timezone: body.timezone,
          endCondition: body.endCondition,
          maxExecutions: body.maxExecutions,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          userId: body.userId,
        });

        return recurrence;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create recurrence',
        };
      }
    },
    {
      body: t.Object({
        campaignId: t.String(),
        workspaceId: t.String(),
        pattern: t.Union([t.Literal('daily'), t.Literal('weekly'), t.Literal('monthly')]),
        config: t.Any(), // RecurrenceConfig (daily/weekly/monthly specific)
        timezone: t.String(), // IANA timezone
        endCondition: t.Union([
          t.Literal('never'),
          t.Literal('after_executions'),
          t.Literal('end_date'),
        ]),
        maxExecutions: t.Optional(t.Number()),
        endDate: t.Optional(t.String()), // ISO 8601 date string
        userId: t.String(),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Create recurring campaign',
        description: 'Set up a recurring campaign schedule (daily, weekly, or monthly)',
      },
    }
  )

  // List all recurrences
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

      const recurrences = await getCampaignRecurrences(db, query.workspaceId, filters);

      return { recurrences };
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
        campaignId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'List campaign recurrences',
        description: 'List all recurring campaigns with optional filters',
      },
    }
  )

  // Get recurrence by ID
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const recurrence = await getRecurrenceById(db, params.id, query.workspaceId);

      if (!recurrence) {
        set.status = 404;
        return { error: 'Recurrence not found' };
      }

      return recurrence;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Get recurrence by ID',
        description: 'Get recurring campaign details',
      },
    }
  )

  // Preview next execution times
  .get(
    '/:id/preview',
    async ({ db, params, query, set }) => {
      try {
        const count = query.count ? parseInt(query.count, 10) : 5;
        const nextExecutions = await previewNextExecutions(
          db,
          params.id,
          query.workspaceId,
          count
        );

        return {
          recurrenceId: params.id,
          nextExecutions: nextExecutions.map((date) => date.toISOString()),
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to preview executions',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        count: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Automation'],
        summary: 'Preview next executions',
        description: 'Preview the next N execution times for a recurring campaign',
      },
    }
  )

  // Pause recurrence
  .patch(
    '/:id/pause',
    async ({ db, params, query, set }) => {
      try {
        const recurrence = await pauseRecurrence(
          db,
          params.id,
          query.workspaceId,
          query.userId
        );

        return recurrence;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to pause recurrence',
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
        summary: 'Pause recurrence',
        description: 'Pause a recurring campaign',
      },
    }
  )

  // Resume recurrence
  .patch(
    '/:id/resume',
    async ({ db, params, query, set }) => {
      try {
        const recurrence = await resumeRecurrence(
          db,
          params.id,
          query.workspaceId,
          query.userId
        );

        return recurrence;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to resume recurrence',
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
        summary: 'Resume recurrence',
        description: 'Resume a paused recurring campaign',
      },
    }
  )

  // Delete recurrence
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      try {
        const recurrence = await deleteRecurrence(
          db,
          params.id,
          query.workspaceId,
          query.userId
        );

        return { success: true, recurrence };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to delete recurrence',
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
        summary: 'Delete recurrence',
        description: 'Delete a recurring campaign',
      },
    }
  );
