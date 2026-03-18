/**
 * Audio Generation Routes
 * On-demand audio generation for chat messages
 *
 * Implements cache-first strategy:
 * 1. Check audio_cache table
 * 2. If cached, return URL immediately
 * 3. If not cached, queue generate-audio job
 * 4. Return job status and estimated time
 */

import { Elysia, t } from 'elysia';
import { audioService } from '../../../services/audio-service';
import { db } from '@agios/db/client';
import { hookEvents } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export const audioRoutes = new Elysia({ prefix: '/audio' })
  /**
   * POST /messages/:messageId/generate
   * Generate audio for a chat message (hook event)
   *
   * Cache-first strategy:
   * - If audio exists in cache, returns URL immediately (status: 'ready')
   * - If not cached, queues generation job (status: 'generating')
   */
  .post(
    '/messages/:messageId/generate',
    async ({ params, query, set }) => {
      const { messageId } = params;
      const { voiceId } = query;

      try {
        // 1. Verify message (hook event) exists
        const event = await db.query.hookEvents.findFirst({
          where: eq(hookEvents.id, messageId),
        });

        if (!event) {
          set.status = 404;
          return {
            error: 'Message not found',
            message: `No message found with ID: ${messageId}`,
          };
        }

        // 2. Check if message is too long (>5000 characters)
        const payload = event.payload as any;
        let textContent = '';

        switch (event.eventName) {
          case 'UserPromptSubmit':
            textContent = payload?.event?.prompt || '';
            break;
          case 'Stop':
          case 'SubagentStop':
            textContent =
              payload?.conversation?.message?.content
                ?.filter((c: any) => c.type === 'text')
                ?.map((c: any) => c.text)
                ?.join('\n') || '';
            break;
          default:
            set.status = 400;
            return {
              error: 'Unsupported message type',
              message: `Cannot generate audio for event type: ${event.eventName}`,
            };
        }

        if (textContent.length > 5000) {
          set.status = 400;
          return {
            error: 'Message too long',
            message: `Message is ${textContent.length} characters. Maximum length is 5000 characters.`,
            warning: 'Please consider breaking this into smaller messages.',
          };
        }

        // 3. Use audioService to get audio (cache-first)
        const result = await audioService.getAudio(messageId, voiceId);

        // 4. Return appropriate response
        if (result.status === 'ready') {
          return {
            status: 'ready',
            audioUrl: result.url,
            cached: true,
          };
        } else {
          return {
            status: 'generating',
            jobId: result.jobId,
            estimatedTime: 5000, // 5 seconds estimate
            message: 'Audio generation queued. Use SSE stream to monitor completion.',
          };
        }
      } catch (error) {
        console.error('[audio/generate] Error:', error);
        set.status = 500;
        return {
          error: 'Audio generation failed',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    {
      params: t.Object({
        messageId: t.String({ format: 'uuid', description: 'Hook event ID (message ID)' }),
      }),
      query: t.Object({
        voiceId: t.Optional(t.String({ format: 'uuid', description: 'Optional voice ID override' })),
      }),
      detail: {
        tags: ['Audio', 'Chat'],
        summary: 'Generate audio for chat message',
        description: 'Generate TTS audio for a chat message. Cache-first strategy: returns cached audio immediately if available, otherwise queues generation job.',
      },
    }
  );
