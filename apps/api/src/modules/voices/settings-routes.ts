/**
 * Voice Settings Routes
 * Manage global and project-level voice settings
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { models } from '@agios/db/schema';
import { VoiceService } from '../../services/audio/voice-service';

export const voiceSettingsRoutes = new Elysia({ prefix: '/voice-settings', tags: ['Voice Settings'] })
  /**
   * Get global voice settings
   */
  .get(
    '/',
    async ({ error, set }) => {
      // Prevent caching to ensure fresh data after updates
      set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Expires'] = '0';

      const settings = await VoiceService.getGlobalSettings(db);

      if (!settings) {
        set.status = 404; return { error: 'Global voice settings not configured' };
      }

      // Fetch voice details
      const userVoice = await VoiceService.getVoiceById(db, settings.userVoiceId);
      const assistantVoice = await VoiceService.getVoiceById(db, settings.assistantVoiceId);

      return {
        settings,
        voices: {
          user: userVoice,
          assistant: assistantVoice,
        },
      };
    },
    {
      detail: {
        summary: 'Get global voice settings',
        description: 'Returns default voice settings for all projects',
      },
    }
  )

  /**
   * Update global voice settings
   */
  .put(
    '/',
    async ({ body, error }) => {
      // Validate voices exist
      const userVoice = await VoiceService.getVoiceById(db, body.userVoiceId);
      if (!userVoice) {
        set.status = 404; return { error: 'User voice not found' };
      }

      const assistantVoice = await VoiceService.getVoiceById(db, body.assistantVoiceId);
      if (!assistantVoice) {
        set.status = 404; return { error: 'Assistant voice not found' };
      }

      // Validate model exists if provided
      if (body.modelId) {
        const model = await db.query.models.findFirst({
          where: (models, { eq }) => eq(models.id, body.modelId!),
        });
        if (!model) {
          set.status = 404; return { error: 'Model not found' };
        }
      }

      const settings = await VoiceService.upsertGlobalSettings(
        db,
        body.userVoiceId,
        body.assistantVoiceId,
        body.modelId
      );

      return {
        settings,
        voices: {
          user: userVoice,
          assistant: assistantVoice,
        },
      };
    },
    {
      body: t.Object({
        userVoiceId: t.String(),
        assistantVoiceId: t.String(),
        modelId: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Update global voice settings',
        description: 'Set default voices for user and assistant roles and TTS model',
      },
    }
  )

  /**
   * Get project voice settings
   */
  .get(
    '/projects/:projectId',
    async ({ params, set }) => {
      try {
        const settings = await VoiceService.getProjectSettings(db, params.projectId);

        if (!settings) {
          set.status = 404;
          return { error: 'Project voice settings not found' };
        }

        // Fetch voice details
        const userVoice = settings.userVoiceId
          ? await VoiceService.getVoiceById(db, settings.userVoiceId)
          : null;
        const assistantVoice = settings.assistantVoiceId
          ? await VoiceService.getVoiceById(db, settings.assistantVoiceId)
          : null;

        return {
          settings,
          voices: {
            user: userVoice,
            assistant: assistantVoice,
          },
        };
      } catch (err: any) {
        console.error('[voice-settings/projects/:projectId GET] Unexpected error:', err);
        throw err; // Let Elysia's error handler deal with it
      }
    },
    {
      params: t.Object({
        projectId: t.String(),
      }),
      detail: {
        summary: 'Get project voice settings',
        description: 'Returns voice overrides for a specific project',
      },
    }
  )

  /**
   * Update project voice settings
   */
  .put(
    '/projects/:projectId',
    async ({ params, body, error }) => {
      try {
        // Validate voices exist if provided
        if (body.userVoiceId) {
          const userVoice = await VoiceService.getVoiceById(db, body.userVoiceId);
          if (!userVoice) {
            set.status = 404; return { error: 'User voice not found' };
          }
        }

        if (body.assistantVoiceId) {
          const assistantVoice = await VoiceService.getVoiceById(db, body.assistantVoiceId);
          if (!assistantVoice) {
            set.status = 404; return { error: 'Assistant voice not found' };
          }
        }

        const settings = await VoiceService.upsertProjectSettings(
          db,
          params.projectId,
          body.userVoiceId,
          body.assistantVoiceId
        );

        // Fetch voice details
        const userVoice = settings.userVoiceId
          ? await VoiceService.getVoiceById(db, settings.userVoiceId)
          : null;
        const assistantVoice = settings.assistantVoiceId
          ? await VoiceService.getVoiceById(db, settings.assistantVoiceId)
          : null;

        return {
          settings,
          voices: {
            user: userVoice,
            assistant: assistantVoice,
          },
        };
      } catch (err: any) {
        console.error('[voice-settings/projects/:projectId PUT] Unexpected error:', err);
        throw err; // Let Elysia's error handler deal with it
      }
    },
    {
      params: t.Object({
        projectId: t.String(),
      }),
      body: t.Object({
        userVoiceId: t.Union([t.String(), t.Null(), t.Undefined()]),
        assistantVoiceId: t.Union([t.String(), t.Null(), t.Undefined()]),
      }),
      detail: {
        summary: 'Update project voice settings',
        description: 'Override voices for a specific project (null to use global defaults)',
      },
    }
  );
