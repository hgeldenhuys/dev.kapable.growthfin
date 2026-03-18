/**
 * NewLeads API - Main Entry Point
 * ElysiaJS backend with modular architecture
 *
 * Architecture: CQRS with Reactive Queries
 * - Commands: Write to database via Drizzle ORM
 * - Queries: Real-time via PostgreSQL LISTEN/NOTIFY (NO POLLING)
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { env } from './config/env';
import { corsConfig } from './config/cors';
import { jobQueue } from './lib/queue';

// Plugins
import { database } from './plugins/database';
import { logger } from './plugins/logger';

// Modules
import { healthModule } from './modules/health';
import { authModule } from './modules/auth';
import { usersModule } from './modules/users';
import { workspacesModule } from './modules/workspaces';
import { projectsModule } from './modules/projects';
import { hookEventsModule } from './modules/hook-events';
import { downloadModule } from './modules/download';
import { sessionsModule } from './modules/sessions';
import { summariesModule } from './modules/summaries';
import { chatModule } from './modules/chat';
import { credentialsModule } from './modules/credentials';
import { llmConfigsModule } from './modules/llm-configs';
import { todosModule } from './modules/todos';
import { failuresModule } from './modules/failures';
import { agentIdentifyModule } from './modules/agent-identify';
import { crmModule } from './modules/crm';
import { voicesModule } from './modules/voices';
import { seedModule } from './modules/seed';
import { modelCatalogRoutes } from './modules/model-catalog';
import { assistantModule } from './modules/assistant';
import { aiAssistantModule } from './modules/ai-assistant';
import { sdlcModule } from './modules/sdlc';
import { cliModule } from './modules/cli';
import { contextUsageModule } from './modules/context-usage';
import { tagsModule } from './modules/tags';
import { financialModule } from './modules/financial';
import { sessionMetricsModule } from './modules/session-metrics';
import { workItemsModule } from './modules/work-items';
import { devModule } from './modules/dev';

// Generic streaming route
import { streamRoutes } from './routes/stream';
import { leadScoresStreamRoutes } from './routes/stream/lead-scores';
import { analyticsMetricsStreamRoutes } from './routes/stream/analytics-metrics';
import { audioStreamRoutes } from './routes/stream/audio';
import { speakRoutes } from './routes/speak';
import { cdnRoutes } from './routes/cdn';
import { testSSERoutes } from './routes/test-sse';

// Job logging routes (US-008, US-011)
import { jobLogsRoutes, jobSSERoutes, jobReportRoutes } from './routes/jobs';

// Voice routes (VOICE-001)
import { voiceTokenRoutes } from './routes/voice';

// Platform routes adapter (deployment, storage, scheduler, etc.)
import { platformRoutes } from './plugins/platform-routes';

const app = new Elysia()
  // Middleware
  .use(cors(corsConfig))
  .use(
    swagger({
      documentation: {
        info: {
          title: 'NewLeads API',
          version: '0.1.0',
          description: 'Claude Code hooks event processing API',
        },
        tags: [
          { name: 'Health', description: 'Health check endpoints' },
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Users', description: 'User profile management' },
          { name: 'Streaming', description: 'Generic SSE streaming for all tables (multiplexed)' },
          { name: 'Workspaces', description: 'Workspace management' },
          { name: 'Hook Events', description: 'Claude Code hook events' },
          { name: 'Sessions', description: 'Claude Code sessions with reactive streaming' },
          { name: 'Summaries', description: 'Event summaries with reactive streaming' },
          { name: 'Chat', description: 'Chat messages with reactive streaming' },
          { name: 'Credentials', description: 'LLM credentials management (encrypted API keys)' },
          { name: 'LLM Configs', description: 'LLM service configurations with system prompts' },
          { name: 'Todos', description: 'Extracted todos from sessions with reactive streaming' },
          { name: 'Failures', description: 'Failed job monitoring and tracking' },
          { name: 'Contacts', description: 'CRM contact management with reactive streaming' },
          { name: 'Lead Scores', description: 'Real-time lead propensity score updates via SSE' },
          { name: 'Campaign Analytics', description: 'Real-time campaign metrics updates via SSE' },
          { name: 'Voices', description: 'TTS voice management' },
          { name: 'Voice Settings', description: 'Global and project-level voice settings' },
          { name: 'Audio', description: 'Text-to-speech audio generation' },
          { name: 'Model Catalog', description: 'LLM model catalog with cost information' },
          { name: 'Assistant', description: 'AI-powered chat assistant for CRM platform' },
          { name: 'AI Assistant', description: 'OpenRouter-powered AI assistant chat (new feature)' },
          { name: 'SDLC', description: 'SDLC file synchronization with real-time streaming' },
          { name: 'CLI', description: 'CLI session heartbeat monitoring and management' },
          { name: 'Context Usage', description: 'Context token usage tracking and analytics' },
          { name: 'Tags', description: 'Tag analytics and usage history' },
          { name: 'Financial Analysis', description: 'Balance sheet analysis using LLM' },
          { name: 'Session Metrics', description: 'Claude Code session metrics and analytics (US-001)' },
          { name: 'Job Observability', description: 'Job execution tracking and reporting (US-008, US-011)' },
          { name: 'Work Items', description: 'Work item management for batch/task semantic separation (US-014)' },
          { name: 'Voice', description: 'Browser-based WebRTC calling via Twilio (VOICE-001)' },
        ],
      },
    })
  )

  // Global plugins
  .use(logger)
  .use(database)

  // Error handling
  .onError(({ code, error, set }) => {
    console.log('ERROR HANDLER CALLED:', { code, errorMessage: error?.message, errorStack: error?.stack });

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Route not found' };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: 'Validation error', details: error.message };
    }

    // BUG-AI-002 FIX: Handle JSON parse errors with 400 instead of 500
    if (code === 'PARSE') {
      set.status = 400;
      return { error: 'Invalid JSON', details: 'Request body contains malformed JSON' };
    }

    console.error('Unhandled error:', error);
    set.status = 500;
    return { error: 'Internal server error' };
  })

  // Health check (no prefix)
  .use(healthModule)

  // Auth routes (no prefix, Better Auth handles /auth/*)
  .use(authModule)

  // Download routes (no prefix)
  .use(downloadModule)

  // CDN routes (no prefix - serves static files)
  .use(cdnRoutes)

  // Test SSE route (for debugging)
  .use(testSSERoutes)

  // Platform routes (deployment, storage, scheduler, etc. — legacy handlers)
  .use(platformRoutes)

  // API routes
  .group('/api/v1', (app) =>
    app
      .use(streamRoutes) // Generic SSE streaming for all tables
      .use(leadScoresStreamRoutes) // Lead score SSE streaming
      .use(analyticsMetricsStreamRoutes) // Campaign analytics metrics SSE streaming
      .use(audioStreamRoutes) // Audio generation SSE streaming
      .use(usersModule)
      .use(workspacesModule)
      .use(projectsModule)
      .use(hookEventsModule)
      .use(sessionsModule)
      .use(summariesModule)
      .use(chatModule)
      .use(credentialsModule)
      .use(llmConfigsModule)
      .use(todosModule)
      .use(failuresModule)
      .use(agentIdentifyModule)
      .use(crmModule)
      .use(voicesModule)
      .use(speakRoutes)
      .use(seedModule)
      .use(modelCatalogRoutes)
      .use(assistantModule)
      .use(aiAssistantModule)
      .use(sdlcModule)
      .use(cliModule)
      .use(contextUsageModule)
      .use(tagsModule)
      .use(financialModule)
      .use(sessionMetricsModule)
      .use(workItemsModule)
      .use(jobLogsRoutes)
      .use(jobSSERoutes)
      .use(jobReportRoutes)
      .use(voiceTokenRoutes) // Browser-based WebRTC calling (VOICE-001)
      .use(devModule) // Dev tools (mock inbox, test mode) - only active in TEST_MODE
  )

  // Start server
  .listen(env.PORT);

// Optional startup seeding (controlled via AUTO_SEED env var)
const AUTO_SEED = process.env.AUTO_SEED === 'true';
if (AUTO_SEED) {
  console.log('\n🌱 AUTO_SEED enabled - running startup seeding...\n');
  try {
    const { db } = await import('@agios/db/client');
    const { getSeeders } = await import('./scripts/seeders');

    const seeders = getSeeders(env.NODE_ENV || 'development');

    for (const seeder of seeders) {
      const result = await seeder.run(db);
      if (result.created > 0) {
        console.log(`  ✅ ${seeder.name}: Created ${result.created}`);
      }
    }

    console.log('✅ Startup seeding complete!\n');
  } catch (error) {
    console.error('❌ Startup seeding failed:', error);
    console.error('   Continuing without seeding...\n');
  }
}

console.log(`
🦊 NewLeads API is running!

  - Local:   http://localhost:${env.PORT}
  - Swagger: http://localhost:${env.PORT}/swagger
  - Health:  http://localhost:${env.PORT}/health
  - Seed Status: http://localhost:${env.PORT}/api/v1/seed/status

Environment: ${env.NODE_ENV}
Auto-Seed: ${AUTO_SEED ? 'enabled' : 'disabled'}
`);

// Initialize job queue (pgboss uses LISTEN/NOTIFY internally - NO POLLING)
jobQueue.start().then(async () => {
  // Register all workers after queue starts
  const { registerAllWorkers } = await import('./workers');
  await registerAllWorkers();
}).catch((error) => {
  console.error('Failed to initialize job queue:', error);
  console.error('Background job processing will not work!');
});

// Start code search worker independently (listens to PostgreSQL NOTIFY)
// This should start regardless of job queue status
(async () => {
  try {
    const { startCodeSearchWorker } = await import('./modules/ai-assistant/workers/code-search.worker');
    await startCodeSearchWorker(true); // verbose = true
  } catch (error) {
    console.error('Failed to start code search worker:', error);
    console.error('Code search functionality will not work!');
  }
})();

// Initialize channel adapters
(async () => {
  try {
    const { initializeChannels } = await import('./lib/channels');
    await initializeChannels();
  } catch (error) {
    console.error('Failed to initialize channel adapters:', error);
    console.error('Multi-channel webhooks may not work correctly!');
  }
})();

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');

  try {
    // Stop job queue
    await jobQueue.stop();

    // Close database connection pool
    const { closeDbConnection } = await import('@agios/db');
    await closeDbConnection();

    console.log('✅ Graceful shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Hot reload cleanup for Bun (development only)
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('🔥 Hot reload detected, cleaning up...');
    await shutdown();
  });
}

export type App = typeof app;
