/**
 * Bulk Operations Worker
 * Processes bulk assign/update operations asynchronously with rollback support
 */

import { jobQueue, type ExecuteBulkOperationJob } from '../lib/queue';
import { db } from '@agios/db';
import { bulkOperations, bulkOperationItems, crmLeads } from '@agios/db';
import { eq, sql } from 'drizzle-orm';

/**
 * Register bulk operation worker
 */
export async function registerBulkOperationWorkers() {
  console.log('[Bulk Operation Worker] Registering worker for execute-bulk-operation...');

  try {
    await jobQueue.work<ExecuteBulkOperationJob>(
      'execute-bulk-operation',
      {
        teamSize: 5, // Process up to 5 operations in parallel
        teamConcurrency: 1, // Each operation processes serially
      },
      async (job) => {
        const { operationId, operationType, leadIds, payload, workspaceId } = job.data;

        console.log(
          `[Bulk Operation] Starting ${operationType} for ${leadIds.length} leads (operation: ${operationId})`
        );

      try {
        // Update operation status to 'running'
        await db
          .update(bulkOperations)
          .set({
            status: 'running',
            startedAt: new Date(),
          })
          .where(eq(bulkOperations.id, operationId));

        // Process leads in chunks (100 at a time)
        const chunkSize = 100;
        for (let i = 0; i < leadIds.length; i += chunkSize) {
          const chunk = leadIds.slice(i, i + chunkSize);

          console.log(
            `[Bulk Operation] Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(leadIds.length / chunkSize)}`
          );

          // Process each lead
          for (const leadId of chunk) {
            try {
              // Get current state for rollback
              const [currentLead] = await db
                .select()
                .from(crmLeads)
                .where(eq(crmLeads.id, leadId))
                .limit(1);

              if (!currentLead) {
                throw new Error(`Lead ${leadId} not found`);
              }

              let afterState: any = {};

              // Execute operation
              if (operationType === 'assign') {
                // Update lead.ownerId (assign to agent)
                console.log(`[Bulk Operation] Assigning lead ${leadId} to agent ${payload.agentId}`);
                const result = await db
                  .update(crmLeads)
                  .set({
                    ownerId: payload.agentId,
                    updatedAt: new Date(),
                  })
                  .where(eq(crmLeads.id, leadId))
                  .returning();

                console.log(`[Bulk Operation] Update result:`, result.length, 'rows affected');
                afterState = { ownerId: payload.agentId };
              } else if (operationType === 'update') {
                // Update lead fields
                const updateFields = {
                  ...payload.fields,
                  updatedAt: new Date(),
                };

                await db.update(crmLeads).set(updateFields).where(eq(crmLeads.id, leadId));

                afterState = payload.fields;
              }

              // Log success in bulk_operation_items
              await db.insert(bulkOperationItems).values({
                operationId,
                leadId,
                workspaceId,
                status: 'success',
                beforeState: currentLead, // Full state for rollback
                afterState,
                processedAt: new Date(),
              });

              // Update progress
              await db.execute(sql`
                UPDATE bulk_operations
                SET processed_items = processed_items + 1,
                    successful_items = successful_items + 1
                WHERE id = ${operationId}
              `);
            } catch (error: any) {
              console.error(`[Bulk Operation] Failed to process lead ${leadId}:`, error);

              // Log failure
              await db.insert(bulkOperationItems).values({
                operationId,
                leadId,
                workspaceId,
                status: 'failed',
                errorMessage: error.message || 'Unknown error',
                processedAt: new Date(),
              });

              // Update progress
              await db.execute(sql`
                UPDATE bulk_operations
                SET processed_items = processed_items + 1,
                    failed_items = failed_items + 1
                WHERE id = ${operationId}
              `);
            }
          }
        }

        // Update operation status to 'completed'
        await db
          .update(bulkOperations)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(bulkOperations.id, operationId));

        // Real-time event handled automatically by SignalDB's table triggers
        console.log(`[Bulk Operation] Completed operation ${operationId}`);
      } catch (error: any) {
        console.error(`[Bulk Operation] Operation ${operationId} failed:`, error);

        // Update operation status to 'failed'
        await db
          .update(bulkOperations)
          .set({
            status: 'failed',
            completedAt: new Date(),
            errorSummary: error.message || 'Operation failed',
          })
          .where(eq(bulkOperations.id, operationId));

        throw error;
      }
    }
  );

    console.log('✅ Bulk operation worker registered successfully');
  } catch (error) {
    console.error('❌ Failed to register bulk operation worker:', error);
    throw error;
  }
}
