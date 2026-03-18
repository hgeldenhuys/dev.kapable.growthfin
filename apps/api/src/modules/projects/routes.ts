/**
 * Projects Routes
 * HTTP routes for project management
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { projectService } from './service';

export const projectRoutes = new Elysia({ prefix: '/projects', tags: ['Projects'] })
  .get('/', async () => {
    try {
      const result = await projectService.list(db);
      console.log('[ProjectRoutes] Successfully retrieved projects:', result.length);
      return result;
    } catch (error) {
      console.error('[ProjectRoutes] Error listing projects:', error);
      throw error;
    }
  })
  .get('/:id', async ({ params }) => {
    return projectService.getById(db, params.id);
  })
  .get('/:id/workspace', async ({ params }) => {
    const project = await projectService.getById(db, params.id);
    return {
      workspaceId: project.workspaceId,
      projectId: params.id,
    };
  })
  .patch('/:id/git-details', async ({ params, body }) => {
    return projectService.updateGitDetails(db, params.id, body);
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      gitRepo: t.Union([t.String(), t.Null()]),
      machineHost: t.Union([t.String(), t.Null()]),
      gitUser: t.Union([t.String(), t.Null()]),
      gitBranch: t.Optional(t.Union([t.String(), t.Null()])),
    }),
  });
