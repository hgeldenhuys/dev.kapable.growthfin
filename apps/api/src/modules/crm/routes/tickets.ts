/**
 * Ticket Routes
 * REST API endpoints for support tickets and product feedback
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db/client';
import { ticketService } from '../services/tickets';

export const ticketRoutes = new Elysia({ prefix: '/tickets' })
  // =====================================================================
  // LIST TICKETS
  // =====================================================================
  .get(
    '/',
    async ({ query }) => {
      const result = await ticketService.list(database, {
        workspaceId: query.workspaceId,
        status: query.status,
        category: query.category,
        priority: query.priority,
        assigneeId: query.assigneeId,
        entityType: query.entityType,
        entityId: query.entityId,
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return result;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(t.String()),
        category: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        assigneeId: t.Optional(t.String()),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: { tags: ['Tickets'], summary: 'List tickets with filters' },
    }
  )

  // =====================================================================
  // GET TICKET SUMMARY
  // =====================================================================
  .get(
    '/summary',
    async ({ query }) => {
      const summary = await ticketService.summary(database, query.workspaceId);
      return { summary };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: { tags: ['Tickets'], summary: 'Get ticket summary statistics' },
    }
  )

  // =====================================================================
  // GET TICKET BY ID
  // =====================================================================
  .get(
    '/:id',
    async ({ params, query, set }) => {
      const ticket = await ticketService.getById(database, params.id, query.workspaceId);
      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
      return ticket;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: { tags: ['Tickets'], summary: 'Get ticket by ID' },
    }
  )

  // =====================================================================
  // CREATE TICKET
  // =====================================================================
  .post(
    '/',
    async ({ body }) => {
      const ticket = await ticketService.create(database, body);
      return ticket;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        category: t.Optional(
          t.Union([
            t.Literal('support'),
            t.Literal('product_feedback'),
            t.Literal('feature_request'),
            t.Literal('bug_report'),
          ])
        ),
        priority: t.Optional(
          t.Union([
            t.Literal('low'),
            t.Literal('medium'),
            t.Literal('high'),
            t.Literal('urgent'),
          ])
        ),
        status: t.Optional(
          t.Union([
            t.Literal('open'),
            t.Literal('in_progress'),
            t.Literal('waiting'),
            t.Literal('resolved'),
            t.Literal('closed'),
          ])
        ),
        entityType: t.Optional(
          t.Union([
            t.Literal('lead'),
            t.Literal('contact'),
            t.Literal('account'),
          ])
        ),
        entityId: t.Optional(t.String()),
        assigneeId: t.Optional(t.String()),
        reportedById: t.Optional(t.String()),
        source: t.Optional(
          t.Union([
            t.Literal('ai_chat'),
            t.Literal('manual'),
            t.Literal('email'),
            t.Literal('api'),
          ])
        ),
        aiConversationId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        createdBy: t.Optional(t.String()),
      }),
      detail: { tags: ['Tickets'], summary: 'Create a new ticket' },
    }
  )

  // =====================================================================
  // UPDATE TICKET
  // =====================================================================
  .put(
    '/:id',
    async ({ params, query, body, set }) => {
      const ticket = await ticketService.update(database, params.id, query.workspaceId, body);
      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
      return ticket;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        category: t.Optional(
          t.Union([
            t.Literal('support'),
            t.Literal('product_feedback'),
            t.Literal('feature_request'),
            t.Literal('bug_report'),
          ])
        ),
        priority: t.Optional(
          t.Union([
            t.Literal('low'),
            t.Literal('medium'),
            t.Literal('high'),
            t.Literal('urgent'),
          ])
        ),
        status: t.Optional(
          t.Union([
            t.Literal('open'),
            t.Literal('in_progress'),
            t.Literal('waiting'),
            t.Literal('resolved'),
            t.Literal('closed'),
          ])
        ),
        entityType: t.Optional(
          t.Union([
            t.Literal('lead'),
            t.Literal('contact'),
            t.Literal('account'),
            t.Null(),
          ])
        ),
        entityId: t.Optional(t.Union([t.String(), t.Null()])),
        assigneeId: t.Optional(t.Union([t.String(), t.Null()])),
        resolution: t.Optional(t.Union([t.String(), t.Null()])),
        tags: t.Optional(t.Array(t.String())),
        updatedBy: t.Optional(t.String()),
      }),
      detail: { tags: ['Tickets'], summary: 'Update a ticket' },
    }
  )

  // =====================================================================
  // DELETE TICKET (soft delete)
  // =====================================================================
  .delete(
    '/:id',
    async ({ params, query, set }) => {
      const ticket = await ticketService.delete(database, params.id, query.workspaceId);
      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: { tags: ['Tickets'], summary: 'Delete a ticket (soft delete)' },
    }
  )

  // =====================================================================
  // BULK IMPORT TICKETS
  // =====================================================================
  .post(
    '/bulk-import',
    async ({ body, set }) => {
      try {
        if (body.items.length > 200) {
          set.status = 400;
          return { error: 'Maximum 200 items per import' };
        }

        const imported: any[] = [];
        for (const item of body.items) {
          const ticket = await ticketService.create(database, {
            ...item,
            workspaceId: body.workspaceId,
            createdBy: body.userId,
            source: item.source || 'manual',
          });
          imported.push(ticket);
        }

        return { imported: imported.length, items: imported };
      } catch (error) {
        console.error('[tickets.bulk-import] Error:', error);
        set.status = 500;
        return { error: error instanceof Error ? error.message : 'Failed to import tickets' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        items: t.Array(
          t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            category: t.Optional(
              t.Union([
                t.Literal('support'),
                t.Literal('product_feedback'),
                t.Literal('feature_request'),
                t.Literal('bug_report'),
              ])
            ),
            priority: t.Optional(
              t.Union([
                t.Literal('low'),
                t.Literal('medium'),
                t.Literal('high'),
                t.Literal('urgent'),
              ])
            ),
            status: t.Optional(
              t.Union([
                t.Literal('open'),
                t.Literal('in_progress'),
                t.Literal('waiting'),
                t.Literal('resolved'),
                t.Literal('closed'),
              ])
            ),
            source: t.Optional(
              t.Union([
                t.Literal('ai_chat'),
                t.Literal('manual'),
                t.Literal('email'),
                t.Literal('api'),
              ])
            ),
            tags: t.Optional(t.Array(t.String())),
            resolution: t.Optional(t.String()),
          })
        ),
      }),
      detail: { tags: ['Tickets'], summary: 'Bulk import tickets from JSON' },
    }
  )

  // =====================================================================
  // SEARCH TICKETS
  // =====================================================================
  .get(
    '/search',
    async ({ query }) => {
      const records = await ticketService.search(
        database,
        query.workspaceId,
        query.q,
        query.limit ? parseInt(query.limit, 10) : undefined
      );
      return { records, total: records.length };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        q: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: { tags: ['Tickets'], summary: 'Search tickets by title/description' },
    }
  )

  // =====================================================================
  // TICKET COMMENTS
  // =====================================================================
  .get(
    '/:id/comments',
    async ({ params, query }) => {
      const comments = await ticketService.listComments(database, params.id, query.workspaceId);
      return { comments };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: { tags: ['Tickets'], summary: 'List comments for a ticket' },
    }
  )
  .post(
    '/:id/comments',
    async ({ params, body }) => {
      const comment = await ticketService.addComment(database, {
        ticketId: params.id,
        workspaceId: body.workspaceId,
        body: body.body,
        isInternal: body.isInternal ?? false,
        createdBy: body.createdBy,
      });
      return comment;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        body: t.String(),
        isInternal: t.Optional(t.Boolean()),
        createdBy: t.Optional(t.String()),
      }),
      detail: { tags: ['Tickets'], summary: 'Add a comment to a ticket' },
    }
  );
