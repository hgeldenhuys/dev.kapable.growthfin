/**
 * A/B Test Calculator Worker
 * Periodically updates A/B test results for active campaigns
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { crmCampaigns } from '@agios/db';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { abTestingService } from '../modules/crm/services/ab-testing';
import { timelineService } from '../modules/crm/services/timeline';

export interface CalculateAbTestJob {
  campaignId: string;
  workspaceId: string;
}

/**
 * Calculate A/B test results for a campaign
 */
async function calculateAbTestResults(job: CalculateAbTestJob): Promise<void> {
  const { campaignId, workspaceId } = job;

  console.log(`[A/B Test Calculator] Processing campaign: ${campaignId}`);

  try {
    // Get campaign details
    const campaigns = await db
      .select()
      .from(crmCampaigns)
      .where(and(eq(crmCampaigns.id, campaignId), eq(crmCampaigns.workspaceId, workspaceId)));

    const campaign = campaigns[0];
    if (!campaign) {
      console.error('[A/B Test Calculator] Campaign not found:', campaignId);
      return;
    }

    // Only process active or completed campaigns with A/B tests
    if (!['active', 'completed'].includes(campaign.status)) {
      console.log(`[A/B Test Calculator] Campaign ${campaignId} status is ${campaign.status}, skipping`);
      return;
    }

    // Update test results
    await abTestingService.updateTestResults(db, campaignId, workspaceId);

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.ab_test_results_updated',
      eventCategory: 'system',
      eventLabel: 'A/B Test Results Updated',
      summary: `A/B test results updated for campaign "${campaign.name}"`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'A/B Test Calculator',
      metadata: {
        campaignId,
        campaignName: campaign.name,
      },
    });

    console.log(`[A/B Test Calculator] Successfully updated results for campaign: ${campaignId}`);
  } catch (error) {
    console.error('[A/B Test Calculator] Error calculating results:', error);
    throw error;
  }
}

/**
 * Schedule A/B test calculation jobs for all active campaigns
 */
export async function scheduleAbTestCalculations(): Promise<void> {
  console.log('[A/B Test Calculator] Scheduling calculations for active A/B test campaigns...');

  try {
    // Find all active campaigns with type 'ab_test' or multiple messages
    const activeCampaigns = await db.query.crmCampaigns.findMany({
      where: and(
        inArray(crmCampaigns.status, ['active', 'completed']),
        isNull(crmCampaigns.deletedAt)
      ),
      with: {
        messages: true,
      },
    });

    // Filter campaigns that have multiple messages (A/B tests)
    const abTestCampaigns = activeCampaigns.filter(
      (c) => c.type === 'ab_test' || c.messages.length > 1
    );

    console.log(`[A/B Test Calculator] Found ${abTestCampaigns.length} A/B test campaigns to process`);

    // Schedule jobs for each campaign
    for (const campaign of abTestCampaigns) {
      await jobQueue.send<CalculateAbTestJob>(
        'calculate-ab-test',
        {
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
        },
        {
          priority: 5, // Lower priority than campaign execution
          retryLimit: 2,
        }
      );
    }

    console.log('[A/B Test Calculator] Scheduled calculations for all A/B test campaigns');
  } catch (error) {
    console.error('[A/B Test Calculator] Error scheduling calculations:', error);
    throw error;
  }
}

/**
 * Register the A/B test calculator worker
 */
export async function registerAbTestCalculatorWorker(): Promise<void> {
  await jobQueue.work<CalculateAbTestJob>(
    'calculate-ab-test',
    {
      teamSize: 1, // Single worker is sufficient
      teamConcurrency: 2, // Process 2 campaigns at a time
    },
    async (job) => {
      await calculateAbTestResults(job.data);
    }
  );
}

/**
 * Start periodic scheduling of A/B test calculations
 * Runs every 5 minutes
 */
export function startAbTestCalculatorScheduler(): NodeJS.Timeout {
  console.log('[A/B Test Calculator] Starting periodic scheduler (every 5 minutes)');

  // Run immediately on start
  scheduleAbTestCalculations().catch((error) => {
    console.error('[A/B Test Calculator] Error in initial scheduling:', error);
  });

  // Then run every 5 minutes
  return setInterval(
    () => {
      scheduleAbTestCalculations().catch((error) => {
        console.error('[A/B Test Calculator] Error in periodic scheduling:', error);
      });
    },
    5 * 60 * 1000
  ); // 5 minutes
}
