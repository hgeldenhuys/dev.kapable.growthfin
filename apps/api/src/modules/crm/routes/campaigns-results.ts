/**
 * Campaign Results Routes
 * Result list generation from campaign engagement (US-CL-008)
 */

import { Elysia, t } from 'elysia';
import { campaignService } from '../services/campaigns';
import { timelineService } from '../services/timeline';
import { listsService } from '../services/lists.service';
import { listMembersService } from '../services/list-members.service';
import { queryRecipientsByCriteria, type EngagementCriteria } from './campaigns-helpers';

export const campaignsResultsRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // RESULT LIST GENERATION
  // ============================================================================
  .get(
    '/:id/test-route',
    async ({ params }) => {
      return { message: 'Test route works!', campaignId: params.id };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Test route',
      },
    }
  )
  .post(
    '/:id/create-result-list',
    async ({ db, params, body, set }) => {
      try {
        const campaignId = params.id;
        const { workspaceId, listName, description, criteria, createdBy } = body;

        // 1. Validate campaign exists and belongs to workspace
        const campaign = await campaignService.getById(db, campaignId, workspaceId);
        if (!campaign) {
          set.status = 404;
          return { error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign does not exist or not accessible' };
        }

        // 2. Query recipients based on engagement criteria
        const contactIds = await queryRecipientsByCriteria(
          db,
          campaignId,
          workspaceId,
          criteria
        );

        // 3. Handle empty results gracefully
        if (contactIds.length === 0) {
          // Still create the list, just empty
          const emptyList = await listsService.createList(db, {
            workspaceId,
            entityType: 'contact',
            name: listName,
            description: description || `Generated from campaign "${campaign.name}" - No matching recipients`,
            type: 'derived',
            metadata: {
              sourceCampaignId: campaignId,
              sourceCampaignName: campaign.name,
              criteria,
              createdAt: new Date().toISOString(),
            },
            createdBy,
          });

          return {
            listId: emptyList.id,
            memberCount: 0,
            list: {
              id: emptyList.id,
              name: emptyList.name,
              type: emptyList.type,
              totalContacts: 0,
              metadata: emptyList.metadata,
            },
          };
        }

        // 4. Create the result list
        const list = await listsService.createList(db, {
          workspaceId,
          entityType: 'contact',
          name: listName,
          description: description || `Generated from campaign "${campaign.name}"`,
          type: 'derived',
          metadata: {
            sourceCampaignId: campaignId,
            sourceCampaignName: campaign.name,
            criteria,
            createdAt: new Date().toISOString(),
          },
          createdBy,
        });

        // 5. Add engaged contacts to the list
        const { added, skipped } = await listMembersService.addMembers(
          db,
          list.id,
          workspaceId,
          contactIds,
          createdBy,
          'campaign'
        );

        // 6. Create timeline event
        await timelineService.create(db, {
          workspaceId,
          entityType: 'contact',
          entityId: campaignId,
          eventType: 'campaign.result_list_created',
          eventCategory: 'system',
          eventLabel: 'Campaign Result List Created',
          summary: `Created list "${listName}" from campaign "${campaign.name}" with ${added} contacts (criteria: ${criteria.type})`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: createdBy,
          actorName: 'User',
          metadata: {
            campaignId,
            campaignName: campaign.name,
            listId: list.id,
            listName,
            criteria,
            totalContacts: added,
          },
        });

        // 7. Return success response
        return {
          listId: list.id,
          memberCount: added,
          list: {
            id: list.id,
            name: list.name,
            type: list.type,
            totalContacts: added,
            metadata: list.metadata,
          },
        };
      } catch (error) {
        console.error('[campaigns/:id/create-result-list] Error:', error);
        set.status = 500;
        return {
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create result list',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        listName: t.String(),
        description: t.Optional(t.String()),
        criteria: t.Object({
          type: t.Union([
            t.Literal('opened'),
            t.Literal('clicked'),
            t.Literal('bounced'),
            t.Literal('no_response'),
            t.Literal('delivered'),
          ]),
          minOpenCount: t.Optional(t.Number()),
          minClickCount: t.Optional(t.Number()),
        }),
        createdBy: t.String(),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Create result list from campaign engagement',
        description: 'Create a contact list from campaign recipients based on engagement criteria (opened, clicked, bounced, no_response, delivered)',
      },
    }
  );
