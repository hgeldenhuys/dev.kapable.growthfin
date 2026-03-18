/**
 * Templates Routes
 * API endpoints for enrichment template management
 */

import { Elysia, t } from 'elysia';
import { templatesService, type TemplateListFilters } from '../services/templates.service';
import type { Database } from '@agios/db';

export const templatesRoutes = new Elysia({ prefix: '/enrichment/templates' })
  /**
   * POST /api/v1/crm/enrichment/templates - Create template
   */
  .post(
    '/',
    async ({ db, body }: { db: Database; body: any }) => {
      const template = await templatesService.create(db, {
        workspaceId: body.workspaceId,
        type: body.type || 'enrichment',
        name: body.name,
        description: body.description || null,
        model: body.model || 'openai/gpt-4o-mini',
        prompt: body.prompt,
        temperature: body.temperature || '0.7',
        maxTokens: body.maxTokens || 500,
        metadata: {
          usageCount: 0,
          lastUsedAt: null,
          estimatedCostPerContact: body.estimatedCostPerContact || null,
        },
        tags: body.tags || [],
        isTemplate: body.isTemplate || false,
        ownerId: body.ownerId || null,
        createdBy: body.createdBy || null,
      });

      return {
        success: true,
        template,
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        prompt: t.String(),
        type: t.Optional(t.Union([t.Literal('enrichment'), t.Literal('scoring'), t.Literal('export')])),
        description: t.Optional(t.String()),
        model: t.Optional(t.String()),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        estimatedCostPerContact: t.Optional(t.Number()),
        tags: t.Optional(t.Array(t.String())),
        isTemplate: t.Optional(t.Boolean()),
        ownerId: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'Create enrichment template',
        description: 'Create a new reusable enrichment template',
      },
    }
  )

  /**
   * GET /api/v1/crm/enrichment/templates - List templates
   */
  .get(
    '/',
    async ({ db, query }: { db: Database; query: any }) => {
      const filters: TemplateListFilters = {
        workspaceId: query.workspaceId,
        type: query.type,
        search: query.search,
        model: query.model,
        sortBy: query.sortBy || 'date',
        sortOrder: query.sortOrder || 'desc',
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      };

      const result = await templatesService.list(db, filters);

      return {
        success: true,
        ...result,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        type: t.Optional(t.Union([t.Literal('enrichment'), t.Literal('scoring'), t.Literal('export')])),
        search: t.Optional(t.String()),
        model: t.Optional(t.String()),
        sortBy: t.Optional(t.Union([t.Literal('usage'), t.Literal('cost'), t.Literal('date')])),
        sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'List enrichment templates',
        description: 'Get all templates for a workspace with filtering and sorting',
      },
    }
  )

  /**
   * GET /api/v1/crm/enrichment/templates/:id - Get one template
   */
  .get(
    '/:id',
    async ({ db, params, query }: { db: Database; params: any; query: any }) => {
      const template = await templatesService.getById(db, params.id, query.workspaceId);

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return {
        success: true,
        template,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'Get template by ID',
        description: 'Get a single template with full details',
      },
    }
  )

  /**
   * PUT /api/v1/crm/enrichment/templates/:id - Update template
   */
  .put(
    '/:id',
    async ({ db, params, body }: { db: Database; params: any; body: any }) => {
      const template = await templatesService.update(db, params.id, body.workspaceId, {
        name: body.name,
        description: body.description,
        prompt: body.prompt,
        model: body.model,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        tags: body.tags,
        updatedBy: body.updatedBy || null,
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return {
        success: true,
        template,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        prompt: t.Optional(t.String()),
        model: t.Optional(t.String()),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        tags: t.Optional(t.Array(t.String())),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'Update template',
        description: 'Update an existing template in-place',
      },
    }
  )

  /**
   * DELETE /api/v1/crm/enrichment/templates/:id - Soft delete template
   */
  .delete(
    '/:id',
    async ({ db, params, query }: { db: Database; params: any; query: any }) => {
      const template = await templatesService.delete(db, params.id, query.workspaceId);

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return {
        success: true,
        message: 'Template deleted successfully',
        template,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'Delete template',
        description: 'Soft delete a template (sets deletedAt timestamp)',
      },
    }
  )

  /**
   * POST /api/v1/crm/enrichment/templates/:id/dry-run - Test template
   */
  .post(
    '/:id/dry-run',
    async ({ db, params, body }: { db: Database; params: any; body: any }) => {
      try {
        const result = await templatesService.runDryRun(db, params.id, {
          workspaceId: body.workspaceId,
          listId: body.listId,
          sampleSize: body.sampleSize || 3,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Dry-run failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        listId: t.String(),
        sampleSize: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Templates'],
        summary: 'Test template with dry-run',
        description: 'Execute template on sample contacts from a list without applying results',
      },
    }
  );
