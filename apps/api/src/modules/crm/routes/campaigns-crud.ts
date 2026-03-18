/**
 * Campaign CRUD Routes
 * Basic CRUD operations for campaigns
 */

import { Elysia, t } from 'elysia';
import { campaignService, campaignMessageService } from '../services/campaigns';
import { timelineService } from '../services/timeline';
import { validateCronExpression, getNextExecutionTime } from '../services/recurring';
import { listsService } from '../services/lists.service';
import { campaignSnapshotsService } from '../services/campaign-snapshots.service';
import { getCampaignMetrics } from '../services/campaign-metrics';

export const campaignsCrudRoutes = new Elysia({ prefix: '/campaigns' })
  // ============================================================================
  // CAMPAIGN CRUD
  // ============================================================================
  .post(
    '/',
    async ({ db, body, set }) => {
      try {
        // Validate recurring campaign requirements
        if (body.type === 'recurring') {
          if (!body.schedule) {
            set.status = 400;
            return { error: 'Schedule is required for recurring campaigns' };
          }

          try {
            validateCronExpression(body.schedule);
          } catch (error) {
            set.status = 400;
            return { error: error instanceof Error ? error.message : 'Invalid cron expression' };
          }
        }

        // Validate list-based campaign if listId provided
        if (body.listId) {
          const list = await listsService.getListById(db, body.listId, body.workspaceId);
          if (!list) {
            set.status = 404;
            return { error: 'LIST_NOT_FOUND', message: 'List does not exist or does not belong to workspace' };
          }

          // Validate recipientSelection if provided
          if (body.recipientSelection) {
            if (body.recipientSelection.selectionStrategy === 'prioritized' && !body.recipientSelection.sortCriteria) {
              set.status = 400;
              return { error: 'INVALID_RECIPIENT_SELECTION', message: 'Prioritized strategy requires sortCriteria' };
            }
          }
        }

        // Calculate next execution time for recurring campaigns
        let nextExecutionAt: Date | undefined = undefined;
        if (body.type === 'recurring' && body.schedule) {
          nextExecutionAt = getNextExecutionTime(body.schedule);
        }

        // Create campaign (always starts in draft status)
        const campaign = await campaignService.create(db, {
          ...body,
          status: 'draft', // Force draft status
          nextExecutionAt,
          // Ensure audienceDefinition has a default for filter-based campaigns
          audienceDefinition: body.audienceDefinition || {},
        });

        // If list-based campaign, create snapshot automatically
        let snapshotResult = null;
        if (body.listId) {
          const recipientSelection = body.recipientSelection || {
            selectionStrategy: 'first' as const,
          };

          snapshotResult = await campaignSnapshotsService.createSnapshot(
            db,
            campaign.id,
            body.listId,
            body.workspaceId,
            recipientSelection
          );
        }

        // Create timeline event
        await timelineService.create(db, {
          workspaceId: body.workspaceId,
          entityType: 'contact', // Will link to recipients when they're added
          entityId: campaign.id, // Temporary, will be updated per contact
          eventType: 'campaign.created',
          eventCategory: 'system',
          eventLabel: 'Campaign Created',
          summary: `Campaign "${campaign.name}" was created${body.listId ? ' with list' : ''}`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.createdBy,
          actorName: 'User',
          metadata: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            objective: campaign.objective,
            type: campaign.type,
            schedule: body.schedule,
            nextExecutionAt: nextExecutionAt?.toISOString(),
            listId: body.listId,
            snapshotId: snapshotResult?.snapshotId,
            totalRecipients: snapshotResult?.selectedCount,
          },
        });

        // Return campaign with snapshot details if created
        if (snapshotResult) {
          return {
            ...campaign,
            snapshotId: snapshotResult.snapshotId,
            totalRecipients: snapshotResult.selectedCount,
            totalListSize: snapshotResult.totalListSize,
            excludedCount: snapshotResult.excludedCount,
          };
        }

        return campaign;
      } catch (error) {
        console.error('[campaigns.create] Error:', error);
        set.status = 500;
        return {
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create campaign',
        };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        objective: t.String(), // lead_generation|sales|awareness|retention|nurture
        type: t.String(), // one_time|recurring|drip|ab_test
        tags: t.Optional(t.Array(t.String())),
        channels: t.Array(t.String()), // ['email']
        // List-based campaign fields (NEW)
        listId: t.Optional(t.String()),
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
        // Filter-based campaign fields (existing)
        audienceDefinition: t.Optional(t.Any()),
        timezone: t.Optional(t.String()),
        schedule: t.Optional(t.String()), // Cron expression for recurring campaigns
        // Email configuration (optional)
        emailConfig: t.Optional(t.Any()),
        createdBy: t.Optional(t.String()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Create campaign',
        description: 'Create a new campaign in draft status (supports both list-based and filter-based audiences)',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      const filters: any = {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      };

      if (query.status) {
        filters.status = query.status;
      }

      if (query.createdAfter) {
        filters.createdAfter = new Date(query.createdAfter);
      }

      return campaignService.list(db, filters);
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(t.String()),
        createdAfter: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'List campaigns',
        description: 'List campaigns with optional filters',
      },
    }
  )
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const campaign = await campaignService.getById(db, params.id, query.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }
      return campaign;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Get campaign',
        description: 'Get campaign by ID',
      },
    }
  )
  .get(
    '/:id/stream',
    async ({ db, params, query, set }) => {
      const campaignId = params.id;
      const { workspaceId } = query;

      // Verify campaign exists
      const campaign = await campaignService.getById(db, campaignId, workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      // Set SSE headers
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';
      set.headers['X-Accel-Buffering'] = 'no'; // Disable nginx buffering

      // Create a ReadableStream for SSE
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let isClosed = false;

          // Send initial campaign state
          try {
            const initialCampaign = await campaignService.getById(db, campaignId, workspaceId);
            if (initialCampaign) {
              const data = JSON.stringify({
                campaign: initialCampaign,
                timestamp: new Date().toISOString(),
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } catch (error) {
            console.error('[SSE] Error sending initial state:', error);
          }

          // Poll for updates every 1 second
          const interval = setInterval(async () => {
            // Skip if stream is already closed
            if (isClosed) {
              clearInterval(interval);
              return;
            }

            try {
              const updatedCampaign = await campaignService.getById(db, campaignId, workspaceId);
              if (updatedCampaign) {
                const data = JSON.stringify({
                  campaign: updatedCampaign,
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            } catch (error) {
              // Check if error is due to closed controller
              if (error instanceof TypeError && error.message.includes('Controller is already closed')) {
                // Client disconnected, mark as closed and stop interval
                isClosed = true;
                clearInterval(interval);
              } else {
                // Other errors, log and close gracefully
                console.error('[SSE] Error sending update:', error);
                isClosed = true;
                clearInterval(interval);
                try {
                  controller.close();
                } catch (closeError) {
                  // Controller already closed, ignore
                }
              }
            }
          }, 1000);

          // Cleanup on close
          return () => {
            isClosed = true;
            clearInterval(interval);
          };
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Stream campaign updates',
        description: 'SSE endpoint for real-time campaign updates',
      },
    }
  )
  .patch(
    '/:id',
    async ({ db, params, query, body, set }) => {
      try {
        // Validate schedule if provided
        let nextExecutionAt: Date | undefined = undefined;
        if (body.schedule) {
          try {
            validateCronExpression(body.schedule);
            nextExecutionAt = getNextExecutionTime(body.schedule);
          } catch (error) {
            set.status = 400;
            return { error: error instanceof Error ? error.message : 'Invalid cron expression' };
          }
        }

        const updateData = { ...body };
        if (nextExecutionAt) {
          updateData.nextExecutionAt = nextExecutionAt;
        }

        const campaign = await campaignService.update(db, params.id, query.workspaceId, updateData);
        if (!campaign) {
          set.status = 404;
          return { error: 'Campaign not found' };
        }

        // Create timeline event
        await timelineService.create(db, {
          workspaceId: query.workspaceId,
          entityType: 'contact',
          entityId: campaign.id,
          eventType: 'campaign.updated',
          eventCategory: 'system',
          eventLabel: 'Campaign Updated',
          summary: `Campaign "${campaign.name}" was updated`,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.updatedBy,
          actorName: 'User',
          metadata: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            scheduleUpdated: !!body.schedule,
            nextExecutionAt: nextExecutionAt?.toISOString(),
          },
        });

        return campaign;
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to update campaign' };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        objective: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        audienceDefinition: t.Optional(t.Any()),
        channels: t.Optional(t.Array(t.String())),
        channelConfig: t.Optional(t.Any()),
        scheduledStartAt: t.Optional(t.String()),
        scheduledEndAt: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        schedule: t.Optional(t.String()), // Cron expression for recurring campaigns
        nextExecutionAt: t.Optional(t.Any()), // Allow manual override if needed
        updatedBy: t.String(),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Update campaign',
        description: 'Update campaign (only if status is draft)',
      },
    }
  )
  .get(
    '/:id/stats',
    async ({ db, params, query, set }) => {
      try {
        const metrics = await getCampaignMetrics(db, query.workspaceId, params.id);
        if (!metrics) {
          set.status = 404;
          return { error: 'Campaign not found' };
        }

        // Map to frontend CampaignStats interface
        return {
          totalRecipients: metrics.totalRecipients,
          sent: metrics.totalSent,
          delivered: metrics.totalDelivered,
          opened: metrics.totalOpened,
          clicked: metrics.totalClicked,
          bounced: metrics.totalBounced,
          failed: 0,
          deliveryRate: metrics.deliveryRate,
          openRate: metrics.openRate,
          clickRate: metrics.clickRate,
          clickToOpenRate: metrics.totalOpened > 0
            ? metrics.totalClicked / metrics.totalOpened
            : 0,
        };
      } catch (error) {
        console.error('[campaigns.stats] Error:', error);
        set.status = 500;
        return { error: 'Failed to fetch campaign stats' };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Get campaign stats',
        description: 'Get campaign performance statistics',
      },
    }
  )
  // ============================================================================
  // BULK IMPORT CAMPAIGNS
  // ============================================================================
  .post(
    '/bulk-import',
    async ({ db, body, set }) => {
      try {
        if (body.items.length > 200) {
          set.status = 400;
          return { error: 'Maximum 200 items per import' };
        }

        const imported: any[] = [];
        for (const item of body.items) {
          const { messages, ...campaignData } = item;

          const campaign = await campaignService.create(db, {
            ...campaignData,
            workspaceId: body.workspaceId,
            status: 'draft',
            createdBy: body.userId,
            updatedBy: body.userId,
            audienceDefinition: campaignData.audienceDefinition || {},
          });

          if (messages && messages.length > 0) {
            for (const msg of messages) {
              await campaignMessageService.create(db, {
                ...msg,
                campaignId: campaign.id,
                workspaceId: body.workspaceId,
                createdBy: body.userId,
                updatedBy: body.userId,
              });
            }
          }

          imported.push(campaign);
        }

        return { imported: imported.length, items: imported };
      } catch (error) {
        console.error('[campaigns.bulk-import] Error:', error);
        set.status = 500;
        return { error: error instanceof Error ? error.message : 'Failed to import campaigns' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        items: t.Array(
          t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            objective: t.String(),
            type: t.String(),
            tags: t.Optional(t.Array(t.String())),
            channels: t.Array(t.String()),
            audienceDefinition: t.Optional(t.Any()),
            timezone: t.Optional(t.String()),
            schedule: t.Optional(t.String()),
            emailConfig: t.Optional(t.Any()),
            messages: t.Optional(
              t.Array(
                t.Object({
                  channel: t.Optional(t.String()),
                  subject: t.Optional(t.String()),
                  body: t.Optional(t.String()),
                  templateId: t.Optional(t.String()),
                  sendOrder: t.Optional(t.Number()),
                  delayMinutes: t.Optional(t.Number()),
                  metadata: t.Optional(t.Any()),
                })
              )
            ),
          })
        ),
      }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Bulk import campaigns from JSON',
        description: 'Import campaigns with optional nested messages. All campaigns are created in draft status.',
      },
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      const campaign = await campaignService.getById(db, params.id, query.workspaceId);
      if (!campaign) {
        set.status = 404;
        return { error: 'Campaign not found' };
      }

      const deletedCampaign = await campaignService.delete(db, params.id, query.workspaceId);
      if (!deletedCampaign) {
        set.status = 404;
        return { error: 'Campaign not found or already deleted' };
      }

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: query.workspaceId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'campaign.deleted',
        eventCategory: 'system',
        eventLabel: 'Campaign Deleted',
        summary: `Campaign "${campaign.name}" was soft deleted`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: campaign.updatedBy || undefined,
        actorName: 'User',
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Campaigns'],
        summary: 'Delete campaign',
        description: 'Soft delete campaign',
      },
    }
  );
