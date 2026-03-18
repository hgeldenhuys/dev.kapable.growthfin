/**
 * PgBoss Instance for AI Assistant Jobs
 *
 * Separate instance from main job queue for AI-specific background jobs
 * Uses LISTEN/NOTIFY internally - NO POLLING
 */

import PgBoss from 'pg-boss';
import { env } from '../../../config/env';

let bossInstance: PgBoss | null = null;
let isStarted = false;

/**
 * Get or create the pgBoss instance
 */
export async function getPgBoss(): Promise<PgBoss> {
  if (bossInstance && isStarted) {
    return bossInstance;
  }

  console.log('[AI Assistant] Starting pgBoss instance for AI jobs...');

  bossInstance = new PgBoss({
    connectionString: env.DATABASE_URL,
    noScheduling: false,
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
    max: 2, // Limit connections
    connectionTimeout: 20000,
    idleTimeout: 30000,
  });

  bossInstance.on('error', (error) => {
    console.error('[AI Assistant] PgBoss error:', error);
  });

  await bossInstance.start();
  isStarted = true;

  // Create AI-specific queues
  await Promise.all([
    bossInstance.createQueue('ai.suggestions.scan.tests'),
    bossInstance.createQueue('ai.suggestions.scan.docs'),
    bossInstance.createQueue('ai.suggestions.scan.quality'),
    bossInstance.createQueue('code-search-requested'),
  ]);

  console.log('[AI Assistant] PgBoss instance started with AI job queues');

  return bossInstance;
}

/**
 * Direct export for convenience
 */
export const pgBoss = {
  async send(queue: string, data: any) {
    const boss = await getPgBoss();
    return boss.send(queue, data);
  },

  async work(queue: string, handler: (job: any) => Promise<any>) {
    const boss = await getPgBoss();
    return boss.work(queue, handler);
  },

  async stop() {
    if (bossInstance && isStarted) {
      await bossInstance.stop();
      bossInstance = null;
      isStarted = false;
    }
  },
};

/**
 * Hot reload cleanup
 */
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('[AI Assistant] Hot reload: Stopping pgBoss...');
    await pgBoss.stop();
  });
}
