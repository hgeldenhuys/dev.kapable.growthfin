/**
 * Work Item AI Pickup Worker
 * Automatically claims and processes expired work items using AI (US-014 T-061)
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { WorkItemsService } from '../modules/work-items/services/work-items.service';
import { getWorkItemTypeHandler } from '../modules/work-items/handlers';

/**
 * Job data for work item AI pickup
 */
export interface WorkItemAiPickupJob {
  workspaceId: string;
}

/**
 * Register work item AI pickup worker
 */
export async function registerWorkItemAiPickupWorker() {
  console.log('[Work Item AI Pickup Worker] Registering worker...');

  await jobQueue.work<WorkItemAiPickupJob>(
    'work-item-ai-pickup',
    {
      teamSize: 3,
      teamConcurrency: 2,
    },
    async (job) => {
      const { workspaceId } = job.data;

      console.log(`[Work Item AI Pickup Worker] Processing expired work items for workspace ${workspaceId}...`);

      try {
        // Query for expired work items
        const { workItems } = await WorkItemsService.list(db, {
          workspaceId,
          status: 'expired', // Special status filter for expired items
          limit: 50, // Process up to 50 at a time
        });

        console.log(`[Work Item AI Pickup Worker] Found ${workItems.length} expired work items`);

        let processed = 0;
        let failed = 0;

        for (const workItem of workItems) {
          try {
            // Claim work item as AI
            const claimed = await WorkItemsService.claim(
              db,
              workItem.id,
              workspaceId,
              'ai-worker'
            );

            console.log(`[Work Item AI Pickup Worker] Claimed work item ${workItem.id} (${workItem.workItemType})`);

            // Get handler for this work item type
            const handler = getWorkItemTypeHandler(workItem.workItemType);

            if (!handler || !handler.execute) {
              console.warn(
                `[Work Item AI Pickup Worker] No handler or execute function for type ${workItem.workItemType}, skipping...`
              );

              // Unclaim the work item so it can be processed manually
              await WorkItemsService.unclaim(db, workItem.id, workspaceId);
              failed++;
              continue;
            }

            // Execute the handler
            await handler.execute(claimed, db);

            // Complete work item with AI result
            await WorkItemsService.complete(
              db,
              workItem.id,
              workspaceId,
              'ai',
              {
                processedAt: new Date().toISOString(),
                processedBy: 'ai-worker',
                executionType: 'automatic',
                handler: workItem.workItemType,
              }
            );

            console.log(`[Work Item AI Pickup Worker] ✅ Completed work item ${workItem.id}`);
            processed++;
          } catch (error) {
            console.error(
              `[Work Item AI Pickup Worker] ❌ Failed to process work item ${workItem.id}:`,
              error
            );

            // Unclaim the work item so it can be retried
            try {
              await WorkItemsService.unclaim(db, workItem.id, workspaceId);
            } catch (unclaimError) {
              console.error(
                `[Work Item AI Pickup Worker] Failed to unclaim work item ${workItem.id}:`,
                unclaimError
              );
            }

            failed++;
          }
        }

        console.log(
          `[Work Item AI Pickup Worker] Completed processing: ${processed} successful, ${failed} failed`
        );
      } catch (error) {
        console.error('[Work Item AI Pickup Worker] Error during processing:', error);
        throw error; // Rethrow to trigger retry
      }
    }
  );

  console.log('✅ Work Item AI Pickup worker registered');
}

/**
 * Start work item AI pickup scheduler
 * Runs every 5 minutes to check for expired work items
 */
export async function startWorkItemAiPickupScheduler() {
  console.log('📅 Starting work item AI pickup scheduler (every 5 minutes)...');

  // Get default workspace ID from env
  const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || 'default';

  // Schedule job to run every 5 minutes
  await jobQueue.schedule(
    'work-item-ai-pickup-scheduler',
    '*/5 * * * *', // Every 5 minutes
    {
      workspaceId: DEFAULT_WORKSPACE_ID,
    }
  );

  console.log('✅ Work Item AI Pickup scheduler started');
}
