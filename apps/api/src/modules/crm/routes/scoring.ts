/**
 * Lead Scoring API Routes
 * Epic 5 - Sprint 2: US-LEAD-SCORE-005
 */

import { Elysia, t } from 'elysia';
import {
  calculateLeadScores,
  getLeadScores,
  getLeadScoreHistory,
} from '../services/scoring';
import { db, leadScoringModels, type NewLeadScoringModel } from '@agios/db';
import { eq, and } from 'drizzle-orm';

export const scoringRoutes = new Elysia({ prefix: '/scoring' })
  /**
   * GET /api/v1/workspaces/:workspaceId/crm/leads/:leadId/scores
   * Get all dimension scores for a lead
   */
  .get(
    '/leads/:leadId',
    async ({ params, query }) => {
      try {
        const { leadId } = params;
        const { workspaceId } = query;

        console.log(`[GET /scoring/leads/${leadId}] Fetching scores for leadId=${leadId}, workspaceId=${workspaceId}`);

        // Check if scores exist
        let scores = await getLeadScores(leadId, workspaceId);

        // If no scores exist, calculate them
        if (!scores) {
          console.log(`[GET /scoring/leads/${leadId}] No scores found, calculating...`);
          const results = await calculateLeadScores({
            leadIds: [leadId],
            workspaceId,
            saveToDatabase: true,
          });

          if (results.length > 0) {
            // Fetch the newly saved scores
            scores = await getLeadScores(leadId, workspaceId);
          }
        }

        if (!scores) {
          return {
            error: 'Lead not found or scores could not be calculated',
            leadId,
          };
        }

        // Get score history (last 30 days)
        const history = await getLeadScoreHistory(leadId, workspaceId, 30);

        return {
          leadId: scores.leadId,
          scores: {
            propensity: scores.propensityScore ? parseFloat(scores.propensityScore as any) : null,
            engagement: scores.engagementScore ? parseFloat(scores.engagementScore as any) : null,
            fit: scores.fitScore ? parseFloat(scores.fitScore as any) : null,
            composite: scores.compositeScore ? parseFloat(scores.compositeScore as any) : null,
          },
          breakdown: scores.scoreBreakdown || {},
          calculatedAt: scores.calculatedAt,
          history: history.map((h) => ({
            date: h.recordedAt,
            propensity: h.propensityScore ? parseFloat(h.propensityScore as any) : null,
            engagement: h.engagementScore ? parseFloat(h.engagementScore as any) : null,
            fit: h.fitScore ? parseFloat(h.fitScore as any) : null,
            composite: h.compositeScore ? parseFloat(h.compositeScore as any) : null,
          })),
        };
      } catch (error) {
        console.error(`[GET /scoring/leads/${params.leadId}] Error:`, error);
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
        tags: ['Lead Scoring'],
        summary: 'Get lead scores',
        description: 'Get all dimension scores for a lead (propensity, engagement, fit, composite)',
      },
    }
  )

  /**
   * POST /api/v1/workspaces/:workspaceId/crm/leads/:leadId/scores/recalculate
   * Manually recalculate scores for a lead
   */
  .post(
    '/leads/:leadId/recalculate',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      console.log(`[POST /scoring/leads/${leadId}/recalculate] Recalculating scores...`);

      // Recalculate all scores
      const results = await calculateLeadScores({
        leadIds: [leadId],
        workspaceId,
        scoreTypes: ['propensity', 'engagement', 'fit', 'composite'],
        saveToDatabase: true,
      });

      if (results.length === 0) {
        return {
          error: 'Lead not found',
          leadId,
        };
      }

      const result = results[0];

      return {
        leadId: result.leadId,
        scores: {
          propensity: result.propensityScore,
          engagement: result.engagementScore,
          fit: result.fitScore,
          composite: result.compositeScore,
        },
        breakdown: result.breakdown,
        calculatedAt: result.calculatedAt,
        message: 'Scores recalculated successfully',
      };
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Scoring'],
        summary: 'Recalculate lead scores',
        description: 'Manually trigger score recalculation for a lead',
      },
    }
  )

  /**
   * POST /api/v1/workspaces/:workspaceId/crm/scoring/models
   * Create or update a scoring model
   */
  .post(
    '/models',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const { name, modelType, weights, engagementFactors, fitCriteria } = body;

      // Deactivate existing active model of same type
      await db
        .update(leadScoringModels)
        .set({ isActive: false })
        .where(
          and(
            eq(leadScoringModels.workspaceId, workspaceId),
            eq(leadScoringModels.modelType, modelType),
            eq(leadScoringModels.isActive, true)
          )
        );

      // Create new model
      const [newModel] = await db
        .insert(leadScoringModels)
        .values({
          workspaceId,
          name,
          modelType,
          propensityWeight: weights?.propensity?.toString() || '0.4000',
          engagementWeight: weights?.engagement?.toString() || '0.3000',
          fitWeight: weights?.fit?.toString() || '0.3000',
          engagementFactors: engagementFactors || null,
          fitCriteria: fitCriteria || null,
          isActive: true,
          createdBy: query.userId || null,
        })
        .returning();

      return {
        modelId: newModel.id,
        modelType: newModel.modelType,
        name: newModel.name,
        isActive: newModel.isActive,
        createdAt: newModel.createdAt,
        message: 'Scoring model created successfully',
      };
    },
    {
      body: t.Object({
        name: t.String(),
        modelType: t.Union([
          t.Literal('propensity'),
          t.Literal('engagement'),
          t.Literal('fit'),
          t.Literal('composite'),
        ]),
        weights: t.Optional(
          t.Object({
            propensity: t.Number(),
            engagement: t.Number(),
            fit: t.Number(),
          })
        ),
        engagementFactors: t.Optional(t.Any()),
        fitCriteria: t.Optional(t.Any()),
      }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lead Scoring'],
        summary: 'Create scoring model',
        description: 'Create or update a scoring model configuration',
      },
    }
  )

  /**
   * GET /api/v1/workspaces/:workspaceId/crm/scoring/models
   * Get active scoring models for workspace
   */
  .get(
    '/models',
    async ({ query }) => {
      const { workspaceId } = query;

      const models = await db
        .select()
        .from(leadScoringModels)
        .where(
          and(
            eq(leadScoringModels.workspaceId, workspaceId),
            eq(leadScoringModels.isActive, true)
          )
        );

      return {
        models: models.map((model) => ({
          id: model.id,
          name: model.name,
          modelType: model.modelType,
          weights: {
            propensity: parseFloat(model.propensityWeight as any),
            engagement: parseFloat(model.engagementWeight as any),
            fit: parseFloat(model.fitWeight as any),
          },
          engagementFactors: model.engagementFactors,
          fitCriteria: model.fitCriteria,
          isActive: model.isActive,
          createdAt: model.createdAt,
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Scoring'],
        summary: 'Get scoring models',
        description: 'Get active scoring model configurations for workspace',
      },
    }
  );
