/**
 * Calculate Health Worker
 * Background worker for lead health score calculation
 * Story: US-LEAD-AI-013
 */

import { jobQueue, type CalculateHealthJob } from '../lib/queue';
import { healthService } from '../services/ai/health-service';
import { db, crmLeads } from '@agios/db';
import { eq } from 'drizzle-orm';

export async function registerCalculateHealthWorker() {
  await jobQueue.work<CalculateHealthJob>(
    'calculate-health',
    {
      teamSize: 5,
      teamConcurrency: 3,
    },
    async (job) => {
      const { leadId, workspaceId, batchAll } = job.data;

      if (batchAll) {
        console.log('[Calculate Health Worker] Batch calculating health for all leads...');

        // Get all leads in workspace
        const leads = await db.query.crmLeads.findMany({
          where: eq(crmLeads.workspaceId, workspaceId),
        });

        console.log(`[Calculate Health Worker] Found ${leads.length} leads to process`);

        // Queue individual health calculation jobs
        for (const lead of leads) {
          await jobQueue.send('calculate-health', {
            leadId: lead.id,
            workspaceId,
            batchAll: false,
          });
        }

        console.log(`[Calculate Health Worker] Queued ${leads.length} health calculation jobs`);
        return;
      }

      if (!leadId) {
        throw new Error('leadId is required when batchAll is false');
      }

      console.log(`[Calculate Health Worker] Calculating health for lead ${leadId}...`);

      try {
        const result = await healthService.calculateHealthScore(leadId, workspaceId);

        console.log(
          `[Calculate Health Worker] ✅ Health: ${result.health_status} (${result.health_score}/100)`
        );

        // Check if lead became at-risk or critical
        if (result.health_status === 'critical' || result.health_status === 'at_risk') {
          console.log(
            `[Calculate Health Worker] ⚠️ Lead ${leadId} is ${result.health_status} - consider taking action`
          );

          // Could trigger alerts here in future
          // await jobQueue.send('send-health-alert', {
          //   leadId,
          //   workspaceId,
          //   healthScore: result.health_score,
          //   healthStatus: result.health_status,
          //   riskFactors: result.risk_factors,
          // });
        }
      } catch (error: any) {
        console.error(`[Calculate Health Worker] ❌ Failed to calculate health for lead ${leadId}:`, error);
        throw error; // Rethrow to trigger retry
      }
    }
  );

  console.log('✅ Calculate health worker registered');
}

/**
 * Start daily health calculation scheduler
 * Runs every day at 2 AM UTC
 */
export async function startHealthCalculationScheduler() {
  console.log('📅 Starting health calculation scheduler (daily at 2 AM UTC)...');

  // Schedule daily batch calculation
  // Note: This will trigger for a default workspace
  // In production, you'd want to iterate over all workspaces
  const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || 'default';

  await jobQueue.schedule(
    'calculate-health-all',
    '0 2 * * *', // 2 AM UTC daily
    {
      workspaceId: DEFAULT_WORKSPACE_ID,
      batchAll: true,
    }
  );

  console.log('✅ Health calculation scheduler started');
}
