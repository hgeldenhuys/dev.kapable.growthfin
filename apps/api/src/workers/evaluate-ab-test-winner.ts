/**
 * A/B Test Winner Evaluation Worker
 * Periodically evaluates A/B tests and auto-declares winners based on statistical significance
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { crmCampaigns, crmAbTestResults } from '@agios/db';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { abTestingService } from '../modules/crm/services/ab-testing';
import { timelineService } from '../modules/crm/services/timeline';

export interface EvaluateAbTestWinnerJob {
  campaignId: string;
  workspaceId: string;
  criteria?: 'open_rate' | 'click_rate' | 'engagement';
  minSampleSize?: number;
  autoPromote?: boolean; // Whether to automatically promote winner to full audience
}

/**
 * Evaluate A/B test and auto-declare winner if statistically significant
 */
async function evaluateAbTestWinner(job: EvaluateAbTestWinnerJob): Promise<void> {
  const {
    campaignId,
    workspaceId,
    criteria = 'open_rate',
    minSampleSize = 100,
    autoPromote = false,
  } = job;

  console.log(`[A/B Test Winner Evaluator] Processing campaign: ${campaignId}`);

  try {
    // Get campaign details
    const campaigns = await db
      .select()
      .from(crmCampaigns)
      .where(and(eq(crmCampaigns.id, campaignId), eq(crmCampaigns.workspaceId, workspaceId)));

    const campaign = campaigns[0];
    if (!campaign) {
      console.error('[A/B Test Winner Evaluator] Campaign not found:', campaignId);
      return;
    }

    // Only process active campaigns that don't already have a winner
    if (campaign.status !== 'active') {
      console.log(
        `[A/B Test Winner Evaluator] Campaign ${campaignId} status is ${campaign.status}, skipping`
      );
      return;
    }

    // Check if winner already declared
    const existingResults = await db
      .select()
      .from(crmAbTestResults)
      .where(
        and(
          eq(crmAbTestResults.campaignId, campaignId),
          eq(crmAbTestResults.workspaceId, workspaceId),
          eq(crmAbTestResults.isWinner, true)
        )
      );

    if (existingResults.length > 0) {
      console.log(
        `[A/B Test Winner Evaluator] Winner already declared for campaign ${campaignId}, skipping`
      );
      return;
    }

    // Attempt to auto-declare winner
    const result = await abTestingService.autoDeclareWinner(
      db,
      campaignId,
      workspaceId,
      criteria,
      minSampleSize
    );

    if (!result) {
      console.log(
        `[A/B Test Winner Evaluator] Not enough data to declare winner for campaign ${campaignId}`
      );
      console.log(`  - Minimum sample size: ${minSampleSize} per variant`);
      console.log(`  - Criteria: ${criteria}`);
      return;
    }

    // Winner declared!
    console.log(
      `[A/B Test Winner Evaluator] Winner declared for campaign ${campaignId}:`,
      result.variantName
    );
    console.log(`  - P-value: ${result.pValue.toFixed(4)}`);
    console.log(`  - Lift: ${result.lift.toFixed(2)}%`);
    console.log(`  - Significant: ${result.isSignificant}`);

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.ab_test_winner_declared',
      eventCategory: 'system',
      eventLabel: 'A/B Test Winner Auto-Declared',
      summary: `Winner auto-declared for campaign "${campaign.name}": Variant ${result.variantName} (${result.lift.toFixed(2)}% lift)`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'A/B Test Auto-Evaluator',
      metadata: {
        campaignId,
        campaignName: campaign.name,
        messageId: result.messageId,
        variantName: result.variantName,
        criteria,
        pValue: result.pValue,
        lift: result.lift,
        isSignificant: result.isSignificant,
        auto: true,
        autoPromote,
      },
    });

    // TODO: If autoPromote is true, schedule winner promotion to remaining audience
    if (autoPromote) {
      console.log(
        `[A/B Test Winner Evaluator] Auto-promotion enabled for campaign ${campaignId} - variant ${result.variantName}`
      );
      // This would require implementing a new job type: 'promote-ab-test-winner'
      // For now, log that it's pending implementation
      console.warn('[A/B Test Winner Evaluator] Auto-promotion not yet implemented');
    }

    console.log(`[A/B Test Winner Evaluator] Successfully evaluated campaign: ${campaignId}`);
  } catch (error) {
    console.error('[A/B Test Winner Evaluator] Error evaluating test:', error);
    throw error;
  }
}

/**
 * Schedule A/B test winner evaluation jobs for all active campaigns
 */
export async function scheduleAbTestWinnerEvaluations(): Promise<void> {
  console.log('[A/B Test Winner Evaluator] Scheduling evaluations for active A/B test campaigns...');

  try {
    // Find all active campaigns with type 'ab_test' or multiple messages
    const activeCampaigns = await db.query.crmCampaigns.findMany({
      where: and(eq(crmCampaigns.status, 'active'), isNull(crmCampaigns.deletedAt)),
      with: {
        messages: true,
        abTestResults: true,
      },
    });

    // Filter campaigns that:
    // 1. Have multiple messages (A/B tests)
    // 2. Don't already have a winner declared
    const abTestCampaigns = activeCampaigns.filter((c) => {
      const hasMultipleVariants = c.type === 'ab_test' || c.messages.length > 1;
      const hasWinner = c.abTestResults.some((r) => r.isWinner);
      return hasMultipleVariants && !hasWinner;
    });

    console.log(
      `[A/B Test Winner Evaluator] Found ${abTestCampaigns.length} A/B test campaigns to evaluate`
    );

    // Schedule jobs for each campaign
    for (const campaign of abTestCampaigns) {
      await jobQueue.send<EvaluateAbTestWinnerJob>(
        'evaluate-ab-test-winner',
        {
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          criteria: 'open_rate', // Default criteria
          minSampleSize: 100, // Default minimum sample size
          autoPromote: false, // Don't auto-promote by default
        },
        {
          priority: 5, // Lower priority than campaign execution
          retryLimit: 2,
        }
      );
    }

    console.log('[A/B Test Winner Evaluator] Scheduled evaluations for all A/B test campaigns');
  } catch (error) {
    console.error('[A/B Test Winner Evaluator] Error scheduling evaluations:', error);
    throw error;
  }
}

/**
 * Register the A/B test winner evaluator worker
 */
export async function registerAbTestWinnerEvaluatorWorker(): Promise<void> {
  await jobQueue.work<EvaluateAbTestWinnerJob>(
    'evaluate-ab-test-winner',
    {
      teamSize: 1, // Single worker is sufficient
      teamConcurrency: 2, // Process 2 campaigns at a time
    },
    async (job) => {
      await evaluateAbTestWinner(job.data);
    }
  );
}

/**
 * Start periodic scheduling of A/B test winner evaluations
 * Runs every hour (less frequent than metrics calculation)
 */
export function startAbTestWinnerEvaluatorScheduler(): NodeJS.Timeout {
  console.log('[A/B Test Winner Evaluator] Starting periodic scheduler (every hour)');

  // Run immediately on start
  scheduleAbTestWinnerEvaluations().catch((error) => {
    console.error('[A/B Test Winner Evaluator] Error in initial scheduling:', error);
  });

  // Then run every hour
  return setInterval(
    () => {
      scheduleAbTestWinnerEvaluations().catch((error) => {
        console.error('[A/B Test Winner Evaluator] Error in periodic scheduling:', error);
      });
    },
    60 * 60 * 1000
  ); // 1 hour
}
