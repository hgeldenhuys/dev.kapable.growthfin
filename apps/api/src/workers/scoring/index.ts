/**
 * Scoring Workers
 * Background job workers for lead scoring operations
 */

import { jobQueue } from '../../lib/queue';
import { processLeadScoreJob, type CalculateLeadScoreJob } from './calculate-lead-score';

/**
 * Register the lead scoring worker
 *
 * Configuration:
 * - Team size: 5 concurrent workers
 * - Team concurrency: 2 jobs per worker
 * - Total throughput: 10 concurrent jobs
 * - Retry limit: 3 attempts
 * - Retry delay: 60 seconds (exponential backoff)
 * - Expire: 1 hour (jobs older than 1 hour are discarded)
 *
 * Priority levels:
 * - 10: New leads (highest priority)
 * - 7: Manual recalculation
 * - 5: Lead updates (normal priority)
 */
export async function registerScoringWorkers(): Promise<void> {
  await jobQueue.work<CalculateLeadScoreJob>(
    'calculate-lead-score',
    {
      teamSize: 5,
      teamConcurrency: 2,
    },
    processLeadScoreJob
  );

  console.log('✅ Lead scoring worker registered');
}
