/**
 * AI Call Scripts Routes
 * CRUD endpoints for managing AI call script templates
 * Phase I: AI Voice Calling - Script Templates
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { crmAiCallScripts } from '@agios/db/schema';

export const aiCallScriptRoutes = new Elysia({ prefix: '/ai-call-scripts' })
  /**
   * GET / - List all AI call scripts for a workspace
   */
  .get(
    '/',
    async ({ db, query }) => {
      const scripts = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.workspaceId, query.workspaceId),
            query.activeOnly === 'true' ? eq(crmAiCallScripts.isActive, true) : undefined
          )
        )
        .orderBy(desc(crmAiCallScripts.isDefault), desc(crmAiCallScripts.useCount));

      return { scripts };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        activeOnly: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'List AI call scripts',
        description: 'List all AI call scripts for a workspace',
      },
    }
  )

  /**
   * GET /:id - Get a single AI call script
   */
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const [script] = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.id, params.id),
            eq(crmAiCallScripts.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!script) {
        set.status = 404;
        return { error: 'Script not found' };
      }

      return { script };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'Get AI call script',
        description: 'Get a single AI call script by ID',
      },
    }
  )

  /**
   * POST / - Create a new AI call script
   */
  .post(
    '/',
    async ({ db, body, set }) => {
      try {
        // If this is being set as default, unset other defaults first
        if (body.isDefault) {
          await db
            .update(crmAiCallScripts)
            .set({ isDefault: false })
            .where(eq(crmAiCallScripts.workspaceId, body.workspaceId));
        }

        const [script] = await db
          .insert(crmAiCallScripts)
          .values({
            workspaceId: body.workspaceId,
            name: body.name,
            description: body.description,
            purpose: body.purpose || 'custom',
            objective: body.objective,
            opening: body.opening,
            talkingPoints: body.talkingPoints || [],
            objectionHandlers: body.objectionHandlers || {},
            qualifyingQuestions: body.qualifyingQuestions || [],
            closing: body.closing,
            endConditions: body.endConditions,
            systemPrompt: body.systemPrompt,
            voiceStyle: body.voiceStyle,
            isActive: body.isActive ?? true,
            isDefault: body.isDefault ?? false,
          })
          .returning();

        return { script };
      } catch (error) {
        console.error('[AI Call Scripts] Create error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to create script',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        purpose: t.Optional(t.String()),
        objective: t.Optional(t.String()),
        opening: t.String(),
        talkingPoints: t.Optional(t.Array(t.String())),
        objectionHandlers: t.Optional(t.Record(t.String(), t.String())),
        qualifyingQuestions: t.Optional(t.Array(t.String())),
        closing: t.Optional(t.String()),
        endConditions: t.Optional(t.Object({
          success: t.Array(t.String()),
          failure: t.Array(t.String()),
          neutral: t.Array(t.String()),
        })),
        systemPrompt: t.Optional(t.String()),
        voiceStyle: t.Optional(t.Object({
          tone: t.Optional(t.String()),
          pace: t.Optional(t.String()),
          enthusiasm: t.Optional(t.String()),
        })),
        isActive: t.Optional(t.Boolean()),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'Create AI call script',
        description: 'Create a new AI call script template',
      },
    }
  )

  /**
   * PATCH /:id - Update an AI call script
   */
  .patch(
    '/:id',
    async ({ db, params, body, set }) => {
      try {
        // Verify script exists
        const [existing] = await db
          .select()
          .from(crmAiCallScripts)
          .where(
            and(
              eq(crmAiCallScripts.id, params.id),
              eq(crmAiCallScripts.workspaceId, body.workspaceId)
            )
          )
          .limit(1);

        if (!existing) {
          set.status = 404;
          return { error: 'Script not found' };
        }

        // If this is being set as default, unset other defaults first
        if (body.isDefault) {
          await db
            .update(crmAiCallScripts)
            .set({ isDefault: false })
            .where(eq(crmAiCallScripts.workspaceId, body.workspaceId));
        }

        const [script] = await db
          .update(crmAiCallScripts)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(crmAiCallScripts.id, params.id))
          .returning();

        return { script };
      } catch (error) {
        console.error('[AI Call Scripts] Update error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to update script',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        purpose: t.Optional(t.String()),
        objective: t.Optional(t.String()),
        opening: t.Optional(t.String()),
        talkingPoints: t.Optional(t.Array(t.String())),
        objectionHandlers: t.Optional(t.Record(t.String(), t.String())),
        qualifyingQuestions: t.Optional(t.Array(t.String())),
        closing: t.Optional(t.String()),
        endConditions: t.Optional(t.Object({
          success: t.Array(t.String()),
          failure: t.Array(t.String()),
          neutral: t.Array(t.String()),
        })),
        systemPrompt: t.Optional(t.String()),
        voiceStyle: t.Optional(t.Object({
          tone: t.Optional(t.String()),
          pace: t.Optional(t.String()),
          enthusiasm: t.Optional(t.String()),
        })),
        isActive: t.Optional(t.Boolean()),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'Update AI call script',
        description: 'Update an existing AI call script',
      },
    }
  )

  /**
   * DELETE /:id - Delete an AI call script
   */
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      try {
        const [deleted] = await db
          .delete(crmAiCallScripts)
          .where(
            and(
              eq(crmAiCallScripts.id, params.id),
              eq(crmAiCallScripts.workspaceId, query.workspaceId)
            )
          )
          .returning();

        if (!deleted) {
          set.status = 404;
          return { error: 'Script not found' };
        }

        return { success: true, deleted };
      } catch (error) {
        console.error('[AI Call Scripts] Delete error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to delete script',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'Delete AI call script',
        description: 'Delete an AI call script',
      },
    }
  )

  /**
   * POST /:id/increment-use - Increment use count (called when script is used)
   */
  .post(
    '/:id/increment-use',
    async ({ db, params, body }) => {
      await db
        .update(crmAiCallScripts)
        .set({
          useCount: (await db
            .select({ useCount: crmAiCallScripts.useCount })
            .from(crmAiCallScripts)
            .where(eq(crmAiCallScripts.id, params.id))
            .limit(1)
          )[0]?.useCount ?? 0 + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crmAiCallScripts.id, params.id),
            eq(crmAiCallScripts.workspaceId, body.workspaceId)
          )
        );

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Call Scripts'],
        summary: 'Increment script use count',
        description: 'Track script usage for analytics',
      },
    }
  );
