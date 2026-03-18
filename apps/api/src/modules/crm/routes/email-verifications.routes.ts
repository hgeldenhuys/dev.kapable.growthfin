/**
 * Email Verifications Routes
 * REST endpoints for email verification attempts audit trail
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-003
 */

import { Elysia, t } from 'elysia';
import { emailVerificationService } from '../services/email-verification.service';

export const emailVerificationsRoutes = new Elysia({ prefix: '/email-verifications' })
  /**
   * GET / - Get email verification attempts for an entity
   * Returns paginated list with summary statistics
   */
  .get(
    '/',
    async ({ db, query }) => {
      const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
      const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit, 10))) : 50;
      const offset = (page - 1) * limit;

      const result = await emailVerificationService.getVerificationAttempts(db, {
        workspaceId: query.workspaceId,
        entityId: query.entityId,
        entityType: query.entityType,
        limit,
        offset,
      });

      return {
        attempts: result.attempts,
        summary: result.summary,
        pagination: {
          total: result.totalCount,
          limit,
          offset,
          page,
          totalPages: Math.ceil(result.totalCount / limit),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityId: t.String(),
        entityType: t.Union([t.Literal('contact'), t.Literal('lead')]),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Email Verifications'],
        summary: 'Get email verification attempts for an entity',
        description:
          'Fetch email verification attempts from crm_tool_calls for a specific lead or contact. Returns parsed results with human-readable status labels and summary statistics.',
      },
    }
  )

  /**
   * GET /failed - Get only failed verification attempts
   * Used for showing eliminated emails
   */
  .get(
    '/failed',
    async ({ db, query }) => {
      const attempts = await emailVerificationService.getFailedVerificationAttempts(
        db,
        query.workspaceId,
        query.entityId,
        query.entityType
      );

      return {
        attempts,
        totalCount: attempts.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        entityId: t.String(),
        entityType: t.Union([t.Literal('contact'), t.Literal('lead')]),
      }),
      detail: {
        tags: ['Email Verifications'],
        summary: 'Get failed email verification attempts',
        description:
          'Fetch only failed/invalid email verification attempts for a lead or contact. Useful for showing eliminated emails during enrichment.',
      },
    }
  )

  /**
   * GET /by-job/:jobId - Get verification attempts for a specific enrichment job
   */
  .get(
    '/by-job/:jobId',
    async ({ db, params, query }) => {
      const attempts = await emailVerificationService.getVerificationAttemptsByJobId(
        db,
        query.workspaceId,
        params.jobId
      );

      // Calculate summary
      const validCount = attempts.filter((a) => a.isValid).length;
      const invalidCount = attempts.filter((a) => !a.isValid).length;

      return {
        attempts,
        totalCount: attempts.length,
        summary: {
          total: attempts.length,
          valid: validCount,
          invalid: invalidCount,
        },
      };
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Email Verifications'],
        summary: 'Get email verification attempts by enrichment job',
        description:
          'Fetch all email verification attempts performed during a specific enrichment job.',
      },
    }
  )

  /**
   * GET /summary/:entityId - Get summary only (no attempt details)
   * Lightweight endpoint for showing badges/counts
   */
  .get(
    '/summary/:entityId',
    async ({ db, params, query }) => {
      const result = await emailVerificationService.getVerificationAttempts(db, {
        workspaceId: query.workspaceId,
        entityId: params.entityId,
        entityType: query.entityType,
        limit: 1, // We only need counts
      });

      return {
        entityId: params.entityId,
        entityType: query.entityType,
        summary: result.summary,
      };
    },
    {
      params: t.Object({
        entityId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        entityType: t.Union([t.Literal('contact'), t.Literal('lead')]),
      }),
      detail: {
        tags: ['Email Verifications'],
        summary: 'Get email verification summary for an entity',
        description:
          'Lightweight endpoint returning only summary statistics (valid/invalid counts) without attempt details.',
      },
    }
  );
