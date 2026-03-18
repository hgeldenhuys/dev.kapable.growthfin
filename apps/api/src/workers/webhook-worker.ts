/**
 * Webhook Worker
 *
 * Background process that:
 * - Processes pending webhook deliveries every 5 seconds
 * - Handles retries with exponential backoff
 * - Cleans up old logs daily
 */

import { processWebhookQueue, getQueueStats, cleanupOldLogs } from '../lib/webhook-delivery';

const POLL_INTERVAL_MS = 5000;  // 5 seconds
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const BATCH_SIZE = 20;  // Process up to 20 webhooks per cycle

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the webhook worker
 */
export function startWebhookWorker(): void {
  if (isRunning) {
    console.log('[webhook-worker] Already running');
    return;
  }

  isRunning = true;
  console.log('[webhook-worker] Starting...');

  // Start polling loop
  poll();

  // Start cleanup timer
  scheduleCleanup();

  console.log('[webhook-worker] Started successfully');
}

/**
 * Stop the webhook worker
 */
export function stopWebhookWorker(): void {
  if (!isRunning) {
    console.log('[webhook-worker] Not running');
    return;
  }

  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  console.log('[webhook-worker] Stopped');
}

/**
 * Poll for pending webhooks
 */
async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    const processed = await processWebhookQueue(BATCH_SIZE);

    if (processed > 0) {
      console.log(`[webhook-worker] Processed ${processed} webhooks`);
    }
  } catch (error) {
    console.error('[webhook-worker] Error in poll cycle:', error);
  }

  // Schedule next poll
  if (isRunning) {
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
  }
}

/**
 * Schedule cleanup of old logs
 */
function scheduleCleanup(): void {
  if (!isRunning) return;

  cleanupTimer = setTimeout(async () => {
    if (!isRunning) return;

    try {
      const deleted = await cleanupOldLogs(30);  // 30 day retention
      if (deleted > 0) {
        console.log(`[webhook-worker] Cleaned up ${deleted} old log entries`);
      }
    } catch (error) {
      console.error('[webhook-worker] Error in cleanup:', error);
    }

    // Schedule next cleanup
    if (isRunning) {
      scheduleCleanup();
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get worker status
 */
export async function getWorkerStatus(): Promise<{
  running: boolean;
  stats: {
    pending: number;
    failed: number;
    processed_today: number;
  };
}> {
  const stats = await getQueueStats();
  return {
    running: isRunning,
    stats,
  };
}

// Auto-start if this file is run directly
if (import.meta.main) {
  console.log('[webhook-worker] Starting as standalone process...');
  startWebhookWorker();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('[webhook-worker] Received SIGINT, shutting down...');
    stopWebhookWorker();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[webhook-worker] Received SIGTERM, shutting down...');
    stopWebhookWorker();
    process.exit(0);
  });
}
