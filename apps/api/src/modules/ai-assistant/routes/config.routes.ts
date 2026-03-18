/**
 * AI Configuration Routes
 * Endpoints for AI assistant configuration
 */

import { Elysia, t } from 'elysia';
import { ConfigService } from '../services/config.service';

export const configRoutes = new Elysia({ prefix: '/workspaces/:workspaceId/config' })
  /**
   * GET /workspaces/:workspaceId/ai/config
   * Get AI configuration for workspace
   */
  .get(
    '/',
    async ({ params, set }) => {
      try {
        const { workspaceId } = params;
        const config = await ConfigService.getConfig(workspaceId);

        return {
          llmConfigId: config.llmConfigId,
          llmConfigName: config.llmConfigName,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          hasApiKey: config.hasApiKey,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error('[GET /config] Error:', error);
        set.status = 500;
        return {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Get AI configuration',
        description: 'Get AI assistant configuration for workspace',
      },
    }
  )

  /**
   * PUT /workspaces/:workspaceId/ai/config
   * Update AI configuration for workspace
   */
  .put(
    '/',
    async ({ params, body, set }) => {
      try {
        const { workspaceId } = params;

        // Validate model if provided
        if (body.model && !body.model.includes('/')) {
          set.status = 400;
          return {
            error: 'Invalid model format. Expected format: provider/model-name',
          };
        }

        // Validate maxTokens if provided
        if (body.maxTokens !== undefined && (body.maxTokens < 1 || body.maxTokens > 100000)) {
          set.status = 400;
          return {
            error: 'maxTokens must be between 1 and 100000',
          };
        }

        // Validate temperature if provided
        if (body.temperature !== undefined && (body.temperature < 0 || body.temperature > 2)) {
          set.status = 400;
          return {
            error: 'temperature must be between 0 and 2',
          };
        }

        // Update configuration
        const config = await ConfigService.updateConfig(workspaceId, {
          llmConfigId: body.llmConfigId,
          model: body.model,
          maxTokens: body.maxTokens,
          temperature: body.temperature,
          apiKey: body.apiKey,
        });

        return {
          success: true,
          config: {
            llmConfigId: config.llmConfigId,
            llmConfigName: config.llmConfigName,
            model: config.model,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            hasApiKey: config.hasApiKey,
          },
        };
      } catch (error) {
        console.error('[PUT /config] Error:', error);
        set.status = 500;
        return {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
      }),
      body: t.Object({
        llmConfigId: t.Optional(t.Union([t.String(), t.Null()], { description: 'LLM config ID to use (preferred)' })),
        model: t.Optional(t.String({ description: 'AI model (e.g., anthropic/claude-3.5-sonnet)' })),
        maxTokens: t.Optional(t.Number({ description: 'Maximum tokens per response' })),
        temperature: t.Optional(t.Number({ description: 'Temperature (0-2)' })),
        apiKey: t.Optional(t.String({ description: 'OpenRouter API key (will be encrypted)' })),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Update AI configuration',
        description: 'Update AI assistant configuration for workspace',
      },
    }
  );
