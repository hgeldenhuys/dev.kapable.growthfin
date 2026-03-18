/**
 * Drip Campaign Routes
 * API endpoints for managing drip enrollments
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { crmDripEnrollments } from '@agios/db';
import { eq, and } from 'drizzle-orm';
import { dripService } from '../services/drip';
import { timelineService } from '../services/timeline';
import { getUserName } from '../../../lib/utils/user-lookup';

export const dripRoutes = new Elysia({ prefix: '/drip' })

  // List all enrollments for a campaign
  .get(
    '/campaigns/:campaignId/enrollments',
    async ({ params, query }) => {
      const { campaignId } = params;
      const { workspace_id } = query;

      if (!workspace_id) {
        return { error: 'workspace_id is required' };
      }

      const enrollments = await db.query.crmDripEnrollments.findMany({
        where: (enrollments, { eq, and }) =>
          and(
            eq(enrollments.campaignId, campaignId),
            eq(enrollments.workspaceId, workspace_id)
          ),
        with: {
          contact: true,
          recipient: true,
          nextMessage: true,
        },
        orderBy: (enrollments, { desc }) => [desc(enrollments.enrolledAt)],
      });

      return {
        enrollments,
        total: enrollments.length,
        active: enrollments.filter((e) => e.status === 'active').length,
        completed: enrollments.filter((e) => e.status === 'completed').length,
        paused: enrollments.filter((e) => e.status === 'paused').length,
      };
    },
    {
      params: t.Object({
        campaignId: t.String(),
      }),
      query: t.Object({
        workspace_id: t.String(),
      }),
      detail: {
        tags: ['Drip Campaigns'],
        summary: 'List drip enrollments',
        description: 'Get all drip enrollments for a campaign',
      },
    }
  )

  // Get enrollment status
  .get(
    '/enrollments/:enrollmentId/status',
    async ({ params, query }) => {
      const { enrollmentId } = params;
      const { workspace_id } = query;

      if (!workspace_id) {
        return { error: 'workspace_id is required' };
      }

      const enrollment = await db.query.crmDripEnrollments.findFirst({
        where: (enrollments, { eq, and }) =>
          and(
            eq(enrollments.id, enrollmentId),
            eq(enrollments.workspaceId, workspace_id)
          ),
        with: {
          contact: true,
          campaign: true,
          nextMessage: true,
        },
      });

      if (!enrollment) {
        return { error: 'Enrollment not found' };
      }

      return { enrollment };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspace_id: t.String(),
      }),
      detail: {
        tags: ['Drip Campaigns'],
        summary: 'Get enrollment status',
        description: 'Get current status and next scheduled message for an enrollment',
      },
    }
  )

  // Pause an enrollment
  .post(
    '/enrollments/:enrollmentId/pause',
    async ({ params, query }) => {
      const { enrollmentId } = params;
      const { workspace_id, userId } = query;

      if (!workspace_id) {
        return { error: 'workspace_id is required' };
      }

      // Verify enrollment belongs to workspace
      const existing = await db.query.crmDripEnrollments.findFirst({
        where: (enrollments, { eq, and }) =>
          and(
            eq(enrollments.id, enrollmentId),
            eq(enrollments.workspaceId, workspace_id)
          ),
      });

      if (!existing) {
        return { error: 'Enrollment not found' };
      }

      const enrollment = await dripService.pauseEnrollment(db, enrollmentId);

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: workspace_id,
        entityType: 'contact',
        entityId: enrollment.contactId,
        eventType: 'campaign.drip_enrollment_paused',
        eventCategory: 'system',
        eventLabel: 'Drip Enrollment Paused',
        summary: `Drip sequence paused at step ${enrollment.currentSequenceStep}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId || null,
        actorName: await getUserName(userId),
        metadata: {
          enrollmentId: enrollment.id,
          campaignId: enrollment.campaignId,
          currentStep: enrollment.currentSequenceStep,
        },
      });

      return { enrollment };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspace_id: t.String(),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Drip Campaigns'],
        summary: 'Pause enrollment',
        description: 'Pause a drip enrollment (can be resumed later)',
      },
    }
  )

  // Resume an enrollment
  .post(
    '/enrollments/:enrollmentId/resume',
    async ({ params, query }) => {
      const { enrollmentId } = params;
      const { workspace_id, userId } = query;

      if (!workspace_id) {
        return { error: 'workspace_id is required' };
      }

      // Verify enrollment belongs to workspace
      const existing = await db.query.crmDripEnrollments.findFirst({
        where: (enrollments, { eq, and }) =>
          and(
            eq(enrollments.id, enrollmentId),
            eq(enrollments.workspaceId, workspace_id)
          ),
      });

      if (!existing) {
        return { error: 'Enrollment not found' };
      }

      const enrollment = await dripService.resumeEnrollment(db, enrollmentId);

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: workspace_id,
        entityType: 'contact',
        entityId: enrollment.contactId,
        eventType: 'campaign.drip_enrollment_resumed',
        eventCategory: 'system',
        eventLabel: 'Drip Enrollment Resumed',
        summary: `Drip sequence resumed from step ${enrollment.currentSequenceStep}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId || null,
        actorName: await getUserName(userId),
        metadata: {
          enrollmentId: enrollment.id,
          campaignId: enrollment.campaignId,
          currentStep: enrollment.currentSequenceStep,
          nextScheduledAt: enrollment.nextScheduledAt?.toISOString(),
        },
      });

      return { enrollment };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspace_id: t.String(),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Drip Campaigns'],
        summary: 'Resume enrollment',
        description: 'Resume a paused drip enrollment',
      },
    }
  )

  // Unsubscribe (soft delete - marks as unsubscribed)
  .delete(
    '/enrollments/:enrollmentId',
    async ({ params, query }) => {
      const { enrollmentId } = params;
      const { workspace_id, userId } = query;

      if (!workspace_id) {
        return { error: 'workspace_id is required' };
      }

      // Verify enrollment belongs to workspace
      const existing = await db.query.crmDripEnrollments.findFirst({
        where: (enrollments, { eq, and }) =>
          and(
            eq(enrollments.id, enrollmentId),
            eq(enrollments.workspaceId, workspace_id)
          ),
      });

      if (!existing) {
        return { error: 'Enrollment not found' };
      }

      const enrollment = await dripService.unsubscribeEnrollment(db, enrollmentId);

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: workspace_id,
        entityType: 'contact',
        entityId: enrollment.contactId,
        eventType: 'campaign.drip_enrollment_unsubscribed',
        eventCategory: 'system',
        eventLabel: 'Drip Enrollment Unsubscribed',
        summary: `Unsubscribed from drip sequence at step ${enrollment.currentSequenceStep}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId || null,
        actorName: await getUserName(userId),
        metadata: {
          enrollmentId: enrollment.id,
          campaignId: enrollment.campaignId,
          currentStep: enrollment.currentSequenceStep,
        },
      });

      return { enrollment, message: 'Enrollment unsubscribed' };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspace_id: t.String(),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Drip Campaigns'],
        summary: 'Unsubscribe enrollment',
        description: 'Unsubscribe recipient from drip sequence (keeps record for audit)',
      },
    }
  );
