/**
 * Campaign Scheduler Worker
 * Checks for recurring campaigns that need to be executed
 */

import { db } from '@agios/db';
import { crmCampaigns } from '@agios/db';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { jobQueue, type ExecuteCampaignJob } from '../lib/queue';
import { getNextExecutionTime } from '../modules/crm/services/recurring';
import { timelineService } from '../modules/crm/services/timeline';

/**
 * Check for recurring campaigns that are due for execution
 */
export async function checkRecurringCampaigns(): Promise<void> {
  const now = new Date();

  console.log('[Campaign Scheduler] Checking for due recurring campaigns...');

  try {
    // Find campaigns that are:
    // - type = 'recurring'
    // - status = 'active'
    // - not deleted
    // - next_execution_at <= NOW()
    const dueCampaigns = await db
      .select()
      .from(crmCampaigns)
      .where(
        and(
          eq(crmCampaigns.type, 'recurring'),
          eq(crmCampaigns.status, 'active'),
          isNull(crmCampaigns.deletedAt),
          lte(crmCampaigns.nextExecutionAt, now)
        )
      );

    console.log(`[Campaign Scheduler] Found ${dueCampaigns.length} campaigns due for execution`);

    for (const campaign of dueCampaigns) {
      try {
        await executeRecurringCampaign(campaign);
      } catch (error) {
        console.error(`[Campaign Scheduler] Error executing campaign ${campaign.id}:`, error);
        // Continue with other campaigns even if one fails
      }
    }

    console.log('[Campaign Scheduler] Completed check');
  } catch (error) {
    console.error('[Campaign Scheduler] Error checking recurring campaigns:', error);
    throw error;
  }
}

/**
 * Execute a single recurring campaign
 */
async function executeRecurringCampaign(campaign: any): Promise<void> {
  console.log(`[Campaign Scheduler] Executing recurring campaign: ${campaign.name} (${campaign.id})`);

  // Verify campaign still has a schedule
  if (!campaign.schedule) {
    console.warn(`[Campaign Scheduler] Campaign ${campaign.id} has no schedule, skipping`);
    return;
  }

  // Get campaign with messages
  const campaignWithData = await db.query.crmCampaigns.findFirst({
    where: (campaigns, { eq }) => eq(campaigns.id, campaign.id),
    with: {
      messages: {
        where: (messages, { isNull }) => isNull(messages.deletedAt),
      },
      recipients: {
        where: (recipients, { isNull }) => isNull(recipients.deletedAt),
      },
    },
  });

  if (!campaignWithData) {
    console.warn(`[Campaign Scheduler] Campaign ${campaign.id} not found, skipping`);
    return;
  }

  if (campaignWithData.messages.length === 0) {
    console.warn(`[Campaign Scheduler] Campaign ${campaign.id} has no messages, skipping`);
    return;
  }

  // Reset recipients to 'pending' status for recurring campaigns
  // This allows the same campaign to send to the same audience multiple times
  if (campaignWithData.recipients.length > 0) {
    await db
      .update(crmCampaigns)
      .set({
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
      })
      .where(eq(crmCampaigns.id, campaign.id));
  }

  // Enqueue execution job
  await jobQueue.send<ExecuteCampaignJob>(
    'execute-campaign',
    {
      campaignId: campaign.id,
      messageId: campaignWithData.messages[0].id,
      workspaceId: campaign.workspaceId,
    },
    {
      priority: 1,
      retryLimit: 3,
    }
  );

  // Calculate next execution time
  const nextExecution = getNextExecutionTime(campaign.schedule);

  // Update campaign with execution timestamps
  await db
    .update(crmCampaigns)
    .set({
      lastExecutedAt: new Date(),
      nextExecutionAt: nextExecution,
      updatedAt: new Date(),
    })
    .where(eq(crmCampaigns.id, campaign.id));

  // Create timeline event
  await timelineService.create(db, {
    workspaceId: campaign.workspaceId,
    entityType: 'contact',
    entityId: campaign.id,
    eventType: 'campaign.scheduled_execution',
    eventCategory: 'system',
    eventLabel: 'Recurring Campaign Scheduled',
    summary: `Recurring campaign "${campaign.name}" scheduled for execution`,
    occurredAt: new Date(),
    actorType: 'system',
    actorId: null,
    actorName: 'Campaign Scheduler',
    metadata: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      schedule: campaign.schedule,
      nextExecutionAt: nextExecution.toISOString(),
      recipientCount: campaignWithData.recipients.length,
    },
  });

  console.log(`[Campaign Scheduler] Scheduled campaign ${campaign.id}, next run: ${nextExecution.toISOString()}`);
}

/**
 * Start the recurring campaign scheduler
 * Runs every minute to check for due campaigns
 */
export async function startCampaignScheduler(): Promise<void> {
  console.log('[Campaign Scheduler] Starting scheduler (runs every minute)...');

  // Run immediately on startup
  await checkRecurringCampaigns();

  // Then run every minute
  setInterval(async () => {
    try {
      await checkRecurringCampaigns();
    } catch (error) {
      console.error('[Campaign Scheduler] Interval check failed:', error);
    }
  }, 60 * 1000); // Every 60 seconds

  console.log('[Campaign Scheduler] Scheduler started');
}
