/**
 * Train Prediction Model Worker
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

import { jobQueue, type TrainPredictionModelJob } from '../lib/queue';
import { PredictionService } from '../services/ai/prediction-service';

/**
 * Register the train-prediction-model worker
 */
export async function registerTrainPredictionModelWorker() {
  await jobQueue.work<TrainPredictionModelJob>(
    'train-prediction-model',
    {
      teamSize: 1, // Only 1 training at a time (CPU intensive)
      teamConcurrency: 1,
    },
    async (job) => {
      const { workspaceId, modelType, minSamples = 50 } = job.data;

      console.log(
        `[Train Prediction Model Worker] Training ${modelType} model for workspace ${workspaceId}...`
      );

      try {
        const service = new PredictionService();
        const model = await service.trainModel(workspaceId, minSamples);

        console.log(
          `[Train Prediction Model Worker] Model trained successfully: ${model.id}, Accuracy: ${(parseFloat(model.accuracy || '0') * 100).toFixed(2)}%`
        );

        return {
          success: true,
          modelId: model.id,
          accuracy: model.accuracy,
          trainingSamples: model.trainingSamples,
        };
      } catch (error: any) {
        console.error(`[Train Prediction Model Worker] Failed:`, error);
        throw error;
      }
    }
  );

  console.log('✅ Train prediction model worker registered');
}
