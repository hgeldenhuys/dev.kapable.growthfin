/**
 * Seed Status Module
 * Provides health check endpoint for seeding status
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { llmConfigs, workspaces, users } from '@agios/db';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env';

export const seedModule = new Elysia({ prefix: '/seed' })
  .get(
    '/status',
    async () => {
      const NODE_ENV = env.NODE_ENV || 'development';

      // Check seeding status by querying actual data
      const [llmConfigCount, userCount, workspaceCount] = await Promise.all([
        db.select().from(llmConfigs).then((rows) => rows.length),
        db.select().from(users).where(eq(users.id, '00000000-0000-0000-0000-000000000001')).then((rows) => rows.length),
        db.select().from(workspaces).then((rows) => rows.length),
      ]);

      // Determine seeding status based on environment
      const isSeeded = (() => {
        // Production/Staging: just check LLM configs
        if (NODE_ENV !== 'development') {
          return llmConfigCount >= 4; // Should have all 4 default configs
        }

        // Development: check all seeders
        return llmConfigCount >= 4 && userCount > 0 && workspaceCount >= 3;
      })();

      return {
        seeded: isSeeded,
        environment: NODE_ENV,
        seeders: {
          'llm-configs': {
            status: llmConfigCount >= 4 ? 'complete' : 'incomplete',
            count: llmConfigCount,
            expected: 4,
          },
          users: {
            status: userCount > 0 ? 'complete' : 'incomplete',
            count: userCount,
            expected: 1,
            note: NODE_ENV === 'development' ? undefined : 'Development only',
          },
          workspaces: {
            status: workspaceCount >= 3 ? 'complete' : 'incomplete',
            count: workspaceCount,
            expected: 3,
            note: NODE_ENV === 'development' ? undefined : 'Development only',
          },
        },
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ['Seed'],
        summary: 'Check seeding status',
        description: 'Returns the current seeding status for all seeders',
      },
    }
  );
