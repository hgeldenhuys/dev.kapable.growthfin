/**
 * CDN Routes
 * Serves static audio files
 */

import { Elysia } from 'elysia';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const cdnRoutes = new Elysia({ prefix: '/cdn' })
  /**
   * GET /cdn/audio/:filename
   * Serve audio files from public/cdn/audio directory
   */
  .get(
    '/audio/:filename',
    async ({ params, set }) => {
      const { filename } = params;

      // Security: Only allow alphanumeric, hyphens, and .mp3 extension
      if (!/^[a-f0-9\-v]+\.mp3$/.test(filename)) {
        set.status = 400;
        return { error: 'Invalid filename' };
      }

      try {
        const audioPath = join(process.cwd(), 'public', 'cdn', 'audio', filename);
        const audioBuffer = await readFile(audioPath);

        set.headers['Content-Type'] = 'audio/mpeg';
        set.headers['Cache-Control'] = 'public, max-age=31536000'; // Cache for 1 year (immutable)
        set.headers['Accept-Ranges'] = 'bytes';

        return audioBuffer;
      } catch (error: any) {
        console.error(`❌ Error serving audio file ${filename}:`, error);

        if (error.code === 'ENOENT') {
          set.status = 404;
          return { error: 'Audio file not found' };
        }

        set.status = 500;
        return { error: 'Failed to serve audio file' };
      }
    },
    {
      detail: {
        tags: ['CDN'],
        summary: 'Serve audio file',
        description: 'Serves MP3 audio files from the CDN',
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
          404: {
            description: 'Audio file not found',
          },
        },
      },
    }
  );
