/**
 * Predict Lead Worker
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

import { jobQueue, type PredictLeadJob } from '../lib/queue';
import { PredictionService } from '../services/ai/prediction-service';

/**
 * Register the predict-lead worker
 */
export async function registerPredictLeadWorker() {
  await jobQueue.work<PredictLeadJob>(
    'predict-lead',
    {
      teamSize: 5, // Allow parallel predictions
      teamConcurrency: 2,
    },
    async (job) => {
      const { leadId, workspaceId } = job.data;

      console.log(`[Predict Lead Worker] Predicting conversion for lead ${leadId}...`);

      try {
        const service = new PredictionService();
        const prediction = await service.predictConversion(leadId, workspaceId);

        console.log(
          `[Predict Lead Worker] Prediction complete: ${prediction.prediction_score}/100 (${prediction.prediction_category})`
        );

        return {
          success: true,
          prediction,
        };
      } catch (error: any) {
        console.error(`[Predict Lead Worker] Failed for lead ${leadId}:`, error);
        throw error;
      }
    }
  );

  console.log('✅ Predict lead worker registered');
}
