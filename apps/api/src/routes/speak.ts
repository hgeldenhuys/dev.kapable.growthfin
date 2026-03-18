/**
 * Speak API Routes
 * Serves audio files for hook events via TTS
 */

import { Elysia, t } from 'elysia';
import { audioService } from '../services/audio-service';
import { readFile } from 'fs/promises';

export const speakRoutes = new Elysia({ prefix: '/speak' })
  /**
   * GET /speak/:hookEventId
   * Get audio URL for a hook event
   * Returns CDN URL if cached, otherwise 202 Accepted with job ID
   */
  .get(
    '/:hookEventId',
    async ({ params, query, set }) => {
      const { hookEventId } = params;
      const { voiceId } = query;

      try {
        const result = await audioService.getAudio(hookEventId, voiceId);

        if (result.status === 'ready' && result.url) {
          // Return CDN URL for client to fetch
          return {
            status: 'ready',
            url: result.url, // Relative URL like /cdn/audio/filename.mp3
          };
        }

        // Still generating
        set.status = 202; // Accepted
        return {
          status: 'generating',
          jobId: result.jobId,
          message: 'Audio generation in progress. Please retry in a few seconds.',
        };
      } catch (error: any) {
        // Handle SKIP_AUDIO errors (thinking-only responses, empty content, etc.)
        if (error.message?.startsWith('SKIP_AUDIO:')) {
          console.log(`⏭️ Skipping audio for ${hookEventId}: ${error.message}`);
          set.status = 204; // No Content - nothing to generate
          return;
        }

        // Handle "No text content" errors as 204 instead of 500
        if (error.message?.includes('No text content found')) {
          console.log(`⏭️ No content for audio generation: ${hookEventId}`);
          set.status = 204; // No Content
          return;
        }

        console.error(`❌ Error getting audio for ${hookEventId}:`, error);
        set.status = 500;
        return {
          error: 'Failed to generate audio',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({
        hookEventId: t.String(),
      }),
      query: t.Object({
        voiceId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Audio'],
        summary: 'Get audio for hook event',
        description:
          'Returns MP3 audio file if cached, otherwise queues generation and returns 202 Accepted. Clients should retry after a few seconds.',
        responses: {
          200: {
            description: 'MP3 audio file',
            content: {
              'audio/mpeg': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          202: {
            description: 'Audio generation in progress',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['generating'] },
                    jobId: { type: 'string', nullable: true },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Error generating audio',
          },
        },
      },
    }
  );
