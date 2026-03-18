/**
 * Intent Signal Routes (US-LEAD-AI-012)
 * API endpoints for tracking and analyzing lead intent signals
 */

import { Elysia, t } from 'elysia';
import { intentDetectionService } from '../../../services/ai/intent-detection-service';
import { db } from '@agios/db';
import { intentSignalTypes, type IntentSignalType } from '@agios/db';
import { and, eq } from 'drizzle-orm';

export const intentRoutes = new Elysia({ prefix: '/intent' })
  /**
   * GET /api/v1/crm/intent/leads/:leadId
   * Get current intent score for a lead
   */
  .get(
    '/leads/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      try {
        const intentScore = await intentDetectionService.getIntentScore(leadId, workspaceId);

        if (!intentScore) {
          return {
            error: 'NOT_FOUND',
            message: 'No intent score found for this lead',
          };
        }

        const rawSignals = (intentScore.topSignals as any[]) || [];
        const signals = [];
        for (let i = 0; i < rawSignals.length; i++) {
          const s = rawSignals[i];
          signals.push({
            id: s.id || `${leadId}-signal-${i}`,
            lead_id: leadId,
            signal_type: s.signal_type,
            source: s.source || 'system',
            confidence: s.confidence ?? (s.weight != null ? Math.min(s.weight / 10, 1) : 0),
            detected_at: s.detected_at || intentScore.calculatedAt,
            signal_data: s.metadata || { description: s.description, decay_rate: s.decay_rate },
          });
        }

        return {
          lead_id: intentScore.leadId,
          intent_score: intentScore.intentScore,
          intent_level: intentScore.intentLevel,
          confidence: Number(intentScore.confidence),
          signal_count: intentScore.signalCount,
          signals,
          recommended_action: intentScore.recommendedAction,
          action_reason: intentScore.actionReason,
          last_calculated_at: intentScore.calculatedAt,
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error fetching intent score:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Intent'],
        summary: 'Get lead intent score',
        description: 'Get current intent score and signals for a lead',
      },
    }
  )

  /**
   * POST /api/v1/crm/intent/leads/:leadId/calculate
   * Trigger intent score recalculation
   */
  .post(
    '/leads/:leadId/calculate',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      try {
        const result = await intentDetectionService.calculateIntentScore(leadId, workspaceId);

        return {
          success: true,
          lead_id: result.lead_id,
          intent_score: result.intent_score,
          intent_level: result.intent_level,
          confidence: result.confidence,
          recommended_action: result.recommended_action,
          message: 'Intent score calculated successfully',
        };
      } catch (error: any) {
        if (error.message === 'INSUFFICIENT_DATA') {
          return {
            error: 'INSUFFICIENT_DATA',
            message: 'Not enough activity data to calculate intent',
          };
        }

        console.error('[Intent Routes] Error calculating intent:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Intent'],
        summary: 'Calculate lead intent',
        description: 'Trigger intent score recalculation for a lead',
      },
    }
  )

  /**
   * POST /api/v1/crm/intent/leads/:leadId/signals
   * Track a new intent signal
   */
  .post(
    '/leads/:leadId/signals',
    async ({ params, query, body }) => {
      const { leadId } = params;
      const { workspaceId } = query;
      const { signal_type, signal_value, source, metadata } = body;

      try {
        const signal = await intentDetectionService.trackSignal(leadId, workspaceId, {
          signalType: signal_type,
          signalValue: signal_value,
          source: source || 'manual',
          metadata: metadata || {},
        });

        return {
          success: true,
          signal_id: signal.id,
          message: 'Signal tracked, intent recalculation queued',
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error tracking signal:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        signal_type: t.String(),
        signal_value: t.Optional(t.String()),
        source: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
      detail: {
        tags: ['Intent'],
        summary: 'Track intent signal',
        description: 'Track a new intent signal for a lead',
      },
    }
  )

  /**
   * GET /api/v1/crm/intent/leads/:leadId/signals
   * Get all signals for a lead
   */
  .get(
    '/leads/:leadId/signals',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId, limit } = query;

      try {
        const signals = await intentDetectionService.getLeadSignals(
          leadId,
          workspaceId,
          limit ? parseInt(limit, 10) : 100
        );

        return {
          lead_id: leadId,
          signals: signals.map((signal) => ({
            id: signal.id,
            signal_type: signal.signalType,
            signal_value: signal.signalValue,
            detected_at: signal.detectedAt,
            source: signal.source,
            metadata: signal.metadata,
          })),
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error fetching signals:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Intent'],
        summary: 'Get lead signals',
        description: 'Get all intent signals for a lead',
      },
    }
  )

  /**
   * GET /api/v1/crm/intent/leads/:leadId/history
   * Get intent score history for a lead
   */
  .get(
    '/leads/:leadId/history',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId, limit } = query;

      try {
        const history = await intentDetectionService.getIntentHistory(
          leadId,
          workspaceId,
          limit ? parseInt(limit, 10) : 30
        );

        return {
          lead_id: leadId,
          history: history.map((entry) => ({
            intent_score: entry.intentScore,
            intent_level: entry.intentLevel,
            calculated_at: entry.calculatedAt,
            trigger_signal_type: entry.triggerSignalType,
            score_delta: entry.scoreDelta,
          })),
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error fetching history:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      params: t.Object({ leadId: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Intent'],
        summary: 'Get intent history',
        description: 'Get intent score history for a lead',
      },
    }
  )

  /**
   * GET /api/v1/crm/intent/top-leads
   * Get leads with highest intent scores
   */
  .get(
    '/top-leads',
    async ({ query }) => {
      const { workspaceId, minScore, limit } = query;

      try {
        const leads = await intentDetectionService.getTopIntentLeads(
          workspaceId,
          minScore ? parseInt(minScore, 10) : 60,
          limit ? parseInt(limit, 10) : 50
        );

        return {
          workspace_id: workspaceId,
          leads: leads.map((score) => ({
            lead_id: score.leadId,
            intent_score: score.intentScore,
            intent_level: score.intentLevel,
            confidence: Number(score.confidence),
            signal_count: score.signalCount,
            recommended_action: score.recommendedAction,
            action_reason: score.actionReason,
            calculated_at: score.calculatedAt,
          })),
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error fetching top leads:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        minScore: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Intent'],
        summary: 'Get top intent leads',
        description: 'Get leads with highest intent scores',
      },
    }
  )

  /**
   * GET /api/v1/crm/intent/signal-types
   * Get configured signal types for workspace
   */
  .get(
    '/signal-types',
    async ({ query }) => {
      const { workspaceId } = query;

      try {
        const signalTypes = await db.query.intentSignalTypes.findMany({
          where: and(
            eq(intentSignalTypes.workspaceId, workspaceId),
            eq(intentSignalTypes.isActive, true)
          ),
        });

        return {
          workspace_id: workspaceId,
          signal_types: signalTypes.map((type) => ({
            id: type.id,
            signal_type: type.signalType,
            display_name: type.displayName,
            description: type.description,
            base_weight: Number(type.baseWeight),
            decay_rate: Number(type.decayRate),
            decay_period_days: type.decayPeriodDays,
            category: type.category,
          })),
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error fetching signal types:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Intent'],
        summary: 'Get signal types',
        description: 'Get configured signal types for workspace',
      },
    }
  )

  /**
   * POST /api/v1/crm/intent/signal-types
   * Create or update signal type configuration
   */
  .post(
    '/signal-types',
    async ({ query, body }) => {
      const { workspaceId } = query;
      const {
        signal_type,
        display_name,
        description,
        base_weight,
        decay_rate,
        decay_period_days,
        category,
      } = body;

      try {
        const [signalType] = await db
          .insert(intentSignalTypes)
          .values({
            workspaceId,
            signalType: signal_type,
            displayName: display_name,
            description,
            baseWeight: String(base_weight),
            decayRate: String(decay_rate),
            decayPeriodDays: decay_period_days || 7,
            category: category || 'engagement',
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [intentSignalTypes.workspaceId, intentSignalTypes.signalType],
            set: {
              displayName: display_name,
              description,
              baseWeight: String(base_weight),
              decayRate: String(decay_rate),
              decayPeriodDays: decay_period_days || 7,
              category: category || 'engagement',
              updatedAt: new Date(),
            },
          })
          .returning();

        return {
          success: true,
          signal_type: {
            id: signalType.id,
            signal_type: signalType.signalType,
            display_name: signalType.displayName,
            base_weight: Number(signalType.baseWeight),
            decay_rate: Number(signalType.decayRate),
          },
        };
      } catch (error: any) {
        console.error('[Intent Routes] Error creating signal type:', error);
        return {
          error: 'SERVER_ERROR',
          message: error.message,
        };
      }
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        signal_type: t.String(),
        display_name: t.String(),
        description: t.Optional(t.String()),
        base_weight: t.Number(),
        decay_rate: t.Number(),
        decay_period_days: t.Optional(t.Number()),
        category: t.Optional(t.Union([
          t.Literal('engagement'),
          t.Literal('research'),
          t.Literal('comparison'),
          t.Literal('decision'),
        ])),
      }),
      detail: {
        tags: ['Intent'],
        summary: 'Create signal type',
        description: 'Create or update signal type configuration',
      },
    }
  );
