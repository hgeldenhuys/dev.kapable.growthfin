/**
 * Campaign Audience Routes
 * Audience calculation and recipient management
 */

import { Elysia, t } from 'elysia';
import { campaignService } from '../services/campaigns';
import { listsService } from '../services/lists.service';
import { listMembersService } from '../services/list-members.service';
import {
  applySelectionStrategy,
  getPreviousRecipientIds,
  excludePreviousRecipients,
} from '../services/campaign-snapshots.service';

export const campaignsAudienceRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // AUDIENCE MANAGEMENT
  // ============================================================================

  /**
   * Calculate audience size based on filter conditions
   * Used by the Campaign Wizard "Build Filters" tab
   */
  .post(
    '/:id/calculate-audience',
    async ({ db, params, body, set }) => {
      try {
        const campaignId = params.id;

        // 1. Validate campaign exists and belongs to workspace
        const campaign = await campaignService.getById(db, campaignId, body.workspaceId);
        if (!campaign) {
          set.status = 404;
          return { error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign does not exist' };
        }

        // 2. Calculate audience using the audienceDefinition filters
        const result = await campaignService.calculateAudience(
          db,
          body.workspaceId,
          body.audienceDefinition || { conditions: [] }
        );

        return { count: result.count, preview: result.preview };
      } catch (error) {
        console.error('[calculate-audience] Error:', error);
        set.status = 500;
        return {
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        audienceDefinition: t.Optional(
          t.Object({
            conditions: t.Array(
              t.Object({
                field: t.String(),
                operator: t.String(),
                value: t.Any(),
              })
            ),
          })
        ),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Calculate audience size from filters',
        description:
          'Calculate how many contacts match the given filter conditions for targeting',
      },
    }
  )
  .post(
    '/:id/calculate-list-audience',
    async ({ db, params, body, set }) => {
      try {
        const campaignId = params.id;
        const { listId, recipientSelection } = body;

        // 1. Validate campaign exists and belongs to workspace
        const campaign = await campaignService.getById(db, campaignId, body.workspaceId);
        if (!campaign) {
          set.status = 404;
          return { error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign does not exist' };
        }

        // 2. Validate list exists and belongs to workspace
        const list = await listsService.getListById(db, listId, body.workspaceId);
        if (!list) {
          set.status = 404;
          return { error: 'LIST_NOT_FOUND', message: 'List does not exist or not accessible' };
        }

        // 3. Validate strategy configuration
        const selection = recipientSelection || { selectionStrategy: 'first' as const };
        if (selection.selectionStrategy === 'prioritized' && !selection.sortCriteria) {
          set.status = 400;
          return {
            error: 'INVALID_STRATEGY',
            message: 'Prioritized strategy requires sortCriteria',
          };
        }

        // 4. Get all list members
        const { members: allMembers } = await listMembersService.getListMembers(
          db,
          listId,
          body.workspaceId
        );
        const totalListSize = allMembers.length;

        // 5. Apply exclusion for previous recipients if configured
        let eligibleMembers = allMembers;
        let excludedDueToPrevious = 0;

        if (selection.excludePreviousRecipients) {
          const previousRecipientIds = await getPreviousRecipientIds(db, campaignId, body.workspaceId);
          const { filtered, excludedCount } = excludePreviousRecipients(allMembers, previousRecipientIds);
          eligibleMembers = filtered;
          excludedDueToPrevious = excludedCount;
        }

        // 6. Apply selection strategy
        const selectedMembers = applySelectionStrategy(eligibleMembers, selection);
        const selectedCount = selectedMembers.length;
        const excludedCount = totalListSize - selectedCount;

        // 7. Format preview (first 10 contacts)
        const preview = selectedMembers.slice(0, 10).map((member) => ({
          id: member.entityId,
          entityType: member.entityType,
          ...member.entity,
        }));

        // 8. Calculate estimated cost if budget configured
        const estimatedCost =
          list.budgetPerContact && list.budgetPerContact > 0
            ? selectedCount * list.budgetPerContact
            : null;

        // 9. Return calculation results
        return {
          totalListSize,
          eligibleCount: eligibleMembers.length,
          selectedCount,
          excludedCount,
          preview,
          estimatedCost,
        };
      } catch (error) {
        console.error('[calculate-list-audience] Error:', error);
        set.status = 500;
        return {
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        listId: t.String(),
        recipientSelection: t.Optional(
          t.Object({
            maxRecipients: t.Optional(t.Number()),
            selectionStrategy: t.Union([
              t.Literal('first'),
              t.Literal('random'),
              t.Literal('prioritized'),
            ]),
            sortCriteria: t.Optional(
              t.Object({
                field: t.String(),
                direction: t.Union([t.Literal('ASC'), t.Literal('DESC')]),
              })
            ),
            excludePreviousRecipients: t.Optional(t.Boolean()),
          })
        ),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Calculate list audience size',
        description:
          'Calculate how many recipients will be selected from a list before creating campaign snapshot',
      },
    }
  )
  .post(
    '/:id/recipients',
    async ({ db, params, body, set }) => {
      const campaign = await campaignService.getById(db, params.id, body.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      const requestedCount = body.contactIds.length;
      const recipients = await campaignService.addRecipients(
        db,
        params.id,
        body.contactIds,
        body.workspaceId,
        body.addedBy
      );

      const addedCount = recipients.length;
      const skippedCount = requestedCount - addedCount;

      return {
        success: true,
        added: addedCount,
        skipped: skippedCount,
        total: requestedCount,
        recipients: recipients.map((r) => ({ id: r.id, contactId: r.contactId, status: r.status })),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        contactIds: t.Array(t.String()),
        addedBy: t.String(),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Add recipients',
        description: 'Add contacts as recipients to campaign',
      },
    }
  )
  .get(
    '/:id/recipients',
    async ({ db, params, query, set }) => {
      const campaign = await campaignService.getById(db, params.id, query.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      const recipients = await campaignService.getRecipients(db, params.id, query.workspaceId);
      return { recipients };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'List recipients',
        description: 'List campaign recipients with engagement stats',
      },
    }
  );
