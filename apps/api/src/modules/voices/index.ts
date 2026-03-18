/**
 * Voices Module
 * Voice management and settings for TTS
 */

import { Elysia } from 'elysia';
import { voicesRoutes } from './routes';
import { voiceSettingsRoutes } from './settings-routes';
import { modelsRoutes } from './models-routes';

export const voicesModule = new Elysia()
  .use(voicesRoutes)
  .use(voiceSettingsRoutes)
  .use(modelsRoutes);
