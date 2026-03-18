/**
 * Enrichment Execution Worker
 * Processes scheduled enrichment jobs
 *
 * US-008: Integrated with JobLoggingService for real-time progress streaming
 */

import { jobQueue, type ExecuteEnrichmentJob } from '../lib/queue';
import { db } from '@agios/db';
import { enrichmentService } from '../modules/crm/services/enrichment';
import { BatchesService } from '../modules/crm/services/batches.service';
import { jobLoggingService } from '../services/job-logging.service';

/**
 * Execute an enrichment job (scheduled or manual)
 */
async function executeEnrichment(job: ExecuteEnrichmentJob): Promise<void> {
  const { jobId, batchId, workspaceId, mode } = job;

  console.log(`[Enrichment Worker] Starting enrichment execution: ${jobId}, mode: ${mode}, batch: ${batchId || 'none'}`);

  // Log job start (US-008)
  await jobLoggingService.logJobStart(db, workspaceId, jobId, 'enrichment', {
    mode,
    batchId: batchId || null,
  });

  try {
    if (mode === 'sample') {
      // Run in sample mode
      await jobLoggingService.info(db, workspaceId, jobId, 'enrichment', 'Running in sample mode');
      await enrichmentService.runSample(db, jobId, workspaceId);
      await jobLoggingService.logJobComplete(db, workspaceId, jobId, 'enrichment', {
        processed: 1,
        failed: 0,
      });
    } else {
      // Run in batch mode
      await jobLoggingService.info(db, workspaceId, jobId, 'enrichment', 'Starting batch processing');
      const result = await enrichmentService.runBatch(db, jobId, workspaceId);

      // If batch-based execution, update batch status based on result
      if (batchId) {
        const enrichmentJob = await enrichmentService.getJob(db, jobId, workspaceId);

        if (enrichmentJob?.status === 'completed') {
          await BatchesService.changeStatus(db, batchId, workspaceId, 'completed');
          console.log(`[Enrichment Worker] Batch ${batchId} marked as completed`);
          await jobLoggingService.logJobComplete(db, workspaceId, jobId, 'enrichment', {
            processed: enrichmentJob.processedContacts ?? 0,
            failed: 0,
            cost: enrichmentJob.actualCost ? parseFloat(enrichmentJob.actualCost) : undefined,
          });
        } else if (enrichmentJob?.status === 'budget_exceeded') {
          await BatchesService.changeStatus(db, batchId, workspaceId, 'failed');
          console.log(`[Enrichment Worker] Batch ${batchId} marked as failed (budget exceeded)`);
          await jobLoggingService.warn(db, workspaceId, jobId, 'enrichment', 'Job stopped: budget exceeded', {
            processed: enrichmentJob.processedContacts,
            cost: enrichmentJob.actualCost,
          });
        } else if (enrichmentJob?.status === 'failed') {
          await BatchesService.changeStatus(db, batchId, workspaceId, 'failed');
          console.log(`[Enrichment Worker] Batch ${batchId} marked as failed`);
          await jobLoggingService.logJobFailed(db, workspaceId, jobId, 'enrichment', 'Enrichment job failed');
        }
      } else {
        // No task, log completion based on result
        const enrichmentJob = await enrichmentService.getJob(db, jobId, workspaceId);
        if (enrichmentJob?.status === 'completed') {
          await jobLoggingService.logJobComplete(db, workspaceId, jobId, 'enrichment', {
            processed: enrichmentJob.processedContacts ?? 0,
            failed: 0,
            cost: enrichmentJob.actualCost ? parseFloat(enrichmentJob.actualCost) : undefined,
          });
        }
      }
    }

    console.log(`[Enrichment Worker] Enrichment ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[Enrichment Worker] Error executing enrichment ${jobId}:`, error);

    // Log the error (US-008)
    await jobLoggingService.logJobFailed(db, workspaceId, jobId, 'enrichment', error instanceof Error ? error : String(error));

    // If batch-based execution, mark batch as failed
    if (batchId) {
      try {
        await BatchesService.changeStatus(db, batchId, workspaceId, 'failed');
        console.log(`[Enrichment Worker] Batch ${batchId} marked as failed due to error`);
      } catch (statusError) {
        console.error(`[Enrichment Worker] Failed to update batch status:`, statusError);
      }
    }

    throw error; // Let pg-boss handle retry logic
  }
}

/**
 * Register the enrichment execution worker
 */
export async function registerExecuteEnrichmentWorker(): Promise<void> {
  await jobQueue.work<ExecuteEnrichmentJob>(
    'execute-enrichment',
    {
      teamSize: 1, // Run 1 worker (enrichment can be resource-intensive)
      teamConcurrency: 1, // Process 1 job at a time
    },
    async (job) => {
      await executeEnrichment(job.data);
    }
  );
}
