/**
 * Batches API Routes
 * RESTful endpoints for batch management
 */

import { Elysia, t } from 'elysia';
import { BatchesService } from '../services/batches.service';
import { eq } from 'drizzle-orm';
import { crmEnrichmentJobs, crmContacts, crmLeads } from '@agios/db';
import { streamEnrichmentResults, streamToolCalls } from '../../../lib/electric-shapes';

export const batchesRoutes = new Elysia({ prefix: '/batches' })
  /**
   * POST /api/v1/crm/batches
   * Create a new batch
   */
  .post(
    '/',
    async ({ db, body }) => {
      const batch = await BatchesService.create(db, body);
      return {
        success: true,
        batch,
      };
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        listId: t.String({ format: 'uuid' }),
        type: t.Union([
          t.Literal('enrichment'),
          t.Literal('export'),
          t.Literal('segmentation'),
          t.Literal('scoring'),
        ]),
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        configuration: t.Record(t.String(), t.Any()),
        scheduledAt: t.Optional(t.String({ format: 'date-time' })),
        createdBy: t.Optional(t.String({ format: 'uuid' })),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Create batch',
        description: 'Create a new batch for a list',
      },
    }
  )

  /**
   * GET /api/v1/crm/batches
   * List batches with filters
   */
  .get(
    '/',
    async ({ db, query }) => {
      const { batches, total } = await BatchesService.list(db, {
        workspaceId: query.workspaceId,
        listId: query.listId,
        type: query.type as any,
        status: query.status as any,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return {
        success: true,
        batches,
        total,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        listId: t.Optional(t.String({ format: 'uuid' })),
        type: t.Optional(
          t.Union([
            t.Literal('enrichment'),
            t.Literal('export'),
            t.Literal('segmentation'),
            t.Literal('scoring'),
          ])
        ),
        status: t.Optional(
          t.Union([
            t.Literal('planned'),
            t.Literal('scheduled'),
            t.Literal('running'),
            t.Literal('completed'),
            t.Literal('failed'),
            t.Literal('cancelled'),
          ])
        ),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'List batches',
        description: 'Get batches with optional filters',
      },
    }
  )

  /**
   * GET /api/v1/crm/batches/:id
   * Get a single batch
   */
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const batch = await BatchesService.getById(db, params.id, query.workspaceId);

      if (!batch) {
        return {
          success: false,
          error: 'Batch not found',
        };
      }

      return {
        success: true,
        batch,
      };
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Get batch',
        description: 'Get a single batch by ID',
      },
    }
  )

  /**
   * PUT /api/v1/crm/batches/:id
   * Update a batch
   */
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      try {
        const batch = await BatchesService.update(
          db,
          params.id,
          query.workspaceId,
          body
        );

        return {
          success: true,
          batch,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Update failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        configuration: t.Optional(t.Record(t.String(), t.Any())),
        scheduledAt: t.Optional(t.String({ format: 'date-time' })),
        updatedBy: t.Optional(t.String({ format: 'uuid' })),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Update batch',
        description: 'Update batch name, description, configuration, or schedule',
      },
    }
  )

  /**
   * PUT /api/v1/crm/batches/:id/status
   * Change batch status
   */
  .put(
    '/:id/status',
    async ({ db, params, query, body }) => {
      try {
        const batch = await BatchesService.changeStatus(
          db,
          params.id,
          query.workspaceId,
          body.status,
          body.updatedBy
        );

        return {
          success: true,
          batch,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Status change failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal('planned'),
          t.Literal('scheduled'),
          t.Literal('running'),
          t.Literal('completed'),
          t.Literal('failed'),
          t.Literal('cancelled'),
        ]),
        updatedBy: t.Optional(t.String({ format: 'uuid' })),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Change batch status',
        description: 'Change batch status with state machine validation',
      },
    }
  )

  /**
   * DELETE /api/v1/crm/batches/:id
   * Delete a batch (hard delete, only if status is planned)
   */
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      try {
        await BatchesService.delete(db, params.id, query.workspaceId);

        return {
          success: true,
          message: 'Batch deleted successfully',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Delete failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Delete batch',
        description: 'Delete a batch (only allowed for planned batches)',
      },
    }
  )

  /**
   * POST /api/v1/crm/batches/:id/execute
   * Execute a batch (creates enrichment job and queues for processing)
   */
  .post(
    '/:id/execute',
    async ({ db, params, query, body }) => {
      try {
        // Get batch
        const batch = await BatchesService.getById(db, params.id, query.workspaceId);
        if (!batch) {
          return {
            success: false,
            error: 'Batch not found',
          };
        }

        // Validate status
        if (!['planned', 'scheduled'].includes(batch.status)) {
          return {
            success: false,
            error: `Cannot execute batch with status: ${batch.status}. Only planned or scheduled batches can be executed.`,
          };
        }

        // Get handler and execute
        const { getBatchTypeHandler } = await import('../services/batches.service');
        const handler = getBatchTypeHandler(batch.type);
        if (!handler || !handler.execute) {
          return {
            success: false,
            error: `Batch type ${batch.type} does not support execution`,
          };
        }

        // Change status to running
        await BatchesService.changeStatus(
          db,
          params.id,
          query.workspaceId,
          'running',
          body.updatedBy
        );

        // Execute batch (creates job and queues)
        const result = await handler.execute(batch, db);

        return {
          success: true,
          message: 'Batch execution started',
          jobId: result.id,
        };
      } catch (error) {
        // Revert to planned status on error
        try {
          await BatchesService.changeStatus(
            db,
            params.id,
            query.workspaceId,
            'planned',
            body.updatedBy
          );
        } catch (revertError) {
          console.error('Failed to revert batch status:', revertError);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Batch execution failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        updatedBy: t.Optional(t.String({ format: 'uuid' })),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Execute batch',
        description: 'Start batch execution (creates enrichment job and queues for processing)',
      },
    }
  )

  /**
   * GET /api/v1/crm/batches/:id/progress
   * Stream batch progress via SSE (ElectricSQL - crm_enrichment_results)
   *
   * Uses proven ElectricSQL pattern from CLI (hook_events, sessions, etc.)
   * Streams enrichment_results WHERE job_id IN (SELECT id FROM enrichment_jobs WHERE batch_id = :batchId)
   */
  .get(
    '/:id/progress',
    async function* ({ params, query, set, db }) {
      // CRITICAL: Set headers object directly to avoid ElysiaJS appending text/plain
      set.headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      };

      const batchId = params.id;
      const workspaceId = query.workspaceId;

      console.log(`[batches/progress] Starting ElectricSQL progress stream for batch ${batchId}`);

      yield `: connected at ${new Date().toISOString()}\n\n`;

      try {
        // 1. Get batch to verify it exists and get start timestamp
        const batch = await BatchesService.getById(db, batchId, workspaceId);
        if (!batch) {
          yield `data: ${JSON.stringify({
            type: 'error',
            error: 'Batch not found',
            batchId
          })}\n\n`;
          return;
        }

        // 2. Get enrichment job linked to this batch
        const enrichmentJob = await db.query.crmEnrichmentJobs.findFirst({
          where: eq(crmEnrichmentJobs.batchId, batchId),
        });

        if (!enrichmentJob) {
          yield `data: ${JSON.stringify({
            type: 'error',
            error: 'No enrichment job found for this batch',
            batchId
          })}\n\n`;
          return;
        }

        console.log(`[batches/progress] Found enrichment job ${enrichmentJob.id} for batch ${batchId}`);

        // 3. Stream enrichment results via ElectricSQL
        // Use batch.startedAt as subscription timestamp (only stream results AFTER batch started)
        const subscriptionTimestamp = batch.startedAt ? new Date(batch.startedAt) : new Date();

        const electricStream = streamEnrichmentResults(
          enrichmentJob.id,
          subscriptionTimestamp
        );

        // 4. Track tool call streams for each enrichment result (multiplex streams)
        const toolCallStreams = new Map<string, ReturnType<typeof streamToolCalls>>();

        // 5. Stream enrichment results as SSE, enriching with contact/lead details + tool calls
        let resultsCount = 0;
        for await (const sseMessage of electricStream.stream()) {
          try {
            // Parse SSE message to add contact/lead details
            if (sseMessage.startsWith('data: ')) {
              const jsonData = sseMessage.slice(6).trim();
              const result = JSON.parse(jsonData);

              const enrichmentResultId = result.id;

              // Start streaming tool calls for this enrichment result if not already done
              if (!toolCallStreams.has(enrichmentResultId)) {
                const toolCallStream = streamToolCalls(enrichmentResultId, subscriptionTimestamp);
                toolCallStreams.set(enrichmentResultId, toolCallStream);

                // Stream tool calls for this result
                try {
                  for await (const toolSseMessage of toolCallStream.stream()) {
                    if (toolSseMessage.startsWith('data: ')) {
                      const toolJsonData = toolSseMessage.slice(6).trim();
                      try {
                        const toolCall = JSON.parse(toolJsonData);
                        // Emit tool call with type flag
                        console.log(`[batches/progress] Streamed tool call for enrichment ${enrichmentResultId}: ${toolCall.tool_name}`);
                        yield `data: ${JSON.stringify({
                          type: 'tool_call',
                          enrichmentResultId,
                          ...toolCall
                        })}\n\n`;
                      } catch (parseError) {
                        console.error('[batches/progress] Error parsing tool call:', parseError);
                      }
                    }
                  }
                } catch (error) {
                  console.error('[batches/progress] Tool call stream error for result', enrichmentResultId + ':', error);
                }
              }

              // Fetch contact or lead details
              let entityName = 'Unknown';
              let entityEmail = 'N/A';

              if (result.entityType === 'contact') {
                const contact = await db.query.crmContacts.findFirst({
                  where: eq(crmContacts.id, result.entityId),
                  columns: { name: true, email: true },
                });
                if (contact) {
                  entityName = contact.name || 'Unknown';
                  entityEmail = contact.email || 'N/A';
                }
              } else if (result.entityType === 'lead') {
                const lead = await db.query.crmLeads.findFirst({
                  where: eq(crmLeads.id, result.entityId),
                  columns: { name: true, email: true },
                });
                if (lead) {
                  entityName = lead.name || 'Unknown';
                  entityEmail = lead.email || 'N/A';
                }
              }

              // Enrich result with entity details
              const enrichedResult = {
                ...result,
                type: 'enrichment_result',
                entityName,
                entityEmail,
              };

              resultsCount++;
              console.log(`[batches/progress] Streamed result #${resultsCount} for batch ${batchId}: ${entityName}`);
              yield `data: ${JSON.stringify(enrichedResult)}\n\n`;
            } else {
              // Pass through non-data messages (comments, heartbeats, etc.)
              yield sseMessage;
            }
          } catch (error) {
            console.error('[batches/progress] Error processing event:', error);
            // Fall back to original message on error
            yield sseMessage;
          }
        }

        console.log(`[batches/progress] Stream ended for batch ${batchId} after ${resultsCount} results`);
      } catch (error) {
        console.error('[batches/progress] ElectricSQL stream error:', error);
        yield `data: ${JSON.stringify({
          type: 'error',
          error: 'Stream error',
          message: String(error)
        })}\n\n`;
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Stream batch progress',
        description: 'Real-time batch execution progress via SSE (ElectricSQL enrichment_results + tool_calls)',
      },
    }
  )

  /**
   * POST /api/v1/crm/batches/:id/retry
   * Retry failed contacts from a batch
   */
  .post(
    '/:id/retry',
    async ({ db, params, query, body }) => {
      try {
        const batch = await BatchesService.getById(db, params.id, query.workspaceId);
        if (!batch) {
          return {
            success: false,
            error: 'Batch not found',
          };
        }

        // Only allow retry for failed or completed batches
        if (!['failed', 'completed'].includes(batch.status)) {
          return {
            success: false,
            error: `Cannot retry batch with status: ${batch.status}. Only failed or completed batches can be retried.`,
          };
        }

        // Get enrichment job for this batch
        const { enrichmentService } = await import('../services/enrichment');
        const { crmEnrichmentJobs, crmEnrichmentResults } = await import('@agios/db');
        const { eq, and, sql, desc } = await import('drizzle-orm');

        const [enrichmentJob] = await db
          .select()
          .from(crmEnrichmentJobs)
          .where(
            and(
              eq(crmEnrichmentJobs.batchId, params.id),
              eq(crmEnrichmentJobs.workspaceId, query.workspaceId)
            )
          )
          .orderBy(desc(crmEnrichmentJobs.createdAt))
          .limit(1);

        if (!enrichmentJob) {
          return {
            success: false,
            error: 'No enrichment job found for this batch',
          };
        }

        // Get failed entity IDs (contacts or leads)
        const failedResults = await db
          .select({
            entityId: crmEnrichmentResults.entityId,
            entityType: crmEnrichmentResults.entityType,
          })
          .from(crmEnrichmentResults)
          .where(
            and(
              eq(crmEnrichmentResults.jobId, enrichmentJob.id),
              eq(crmEnrichmentResults.status, 'failed')
            )
          );

        if (failedResults.length === 0) {
          return {
            success: false,
            error: 'No failed enrichments to retry',
          };
        }

        // Separate failed entities by type
        const failedContactIds = failedResults
          .filter((r) => r.entityType === 'contact')
          .map((r) => r.entityId);

        const failedLeadIds = failedResults
          .filter((r) => r.entityType === 'lead')
          .map((r) => r.entityId);

        // Check if we have any failed entities to retry
        if (failedContactIds.length === 0 && failedLeadIds.length === 0) {
          return {
            success: false,
            error: 'No failed entities to retry',
          };
        }

        const { crmContactLists, crmContactListMemberships } = await import('@agios/db');

        // Create retry list(s) and batch(s) based on what failed
        // For simplicity, we create a single polymorphic list that can contain both contacts and leads
        const entityTypes: string[] = [];
        if (failedContactIds.length > 0) entityTypes.push('contacts');
        if (failedLeadIds.length > 0) entityTypes.push('leads');

        const newList = await db
          .insert(crmContactLists)
          .values({
            workspaceId: query.workspaceId,
            name: `${batch.name} - Retry Failed`,
            description: `Retry failed ${entityTypes.join(' and ')} from batch: ${batch.name}`,
            type: 'manual',
            createdBy: body.createdBy,
          })
          .returning();

        // Add all failed entities to the list (contacts and leads)
        const memberships = [
          ...failedContactIds.map((contactId) => ({
            workspaceId: query.workspaceId,
            listId: newList[0].id,
            entityType: 'contact' as const,
            entityId: contactId,
            isActive: true,
            createdBy: body.createdBy,
          })),
          ...failedLeadIds.map((leadId) => ({
            workspaceId: query.workspaceId,
            listId: newList[0].id,
            entityType: 'lead' as const,
            entityId: leadId,
            isActive: true,
            createdBy: body.createdBy,
          })),
        ];

        await db.insert(crmContactListMemberships).values(memberships);

        // Create new batch for retry
        const totalFailed = failedContactIds.length + failedLeadIds.length;
        const retryBatch = await BatchesService.create(db, {
          workspaceId: query.workspaceId,
          listId: newList[0].id,
          type: batch.type,
          name: `${batch.name} - Retry`,
          description: `Retry of ${failedContactIds.length} failed contacts and ${failedLeadIds.length} failed leads`,
          configuration: batch.configuration,
          createdBy: body.createdBy,
        });

        return {
          success: true,
          message: `Created retry batch with ${totalFailed} failed ${totalFailed === 1 ? 'entity' : 'entities'}`,
          retryBatch: {
            id: retryBatch.id,
            name: retryBatch.name,
            failedContactCount: failedContactIds.length,
            failedLeadCount: failedLeadIds.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Retry failed',
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        createdBy: t.Optional(t.String({ format: 'uuid' })),
      }),
      detail: {
        tags: ['Batches'],
        summary: 'Retry failed contacts',
        description: 'Create a new batch to retry failed contacts from a completed/failed batch',
      },
    }
  );
