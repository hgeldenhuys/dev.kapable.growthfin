/**
 * AI Assistant Voice Routes
 * STT (voice-to-text + chat) and TTS (text-to-speech) endpoints
 */

import { Elysia, t } from 'elysia';
import { env } from '../../../config/env';
import { ElevenLabsProvider } from '../../../services/audio/elevenlabs-provider';
import { ConversationService } from '../services/conversation.service';
import { ConfigService } from '../services/config.service';
import { ContextService } from '../services/context.service';
import { OpenRouterService, type ChatMessage } from '../services/openrouter.service';
import { ToolExecutor } from '../services/tools/tool-executor.service';

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs "Rachel"

export const voiceRoutes = new Elysia({ prefix: '/workspaces/:workspaceId/chat' })
  /**
   * POST /workspaces/:workspaceId/chat/voice
   * Transcribe audio and send as chat message
   */
  .post(
    '/voice',
    async ({ body, params, set }) => {
      try {
        const { workspaceId } = params;
        const { audio, userId, context: contextStr } = body;

        if (!env.ELEVENLABS_API_KEY) {
          set.status = 503;
          return { error: 'Voice service not configured (ELEVENLABS_API_KEY missing)' };
        }

        if (!audio || !(audio instanceof Blob || audio instanceof File)) {
          set.status = 400;
          return { error: 'No audio file provided' };
        }

        // Transcribe audio
        const provider = new ElevenLabsProvider(env.ELEVENLABS_API_KEY);
        const audioBuffer = Buffer.from(await (audio as Blob).arrayBuffer());
        const filename = (audio as any).name || 'recording.webm';
        const transcription = await provider.transcribeBuffer(audioBuffer, filename);

        if (!transcription.text || !transcription.text.trim()) {
          return {
            success: true,
            transcription: '',
            response: null,
            driver_actions: [],
          };
        }

        const message = transcription.text.trim();

        // Parse optional context
        let context: any = {};
        if (contextStr) {
          try {
            context = typeof contextStr === 'string' ? JSON.parse(contextStr) : contextStr;
          } catch {
            // ignore parse errors
          }
        }

        // -- Reuse the same chat flow as /message --
        let conversation;
        try {
          conversation = await ConversationService.getOrCreateConversation(userId, workspaceId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('violates foreign key constraint') ||
            (error as any)?.code === '23503'
          ) {
            set.status = 400;
            return { error: 'Invalid user or workspace' };
          }
          throw error;
        }

        const systemPrompt = await ContextService.buildSystemContext({
          userId,
          workspaceId,
          currentRoute: context?.currentRoute,
          routeParams: context?.routeParams,
          additionalContext: context?.additionalContext,
        });

        const history = await ConversationService.getConversationHistory(conversation.id, 20);

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        const userMessage = await ConversationService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: message,
          context: ContextService.formatContext({ ...context, source: 'voice' }),
        });

        let openRouterConfig;
        try {
          openRouterConfig = await ConfigService.getOpenRouterConfig(workspaceId);
        } catch (error) {
          set.status = 400;
          return { error: error instanceof Error ? error.message : 'Failed to get AI configuration' };
        }

        let aiResponse;
        let allDriverActions: any[] = [];
        const maxIterations = 5;
        let iteration = 0;

        while (iteration < maxIterations) {
          iteration++;
          aiResponse = await OpenRouterService.sendMessage({
            messages,
            config: openRouterConfig,
            tools: OpenRouterService.TOOLS,
          });

          if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) break;

          const { results: toolResults, driverActions } = await ToolExecutor.executeTools(
            aiResponse.tool_calls.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              parameters: JSON.parse(tc.function.arguments),
            })),
            { workspaceId, conversationId: conversation.id, messageId: userMessage.id, userId }
          );

          if (driverActions.length > 0) allDriverActions.push(...driverActions);

          messages.push({
            role: 'assistant',
            content: aiResponse.content || '',
            tool_calls: aiResponse.tool_calls,
          });

          for (const toolResult of toolResults) {
            messages.push({
              role: 'tool',
              content: toolResult.content,
              tool_call_id: toolResult.tool_call_id,
            });
          }
        }

        if (iteration >= maxIterations && (!aiResponse || !aiResponse.content)) {
          messages.push({
            role: 'system',
            content: 'Please provide a final response to the user based on the tool results above. Do not call more tools.',
          });
          aiResponse = await OpenRouterService.sendMessage({
            messages,
            config: openRouterConfig,
            tools: [],
          });
        }

        const assistantMessage = await ConversationService.addMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: aiResponse!.content || 'Tool execution completed.',
          model: aiResponse!.model,
          tokenUsage: aiResponse!.tokenUsage,
        });

        return {
          success: true,
          transcription: message,
          id: assistantMessage.id,
          conversationId: conversation.id,
          role: 'assistant' as const,
          content: aiResponse!.content || 'Tool execution completed.',
          createdAt: assistantMessage.createdAt.toISOString(),
          driver_actions: allDriverActions.length > 0 ? allDriverActions : undefined,
        };
      } catch (error) {
        console.error('[POST /chat/voice] Error:', error);
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
        audio: t.Any({ description: 'Audio recording file' }),
        userId: t.String({ description: 'User ID' }),
        context: t.Optional(t.Any({ description: 'JSON context string' })),
      }),
      type: 'multipart/form-data',
      detail: {
        tags: ['AI Assistant'],
        summary: 'Voice message (STT + chat)',
        description: 'Transcribe audio and send as AI chat message',
      },
    }
  )

  /**
   * POST /workspaces/:workspaceId/chat/tts
   * Convert text to speech — condenses the AI response into natural spoken form first
   */
  .post(
    '/tts',
    async ({ body, params, set }) => {
      try {
        if (!env.ELEVENLABS_API_KEY) {
          set.status = 503;
          return { error: 'Voice service not configured (ELEVENLABS_API_KEY missing)' };
        }

        const { text, voiceId } = body;
        const { workspaceId } = params;

        // Condense the AI response into a brief, natural spoken summary
        let spokenText = text;
        try {
          const openRouterConfig = await ConfigService.getOpenRouterConfig(workspaceId);
          const condensed = await OpenRouterService.sendMessage({
            messages: [
              {
                role: 'system',
                content: 'You are a voice assistant. Convert the following AI chat response into a brief, natural spoken summary (2-3 sentences max). Strip all markdown, emojis, bullet points, and formatting. Be conversational and concise — imagine you are speaking directly to the user. Do not say "here is a summary" or similar meta-phrases. Just speak naturally.',
              },
              { role: 'user', content: text },
            ],
            config: {
              ...openRouterConfig,
              maxTokens: 200,
              temperature: 0.5,
            },
          });
          if (condensed.content && condensed.content.trim().length > 10) {
            spokenText = condensed.content.trim();
          }
        } catch (err) {
          // If condensation fails, fall back to raw text (truncated)
          console.error('[TTS] Condensation failed, using raw text:', err);
          spokenText = text.replace(/[#*_`~\[\]()>|{}]/g, '').substring(0, 500);
        }

        const provider = new ElevenLabsProvider(env.ELEVENLABS_API_KEY);
        const audioBuffer = await provider.generateSpeech(
          spokenText,
          voiceId || DEFAULT_VOICE_ID,
          'eleven_flash_v2_5' // Faster model for TTS
        );

        set.headers['content-type'] = 'audio/mpeg';
        set.headers['content-length'] = String(audioBuffer.length);
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(audioBuffer.length),
          },
        });
      } catch (error) {
        console.error('[POST /chat/tts] Error:', error);
        set.status = 500;
        return {
          error: 'TTS generation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
      }),
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 5000 }),
        voiceId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Assistant'],
        summary: 'Text-to-speech',
        description: 'Condenses AI response into natural speech, then generates audio (MP3)',
      },
    }
  );
