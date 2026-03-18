/**
 * Recurring Campaign Execution Worker
 * Executes recurring campaigns and schedules the next occurrence
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { campaignRecurrences } from '@agios/db/schema';
import { crmCampaigns } from '@agios/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { markRecurrenceExecuted } from '../modules/crm/services/campaign-recurrence';
import { timelineService } from '../modules/crm/services/timeline';

export interface ExecuteRecurringCampaignJob {
  recurrenceId: string;
  campaignId: string;
  workspaceId: string;
}

/**
 * Execute a recurring campaign
 */
async function executeRecurringCampaign(job: ExecuteRecurringCampaignJob): Promise<void> {
  const { recurrenceId, campaignId, workspaceId } = job;

  console.log(`[Recurring Campaign Worker] Executing recurring campaign: ${campaignId}`);

  try {
    // Get recurrence
    const recurrences = await db
      .select()
      .from(campaignRecurrences)
      .where(
        and(
          eq(campaignRecurrences.id, recurrenceId),
          eq(campaignRecurrences.workspaceId, workspaceId),
          isNull(campaignRecurrences.deletedAt)
        )
      );

    const recurrence = recurrences[0];
    if (!recurrence) {
      throw new Error('Recurrence not found');
    }

    // Get campaign with messages and recipients
    const campaignData = await db.query.crmCampaigns.findFirst({
      where: (campaigns, { eq, and }) =>
        and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId)),
      with: {
        messages: true,
        recipients: true,
      },
    });

    if (!campaignData) {
      throw new Error('Campaign not found');
    }

    if (!campaignData.messages.length) {
      throw new Error('Campaign has no messages');
    }

    if (!campaignData.recipients.length) {
      throw new Error('Campaign has no recipients');
    }

    // NOTE: For recurring campaigns, we don't change the campaign status
    // We just execute it and let it return to its original state
    // This allows the campaign to be executed multiple times

    // Queue campaign execution job
    await jobQueue.send(
      'execute-campaign',
      {
        campaignId,
        messageId: campaignData.messages[0].id,
        workspaceId,
      },
      {
        priority: 1,
        retryLimit: 3,
      }
    );

    // Mark execution and calculate next occurrence
    const updatedRecurrence = await markRecurrenceExecuted(db, recurrenceId, workspaceId);

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.recurring_execution',
      eventCategory: 'system',
      eventLabel: 'Recurring Campaign Executed',
      summary: `Recurring campaign "${campaignData.name}" was executed (execution ${updatedRecurrence.executionCount})`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Campaign Scheduler',
      metadata: {
        campaignId,
        campaignName: campaignData.name,
        recurrenceId,
        pattern: recurrence.pattern,
        executionCount: updatedRecurrence.executionCount,
        nextExecutionAt: updatedRecurrence.nextExecutionAt?.toISOString(),
        status: updatedRecurrence.status,
      },
    });

    console.log(
      `[Recurring Campaign Worker] Successfully executed campaign ${campaignId}. Next execution: ${updatedRecurrence.nextExecutionAt}`
    );
  } catch (error) {
    console.error(`[Recurring Campaign Worker] Error executing campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Register the recurring campaign worker
 */
export async function registerExecuteRecurringCampaignWorker() {
  await jobQueue.work<ExecuteRecurringCampaignJob>(
    'execute-recurring-campaign',
    {
      teamSize: 5,
      teamConcurrency: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await executeRecurringCampaign(job.data);
          await job.done();
        } catch (error) {
          console.error('[Recurring Campaign Worker] Job failed:', error);
          await job.done(error as Error);
        }
      }
    }
  );

  console.log('✅ Recurring campaign worker registered');
}

/**
 * Start the scheduler that checks for due recurrences every minute
 */
export function startRecurringCampaignScheduler() {
  const INTERVAL_MS = 60000; // 1 minute

  setInterval(async () => {
    try {
      // Get recurrences due for execution
      const dueRecurrences = await db
        .select()
        .from(campaignRecurrences)
        .where(
          and(
            eq(campaignRecurrences.status, 'active'),
            lte(campaignRecurrences.nextExecutionAt, new Date()),
            isNull(campaignRecurrences.deletedAt)
          )
        );

      if (dueRecurrences.length > 0) {
        console.log(`[Recurring Campaign Scheduler] Found ${dueRecurrences.length} due recurrences`);
      }

      // Queue execution jobs
      for (const recurrence of dueRecurrences) {
        await jobQueue.send<ExecuteRecurringCampaignJob>(
          'execute-recurring-campaign',
          {
            recurrenceId: recurrence.id,
            campaignId: recurrence.campaignId,
            workspaceId: recurrence.workspaceId,
          },
          {
            priority: 1,
            retryLimit: 3,
          }
        );
      }
    } catch (error) {
      console.error('[Recurring Campaign Scheduler] Error checking recurrences:', error);
    }
  }, INTERVAL_MS);

  console.log('🔄 Recurring campaign scheduler started (checks every 1 minute)');
}
