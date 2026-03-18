/**
 * Chat Module
 * Real-time chat message streaming and audio generation
 */

import { Elysia } from 'elysia';
import { chatRoutes } from './routes';
import { audioRoutes } from './routes/audio';

export const chatModule = new Elysia({ prefix: '/chat' })
  .use(chatRoutes)
  .use(audioRoutes);
