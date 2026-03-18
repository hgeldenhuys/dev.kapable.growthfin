/**
 * List Operations Routes
 * REST endpoints for list set operations: union, subtract, intersect, split
 */

import { Elysia, t } from 'elysia';
import { listOperationsService } from '../services/list-operations.service';

export const listOperationsRoutes = new Elysia({ prefix: '/lists' })
  // ============================================================================
  // UNION: Combine multiple lists
  // ============================================================================
  .post(
    '/operations/union',
    async ({ db, body, query }) => {
      try {
        const result = await listOperationsService.union(db, {
          workspaceId: query.workspaceId,
          sourceListIds: body.sourceListIds,
          name: body.name,
          userId: query.userId,
        });

        return {
          list: result,
          message: `Created union list with ${result.memberCount} unique members`,
        };
      } catch (error) {
        return {
          error: 'Failed to create union',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        sourceListIds: t.Array(t.String({ format: 'uuid' }), { minItems: 2 }),
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['List Operations'],
        summary: 'Union - Combine lists',
        description:
          'Create a new list containing all unique members from source lists (A ∪ B). Deduplicates automatically.',
      },
    }
  )

  // ============================================================================
  // SUBTRACT: Remove members from a list
  // ============================================================================
  .post(
    '/operations/subtract',
    async ({ db, body, query }) => {
      try {
        const result = await listOperationsService.subtract(db, {
          workspaceId: query.workspaceId,
          sourceListId: body.sourceListId,
          subtractListId: body.subtractListId,
          name: body.name,
          userId: query.userId,
        });

        return {
          list: result,
          message: `Created subtract list with ${result.memberCount} members`,
        };
      } catch (error) {
        return {
          error: 'Failed to create subtract',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        sourceListId: t.String({ format: 'uuid' }),
        subtractListId: t.String({ format: 'uuid' }),
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['List Operations'],
        summary: 'Subtract - Remove members',
        description:
          'Create a new list with members from source list EXCLUDING members in subtract list (A - B).',
      },
    }
  )

  // ============================================================================
  // INTERSECT: Find common members
  // ============================================================================
  .post(
    '/operations/intersect',
    async ({ db, body, query }) => {
      try {
        const result = await listOperationsService.intersect(db, {
          workspaceId: query.workspaceId,
          sourceListIds: body.sourceListIds,
          name: body.name,
          userId: query.userId,
        });

        return {
          list: result,
          message: `Created intersect list with ${result.memberCount} common members`,
        };
      } catch (error) {
        return {
          error: 'Failed to create intersect',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        sourceListIds: t.Array(t.String({ format: 'uuid' }), { minItems: 2 }),
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['List Operations'],
        summary: 'Intersect - Find common members',
        description:
          'Create a new list containing only members present in ALL source lists (A ∩ B).',
      },
    }
  )

  // ============================================================================
  // SPLIT: Segment by custom field
  // ============================================================================
  .post(
    '/operations/split',
    async ({ db, body, query }) => {
      try {
        const results = await listOperationsService.split(db, {
          workspaceId: query.workspaceId,
          sourceListId: body.sourceListId,
          fieldName: body.fieldName,
          userId: query.userId,
        });

        return {
          lists: results,
          message: `Created ${results.length} segmented lists`,
          summary: results.map((r) => ({
            name: r.name,
            memberCount: r.memberCount,
          })),
        };
      } catch (error) {
        return {
          error: 'Failed to split list',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        sourceListId: t.String({ format: 'uuid' }),
        fieldName: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['List Operations'],
        summary: 'Split - Segment by custom field',
        description:
          'Create multiple lists by segmenting source list based on custom field values. One list per unique value.',
      },
    }
  )

  // ============================================================================
  // CREATE FROM FILTERS: Save filtered view as new list
  // ============================================================================
  .post(
    '/operations/create-from-filters',
    async ({ db, body, query }) => {
      try {
        const result = await listOperationsService.createFromFilters(db, {
          workspaceId: query.workspaceId,
          sourceListId: body.sourceListId,
          name: body.name,
          description: body.description,
          filters: body.filters,
          userId: query.userId,
        });

        return {
          list: result,
          message: `Created filtered list "${result.name}" with ${result.memberCount} members`,
        };
      } catch (error) {
        return {
          error: 'Failed to create list from filters',
          message: error instanceof Error ? error.message : String(error),
          status: 400,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        sourceListId: t.String({ format: 'uuid' }),
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        filters: t.Record(t.String(), t.Any()),
      }),
      detail: {
        tags: ['List Operations'],
        summary: 'Create List from Filters',
        description:
          'Create a new list from active custom field filters applied to source list. Filters are saved in list metadata for reproducibility.',
      },
    }
  );
