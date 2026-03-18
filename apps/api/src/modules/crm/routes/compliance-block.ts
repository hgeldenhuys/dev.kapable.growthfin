/**
 * Compliance Block Routes
 * REST endpoints for do_not_contact enforcement with entity propagation
 * US-CRM-STATE-MACHINE T-014, T-020
 */

import { Elysia, t } from 'elysia';
import { complianceBlockService } from '../services/compliance-block';

export const complianceBlockRoutes = new Elysia({ prefix: '/compliance' })
  /**
   * T-020: Apply Compliance Block
   * POST /:entityType/:id/block - Apply compliance block to entity
   */
  .post(
    '/:entityType/:id/block',
    async ({ db, params, query, body, set }) => {
      // Validate entity type
      if (params.entityType !== 'lead' && params.entityType !== 'contact') {
        set.status = 400;
        return {
          error: `Invalid entity type: ${params.entityType}. Must be 'lead' or 'contact'`,
        };
      }

      try {
        await complianceBlockService.applyComplianceBlock(
          db,
          params.entityType as 'lead' | 'contact',
          params.id,
          query.workspaceId,
          body.reason,
          body.requestedBy,
          body.userId
        );

        return {
          success: true,
          message: `Compliance block applied to ${params.entityType} ${params.id}`,
        };
      } catch (error) {
        console.error('[compliance/:entityType/:id/block] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to apply compliance block',
        };
      }
    },
    {
      params: t.Object({
        entityType: t.String(),
        id: t.String(),
      }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        reason: t.String(),
        requestedBy: t.Union([
          t.Literal('consumer'),
          t.Literal('system'),
          t.Literal('legal'),
        ]),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Compliance', 'State Machine'],
        summary: 'Apply compliance block',
        description: 'Apply do_not_contact compliance block to lead or contact with entity propagation (US-CRM-STATE-MACHINE T-014)',
      },
    }
  )
  /**
   * GET /:entityType/:id/is-blocked - Check if entity is blocked
   */
  .get(
    '/:entityType/:id/is-blocked',
    async ({ db, params, query, set }) => {
      // Validate entity type
      if (params.entityType !== 'lead' && params.entityType !== 'contact') {
        set.status = 400;
        return {
          error: `Invalid entity type: ${params.entityType}. Must be 'lead' or 'contact'`,
        };
      }

      try {
        const isBlocked = await complianceBlockService.isBlocked(
          db,
          params.entityType as 'lead' | 'contact',
          params.id,
          query.workspaceId
        );

        return {
          isBlocked,
          entityType: params.entityType,
          entityId: params.id,
        };
      } catch (error) {
        console.error('[compliance/:entityType/:id/is-blocked] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to check compliance block status',
        };
      }
    },
    {
      params: t.Object({
        entityType: t.String(),
        id: t.String(),
      }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Compliance', 'State Machine'],
        summary: 'Check if entity is blocked',
        description: 'Check if lead or contact has active compliance block (US-CRM-STATE-MACHINE T-014)',
      },
    }
  );
