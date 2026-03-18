/**
 * Lead Score History Routes
 * API endpoint for retrieving lead score history for trend charts
 * US-SCORE-005: Agent Dashboard Score Display
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { crmLeadScoreHistory, crmLeads } from '@agios/db';
import { eq, and, gte, desc, isNull } from 'drizzle-orm';

export const leadScoreHistoryRoutes = new Elysia({ prefix: '/leads' })
  .get(
    '/:id/score-history',
    async ({ params, query, set }) => {
      const { id: leadId } = params;
      const { workspaceId, days = '7' } = query;

      // Verify lead belongs to workspace
      const [lead] = await database
        .select()
        .from(crmLeads)
        .where(
          and(
            eq(crmLeads.id, leadId),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        )
        .limit(1);

      if (!lead) {
        set.status = 404;
        return {
          error: 'NOT_FOUND',
          message: 'Lead not found',
        };
      }

      // Calculate date threshold
      const daysNumber = parseInt(days, 10);
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysNumber);

      // Fetch score history
      const history = await database
        .select({
          id: crmLeadScoreHistory.id,
          scoreBefore: crmLeadScoreHistory.scoreBefore,
          scoreAfter: crmLeadScoreHistory.scoreAfter,
          scoreDelta: crmLeadScoreHistory.scoreDelta,
          createdAt: crmLeadScoreHistory.createdAt,
          triggerType: crmLeadScoreHistory.triggerType,
          triggerReason: crmLeadScoreHistory.triggerReason,
        })
        .from(crmLeadScoreHistory)
        .where(
          and(
            eq(crmLeadScoreHistory.leadId, leadId),
            eq(crmLeadScoreHistory.workspaceId, workspaceId),
            gte(crmLeadScoreHistory.createdAt, dateThreshold)
          )
        )
        .orderBy(desc(crmLeadScoreHistory.createdAt))
        .limit(50); // Limit to 50 entries

      return {
        history,
        _meta: {
          leadId,
          days: daysNumber,
          count: history.length,
          dateThreshold: dateThreshold.toISOString(),
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        days: t.Optional(t.String()),
      }),
      detail: {
        tags: ['CRM', 'Scoring'],
        summary: 'Get lead score history',
        description:
          'Returns score history for a lead over a specified number of days. Used for score trend charts.',
      },
    }
  );
