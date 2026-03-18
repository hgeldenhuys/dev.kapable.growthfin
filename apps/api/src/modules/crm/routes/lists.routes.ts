/**
 * Lists Routes
 * REST endpoints for CRM list operations with real-time SSE streaming
 * Supports polymorphic entity types (leads, contacts, accounts, opportunities)
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { listsService } from '../services/lists.service';
import { listMembersService } from '../services/list-members.service';
import { listFiltersService } from '../services/list-filters.service';
import { createSignalDBStream } from '../../../lib/signaldb-stream';

/**
 * Stream list changes for a workspace
 */
function streamLists(
  workspaceId: string,
  entityType?: string,
  subscriptionTimestamp: Date = new Date()
) {
  const whereConditions = [`workspace_id='${workspaceId}'`];
  if (entityType) {
    whereConditions.push(`entity_type='${entityType}'`);
  }

  return createSignalDBStream({
    table: 'crm_contact_lists',
    where: whereConditions.join(' AND '),
    subscriptionTimestamp,
  });
}

/**
 * Stream list membership changes
 */
function streamListMemberships(
  listId: string,
  subscriptionTimestamp: Date = new Date()
) {
  return createSignalDBStream({
    table: 'crm_contact_list_memberships',
    where: `list_id='${listId}'`,
    subscriptionTimestamp,
  });
}

export const listsRoutes = new Elysia({ prefix: '/lists' })
  // ============================================================================
  // CQRS Pattern: Initial State + SSE Streaming
  // ============================================================================

  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const lists = await listsService.getRecentLists(
        db,
        query.workspaceId,
        query.entityType as any,
        seconds
      );

      return {
        serverTimestamp: new Date().toISOString(),
        lists,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Get recent lists',
        description: 'Fetch recent lists for initial state (CQRS pattern)',
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
        `[lists/stream] Starting stream for workspace ${query.workspaceId}` +
          (query.entityType ? ` (entity: ${query.entityType})` : '')
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamLists(
          query.workspaceId,
          query.entityType,
          subscriptionTimestamp
        );

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[lists/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Stream list updates',
        description: 'Stream NEW list updates via ElectricSQL (REACTIVE, NO POLLING)',
      },
    }
  )

  // ============================================================================
  // List CRUD Operations
  // ============================================================================

  .get(
    '/',
    async ({ db, query }) => {
      const lists = await listsService.getListsByEntityType(
        db,
        query.workspaceId,
        query.entityType as any
      );

      return {
        lists,
        total: lists.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Get lists by entity type',
        description: 'Retrieve all lists filtered by entity type (lead, contact, account, opportunity). If entityType is omitted, returns all lists.',
      },
    }
  )

  .get(
    '/:id',
    async ({ db, params, query }) => {
      const list = await listsService.getListById(db, params.id, query.workspaceId);

      if (!list) {
        return {
          error: 'List not found',
          status: 404,
        };
      }

      return { list };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Get list by ID',
        description: 'Retrieve a single list with full details',
      },
    }
  )

  .post(
    '/',
    async ({ db, body }) => {
      try {
        const list = await listsService.createList(db, body);

        return {
          list,
          message: 'List created successfully',
        };
      } catch (error) {
        return {
          error: 'Failed to create list',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        entityType: t.Union([
          t.Literal('lead'),
          t.Literal('contact'),
          t.Literal('account'),
          t.Literal('opportunity'),
        ]),
        name: t.String(),
        description: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal('manual'),
            t.Literal('import'),
            t.Literal('campaign'),
            t.Literal('enrichment'),
            t.Literal('segment'),
          ])
        ),
        customFieldSchema: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
        ownerId: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Create a new list',
        description: 'Create a new CRM list for any entity type',
      },
    }
  )

  .patch(
    '/:id',
    async ({ db, params, query, body }) => {
      const updated = await listsService.updateList(
        db,
        params.id,
        query.workspaceId,
        body
      );

      if (!updated) {
        return {
          error: 'List not found',
          status: 404,
        };
      }

      return {
        list: updated,
        message: 'List updated successfully',
      };
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
        status: t.Optional(
          t.Union([t.Literal('active'), t.Literal('archived'), t.Literal('processing')])
        ),
        customFieldSchema: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Update a list',
        description: 'Update list metadata (partial update)',
      },
    }
  )

  .delete(
    '/:id',
    async ({ db, params, query }) => {
      const deleted = await listsService.deleteList(db, params.id, query.workspaceId);

      if (!deleted) {
        return {
          error: 'List not found',
          status: 404,
        };
      }

      return {
        message: 'List deleted successfully',
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
        tags: ['Lists'],
        summary: 'Delete a list',
        description: 'Soft delete a list',
      },
    }
  )

  // ============================================================================
  // List Membership Operations
  // ============================================================================

  .get(
    '/:id/members',
    async ({ db, params, query }) => {
      try {
        // Parse custom field filters from query params
        const customFieldFilters = listFiltersService.parseCustomFieldFilters(
          query as Record<string, string>
        );

        const { members, customFieldSchema } = await listMembersService.getListMembers(
          db,
          params.id,
          query.workspaceId,
          customFieldFilters
        );

        return {
          members,
          total: members.length,
          filters: customFieldFilters,
          customFieldSchema,
        };
      } catch (error) {
        return {
          error: 'Failed to fetch members',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }, {
        // Allow additional properties for dynamic custom field filters
        additionalProperties: true,
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Get list members with entity data',
        description:
          'Retrieve list members with polymorphic entity joins. Supports custom field filtering via query params (e.g., ?customField.ethnicity=african&customField.confidence.min=0.8)',
      },
    }
  )

  .get(
    '/:id/members/stream',
    async function* ({ params, query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[lists/${params.id}/members/stream] Starting membership stream`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamListMemberships(params.id, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[lists/members/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Stream membership updates',
        description: 'Stream NEW membership changes via ElectricSQL (REACTIVE, NO POLLING)',
      },
    }
  )

  .post(
    '/:id/members',
    async ({ db, params, query, body, set }) => {
      try {
        const result = await listMembersService.addMembers(
          db,
          params.id,
          query.workspaceId,
          body.entityIds,
          body.addedBy,
          body.source
        );

        set.status = 200;
        return {
          added: result.added,
          skipped: result.skipped,
          message: `Added ${result.added} members, skipped ${result.skipped} duplicates`,
        };
      } catch (error) {
        set.status = 400;
        return {
          error: 'Failed to add members',
          message: error instanceof Error ? error.message : String(error),
        };
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
        entityIds: t.Array(t.String()),
        addedBy: t.Optional(t.String()),
        source: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Add members to list',
        description: 'Bulk add entities to a list (skips duplicates)',
      },
    }
  )

  .delete(
    '/:id/members/:memberId',
    async ({ db, params, query, set }) => {
      try {
        const deleted = await listMembersService.removeMember(
          db,
          params.id,
          params.memberId,
          query.workspaceId
        );

        if (!deleted) {
          set.status = 404;
          return {
            error: 'Member not found or already deleted',
          };
        }

        set.status = 200;
        return {
          message: 'Member removed successfully',
          membershipId: params.memberId,
        };
      } catch (error) {
        console.error('[DELETE /lists/:id/members/:memberId] Error:', error);
        set.status = 500;
        return {
          error: 'Failed to remove member',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
        memberId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Remove member from list',
        description: 'Soft delete a list membership',
      },
    }
  )

  // ============================================================================
  // Filter Options (for UI dropdowns)
  // ============================================================================

  .get(
    '/:id/filter-options',
    async ({ db, params, query }) => {
      try {
        const options = await listFiltersService.getFilterOptions(
          db,
          params.id,
          query.workspaceId,
          query.field
        );

        return {
          field: query.field,
          options,
          total: options.length,
        };
      } catch (error) {
        return {
          error: 'Failed to fetch filter options',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        field: t.String(),
      }),
      detail: {
        tags: ['Lists'],
        summary: 'Get filter options',
        description: 'Get distinct values and counts for a custom field (for filter dropdowns)',
      },
    }
  );
