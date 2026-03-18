/**
 * Assistant Chat Routes
 * AI assistant for CRM platform
 */

import { Elysia, t } from 'elysia';
import { AssistantService } from './service';

export const assistantRoutes = new Elysia({ prefix: '/assistant', tags: ['Assistant'] })
  /**
   * Stream chat response
   * POST /api/assistant/chat
   */
  .post(
    '/chat',
    async function* ({ body, error, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { conversationId, message, model } = body;

      if (!conversationId || !message) {
        yield `data: ${JSON.stringify({ error: 'conversationId and message are required' })}\n\n`;
        return;
      }

      try {
        // Stream chunks from Claude
        for await (const chunk of AssistantService.streamChatResponse(
          conversationId,
          message,
          model || 'chat-message-generator',
          body.extended_thinking ?? false
        )) {
          yield `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
        }

        // Signal completion
        yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[assistant/chat] Error:', errorMsg);
        yield `data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`;
      }
    },
    {
      body: t.Object({
        conversationId: t.String({ description: 'ID of the conversation' }),
        message: t.String({ description: 'User message to send' }),
        model: t.Optional(t.String({ description: 'LLM config name to use (defaults to chat-message-generator)' })),
        extended_thinking: t.Optional(t.Boolean({ description: 'Enable extended thinking mode for Claude models' })),
      }),
      detail: {
        summary: 'Stream chat response',
        description: 'Send a message and stream the AI assistant response via SSE',
      },
    }
  )

  /**
   * Get conversation by ID
   * GET /api/assistant/conversations/:id
   */
  .get(
    '/conversations/:id',
    async ({ params, error, set }) => {
      try {
        const conversation = await AssistantService.getConversation(params.id);

        if (!conversation) {
          set.status = 404;
          return { error: 'Conversation not found' };
        }

        return { conversation };
      } catch (err) {
        console.error('[GET /conversations/:id] Error:', err);
        set.status = 500;
        return { error: 'Failed to fetch conversation' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get conversation',
        description: 'Get a conversation with all its messages',
      },
    }
  )

  /**
   * List conversations for workspace
   * GET /api/assistant/conversations
   */
  .get(
    '/conversations',
    async ({ query }) => {
      const conversations = await AssistantService.listConversations(
        query.workspaceId,
        query.limit
      );

      return { conversations };
    },
    {
      query: t.Object({
        workspaceId: t.String({ description: 'Workspace ID to filter conversations' }),
        limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
      }),
      detail: {
        summary: 'List conversations',
        description: 'List conversations for a workspace',
      },
    }
  )

  /**
   * Create new conversation
   * POST /api/assistant/conversations
   */
  .post(
    '/conversations',
    async ({ body }) => {
      const conversation = await AssistantService.createConversation(
        body.workspaceId,
        body.projectId
      );

      return { conversation };
    },
    {
      body: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
        projectId: t.Optional(t.String({ description: 'Optional project ID' })),
      }),
      detail: {
        summary: 'Create conversation',
        description: 'Create a new conversation',
      },
    }
  )

  /**
   * Delete conversation
   * DELETE /api/assistant/conversations/:id
   */
  .delete(
    '/conversations/:id',
    async ({ params }) => {
      await AssistantService.deleteConversation(params.id);
      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Delete conversation',
        description: 'Delete a conversation and all its messages',
      },
    }
  )

  /**
   * Get available LLM models
   * GET /api/assistant/models
   */
  .get(
    '/models',
    async ({ query, set }) => {
      try {
        const models = await AssistantService.getAvailableModels(query.workspaceId);
        return { models };
      } catch (err) {
        console.error('[GET /models] Error:', err);
        set.status = 500;
        return { error: 'Failed to fetch available models' };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ description: 'Workspace ID to filter models' }),
      }),
      detail: {
        summary: 'Get available models',
        description: 'Get list of available LLM configs for chat',
      },
    }
  )

  /**
   * Get available credentials
   * GET /api/assistant/credentials
   */
  .get(
    '/credentials',
    async ({ set }) => {
      console.log('[GET /credentials] Route hit');
      try {
        const credentials = await AssistantService.getAvailableCredentials();
        console.log('[GET /credentials] Success:', credentials.length, 'credentials');
        return { credentials };
      } catch (err) {
        console.error('[GET /credentials] Error:', err);
        set.status = 500;
        return { error: 'Failed to fetch available credentials' };
      }
    },
    {
      detail: {
        summary: 'Get available credentials',
        description: 'Get list of active LLM credentials with model counts',
      },
    }
  )

  /**
   * Get providers for a credential
   * GET /api/assistant/credentials/:credentialId/providers
   */
  .get(
    '/credentials/:credentialId/providers',
    async ({ params, set }) => {
      try {
        const providers = await AssistantService.getProvidersByCredential(params.credentialId);
        return { providers };
      } catch (err) {
        console.error('[GET /credentials/:credentialId/providers] Error:', err);
        set.status = err instanceof Error && err.message.includes('not found') ? 404 : 500;
        return { error: err instanceof Error ? err.message : 'Failed to fetch providers' };
      }
    },
    {
      params: t.Object({
        credentialId: t.String({ format: 'uuid', description: 'Credential ID' }),
      }),
      detail: {
        summary: 'Get providers by credential',
        description: 'Get list of providers accessible via a specific credential',
      },
    }
  )

  /**
   * Get models for a credential and provider
   * GET /api/assistant/credentials/:credentialId/providers/:provider/models
   */
  .get(
    '/credentials/:credentialId/providers/:provider/models',
    async ({ params, set }) => {
      try {
        const models = await AssistantService.getModelsByCredentialAndProvider(
          params.credentialId,
          params.provider
        );
        return { models };
      } catch (err) {
        console.error('[GET /credentials/:credentialId/providers/:provider/models] Error:', err);
        set.status = err instanceof Error && err.message.includes('not found') ? 404 : 500;
        return { error: err instanceof Error ? err.message : 'Failed to fetch models' };
      }
    },
    {
      params: t.Object({
        credentialId: t.String({ format: 'uuid', description: 'Credential ID' }),
        provider: t.String({ description: 'Provider name (e.g., openai, anthropic)' }),
      }),
      detail: {
        summary: 'Get models by credential and provider',
        description: 'Get list of models accessible via a specific credential and provider',
      },
    }
  );
