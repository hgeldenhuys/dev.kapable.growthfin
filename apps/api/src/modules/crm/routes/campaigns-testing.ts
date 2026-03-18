/**
 * Campaign A/B Testing Routes
 * A/B test results, winner declaration, and evaluation
 */

import { Elysia, t } from 'elysia';
import { campaignService, campaignMessageService } from '../services/campaigns';
import { timelineService } from '../services/timeline';
import { abTestingService } from '../services/ab-testing';

export const campaignsTestingRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // A/B TESTING
  // ============================================================================
  .get(
    '/:id/ab-test-results',
    async ({ db, params, query, set }) => {
      const campaign = await campaignService.getById(db, params.id, query.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      const results = await abTestingService.getTestResults(db, params.id, query.workspaceId);

      return {
        campaignId: params.id,
        campaignName: campaign.name,
        variants: results.map((r) => ({
          id: r.id,
          messageId: r.messageId,
          variantName: r.variantName,
          isWinner: r.isWinner,
          metrics: {
            sentCount: r.sentCount,
            deliveredCount: r.deliveredCount,
            openedCount: r.openedCount,
            clickedCount: r.clickedCount,
            bouncedCount: r.bouncedCount,
            openRate: r.openRate ? Number(r.openRate) : null,
            clickRate: r.clickRate ? Number(r.clickRate) : null,
            bounceRate: r.bounceRate ? Number(r.bounceRate) : null,
          },
          winnerDeclaredAt: r.winnerDeclaredAt,
          winningCriteria: r.winningCriteria,
          message: r.message,
        })),
        totalVariants: results.length,
        hasWinner: results.some((r) => r.isWinner),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns', 'A/B Testing'],
        summary: 'Get A/B test results',
        description: 'Get A/B test results for a campaign with all variant metrics',
      },
    }
  )
  .post(
    '/:id/declare-winner',
    async ({ db, params, body, set }) => {
      const campaign = await campaignService.getById(db, params.id, body.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      // Validate message exists
      const messages = await campaignMessageService.list(db, params.id, body.workspaceId);
      const targetMessage = messages.find((m) => m.id === body.messageId);

      if (!targetMessage) {
        set.status = 404;
        return { error: 'Message not found' };
      }

      // Declare winner
      await abTestingService.declareWinner(
        db,
        params.id,
        body.workspaceId,
        body.messageId,
        body.criteria || 'manual'
      );

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: body.workspaceId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.ab_test_winner_declared',
        eventCategory: 'system',
        eventLabel: 'A/B Test Winner Declared',
        summary: `Winner declared for campaign "${campaign.name}": Variant ${targetMessage.variantName || 'A'}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: body.userId,
        actorName: 'User',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
          messageId: body.messageId,
          messageName: targetMessage.name,
          variantName: targetMessage.variantName,
          criteria: body.criteria || 'manual',
        },
      });

      return {
        success: true,
        messageId: body.messageId,
        variantName: targetMessage.variantName,
        criteria: body.criteria || 'manual',
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        messageId: t.String(),
        criteria: t.Optional(t.Union([
          t.Literal('open_rate'),
          t.Literal('click_rate'),
          t.Literal('manual'),
          t.Literal('engagement'),
        ])),
      }),
      detail: {
        tags: ['Campaigns', 'A/B Testing'],
        summary: 'Declare A/B test winner',
        description: 'Manually declare the winning variant for an A/B test',
      },
    }
  )
  .post(
    '/:id/auto-declare-winner',
    async ({ db, params, body, set }) => {
      const campaign = await campaignService.getById(db, params.id, body.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      const result = await abTestingService.autoDeclareWinner(
        db,
        params.id,
        body.workspaceId,
        body.criteria || 'open_rate',
        body.minSampleSize || 100
      );

      if (!result) {
        set.status = 400;
        return {
          error: 'Not enough data to declare a winner',
          minSampleSize: body.minSampleSize || 100,
        };
      }

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: body.workspaceId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.ab_test_winner_declared',
        eventCategory: 'system',
        eventLabel: 'A/B Test Winner Auto-Declared',
        summary: `Winner auto-declared for campaign "${campaign.name}": Variant ${result.variantName} (by ${body.criteria || 'open_rate'})`,
        occurredAt: new Date(),
        actorType: 'system',
        actorId: null,
        actorName: 'A/B Test Auto-Selector',
        metadata: {
          campaignId: params.id,
          campaignName: campaign.name,
          messageId: result.messageId,
          variantName: result.variantName,
          criteria: body.criteria || 'open_rate',
          auto: true,
        },
      });

      return {
        success: true,
        messageId: result.messageId,
        variantName: result.variantName,
        criteria: body.criteria || 'open_rate',
        auto: true,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        criteria: t.Optional(t.Union([
          t.Literal('open_rate'),
          t.Literal('click_rate'),
          t.Literal('engagement'),
        ])),
        minSampleSize: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Campaigns', 'A/B Testing'],
        summary: 'Auto-declare A/B test winner',
        description: 'Automatically declare winner based on performance metrics',
      },
    }
  )
  .post(
    '/:id/evaluate',
    async ({ db, params, body, set }) => {
      const campaign = await campaignService.getById(db, params.id, body.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      try {
        const evaluation = await abTestingService.evaluateABTest(
          db,
          params.id,
          body.workspaceId,
          body.criteria || 'open_rate',
          body.minSampleSize || 100
        );

        return {
          success: true,
          campaignId: params.id,
          campaignName: campaign.name,
          criteria: body.criteria || 'open_rate',
          evaluation: {
            hasMinimumSample: evaluation.hasMinimumSample,
            sampleValidation: evaluation.sampleValidation,
            variants: evaluation.variants.map((v) => ({
              variantName: v.variantName,
              messageId: v.messageId,
              performance: {
                rate: v.rate,
                ratePercentage: (v.rate * 100).toFixed(2),
                count: v.count,
                total: v.total,
              },
              confidenceInterval: {
                lower: (v.confidenceInterval.lower * 100).toFixed(2),
                upper: (v.confidenceInterval.upper * 100).toFixed(2),
                margin: (v.confidenceInterval.margin * 100).toFixed(2),
              },
            })),
            statisticalTest: evaluation.chiSquareTest
              ? {
                  chiSquare: evaluation.chiSquareTest.chiSquare.toFixed(4),
                  pValue: evaluation.chiSquareTest.pValue.toFixed(4),
                  degreesOfFreedom: evaluation.chiSquareTest.degreesOfFreedom,
                  isSignificant: evaluation.chiSquareTest.isSignificant,
                  interpretation:
                    evaluation.chiSquareTest.pValue < 0.01
                      ? 'Highly significant (p < 0.01)'
                      : evaluation.chiSquareTest.pValue < 0.05
                      ? 'Significant (p < 0.05)'
                      : 'Not significant (p >= 0.05)',
                }
              : null,
            recommendedWinner: evaluation.recommendedWinner
              ? {
                  variantName: evaluation.recommendedWinner.variantName,
                  messageId: evaluation.recommendedWinner.messageId,
                  lift: evaluation.recommendedWinner.lift.toFixed(2),
                  liftPercentage: `${evaluation.recommendedWinner.lift >= 0 ? '+' : ''}${evaluation.recommendedWinner.lift.toFixed(2)}%`,
                }
              : null,
          },
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to evaluate A/B test',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        criteria: t.Optional(
          t.Union([t.Literal('open_rate'), t.Literal('click_rate'), t.Literal('engagement')])
        ),
        minSampleSize: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Campaigns', 'A/B Testing'],
        summary: 'Evaluate A/B test with statistical analysis',
        description:
          'Analyze A/B test results with chi-square test, confidence intervals, and recommended winner (does not declare winner)',
      },
    }
  );
