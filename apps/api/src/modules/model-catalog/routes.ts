/**
 * Model Catalog API Routes
 * Provides access to the centralized LLM model catalog
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { llmModelCatalog } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';

const VALID_PROVIDERS = ['openai', 'anthropic', 'together', 'openapi'];

/**
 * Format provider name for display
 * @param provider - Raw provider name (e.g., "anthropic", "meta-llama")
 * @returns Formatted display name (e.g., "Anthropic", "Meta")
 */
function formatProviderName(provider: string): string {
  const nameMap: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral AI',
  };

  return nameMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export const modelCatalogRoutes = new Elysia({ prefix: '/model-catalog', tags: ['Model Catalog'] })
  /**
   * List all models in catalog
   * GET /api/v1/model-catalog
   * Query params: provider, is_active
   */
  .get(
    '/',
    async ({ query, set }) => {
      const conditions = [];

      if (query.provider) {
        conditions.push(eq(llmModelCatalog.provider, query.provider));
      }

      if (query.is_active !== undefined) {
        conditions.push(eq(llmModelCatalog.isActive, query.is_active));
      } else {
        // Default to active models only
        conditions.push(eq(llmModelCatalog.isActive, true));
      }

      try {
        const models = await db.query.llmModelCatalog.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: (llmModelCatalog, { asc }) => [
            asc(llmModelCatalog.provider),
            asc(llmModelCatalog.displayName),
          ],
        });

        // Return models with costs as strings (PostgreSQL numeric returns strings)
        return { models };
      } catch (err) {
        console.error('[model-catalog] Error fetching models:', err);
        set.status = 500;
        return { error: 'Failed to fetch models' };
      }
    },
    {
      query: t.Object({
        provider: t.Optional(t.String()),
        is_active: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'List LLM models from catalog',
        description:
          'Returns available LLM models with costs and metadata. Defaults to active models only.',
      },
    }
  )

  /**
   * Create new model in catalog
   * POST /api/v1/model-catalog
   */
  .post(
    '/',
    async ({ body, set }) => {
      // Check for existing model before inserting
      const existing = await db.query.llmModelCatalog.findFirst({
        where: and(
          eq(llmModelCatalog.provider, body.provider),
          eq(llmModelCatalog.modelName, body.model_name)
        ),
      });

      if (existing) {
        set.status = 409;
        return { error: `Model '${body.model_name}' already exists for provider '${body.provider}'` };
      }

      try {
        const [model] = await db
          .insert(llmModelCatalog)
          .values({
            provider: body.provider,
            modelName: body.model_name,
            displayName: body.display_name,
            inputCostPer1MTokens: body.input_cost_per_1m_tokens.toString(),
            outputCostPer1MTokens: body.output_cost_per_1m_tokens.toString(),
            contextWindow: body.context_window ?? null,
            isActive: body.is_active ?? true,
            metadata: body.metadata ?? null,
          })
          .returning();

        return { model };
      } catch (err: any) {
        console.error('[model-catalog] Error creating model:', err);

        set.status = 500;
        return { error: 'Failed to create model' };
      }
    },
    {
      body: t.Object({
        provider: t.String({ minLength: 1 }),
        model_name: t.String({ minLength: 1 }),
        display_name: t.String({ minLength: 1 }),
        input_cost_per_1m_tokens: t.Number({ minimum: 0 }),
        output_cost_per_1m_tokens: t.Number({ minimum: 0 }),
        context_window: t.Optional(t.Union([t.Number({ minimum: 1 }), t.Null()])),
        is_active: t.Optional(t.Boolean()),
        metadata: t.Optional(t.Union([t.Object({}), t.Null()])),
      }),
      detail: {
        summary: 'Create new model',
        description: 'Add a new LLM model to the catalog',
      },
    }
  )

  /**
   * Update model in catalog
   * PUT /api/v1/model-catalog/:id
   */
  .put(
    '/:id',
    async ({ params, body, set }) => {
      // Check if model exists
      const existing = await db.query.llmModelCatalog.findFirst({
        where: eq(llmModelCatalog.id, params.id),
      });

      if (!existing) {
        set.status = 404;
        return { error: 'Model not found' };
      }

      try {
        const updateData: any = {
          updatedAt: new Date(),
        };

        // Update all provided fields
        if (body.provider !== undefined) updateData.provider = body.provider;
        if (body.model_name !== undefined) updateData.modelName = body.model_name;
        if (body.display_name !== undefined) updateData.displayName = body.display_name;
        if (body.input_cost_per_1m_tokens !== undefined) {
          updateData.inputCostPer1MTokens = body.input_cost_per_1m_tokens.toString();
        }
        if (body.output_cost_per_1m_tokens !== undefined) {
          updateData.outputCostPer1MTokens = body.output_cost_per_1m_tokens.toString();
        }
        if (body.context_window !== undefined) updateData.contextWindow = body.context_window;
        if (body.is_active !== undefined) updateData.isActive = body.is_active;
        if (body.metadata !== undefined) updateData.metadata = body.metadata;

        const [model] = await db
          .update(llmModelCatalog)
          .set(updateData)
          .where(eq(llmModelCatalog.id, params.id))
          .returning();

        return { model };
      } catch (err: any) {
        console.error('[model-catalog] Error updating model:', err);

        set.status = 500;
        return { error: 'Failed to update model' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        provider: t.Optional(t.String({ minLength: 1 })),
        model_name: t.Optional(t.String({ minLength: 1 })),
        display_name: t.Optional(t.String({ minLength: 1 })),
        input_cost_per_1m_tokens: t.Optional(t.Number({ minimum: 0 })),
        output_cost_per_1m_tokens: t.Optional(t.Number({ minimum: 0 })),
        context_window: t.Optional(t.Union([t.Number({ minimum: 1 }), t.Null()])),
        is_active: t.Optional(t.Boolean()),
        metadata: t.Optional(t.Union([t.Object({}), t.Null()])),
      }),
      detail: {
        summary: 'Update model',
        description: 'Update an existing model in the catalog',
      },
    }
  )

  /**
   * Delete model from catalog
   * DELETE /api/v1/model-catalog/:id
   */
  .delete(
    '/:id',
    async ({ params, set }) => {
      // Check if model exists
      const existing = await db.query.llmModelCatalog.findFirst({
        where: eq(llmModelCatalog.id, params.id),
      });

      if (!existing) {
        set.status = 404;
        return { error: 'Model not found' };
      }

      try {
        await db.delete(llmModelCatalog).where(eq(llmModelCatalog.id, params.id));
        return { success: true, message: 'Model deleted successfully' };
      } catch (err) {
        console.error('[model-catalog] Error deleting model:', err);
        set.status = 500;
        return { error: 'Failed to delete model' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Delete model',
        description: 'Delete a model from the catalog',
      },
    }
  )

  /**
   * Get list of providers with model counts
   * GET /api/v1/model-catalog/providers
   */
  .get(
    '/providers',
    async ({ set }) => {
      try {
        // Extract unique providers from model_name field (e.g., "anthropic/claude-haiku" -> "anthropic")
        const models = await db.query.llmModelCatalog.findMany({
          where: eq(llmModelCatalog.isActive, true),
          columns: {
            modelName: true,
          },
        });

        // Group by provider prefix
        const providerMap = new Map<string, number>();

        for (const model of models) {
          const parts = model.modelName.split('/');
          if (parts.length >= 2) {
            const provider = parts[0];
            // Filter out test models
            if (!provider.startsWith('test-') && !provider.startsWith('dup-') && !provider.startsWith('debug-')) {
              providerMap.set(provider, (providerMap.get(provider) || 0) + 1);
            }
          }
        }

        // Convert to array and sort by name
        const providers = Array.from(providerMap.entries())
          .map(([name, count]) => ({
            name,
            displayName: formatProviderName(name),
            modelCount: count,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        return { providers };
      } catch (error: any) {
        console.error('[model-catalog/providers] Error:', error);
        set.status = 500;
        return { error: 'Failed to fetch providers', details: error.message };
      }
    },
    {
      detail: {
        summary: 'Get list of providers',
        description: 'Returns list of unique providers with model counts for two-tier selection',
        tags: ['Model Catalog'],
      },
    }
  )

  /**
   * Get models for a specific provider
   * GET /api/v1/model-catalog/providers/:provider/models
   */
  .get(
    '/providers/:provider/models',
    async ({ params, set }) => {
      try {
        const { provider } = params;

        // Query models that start with "provider/"
        const models = await db.query.llmModelCatalog.findMany({
          where: and(
            eq(llmModelCatalog.isActive, true)
          ),
          orderBy: (llmModelCatalog, { asc }) => [asc(llmModelCatalog.displayName)],
        });

        // Filter to models matching this provider
        const filtered = models.filter((m) => {
          const parts = m.modelName.split('/');
          return parts.length >= 2 && parts[0] === provider;
        });

        return {
          provider,
          displayName: formatProviderName(provider),
          models: filtered
        };
      } catch (error: any) {
        console.error(`[model-catalog/providers/${params.provider}/models] Error:`, error);
        set.status = 500;
        return { error: 'Failed to fetch models for provider', details: error.message };
      }
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      detail: {
        summary: 'Get models for a specific provider',
        description: 'Returns all models for a given provider (e.g., anthropic, openai)',
        tags: ['Model Catalog'],
      },
    }
  )

  /**
   * Sync models from OpenRouter API
   * POST /api/v1/model-catalog/sync
   */
  .post(
    '/sync',
    async ({ set }) => {
      try {
        console.log('[model-catalog/sync] Fetching models from OpenRouter API...');

        // 1. Fetch from OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) {
          console.error('[model-catalog/sync] OpenRouter API error:', response.status, response.statusText);
          set.status = 500;
          return { error: 'Failed to fetch from OpenRouter API', details: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const models = data.data;
        console.log(`[model-catalog/sync] Fetched ${models.length} models from OpenRouter`);

        // 2. Sync ALL models (no filtering)
        const filtered = models;
        console.log(`[model-catalog/sync] Syncing all ${filtered.length} models`);

        // 3. Sync to database
        let added = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const model of filtered) {
          try {
            // Extract provider from model.id (e.g., "anthropic/claude-haiku" -> "anthropic")
            // All OpenRouter models use provider='openapi' in our catalog
            const provider = 'openapi';

            // Parse costs (convert from per-token to per-1M-tokens)
            const inputCost = parseFloat(model.pricing.prompt) * 1_000_000;
            const outputCost = parseFloat(model.pricing.completion) * 1_000_000;

            // Skip if no valid pricing
            if (inputCost === 0 && outputCost === 0) {
              skipped++;
              continue;
            }

            // Check if model exists
            const existing = await db.query.llmModelCatalog.findFirst({
              where: and(
                eq(llmModelCatalog.provider, provider),
                eq(llmModelCatalog.modelName, model.id)
              ),
            });

            if (existing) {
              // Update existing model
              await db
                .update(llmModelCatalog)
                .set({
                  displayName: model.name,
                  inputCostPer1MTokens: inputCost.toFixed(2),
                  outputCostPer1MTokens: outputCost.toFixed(2),
                  contextWindow: model.context_length || null,
                  updatedAt: new Date(),
                })
                .where(eq(llmModelCatalog.id, existing.id));
              updated++;
            } else {
              // Create new model
              await db.insert(llmModelCatalog).values({
                provider,
                modelName: model.id,
                displayName: model.name,
                inputCostPer1MTokens: inputCost.toFixed(2),
                outputCostPer1MTokens: outputCost.toFixed(2),
                contextWindow: model.context_length || null,
                isActive: true,
                metadata: {
                  architecture: model.architecture,
                  description: model.description?.substring(0, 500), // Truncate long descriptions
                  topProvider: model.top_provider,
                },
              });
              added++;
            }
          } catch (modelError: any) {
            console.error(`[model-catalog/sync] Error processing model ${model.id}:`, modelError);
            errors.push(`${model.id}: ${modelError.message}`);
            skipped++;
          }
        }

        const summary = {
          total: filtered.length,
          added,
          updated,
          skipped,
        };

        console.log('[model-catalog/sync] Sync completed:', summary);

        if (errors.length > 0) {
          console.warn('[model-catalog/sync] Errors encountered:', errors);
        }

        return {
          success: true,
          summary,
          message: `Synced ${filtered.length} models: ${added} added, ${updated} updated, ${skipped} skipped`,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error: any) {
        console.error('[model-catalog/sync] Sync error:', error);
        set.status = 500;
        return { error: 'Failed to sync models', details: error.message };
      }
    },
    {
      detail: {
        summary: 'Sync models from OpenRouter API',
        description: 'Fetches latest models and pricing from OpenRouter and updates the catalog. Filters to relevant providers (Anthropic, OpenAI, Meta, Google, Mistral).',
        tags: ['Model Catalog'],
      },
    }
  );
