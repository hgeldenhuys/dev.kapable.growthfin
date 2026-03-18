/**
 * Predictions API Routes
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

import { Elysia, t } from 'elysia';
import { PredictionService } from '../../../services/ai/prediction-service';
import { db, predictionModels, leadPredictions } from '@agios/db';
import { and, eq, desc } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';

export const predictionsRoutes = new Elysia({ prefix: '/predictions' })
  /**
   * POST /api/v1/crm/leads/:leadId/predict
   * Get or trigger prediction for a lead
   */
  .post(
    '/leads/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      console.log(`[Predictions API] Getting prediction for lead ${leadId}...`);

      try {
        // Check if recent prediction exists (last 24 hours)
        const existingPrediction = await db.query.leadPredictions.findFirst({
          where: and(eq(leadPredictions.leadId, leadId), eq(leadPredictions.workspaceId, workspaceId)),
        });

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (
          existingPrediction &&
          new Date(existingPrediction.predictedAt).getTime() > oneDayAgo.getTime()
        ) {
          // Return existing prediction
          const model = await db.query.predictionModels.findFirst({
            where: eq(predictionModels.id, existingPrediction.modelId),
          });

          console.log(`[Predictions API] Returning cached prediction (age: ${Math.round((Date.now() - new Date(existingPrediction.predictedAt).getTime()) / (1000 * 60))} minutes)`);

          const score = parseFloat(existingPrediction.predictionScore);
          const confidenceInterval = parseFloat(existingPrediction.confidenceInterval || '15');

          return {
            lead_id: leadId,
            prediction_score: score,
            confidence_interval: confidenceInterval,
            prediction_category:
              score >= 70
                ? 'high_probability'
                : score >= 40
                  ? 'medium_probability'
                  : 'low_probability',
            top_factors: existingPrediction.topFactors,
            model_accuracy: parseFloat(model?.accuracy || '0'),
            predicted_at: existingPrediction.predictedAt.toISOString(),
            cached: true,
          };
        }

        // Generate new prediction
        const service = new PredictionService();
        const prediction = await service.predictConversion(leadId, workspaceId);

        console.log(`[Predictions API] Generated new prediction: ${prediction.prediction_score}/100`);

        return prediction;
      } catch (error: any) {
        console.error('[Predictions API] Error:', error);

        if (error.message.includes('No trained model')) {
          return {
            error: 'MODEL_NOT_TRAINED',
            message: 'Prediction model not yet trained for workspace',
            suggestion: 'Train a model first using POST /api/v1/crm/predictions/train',
          };
        }

        if (error.message.includes('not found')) {
          return {
            error: 'NOT_FOUND',
            message: 'Lead not found',
          };
        }

        throw error;
      }
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Predictions'],
        summary: 'Get or trigger prediction for a lead',
        description:
          'Returns cached prediction if recent (< 24h), otherwise generates new prediction',
      },
    }
  )

  /**
   * POST /api/v1/crm/predictions/train
   * Train a new prediction model
   */
  .post(
    '/train',
    async ({ body }) => {
      const { workspaceId, minSamples = 50 } = body;

      console.log(`[Predictions API] Training model for workspace ${workspaceId}...`);

      try {
        // Queue training job (CPU intensive, run in background)
        const jobId = await jobQueue.send('train-prediction-model', {
          workspaceId,
          modelType: 'conversion',
          minSamples,
        });

        console.log(`[Predictions API] Training job queued: ${jobId}`);

        return {
          success: true,
          message: 'Model training started',
          jobId,
          estimatedTime: '2-5 minutes',
        };
      } catch (error: any) {
        console.error('[Predictions API] Error:', error);
        throw error;
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        minSamples: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Predictions'],
        summary: 'Train a new prediction model',
        description: 'Queue a background job to train a prediction model on historical data',
      },
    }
  )

  /**
   * GET /api/v1/crm/predictions/models
   * List prediction models for workspace
   */
  .get(
    '/models',
    async ({ query }) => {
      const { workspaceId } = query;

      console.log(`[Predictions API] Fetching models for workspace ${workspaceId}...`);

      const models = await db.query.predictionModels.findMany({
        where: and(
          eq(predictionModels.workspaceId, workspaceId),
          eq(predictionModels.modelType, 'conversion')
        ),
        orderBy: desc(predictionModels.createdAt),
      });

      return {
        models: models.map((m) => ({
          id: m.id,
          model_type: m.modelType,
          model_version: m.modelVersion,
          algorithm: m.algorithm,
          training_samples: m.trainingSamples,
          accuracy: parseFloat(m.accuracy || '0'),
          precision: parseFloat(m.precision || '0'),
          recall: parseFloat(m.recall || '0'),
          f1_score: parseFloat(m.f1Score || '0'),
          feature_importance: m.featureImportance,
          is_active: m.isActive,
          trained_at: m.trainingCompletedAt?.toISOString(),
          created_at: m.createdAt.toISOString(),
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Predictions'],
        summary: 'List prediction models',
        description: 'Get all prediction models for a workspace with their metrics',
      },
    }
  )

  /**
   * GET /api/v1/crm/predictions/models/:modelId/metrics
   * Get detailed metrics for a specific model
   */
  .get(
    '/models/:modelId/metrics',
    async ({ params, query }) => {
      const { modelId } = params;
      const { workspaceId } = query;

      console.log(`[Predictions API] Fetching metrics for model ${modelId}...`);

      const model = await db.query.predictionModels.findFirst({
        where: and(eq(predictionModels.id, modelId), eq(predictionModels.workspaceId, workspaceId)),
      });

      if (!model) {
        return {
          error: 'NOT_FOUND',
          message: 'Model not found',
        };
      }

      return {
        id: model.id,
        model_type: model.modelType,
        algorithm: model.algorithm,
        training_samples: model.trainingSamples,
        metrics: {
          accuracy: parseFloat(model.accuracy || '0'),
          precision: parseFloat(model.precision || '0'),
          recall: parseFloat(model.recall || '0'),
          f1_score: parseFloat(model.f1Score || '0'),
        },
        feature_importance: model.featureImportance,
        training_duration_ms:
          model.trainingCompletedAt && model.trainingStartedAt
            ? new Date(model.trainingCompletedAt).getTime() -
              new Date(model.trainingStartedAt).getTime()
            : null,
        is_active: model.isActive,
        trained_at: model.trainingCompletedAt?.toISOString(),
      };
    },
    {
      params: t.Object({
        modelId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Predictions'],
        summary: 'Get model metrics',
        description: 'Get detailed performance metrics for a specific prediction model',
      },
    }
  )

  /**
   * POST /api/v1/crm/predictions/batch
   * Trigger batch predictions for multiple leads
   */
  .post(
    '/batch',
    async ({ body }) => {
      const { workspaceId, leadIds } = body;

      console.log(
        `[Predictions API] Triggering batch predictions for ${leadIds?.length || 'all'} leads...`
      );

      try {
        // Queue batch prediction job
        const jobId = await jobQueue.send('batch-predict', {
          workspaceId,
          leadIds,
        });

        console.log(`[Predictions API] Batch prediction job queued: ${jobId}`);

        return {
          success: true,
          message: 'Batch prediction started',
          jobId,
          leadCount: leadIds?.length || 'all',
          estimatedTime: leadIds?.length ? `${Math.ceil(leadIds.length / 10)} minutes` : 'varies',
        };
      } catch (error: any) {
        console.error('[Predictions API] Error:', error);
        throw error;
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        leadIds: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ['Predictions'],
        summary: 'Batch predict leads',
        description: 'Queue batch predictions for multiple leads (or all leads if not specified)',
      },
    }
  );
