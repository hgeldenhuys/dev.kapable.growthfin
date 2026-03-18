/**
 * AI Assistant Module
 * Main module registration for AI assistant feature
 */

import { Elysia } from 'elysia';
import { chatRoutes } from './routes/chat.routes';
import { configRoutes } from './routes/config.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { codeSearchRoutes } from './routes/code-search.routes';
import { voiceRoutes } from './routes/voice.routes';

export const aiAssistantModule = new Elysia({ prefix: '/ai-assistant' })
  .use(chatRoutes)
  .use(voiceRoutes)
  .use(configRoutes)
  .use(analyticsRoutes)
  .use(codeSearchRoutes)
  .get('/', () => ({
    module: 'AI Assistant',
    version: '1.0.0',
    status: 'Active',
    routes: {
      chat: '/ai-assistant/workspaces/:workspaceId/chat/*',
      config: '/ai-assistant/workspaces/:workspaceId/config',
      analytics: '/ai-assistant/workspaces/:workspaceId/ai/analytics/*',
      codeSearch: '/ai-assistant/workspaces/:workspaceId/code-search/*',
      voice: '/ai-assistant/workspaces/:workspaceId/chat/voice',
      tts: '/ai-assistant/workspaces/:workspaceId/chat/tts',
    },
    endpoints: {
      // Chat
      sendMessage: 'POST /ai-assistant/workspaces/:workspaceId/chat/message',
      voiceMessage: 'POST /ai-assistant/workspaces/:workspaceId/chat/voice',
      textToSpeech: 'POST /ai-assistant/workspaces/:workspaceId/chat/tts',
      getConversation: 'GET /ai-assistant/workspaces/:workspaceId/chat/conversation',
      clearConversation: 'POST /ai-assistant/workspaces/:workspaceId/chat/clear',

      // Config
      getConfig: 'GET /ai-assistant/workspaces/:workspaceId/config',
      updateConfig: 'PUT /ai-assistant/workspaces/:workspaceId/config',

      // Analytics
      toolUsage: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/tools',
      toolTimeSeries: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/tools/timeseries',
      costs: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/costs',
      performance: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/performance',
      sessions: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/sessions',
      stream: 'GET /ai-assistant/workspaces/:workspaceId/ai/analytics/stream (SSE)',

      // Code Search
      createSearch: 'POST /ai-assistant/workspaces/:workspaceId/code-search',
      streamResults: 'GET /ai-assistant/workspaces/:workspaceId/code-search/:searchId/sse (SSE)',
    },
  }));
