/**
 * Calculate Intent Worker (US-LEAD-AI-012)
 * Async worker to calculate intent scores for leads
 */

import { jobQueue, type CalculateIntentJob } from '../lib/queue';
import { intentDetectionService } from '../services/ai/intent-detection-service';

export async function registerCalculateIntentWorker() {
  await jobQueue.work<CalculateIntentJob>(
    'calculate-intent',
    {
      teamSize: 10,
      teamConcurrency: 5,
    },
    async (job) => {
      const { leadId, workspaceId, triggerSignalType } = job.data;

      console.log(
        `[Calculate Intent Worker] Calculating intent for lead ${leadId}...` +
          (triggerSignalType ? ` (triggered by ${triggerSignalType})` : '')
      );

      try {
        const result = await intentDetectionService.calculateIntentScore(leadId, workspaceId);

        console.log(
          `[Calculate Intent Worker] Intent: ${result.intent_level} (${result.intent_score}/100, confidence: ${result.confidence})`
        );
        console.log(`[Calculate Intent Worker] Recommended action: ${result.recommended_action}`);

        // If intent level is high or very_high, we could trigger additional actions here
        // For example: send notification, create task, update CRM status, etc.
        if (result.intent_level === 'very_high' || result.intent_level === 'high') {
          console.log(
            `[Calculate Intent Worker] ⚠️  High intent lead detected: ${leadId} (score: ${result.intent_score})`
          );
          // TODO: Add notification/alert system integration here
        }

        return { success: true, result };
      } catch (error: any) {
        if (error.message === 'INSUFFICIENT_DATA') {
          console.log(
            '[Calculate Intent Worker] Not enough data to calculate intent, skipping'
          );
          return { success: false, reason: 'insufficient_data' };
        }

        console.error('[Calculate Intent Worker] Failed:', error);
        throw error;
      }
    }
  );

  console.log('✅ Calculate intent worker registered');
}
