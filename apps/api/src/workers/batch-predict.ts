/**
 * Batch Predict Worker
 * US-LEAD-AI-010: Predictive Conversion Scoring
 */

import { jobQueue, type BatchPredictJob } from '../lib/queue';
import { PredictionService } from '../services/ai/prediction-service';
import { db, crmLeads } from '@agios/db';
import { eq } from 'drizzle-orm';

/**
 * Register the batch-predict worker
 */
export async function registerBatchPredictWorker() {
  await jobQueue.work<BatchPredictJob>(
    'batch-predict',
    {
      teamSize: 2, // Allow 2 batch jobs at a time
      teamConcurrency: 1,
    },
    async (job) => {
      const { workspaceId, leadIds, batchSize = 100 } = job.data;

      console.log(`[Batch Predict Worker] Starting batch predictions for workspace ${workspaceId}...`);

      try {
        const service = new PredictionService();

        // Get leads to predict
        let leadsToPredict: string[];

        if (leadIds && leadIds.length > 0) {
          leadsToPredict = leadIds;
        } else {
          // Get all leads in workspace that don't have recent predictions (last 7 days)
          const leads = await db.query.crmLeads.findMany({
            where: eq(crmLeads.workspaceId, workspaceId),
            columns: { id: true },
          });
          leadsToPredict = leads.map((l) => l.id);
        }

        console.log(`[Batch Predict Worker] Processing ${leadsToPredict.length} leads...`);

        const results = {
          total: leadsToPredict.length,
          processed: 0,
          successful: 0,
          failed: 0,
          errors: [] as Array<{ leadId: string; error: string }>,
        };

        // Process in batches
        for (let i = 0; i < leadsToPredict.length; i += batchSize) {
          const batch = leadsToPredict.slice(i, i + batchSize);

          for (const leadId of batch) {
            try {
              await service.predictConversion(leadId, workspaceId);
              results.successful++;
            } catch (error: any) {
              console.error(`[Batch Predict Worker] Failed for lead ${leadId}:`, error.message);
              results.failed++;
              results.errors.push({ leadId, error: error.message });
            }
            results.processed++;
          }

          // Log progress
          const progressPct = ((results.processed / results.total) * 100).toFixed(1);
          console.log(
            `[Batch Predict Worker] Progress: ${results.processed}/${results.total} (${progressPct}%)`
          );
        }

        console.log(
          `[Batch Predict Worker] Batch complete: ${results.successful} successful, ${results.failed} failed`
        );

        return {
          success: true,
          results,
        };
      } catch (error: any) {
        console.error(`[Batch Predict Worker] Failed:`, error);
        throw error;
      }
    }
  );

  console.log('✅ Batch predict worker registered');
}
