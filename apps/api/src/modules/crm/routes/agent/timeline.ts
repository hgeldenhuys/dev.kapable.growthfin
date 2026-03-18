/**
 * Agent Activity Timeline Routes
 * REST endpoint for lead activity timeline with SSE streaming
 * US-AGENT-004: Activity Timeline API
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { crmActivities, crmLeads, users, workspaceMembers, workspaces } from '@agios/db';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { streamActivities } from '../../../../lib/electric-shapes';

export const agentTimelineRoutes = new Elysia({ prefix: '/agent' })
  .get(
    '/leads/:leadId/timeline',
    async ({ params, query, set }) => {
      const { leadId } = params;
      const { workspaceId, userId, type } = query;

      try {
        // Performance tracking
        const startTime = Date.now();

        // Verify workspace access (same pattern as lead-detail)
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
              message: 'Lead not found',
            };
          }
        }

        // Verify lead exists and belongs to workspace
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

        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Build query conditions
        const conditions = [
          eq(crmActivities.leadId, leadId),
          eq(crmActivities.workspaceId, workspaceId),
          isNull(crmActivities.deletedAt),
          gte(crmActivities.createdAt, thirtyDaysAgo),
        ];

        // Optional filter by type
        if (type) {
          conditions.push(eq(crmActivities.type, type));
        }

        // Fetch activities with user info (JOIN)
        const activities = await database
          .select({
            id: crmActivities.id,
            type: crmActivities.type,
            subject: crmActivities.subject,
            description: crmActivities.description,
            disposition: crmActivities.disposition,
            outcome: crmActivities.outcome,
            status: crmActivities.status,
            duration: crmActivities.duration,
            createdAt: crmActivities.createdAt,
            completedDate: crmActivities.completedDate,
            dueDate: crmActivities.dueDate,
            createdBy: crmActivities.createdBy,
            // User info from JOIN
            userName: users.name,
            userEmail: users.email,
          })
          .from(crmActivities)
          .leftJoin(users, eq(crmActivities.createdBy, users.id))
          .where(and(...conditions))
          .orderBy(desc(crmActivities.createdAt));

        const queryTime = Date.now() - startTime;

        console.log(
          `[agent/timeline] Retrieved ${activities.length} activities in ${queryTime}ms for lead ${leadId}`
        );

        // Format response
        const response = {
          activities: activities.map((activity) => ({
            id: activity.id,
            type: activity.type,
            subject: activity.subject,
            notes: activity.description,
            disposition: activity.disposition,
            outcome: activity.outcome,
            status: activity.status,
            duration: activity.duration,
            createdAt: activity.createdAt,
            completedDate: activity.completedDate,
            dueDate: activity.dueDate,
            createdBy: {
              id: activity.createdBy,
              name: activity.userName || 'Unknown User',
              email: activity.userEmail || null,
            },
          })),
          _meta: {
            count: activities.length,
            queryTime,
            timestamp: new Date().toISOString(),
          },
        };

        return response;
      } catch (error) {
        console.error('[agent/timeline] Error:', error);
        set.status = 404;
        return {
          error: 'NOT_FOUND',
          message: 'Lead not found or invalid ID format',
        };
      }
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        type: t.Optional(
          t.Union([
            t.Literal('call'),
            t.Literal('email'),
            t.Literal('meeting'),
            t.Literal('note'),
            t.Literal('task'),
          ])
        ),
      }),
      detail: {
        tags: ['Agent'],
        summary: 'Get lead activity timeline',
        description:
          'Returns last 30 days of activities for a lead. Optional filter by type (call, email, meeting, note, task). Includes user info for each activity.',
      },
    }
  )
  .get(
    '/leads/:leadId/timeline/stream',
    async function* ({ params, query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { leadId } = params;
      const { workspaceId } = query;

      const subscriptionTimestamp = new Date();

      console.log(
        `[agent/timeline/stream] Starting stream for lead ${leadId} in workspace ${workspaceId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream activities for this workspace
        // Note: ElectricSQL streams all activities for workspace, client should filter by leadId
        const electric = streamActivities(workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[agent/timeline/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
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
        tags: ['Agent'],
        summary: 'Stream lead activity timeline updates',
        description:
          'Stream NEW activity updates via ElectricSQL (REACTIVE, NO POLLING). Client should filter by leadId.',
      },
    }
  );
