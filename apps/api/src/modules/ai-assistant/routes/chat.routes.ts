/**
 * AI Chat Routes
 * Endpoints for AI assistant chat functionality
 */

import { Elysia, t } from 'elysia';
import { ConversationService } from '../services/conversation.service';
import { ConfigService } from '../services/config.service';
import { ContextService } from '../services/context.service';
import { OpenRouterService, type ChatMessage } from '../services/openrouter.service';
import { ToolExecutor } from '../services/tools/tool-executor.service';

export const chatRoutes = new Elysia({ prefix: '/workspaces/:workspaceId/chat' })
  /**
   * POST /workspaces/:workspaceId/ai/chat/message
   * Send message to AI and get response
   */
  .post(
    '/message',
    async ({ body, params, set }) => {
      try {
        const { workspaceId } = params;
        const { message, context } = body;

        // TODO: Get userId from authenticated session
        // For now, using a placeholder - will be replaced with actual auth
        const userId = context?.userId || 'test-user-id';

        // Get or create active conversation
        let conversation;
        try {
          conversation = await ConversationService.getOrCreateConversation(
            userId,
            workspaceId
          );
        } catch (error) {
          // BUG-AI-001 FIX: Better error handling for conversation creation failures
          // Common causes: user doesn't exist, workspace doesn't exist
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : '';
          const errorCause = (error as any)?.cause;

          // Check for foreign key constraint violation (Postgres code 23503)
          // Can appear in message, stack, or cause
          const isForeignKeyError =
            errorMessage.includes('violates foreign key constraint') ||
            errorMessage.includes('_user_id_fkey') ||
            errorMessage.includes('_workspace_id_fkey') ||
            errorStack?.includes('violates foreign key constraint') ||
            errorStack?.includes('_user_id_fkey') ||
            errorStack?.includes('_workspace_id_fkey') ||
            (error as any)?.code === '23503' ||
            errorCause?.code === '23503';

          if (isForeignKeyError) {
            set.status = 400;
            return {
              error: 'Invalid user or workspace',
              details: 'User or workspace does not exist. Please verify user is authenticated.',
            };
          }
          throw error; // Re-throw unexpected errors
        }

        // Build system context
        const systemPrompt = await ContextService.buildSystemContext({
          userId,
          workspaceId,
          currentRoute: context?.currentRoute,
          routeParams: context?.routeParams,
          additionalContext: context?.additionalContext,
        });

        // Get conversation history
        const history = await ConversationService.getConversationHistory(conversation.id, 20);

        // Build messages array for OpenRouter
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        // Save user message
        const userMessage = await ConversationService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: message,
          context: ContextService.formatContext(context || {}),
        });

        // Get OpenRouter configuration
        let openRouterConfig;
        try {
          openRouterConfig = await ConfigService.getOpenRouterConfig(workspaceId);
        } catch (error) {
          set.status = 400;
          return {
            error: error instanceof Error ? error.message : 'Failed to get AI configuration',
          };
        }

        // Tool execution loop: Keep calling OpenRouter until no more tool calls
        let aiResponse;
        let toolInvocationSummary: any[] = [];
        let allDriverActions: any[] = [];
        const maxIterations = 5; // Prevent infinite loops
        let iteration = 0;

        try {
          while (iteration < maxIterations) {
            iteration++;

            // Call OpenRouter API with tools
            aiResponse = await OpenRouterService.sendMessage({
              messages,
              config: openRouterConfig,
              tools: OpenRouterService.TOOLS,
            });

            // If no tool calls, we have final response
            if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) {
              break;
            }

            // Execute tool calls
            console.log(
              `[chat/message] Executing ${aiResponse.tool_calls.length} tool calls (iteration ${iteration})`
            );

            const { results: toolResults, driverActions } = await ToolExecutor.executeTools(
              aiResponse.tool_calls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                parameters: JSON.parse(tc.function.arguments),
              })),
              {
                workspaceId,
                conversationId: conversation.id,
                messageId: userMessage.id,
                userId,
              }
            );

            // Accumulate driver actions across iterations
            if (driverActions.length > 0) {
              allDriverActions.push(...driverActions);
            }

            // Track tool invocations for response
            toolInvocationSummary.push(
              ...aiResponse.tool_calls.map((tc, idx) => {
                const result = JSON.parse(toolResults[idx].content);
                return {
                  tool: tc.function.name,
                  status: result.error ? 'error' : 'success',
                  error: result.error ? result.message : undefined,
                };
              })
            );

            // Add assistant message with tool calls to conversation
            messages.push({
              role: 'assistant',
              content: aiResponse.content || '',
              tool_calls: aiResponse.tool_calls,
            });

            // Add tool results to conversation
            for (const toolResult of toolResults) {
              messages.push({
                role: 'tool',
                content: toolResult.content,
                tool_call_id: toolResult.tool_call_id,
              });
            }
          }

          if (iteration >= maxIterations) {
            console.warn('[chat/message] Max tool execution iterations reached');
            // If we hit max iterations without final content, ask AI for summary
            if (!aiResponse || !aiResponse.content) {
              messages.push({
                role: 'system',
                content: 'Please provide a final response to the user based on the tool results above. Do not call more tools.',
              });
              aiResponse = await OpenRouterService.sendMessage({
                messages,
                config: openRouterConfig,
                tools: [], // No more tools allowed
              });
            }
          }
        } catch (error) {
          set.status = 502;
          return {
            error: 'Failed to get response from AI service',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
        }

        // Save assistant message (final response after tool use)
        const assistantMessage = await ConversationService.addMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: aiResponse!.content || 'Tool execution completed.',
          model: aiResponse!.model,
          tokenUsage: aiResponse!.tokenUsage,
        });

        // Return response
        return {
          id: assistantMessage.id,
          conversationId: conversation.id,
          role: 'assistant' as const,
          content: aiResponse!.content || 'Tool execution completed.',
          createdAt: assistantMessage.createdAt.toISOString(),
          model: aiResponse!.model,
          tokenUsage: aiResponse!.tokenUsage,
          tool_invocations: toolInvocationSummary.length > 0 ? toolInvocationSummary : undefined,
          driver_actions: allDriverActions.length > 0 ? allDriverActions : undefined,
        };
      } catch (error) {
        console.error('[POST /chat/message] Error:', error);
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
        message: t.String({ minLength: 1, maxLength: 10000 }),
        context: t.Optional(
          t.Object({
            userId: t.Optional(t.String()),
            currentRoute: t.Optional(t.String()),
            routeParams: t.Optional(t.Record(t.String(), t.String())),
            additionalContext: t.Optional(t.Any()),
          })
        ),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Send message to AI',
        description: 'Send a message to the AI assistant and get a response',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/ai/chat/conversation
   * Get current active conversation with messages
   */
  .get(
    '/conversation',
    async ({ params, query, set }) => {
      try {
        const { workspaceId } = params;

        // TODO: Get userId from authenticated session
        const userId = query.userId || 'test-user-id';

        // Get active conversation
        const conversation = await ConversationService.getActiveConversation(userId, workspaceId);

        if (!conversation) {
          set.status = 404;
          return {
            error: 'No active conversation found',
          };
        }

        // Get messages
        const messages = await ConversationService.getConversationHistory(conversation.id, 100);

        return {
          id: conversation.id,
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          })),
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error('[GET /chat/conversation] Error:', error);
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
      query: t.Object({
        userId: t.Optional(t.String({ description: 'User ID (temporary, will use auth)' })),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Get conversation',
        description: 'Get the current active conversation with all messages',
      },
    }
  )

  /**
   * POST /workspaces/:workspaceId/ai/chat/clear
   * Clear current conversation and create a new one
   */
  .post(
    '/clear',
    async ({ params, query, set }) => {
      try {
        const { workspaceId } = params;

        // TODO: Get userId from authenticated session
        const userId = query.userId || 'test-user-id';

        // Get active conversation
        const conversation = await ConversationService.getActiveConversation(userId, workspaceId);

        if (conversation) {
          // Clear the conversation (set clearedAt)
          await ConversationService.clearConversation(conversation.id);
        }

        // Create new conversation
        const newConversation = await ConversationService.createConversation(userId, workspaceId);

        return {
          success: true,
          newConversationId: newConversation.id,
          message: 'Conversation cleared and new conversation created',
        };
      } catch (error) {
        console.error('[POST /chat/clear] Error:', error);
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
      query: t.Object({
        userId: t.Optional(t.String({ description: 'User ID (temporary, will use auth)' })),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Clear conversation',
        description: 'Clear the current conversation and start a new one',
      },
    }
  );
