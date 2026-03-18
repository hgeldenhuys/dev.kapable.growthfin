/**
 * Models Routes
 * TTS models from providers
 */

import { Elysia } from 'elysia';
import { db } from '@agios/db/client';
import { asc } from 'drizzle-orm';
import { models } from '@agios/db/schema';

export const modelsRoutes = new Elysia({ prefix: '/models', tags: ['Models'] })
  /**
   * List all models
   */
  .get(
    '/',
    async () => {
      try {
        const allModels = await db.query.models.findMany({
          orderBy: (models, { asc }) => [asc(models.name)],
        });

        return { models: allModels };
      } catch (error) {
        console.error('Error fetching models:', error);
        return { models: [] };
      }
    },
    {
      detail: {
        summary: 'List models',
        description: 'Returns list of available TTS models',
      },
    }
  );
