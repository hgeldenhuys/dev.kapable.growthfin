/**
 * Work Items Routes
 * REST endpoints for work item CRUD operations and lifecycle management (US-014)
 */

import { Elysia, t } from 'elysia';
import { WorkItemsService } from '../services/work-items.service';

export const workItemsRoutes = new Elysia()
  /**
   * POST /work-items - Create work item
   */
  .post(
    '/',
    async ({ db, body }) => {
      const workItem = await WorkItemsService.create(db, body);
      return workItem;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        entityType: t.Union([
          t.Literal('lead'),
          t.Literal('contact'),
          t.Literal('opportunity'),
          t.Literal('account'),
        ]),
        entityId: t.String(),
        workItemType: t.Union([
          t.Literal('lead_conversion'),
          t.Literal('follow_up'),
          t.Literal('review'),
          t.Literal('qualification'),
        ]),
        title: t.String(),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        assignedTo: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal('pending'),
            t.Literal('claimed'),
            t.Literal('in_progress'),
            t.Literal('completed'),
            t.Literal('expired'),
            t.Literal('cancelled'),
          ])
        ),
        dueAt: t.Optional(t.String()),
        expiresAt: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Create work item',
        description: 'Create a new work item for batch/task semantic separation',
      },
    }
  )

  /**
   * GET /work-items - List work items with filters
   */
  .get(
    '/',
    async ({ db, query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await WorkItemsService.list(db, {
        workspaceId: query.workspaceId,
        status: query.status as any,
        entityType: query.entityType as any,
        entityId: query.entityId || undefined,
        assignedTo: query.assignedTo || undefined,
        workItemType: query.workItemType as any,
        sourceType: query.sourceType as any,
        sourceId: query.sourceId || undefined,
        limit,
        offset,
      });

      return result;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(
          t.Union([
            t.Literal('pending'),
            t.Literal('claimed'),
            t.Literal('in_progress'),
            t.Literal('completed'),
            t.Literal('expired'),
            t.Literal('cancelled'),
          ])
        ),
        entityType: t.Optional(
          t.Union([
            t.Literal('lead'),
            t.Literal('contact'),
            t.Literal('opportunity'),
            t.Literal('account'),
          ])
        ),
        entityId: t.Optional(t.String()),
        assignedTo: t.Optional(t.String()),
        workItemType: t.Optional(
          t.Union([
            t.Literal('lead_conversion'),
            t.Literal('follow_up'),
            t.Literal('review'),
            t.Literal('qualification'),
          ])
        ),
        sourceType: t.Optional(
          t.Union([
            t.Literal('batch'),
            t.Literal('state_machine'),
            t.Literal('manual'),
            t.Literal('campaign'),
            t.Literal('workflow'),
          ])
        ),
        sourceId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'List work items',
        description: 'List work items with optional filters (supports status=expired, sourceType, sourceId)',
      },
    }
  )

  /**
   * GET /work-items/:id - Get work item by ID
   */
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const workItem = await WorkItemsService.getById(db, params.id, query.workspaceId);

      if (!workItem) {
        throw new Error('Work item not found');
      }

      return workItem;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Get work item by ID',
        description: 'Retrieve a single work item by ID',
      },
    }
  )

  /**
   * PUT /work-items/:id - Update work item
   */
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      const workItem = await WorkItemsService.update(db, params.id, query.workspaceId, body);
      return workItem;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        assignedTo: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal('pending'),
            t.Literal('claimed'),
            t.Literal('in_progress'),
            t.Literal('completed'),
            t.Literal('expired'),
            t.Literal('cancelled'),
          ])
        ),
        dueAt: t.Optional(t.String()),
        expiresAt: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Update work item',
        description: 'Update an existing work item',
      },
    }
  )

  /**
   * DELETE /work-items/:id - Soft delete work item
   */
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      const workItem = await WorkItemsService.delete(db, params.id, query.workspaceId);
      return workItem;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Delete work item',
        description: 'Soft delete a work item',
      },
    }
  )

  /**
   * POST /work-items/:id/claim - Claim work item
   */
  .post(
    '/:id/claim',
    async ({ db, params, query, body, set }) => {
      try {
        const workItem = await WorkItemsService.claim(
          db,
          params.id,
          query.workspaceId,
          body.userId
        );
        return workItem;
      } catch (error: any) {
        // Return 409 Conflict if already claimed
        if (error.cause?.code === 'ALREADY_CLAIMED') {
          set.status = 409;
          return {
            error: 'Work item already claimed',
            claimedBy: error.cause.claimedBy,
          };
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        userId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Claim work item',
        description: 'Claim a work item atomically (returns 409 if already claimed)',
      },
    }
  )

  /**
   * POST /work-items/:id/unclaim - Release work item
   */
  .post(
    '/:id/unclaim',
    async ({ db, params, query }) => {
      const workItem = await WorkItemsService.unclaim(db, params.id, query.workspaceId);
      return workItem;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Unclaim work item',
        description: 'Release a claimed work item',
      },
    }
  )

  /**
   * POST /work-items/:id/complete - Complete work item with result
   */
  .post(
    '/:id/complete',
    async ({ db, params, query, body }) => {
      const workItem = await WorkItemsService.complete(
        db,
        params.id,
        query.workspaceId,
        body.completedBy,
        body.result
      );
      return workItem;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        completedBy: t.Union([t.Literal('user'), t.Literal('ai'), t.Literal('system')]),
        result: t.Any(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Complete work item',
        description: 'Mark work item as completed with result data',
      },
    }
  )

  // ============================================================================
  // PROVENANCE ENDPOINTS (UI-001)
  // ============================================================================

  /**
   * GET /work-items/by-source - List work items by source (provenance)
   */
  .get(
    '/by-source',
    async ({ db, query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await WorkItemsService.listBySource(
        db,
        query.workspaceId,
        query.sourceType as any,
        query.sourceId,
        { limit, offset }
      );

      return result;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        sourceType: t.Union([
          t.Literal('batch'),
          t.Literal('state_machine'),
          t.Literal('manual'),
          t.Literal('campaign'),
          t.Literal('workflow'),
        ]),
        sourceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'List work items by source',
        description: 'Get all work items from a specific source (batch, campaign, etc.)',
      },
    }
  )

  /**
   * GET /work-items/source-progress - Get progress stats for a source
   */
  .get(
    '/source-progress',
    async ({ db, query }) => {
      const progress = await WorkItemsService.getSourceProgress(
        db,
        query.workspaceId,
        query.sourceType as any,
        query.sourceId
      );

      return progress;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        sourceType: t.Union([
          t.Literal('batch'),
          t.Literal('state_machine'),
          t.Literal('manual'),
          t.Literal('campaign'),
          t.Literal('workflow'),
        ]),
        sourceId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Get source progress',
        description: 'Get completion progress statistics for work items from a specific source',
      },
    }
  )

  /**
   * GET /work-items/sources - Get unique sources in workspace
   */
  .get(
    '/sources',
    async ({ db, query }) => {
      const sources = await WorkItemsService.getUniqueSources(db, query.workspaceId);
      return { sources };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Work Items'],
        summary: 'Get unique sources',
        description: 'Get list of unique source types and IDs for filtering',
      },
    }
  );
