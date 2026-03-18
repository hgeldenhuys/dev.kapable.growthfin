/**
 * Lead Segments Routes
 * Dynamic segmentation with auto-refresh and metrics tracking
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import {
  leadSegments,
  leadSegmentMemberships,
  segmentMetricsHistory,
  crmLeads,
} from '@agios/db';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';
import {
  evaluateSegmentCriteria,
  validateSegmentCriteria,
  type Criteria,
} from '../services/segment-query-evaluator';

export const segmentsRoutes = new Elysia({ prefix: '/segments' })
  /**
   * List all segments for workspace
   * GET /api/v1/workspaces/:workspaceId/crm/segments
   */
  .get(
    '/',
    async ({ query }) => {
      const { workspaceId } = query;

      const segments = await db.query.leadSegments.findMany({
        where: and(
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
        orderBy: desc(leadSegments.createdAt),
      });

      return {
        segments,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'List segments',
        description: 'List all active segments for a workspace',
      },
    }
  )

  /**
   * Get single segment
   * GET /api/v1/workspaces/:workspaceId/crm/segments/:segmentId
   */
  .get(
    '/:segmentId',
    async ({ params, query }) => {
      const { segmentId } = params;
      const { workspaceId } = query;

      const segment = await db.query.leadSegments.findFirst({
        where: and(
          eq(leadSegments.id, segmentId),
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
      });

      if (!segment) {
        throw new Error('Segment not found');
      }

      // Get current memberships count
      const memberships = await db
        .select({ count: sql<number>`count(*)` })
        .from(leadSegmentMemberships)
        .where(
          and(
            eq(leadSegmentMemberships.segmentId, segmentId),
            isNull(leadSegmentMemberships.removedAt)
          )
        );

      return {
        ...segment,
        currentMemberCount: Number(memberships[0]?.count) || 0,
      };
    },
    {
      params: t.Object({
        segmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Get segment',
        description: 'Get single segment with current member count',
      },
    }
  )

  /**
   * Create new segment
   * POST /api/v1/workspaces/:workspaceId/crm/segments
   */
  .post(
    '/',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const {
        name,
        description,
        color,
        icon,
        criteria,
        autoRefresh = true,
        refreshIntervalMinutes = 15,
        userId,
      } = body;

      // Validate criteria
      const validation = validateSegmentCriteria(criteria as Criteria);
      if (!validation.valid) {
        throw new Error(`Invalid criteria: ${validation.errors.join(', ')}`);
      }

      // Create segment
      const [segment] = await db
        .insert(leadSegments)
        .values({
          workspaceId,
          name,
          description,
          color,
          icon,
          criteria,
          autoRefresh,
          refreshIntervalMinutes,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Enqueue initial refresh
      await jobQueue.send('refresh-segment', {
        segmentId: segment.id,
        workspaceId,
        forceRefresh: true,
      });

      return {
        success: true,
        segmentId: segment.id,
        segment,
        message: 'Segment created and refresh queued',
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        color: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        criteria: t.Any(), // JSON object
        autoRefresh: t.Optional(t.Boolean()),
        refreshIntervalMinutes: t.Optional(t.Number()),
        userId: t.String(), // From auth middleware
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Create segment',
        description: 'Create new lead segment with criteria',
      },
    }
  )

  /**
   * Update segment
   * PUT /api/v1/workspaces/:workspaceId/crm/segments/:segmentId
   */
  .put(
    '/:segmentId',
    async ({ params, body, query }) => {
      const { segmentId } = params;
      const { workspaceId } = query;
      const {
        name,
        description,
        color,
        icon,
        criteria,
        autoRefresh,
        refreshIntervalMinutes,
        userId,
      } = body;

      // Check segment exists
      const existingSegment = await db.query.leadSegments.findFirst({
        where: and(
          eq(leadSegments.id, segmentId),
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
      });

      if (!existingSegment) {
        throw new Error('Segment not found');
      }

      // Validate criteria if provided
      if (criteria) {
        const validation = validateSegmentCriteria(criteria as Criteria);
        if (!validation.valid) {
          throw new Error(`Invalid criteria: ${validation.errors.join(', ')}`);
        }
      }

      // Update segment
      const [segment] = await db
        .update(leadSegments)
        .set({
          name: name ?? existingSegment.name,
          description: description ?? existingSegment.description,
          color: color ?? existingSegment.color,
          icon: icon ?? existingSegment.icon,
          criteria: criteria ?? existingSegment.criteria,
          autoRefresh: autoRefresh ?? existingSegment.autoRefresh,
          refreshIntervalMinutes:
            refreshIntervalMinutes ?? existingSegment.refreshIntervalMinutes,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(leadSegments.id, segmentId))
        .returning();

      // Enqueue refresh if criteria changed
      if (criteria) {
        await jobQueue.send('refresh-segment', {
          segmentId: segment.id,
          workspaceId,
          forceRefresh: true,
        });
      }

      return {
        success: true,
        segment,
        message: criteria ? 'Segment updated and refresh queued' : 'Segment updated',
      };
    },
    {
      params: t.Object({
        segmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        color: t.Optional(t.String()),
        icon: t.Optional(t.String()),
        criteria: t.Optional(t.Any()), // JSON object
        autoRefresh: t.Optional(t.Boolean()),
        refreshIntervalMinutes: t.Optional(t.Number()),
        userId: t.String(), // From auth middleware
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Update segment',
        description: 'Update segment properties and optionally trigger refresh',
      },
    }
  )

  /**
   * Delete segment (soft delete)
   * DELETE /api/v1/workspaces/:workspaceId/crm/segments/:segmentId
   */
  .delete(
    '/:segmentId',
    async ({ params, query }) => {
      const { segmentId } = params;
      const { workspaceId } = query;

      // Check segment exists
      const segment = await db.query.leadSegments.findFirst({
        where: and(
          eq(leadSegments.id, segmentId),
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
      });

      if (!segment) {
        throw new Error('Segment not found');
      }

      // Soft delete
      await db
        .update(leadSegments)
        .set({
          deletedAt: new Date(),
        })
        .where(eq(leadSegments.id, segmentId));

      return {
        success: true,
        message: 'Segment deleted',
      };
    },
    {
      params: t.Object({
        segmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Delete segment',
        description: 'Soft delete a segment',
      },
    }
  )

  /**
   * Preview segment membership (no save)
   * POST /api/v1/workspaces/:workspaceId/crm/segments/preview
   */
  .post(
    '/preview',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const { criteria } = body;

      // Validate criteria
      const validation = validateSegmentCriteria(criteria as Criteria);
      if (!validation.valid) {
        throw new Error(`Invalid criteria: ${validation.errors.join(', ')}`);
      }

      try {
        // Build SQL WHERE clause
        const whereClause = evaluateSegmentCriteria(criteria as Criteria);

        // Find matching leads (limit to 100 for preview)
        const matchingLeads = await db
          .select({
            id: crmLeads.id,
            firstName: crmLeads.firstName,
            lastName: crmLeads.lastName,
            email: crmLeads.email,
            companyName: crmLeads.companyName,
            status: crmLeads.status,
            propensityScore: crmLeads.propensityScore,
          })
          .from(crmLeads)
          .where(and(eq(crmLeads.workspaceId, workspaceId), sql`${whereClause}`))
          .limit(100);

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(crmLeads)
          .where(and(eq(crmLeads.workspaceId, workspaceId), sql`${whereClause}`));

        return {
          totalCount: countResult[0]?.count || 0,
          matchingLeads: matchingLeads,
          previewLimit: 100,
        };
      } catch (error) {
        console.error('Preview error:', error);
        throw new Error(`Failed to preview segment: ${error.message}`);
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        criteria: t.Any(), // JSON object
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Preview segment',
        description: 'Preview segment membership without saving (limited to 100 leads)',
      },
    }
  )

  /**
   * Get segment metrics with timeframe
   * GET /api/v1/workspaces/:workspaceId/crm/segments/:segmentId/metrics
   */
  .get(
    '/:segmentId/metrics',
    async ({ params, query }) => {
      const { segmentId } = params;
      const { workspaceId, timeframe = '30d' } = query;

      // Check segment exists
      const segment = await db.query.leadSegments.findFirst({
        where: and(
          eq(leadSegments.id, segmentId),
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
      });

      if (!segment) {
        throw new Error('Segment not found');
      }

      // Calculate date range based on timeframe
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get metrics history
      const metrics = await db
        .select()
        .from(segmentMetricsHistory)
        .where(
          and(
            eq(segmentMetricsHistory.segmentId, segmentId),
            sql`${segmentMetricsHistory.snapshotDate} >= ${startDate}`
          )
        )
        .orderBy(segmentMetricsHistory.snapshotDate);

      return {
        segment,
        timeframe,
        metrics,
      };
    },
    {
      params: t.Object({
        segmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        timeframe: t.Optional(t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])),
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Get segment metrics',
        description: 'Get historical metrics for a segment',
      },
    }
  )

  /**
   * Manual refresh trigger
   * POST /api/v1/workspaces/:workspaceId/crm/segments/:segmentId/refresh
   */
  .post(
    '/:segmentId/refresh',
    async ({ params, query }) => {
      const { segmentId } = params;
      const { workspaceId } = query;

      // Check segment exists
      const segment = await db.query.leadSegments.findFirst({
        where: and(
          eq(leadSegments.id, segmentId),
          eq(leadSegments.workspaceId, workspaceId),
          isNull(leadSegments.deletedAt)
        ),
      });

      if (!segment) {
        throw new Error('Segment not found');
      }

      // Enqueue refresh job
      await jobQueue.send('refresh-segment', {
        segmentId: segment.id,
        workspaceId,
        forceRefresh: true,
      });

      return {
        success: true,
        message: 'Segment refresh queued',
      };
    },
    {
      params: t.Object({
        segmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Segments'],
        summary: 'Refresh segment',
        description: 'Manually trigger segment membership refresh',
      },
    }
  );
