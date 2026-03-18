/**
 * Campaign Templates Routes
 * US-CAMPAIGN-TEMPLATE-006: Template Library
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { campaignTemplateService } from '../services/campaign-templates';
import { createSignalDBStream } from '../../../lib/signaldb-stream';

export const campaignTemplatesRoutes = new Elysia({ prefix: '/campaign-templates' })
  // ============================================================================
  // RECENT & STREAMING (CQRS Pattern)
  // ============================================================================

  .get(
    '/recent',
    async ({ query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const templates = await campaignTemplateService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        templates,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Get recent campaign templates',
        description: 'Fetch recent templates for initial state (CQRS pattern)',
      },
    }
  )

  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[campaign-templates/stream] Starting stream for workspace ${query.workspaceId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const stream = createSignalDBStream({
          table: 'campaign_templates',
          where: `workspace_id='${query.workspaceId}'`,
          subscriptionTimestamp,
        });

        for await (const sseMessage of stream.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[campaign-templates/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Stream template updates',
        description: 'Stream NEW template updates via ElectricSQL (REACTIVE, NO POLLING)',
      },
    }
  )

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  .get(
    '/',
    async ({ query }) => {
      const result = await campaignTemplateService.list(db, query.workspaceId, {
        category: query.category as any,
        status: query.status as any,
        tags: query.tags ? JSON.parse(query.tags) : undefined,
        latestOnly: query.latestOnly === 'true',
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return result;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        category: t.Optional(t.String()),
        status: t.Optional(t.String()),
        tags: t.Optional(t.String()),
        latestOnly: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'List campaign templates',
        description: 'Get all templates with optional filtering',
      },
    }
  )

  .get(
    '/popular',
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const templates = await campaignTemplateService.getPopular(db, query.workspaceId, limit);

      return { templates };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Get popular templates',
        description: 'Get most used templates ordered by usage count',
      },
    }
  )

  .get(
    '/:id',
    async ({ params, query }) => {
      const template = await campaignTemplateService.getById(db, params.id, query.workspaceId);

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Get template by ID',
      },
    }
  )

  .get(
    '/:id/versions',
    async ({ params, query }) => {
      const versions = await campaignTemplateService.getVersions(db, params.id, query.workspaceId);

      return { versions };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Get template versions',
        description: 'Get all versions of a template',
      },
    }
  )

  .post(
    '/',
    async ({ body }) => {
      const template = await campaignTemplateService.create(db, body);

      return template;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        category: t.String(),
        tags: t.Optional(t.Array(t.String())),
        templateData: t.Any(),
        status: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Create template',
        description: 'Create a new campaign template',
      },
    }
  )

  .post(
    '/:id/version',
    async ({ params, query, body }) => {
      const newVersion = await campaignTemplateService.createVersion(
        db,
        params.id,
        query.workspaceId,
        body
      );

      return newVersion;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        templateData: t.Optional(t.Any()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Create template version',
        description: 'Create a new version of an existing template',
      },
    }
  )

  .put(
    '/:id',
    async ({ params, query, body }) => {
      const template = await campaignTemplateService.update(db, params.id, query.workspaceId, body);

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        templateData: t.Optional(t.Any()),
        status: t.Optional(t.String()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Update template',
      },
    }
  )

  .post(
    '/:id/use',
    async ({ params, query }) => {
      await campaignTemplateService.incrementUsageCount(db, params.id, query.workspaceId);

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Increment template usage',
        description: 'Increment usage count when template is used to create a campaign',
      },
    }
  )

  .delete(
    '/:id',
    async ({ params, query }) => {
      const success = await campaignTemplateService.delete(db, params.id, query.workspaceId);

      if (!success) {
        throw new Error('Template not found');
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Templates'],
        summary: 'Delete template',
        description: 'Soft delete a template',
      },
    }
  );
