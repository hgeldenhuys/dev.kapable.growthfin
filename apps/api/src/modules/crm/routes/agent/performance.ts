/**
 * Agent Performance Metrics Routes
 * REST endpoint for agent performance analytics and KPIs
 * US-AGENT-005: Agent Performance Metrics API
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { workspaces, workspaceMembers } from '@agios/db';
import { eq, and } from 'drizzle-orm';
import { agentPerformanceService } from '../../services/agent-performance';

export const agentPerformanceRoutes = new Elysia({ prefix: '/agent' })
  .get(
    '/performance',
    async ({ query, set }) => {
      const { workspaceId, userId, startDate, endDate } = query;

      // Performance tracking
      const startTime = Date.now();

      // Verify workspace access (same pattern as other agent routes)
      const [workspaceOwner] = await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspaceOwner) {
        set.status = 404;
        return {
          error: 'NOT_FOUND',
          message: 'Workspace not found',
        };
      }

      const isOwner = workspaceOwner.ownerId === userId;

      if (!isOwner) {
        // Not owner, check if member
        const membershipResult = await database
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, userId)
            )
          )
          .limit(1);

        if (!membershipResult.length) {
          set.status = 404;
          return {
            error: 'NOT_FOUND',
            message: 'Workspace not found',
          };
        }
      }

      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate date range
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        set.status = 400;
        return {
          error: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate must be valid ISO 8601 dates',
        };
      }

      if (start > end) {
        set.status = 400;
        return {
          error: 'INVALID_DATE_RANGE',
          message: 'startDate must be before endDate',
        };
      }

      // Calculate metrics
      try {
        const metrics = await agentPerformanceService.calculate(database, {
          workspaceId,
          userId,
          startDate: start,
          endDate: end,
        });

        const queryTime = Date.now() - startTime;

        console.log(
          `[agent/performance] Calculated metrics in ${queryTime}ms for user ${userId}`
        );

        if (queryTime > 2000) {
          console.warn(
            `[agent/performance] Performance warning: Query took ${queryTime}ms (target: <2000ms)`
          );
        }

        return {
          metrics,
          _meta: {
            queryTime,
            timestamp: new Date().toISOString(),
            dateRange: {
              startDate: start.toISOString(),
              endDate: end.toISOString(),
            },
          },
        };
      } catch (error) {
        console.error('[agent/performance] Error calculating metrics:', error);
        set.status = 500;
        return {
          error: 'CALCULATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to calculate metrics',
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        startDate: t.String(), // ISO 8601 format
        endDate: t.String(), // ISO 8601 format
      }),
      detail: {
        tags: ['Agent'],
        summary: 'Get agent performance metrics',
        description:
          'Calculate comprehensive agent performance metrics including calls made, contact rate, conversion rate, team comparison, and daily trends. Optimized for <2 seconds response time.',
      },
    }
  );
