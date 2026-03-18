/**
 * Contact List Routes
 * REST endpoints for contact list CRUD operations with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { contactListService } from '../services/contact-lists';
import { streamContactLists } from '../../../lib/electric-shapes';

export const contactListRoutes = new Elysia({ prefix: '/lists' })
  // CQRS Pattern: GET /recent - Initial state
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const lists = await contactListService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        lists,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Get recent contact lists',
        description: 'Fetch recent contact lists for initial state (CQRS pattern)',
      },
    }
  )
  // CQRS Pattern: GET /stream - SSE streaming
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[lists/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamContactLists(query.workspaceId, subscriptionTimestamp);

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
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Stream contact list updates',
        description: 'Stream NEW contact list updates via ElectricSQL (REACTIVE, NO POLLING)',
      },
    }
  )
  // GET / - List all lists for workspace
  .get(
    '/',
    async ({ db, query }) => {
      return contactListService.list(db, query.workspaceId);
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'List all contact lists',
        description: 'Get all contact lists for a workspace',
      },
    }
  )
  // POST / - Create new list
  .post(
    '/',
    async ({ db, body, set }) => {
      // Validate required fields
      if (!body.name || body.name.trim() === '') {
        set.status = 400;
        return { error: 'List name is required' };
      }

      // Check for duplicate list name in workspace
      const isDuplicate = await contactListService.checkDuplicateListName(
        db,
        body.workspaceId,
        body.name
      );

      if (isDuplicate) {
        set.status = 409;
        return { error: 'A list with this name already exists in this workspace' };
      }

      const list = await contactListService.create(db, body);
      set.status = 201;
      return list;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        parentListId: t.Optional(t.String()),
        importBatchId: t.Optional(t.String()),
        importSource: t.Optional(t.String()),
        importedAt: t.Optional(t.String()),
        budgetLimit: t.Optional(t.String()),
        budgetPerContact: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
        createdBy: t.Optional(t.String()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Create contact list',
        description: 'Create a new contact list',
      },
    }
  )
  // GET /:id - Get single list
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const list = await contactListService.getById(db, params.id, query.workspaceId);

      if (!list) {
        set.status = 404;
        return { error: 'Contact list not found' };
      }

      return list;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Get contact list by ID',
        description: 'Get a single contact list with member count',
      },
    }
  )
  // PUT /:id - Update list
  .put(
    '/:id',
    async ({ db, params, query, body, set }) => {
      // If name is being updated, check for duplicates
      if (body.name) {
        const isDuplicate = await contactListService.checkDuplicateListName(
          db,
          query.workspaceId,
          body.name,
          params.id // Exclude current list from duplicate check
        );

        if (isDuplicate) {
          set.status = 409;
          return { error: 'A list with this name already exists in this workspace' };
        }
      }

      const list = await contactListService.update(db, params.id, query.workspaceId, body);

      if (!list) {
        set.status = 404;
        return { error: 'Contact list not found' };
      }

      return list;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        parentListId: t.Optional(t.String()),
        budgetLimit: t.Optional(t.String()),
        budgetPerContact: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Update contact list',
        description: 'Update contact list properties',
      },
    }
  )
  // DELETE /:id - Soft delete list
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      const list = await contactListService.softDelete(db, params.id, query.workspaceId);

      if (!list) {
        set.status = 404;
        return { error: 'Contact list not found' };
      }

      return { success: true, message: 'Contact list deleted' };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Delete contact list',
        description: 'Soft delete a contact list',
      },
    }
  )
  // POST /:id/contacts - Add contacts to list (bulk)
  .post(
    '/:id/contacts',
    async ({ db, params, query, body, set }) => {
      // Validate input
      if (!body.contactIds || body.contactIds.length === 0) {
        set.status = 400;
        return { error: 'contactIds array is required and cannot be empty' };
      }

      if (!body.userId) {
        set.status = 400;
        return { error: 'userId is required' };
      }

      try {
        const results = await contactListService.addContacts(
          db,
          params.id,
          query.workspaceId,
          body.contactIds,
          body.source || 'manual',
          body.userId
        );

        set.status = 201;
        return {
          success: true,
          added: results.length,
          message: `Added ${results.length} contacts to list`,
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to add contacts',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        contactIds: t.Array(t.String()),
        source: t.Optional(t.String()),
        userId: t.String(),
      }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Add contacts to list',
        description: 'Add multiple contacts to a list (idempotent bulk operation)',
      },
    }
  )
  // DELETE /:id/contacts/:contactId - Remove contact from list
  .delete(
    '/:id/contacts/:contactId',
    async ({ db, params, query, set }) => {
      const result = await contactListService.removeContact(
        db,
        params.id,
        params.contactId,
        query.workspaceId
      );

      if (!result) {
        set.status = 404;
        return { error: 'Contact not found in list or already removed' };
      }

      return { success: true, message: 'Contact removed from list' };
    },
    {
      params: t.Object({
        id: t.String(),
        contactId: t.String(),
      }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Remove contact from list',
        description: 'Remove a single contact from a list',
      },
    }
  )
  // GET /:id/contacts - Get list members
  .get(
    '/:id/contacts',
    async ({ db, params, query, set }) => {
      // Verify list exists
      const list = await contactListService.getById(db, params.id, query.workspaceId);
      if (!list) {
        set.status = 404;
        return { error: 'Contact list not found' };
      }

      const members = await contactListService.getMembers(db, params.id, query.workspaceId);

      return {
        listId: params.id,
        listName: list.name,
        totalMembers: members.length,
        members: members.map((m) => ({
          contact: m.contact,
          membership: {
            addedAt: m.membership.addedAt,
            addedBy: m.membership.addedBy,
            source: m.membership.source,
            enrichmentScore: m.membership.enrichmentScore,
            enrichedAt: m.membership.enrichedAt,
          },
        })),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Get list members',
        description: 'Get all contacts in a list with membership details',
      },
    }
  )
  // GET /:id/custom-field-schema - Analyze custom fields in list members
  .get(
    '/:id/custom-field-schema',
    async ({ db, params, query, set }) => {
      try {
        const schema = await contactListService.getCustomFieldSchema(db, params.id, query.workspaceId);

        if (!schema) {
          set.status = 404;
          return { error: 'Contact list not found' };
        }

        return schema;
      } catch (error) {
        console.error('[custom-field-schema] Error:', error);
        set.status = 500;
        return {
          error: 'Failed to analyze custom fields',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Contact Lists'],
        summary: 'Get custom field schema for list',
        description: 'Analyze custom fields in list members and return schema with types and unique values',
      },
    }
  );
