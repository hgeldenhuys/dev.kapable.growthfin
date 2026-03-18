/**
 * LLM Configs Routes
 * CRUD operations for LLM service configurations
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { llmConfigs, type LLMProvider } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_PROMPTS } from './defaults';

export const llmConfigsRoutes = new Elysia({ prefix: '/llm-configs', tags: ['LLM Configs'] })
  /**
   * List all LLM configs
   */
  .get(
    '/',
    async ({ query }) => {
      const conditions = [];

      if (query.projectId !== undefined) {
        conditions.push(
          query.projectId === 'null' || query.projectId === ''
            ? eq(llmConfigs.projectId, null)
            : eq(llmConfigs.projectId, query.projectId)
        );
      }

      if (query.provider) {
        conditions.push(eq(llmConfigs.provider, query.provider));
      }

      if (query.isActive !== undefined) {
        conditions.push(eq(llmConfigs.isActive, query.isActive));
      }

      const configs = await db.query.llmConfigs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          credential: {
            columns: {
              id: true,
              name: true,
              provider: true,
              // Don't return encrypted key
            },
          },
        },
        orderBy: (llmConfigs, { desc }) => [desc(llmConfigs.createdAt)],
      });

      return { configs };
    },
    {
      query: t.Object({
        projectId: t.Optional(t.String()),
        provider: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'List LLM configs',
        description: 'Returns list of LLM configurations with their credentials (without API keys)',
      },
    }
  )

  /**
   * Get LLM config by ID
   */
  .get(
    '/:id',
    async ({ params, error }) => {
      const config = await db.query.llmConfigs.findFirst({
        where: eq(llmConfigs.id, params.id),
        with: {
          credential: {
            columns: {
              id: true,
              name: true,
              provider: true,
            },
          },
        },
      });

      if (!config) {
        return error(404, { error: 'LLM config not found' });
      }

      return { config };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get LLM config by ID',
      },
    }
  )

  /**
   * Get default prompts
   * Returns predefined system prompts for common use cases
   */
  .get(
    '/defaults/prompts',
    () => {
      return { prompts: DEFAULT_PROMPTS };
    },
    {
      detail: {
        summary: 'Get default prompts',
        description: 'Returns predefined system prompts for common LLM tasks',
      },
    }
  )

  /**
   * Create new LLM config
   */
  .post(
    '/',
    async ({ body }) => {
      const [config] = await db
        .insert(llmConfigs)
        .values({
          name: body.name,
          provider: body.provider,
          model: body.model,
          systemPrompt: body.systemPrompt,
          temperature: body.temperature ?? 70,
          maxTokens: body.maxTokens ?? 1000,
          apiUrl: body.apiUrl || null,
          credentialId: body.credentialId,
          projectId: body.projectId || null,
          isActive: body.isActive ?? true,
        })
        .returning();

      // Fetch with credential info
      const configWithCredential = await db.query.llmConfigs.findFirst({
        where: eq(llmConfigs.id, config.id),
        with: {
          credential: {
            columns: {
              id: true,
              name: true,
              provider: true,
            },
          },
        },
      });

      return { config: configWithCredential };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        provider: t.Union([
          t.Literal('openrouter'),
          t.Literal('openai'),
          t.Literal('anthropic'),
          t.Literal('together'),
          t.Literal('openapi'),
        ]),
        model: t.String({ minLength: 1 }),
        systemPrompt: t.String({ minLength: 1 }),
        temperature: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        maxTokens: t.Optional(t.Number({ minimum: 1 })),
        apiUrl: t.Optional(t.Union([t.String(), t.Null()])),
        credentialId: t.String(),
        projectId: t.Optional(t.Union([t.String(), t.Null()])),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Create LLM config',
        description: 'Create a new LLM configuration',
      },
    }
  )

  /**
   * Update LLM config
   */
  .put(
    '/:id',
    async ({ params, body, error }) => {
      const existing = await db.query.llmConfigs.findFirst({
        where: eq(llmConfigs.id, params.id),
      });

      if (!existing) {
        return error(404, { error: 'LLM config not found' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Update all provided fields
      if (body.name !== undefined) updateData.name = body.name;
      if (body.provider !== undefined) updateData.provider = body.provider;
      if (body.model !== undefined) updateData.model = body.model;
      if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
      if (body.temperature !== undefined) updateData.temperature = body.temperature;
      if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
      if (body.apiUrl !== undefined) updateData.apiUrl = body.apiUrl || null;
      if (body.credentialId !== undefined) updateData.credentialId = body.credentialId;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      await db.update(llmConfigs).set(updateData).where(eq(llmConfigs.id, params.id));

      // Fetch updated config with credential info
      const config = await db.query.llmConfigs.findFirst({
        where: eq(llmConfigs.id, params.id),
        with: {
          credential: {
            columns: {
              id: true,
              name: true,
              provider: true,
            },
          },
        },
      });

      return { config };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        provider: t.Optional(
          t.Union([
            t.Literal('openrouter'),
            t.Literal('openai'),
            t.Literal('anthropic'),
            t.Literal('together'),
            t.Literal('openapi'),
          ])
        ),
        model: t.Optional(t.String({ minLength: 1 })),
        systemPrompt: t.Optional(t.String({ minLength: 1 })),
        temperature: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        maxTokens: t.Optional(t.Number({ minimum: 1 })),
        apiUrl: t.Optional(t.Union([t.String(), t.Null()])),
        credentialId: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Update LLM config',
      },
    }
  )

  /**
   * Delete LLM config
   */
  .delete(
    '/:id',
    async ({ params, error }) => {
      const existing = await db.query.llmConfigs.findFirst({
        where: eq(llmConfigs.id, params.id),
      });

      if (!existing) {
        return error(404, { error: 'LLM config not found' });
      }

      await db.delete(llmConfigs).where(eq(llmConfigs.id, params.id));
      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Delete LLM config',
      },
    }
  );
