/**
 * Tags Routes
 * HTTP routes for tag management and analytics
 */

import { Elysia, t } from 'elysia';
import { tagsService } from './service';

export const tagsRoutes = new Elysia()
  /**
   * GET / - Get latest tags sorted by last_used_at
   * AC-003: Returns latest 10 tags with metadata
   * AC-007: Returns tag metadata (event_count, first_used_at, last_used_at)
   */
  .get('/', async ({ db, query }) => {
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const projectId = query.projectId;
    const tags = await tagsService.getLatest(db, { limit, projectId });

    return { tags };
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      projectId: t.Optional(t.String()),
    }),
  })
  /**
   * GET /history - Get tag usage history
   * Returns all tags with event counts and timestamps
   */
  .get('/history', async ({ db, query }) => {
    const projectId = query.projectId;
    const result = await tagsService.getHistory(db, projectId);

    // Elysia has issues with complex objects - manually stringify
    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response;
  }, {
    query: t.Object({
      projectId: t.Optional(t.String()),
    }),
  });
