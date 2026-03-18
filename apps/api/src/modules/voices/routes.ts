/**
 * Voices Routes
 * CRUD operations for TTS voices
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { models } from '@agios/db/schema';
import { VoiceService } from '../../services/audio/voice-service';

export const voicesRoutes = new Elysia({ prefix: '/voices', tags: ['Voices'] })
  /**
   * List all voices
   */
  .get(
    '/',
    async ({ query }) => {
      const voices = await VoiceService.listVoices(db, {
        provider: query.provider as any,
        gender: query.gender as any,
        useForSummaries: query.useForSummaries,
      });

      return { voices };
    },
    {
      query: t.Object({
        provider: t.Optional(t.Union([t.Literal('elevenlabs'), t.Literal('openai-tts')])),
        gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female'), t.Literal('neutral')])),
        useForSummaries: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'List voices',
        description: 'Returns list of available TTS voices with optional filters',
      },
    }
  )

  /**
   * Get voice by ID
   */
  .get(
    '/:id',
    async ({ params, error }) => {
      const voice = await VoiceService.getVoiceById(db, params.id);

      if (!voice) {
        return error(404, { error: 'Voice not found' });
      }

      return { voice };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get voice by ID',
      },
    }
  )

  /**
   * Sync entities from provider
   * Fetches voices, models, dictionaries, and usage stats from provider API
   * Uses environment variable if apiKey is not provided
   */
  .post(
    '/sync',
    async ({ body }) => {
      try {
        // Use provided apiKey or fall back to environment variable
        let apiKey = body.apiKey;

        if (!apiKey || apiKey.trim() === '') {
          if (body.provider === 'elevenlabs') {
            apiKey = process.env.ELEVENLABS_API_KEY || '';
          } else if (body.provider === 'openai-tts') {
            apiKey = process.env.OPENAI_API_KEY || '';
          }
        }

        if (!apiKey) {
          return {
            success: false,
            error: `No API key provided and ${body.provider.toUpperCase()}_API_KEY not set in environment`,
          };
        }

        // Determine which entities to sync (default: all)
        const syncEntities = body.syncEntities || ['voices', 'models', 'dictionaries', 'usage'];

        // Get provider instance
        const provider =
          body.provider === 'elevenlabs'
            ? new (await import('../../services/audio/elevenlabs-provider')).ElevenLabsProvider(apiKey)
            : null;

        if (!provider) {
          return {
            success: false,
            error: `Provider ${body.provider} not supported`,
          };
        }

        // Run sync operations in parallel
        const results = await Promise.allSettled([
          syncEntities.includes('voices')
            ? VoiceService.syncVoicesFromProvider(db, body.provider, apiKey)
            : Promise.resolve([]),
          syncEntities.includes('models')
            ? VoiceService.syncModels(db, provider)
            : Promise.resolve(0),
          syncEntities.includes('dictionaries')
            ? VoiceService.syncPronunciationDictionaries(db, provider)
            : Promise.resolve(0),
          syncEntities.includes('usage')
            ? VoiceService.getUsageStats(db, provider)
            : Promise.resolve(null),
        ]);

        const [voicesResult, modelsResult, dictionariesResult, usageResult] = results;

        return {
          success: true,
          voices: {
            count: voicesResult.status === 'fulfilled' ? voicesResult.value.length : 0,
            synced: voicesResult.status === 'fulfilled',
            error: voicesResult.status === 'rejected' ? voicesResult.reason.message : undefined,
          },
          models: {
            count: modelsResult.status === 'fulfilled' ? modelsResult.value : 0,
            synced: modelsResult.status === 'fulfilled',
            error: modelsResult.status === 'rejected' ? modelsResult.reason.message : undefined,
          },
          dictionaries: {
            count: dictionariesResult.status === 'fulfilled' ? dictionariesResult.value : 0,
            synced: dictionariesResult.status === 'fulfilled',
            error: dictionariesResult.status === 'rejected' ? dictionariesResult.reason.message : undefined,
          },
          usage: usageResult.status === 'fulfilled' && usageResult.value ? {
            charactersUsed: usageResult.value.charactersUsed,
            characterLimit: usageResult.value.characterLimit,
          } : null,
        };
      } catch (err: any) {
        console.error('[voices/sync] Error:', err);
        return {
          success: false,
          error: err.message,
        };
      }
    },
    {
      body: t.Object({
        provider: t.Union([t.Literal('elevenlabs'), t.Literal('openai-tts')]),
        apiKey: t.Optional(t.String()),
        syncEntities: t.Optional(t.Array(t.Union([
          t.Literal('voices'),
          t.Literal('models'),
          t.Literal('dictionaries'),
          t.Literal('usage'),
        ]))),
      }),
      detail: {
        summary: 'Sync entities from provider',
        description: 'Fetches voices, models, dictionaries, and usage stats from TTS provider API. Uses environment variable if apiKey is not provided.',
      },
    }
  )

  /**
   * Update voice metadata
   */
  .put(
    '/:id',
    async ({ params, body, error }) => {
      const existing = await VoiceService.getVoiceById(db, params.id);

      if (!existing) {
        return error(404, { error: 'Voice not found' });
      }

      const voice = await VoiceService.updateVoice(db, params.id, body);

      return { voice };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        useForSummaries: t.Optional(t.Boolean()),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
      detail: {
        summary: 'Update voice metadata',
        description: 'Update voice settings like useForSummaries flag or provider-specific metadata',
      },
    }
  );
