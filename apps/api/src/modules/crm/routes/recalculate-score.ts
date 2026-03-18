/**
 * Manual Score Recalculation Route
 * Allows manual triggering of lead propensity score calculation
 */

import { Elysia, t } from 'elysia';
import { jobQueue, type CalculateLeadScoreJob } from '../../../lib/queue';
import { leadService } from '../services/leads';

export const recalculateScoreRoutes = new Elysia({ prefix: '/leads' })
  .post(
    '/:id/recalculate-score',
    async ({ db, params, body, query }) => {
      const { id: leadId } = params;
      const { workspaceId, userId, reason } = body;

      // Verify lead exists
      const lead = await leadService.getById(db, leadId, workspaceId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Queue manual scoring job (priority 7)
      const jobId = await jobQueue.send<CalculateLeadScoreJob>(
        'calculate-lead-score',
        {
          leadId,
          workspaceId,
          trigger: 'manual',
          triggerUserId: userId,
          triggerReason: reason,
        },
        {
          priority: 7, // Medium-high priority for manual recalculation
          retryLimit: 3,
          retryDelay: 60,
        }
      );

      return {
        success: true,
        message: 'Score recalculation queued',
        jobId,
        leadId,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        reason: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Manually recalculate lead score',
        description:
          'Queue a background job to recalculate the propensity score for a lead. ' +
          'Score will be updated asynchronously within seconds.',
      },
    }
  );
