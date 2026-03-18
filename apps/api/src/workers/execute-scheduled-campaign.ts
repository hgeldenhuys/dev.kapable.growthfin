/**
 * Scheduled Campaign Execution Worker
 * Executes scheduled one-time campaigns and marks them as completed
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { campaignSchedules } from '@agios/db/schema';
import { crmCampaigns } from '@agios/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { markScheduleExecuted } from '../modules/crm/services/campaign-scheduling';
import { timelineService } from '../modules/crm/services/timeline';

export interface ExecuteScheduledCampaignJob {
  scheduleId: string;
  campaignId: string;
  workspaceId: string;
}

/**
 * Execute a scheduled campaign
 */
async function executeScheduledCampaign(job: ExecuteScheduledCampaignJob): Promise<void> {
  const { scheduleId, campaignId, workspaceId } = job;

  console.log(`[Scheduled Campaign Worker] Executing scheduled campaign: ${campaignId}`);

  try {
    // Get schedule
    const schedules = await db
      .select()
      .from(campaignSchedules)
      .where(
        and(
          eq(campaignSchedules.id, scheduleId),
          eq(campaignSchedules.workspaceId, workspaceId),
          isNull(campaignSchedules.deletedAt)
        )
      );

    const schedule = schedules[0];
    if (!schedule) {
      throw new Error('Schedule not found');
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

    // Update campaign status to active
    await db
      .update(crmCampaigns)
      .set({
        status: 'active',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmCampaigns.id, campaignId));

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

    // Mark schedule as executed
    await markScheduleExecuted(db, scheduleId, workspaceId);

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'contact',
      entityId: campaignId,
      eventType: 'campaign.scheduled_execution',
      eventCategory: 'system',
      eventLabel: 'Scheduled Campaign Executed',
      summary: `Scheduled campaign "${campaignData.name}" was executed`,
      occurredAt: new Date(),
      actorType: 'system',
      actorId: null,
      actorName: 'Campaign Scheduler',
      metadata: {
        campaignId,
        campaignName: campaignData.name,
        scheduleId,
        scheduledTime: schedule.scheduledTime?.toISOString(),
      },
    });

    console.log(`[Scheduled Campaign Worker] Successfully executed campaign ${campaignId}`);
  } catch (error) {
    console.error(`[Scheduled Campaign Worker] Error executing campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Register the scheduled campaign worker
 */
export async function registerExecuteScheduledCampaignWorker() {
  await jobQueue.work<ExecuteScheduledCampaignJob>(
    'execute-scheduled-campaign',
    {
      teamSize: 5,
      teamConcurrency: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await executeScheduledCampaign(job.data);
          await job.done();
        } catch (error) {
          console.error('[Scheduled Campaign Worker] Job failed:', error);
          await job.done(error as Error);
        }
      }
    }
  );

  console.log('✅ Scheduled campaign worker registered');
}

/**
 * Start the scheduler that checks for due schedules every minute
 */
export function startScheduledCampaignScheduler() {
  const INTERVAL_MS = 60000; // 1 minute

  setInterval(async () => {
    try {
      // Get schedules due for execution
      const dueSchedules = await db
        .select()
        .from(campaignSchedules)
        .where(
          and(
            eq(campaignSchedules.status, 'active'),
            eq(campaignSchedules.scheduleType, 'once'),
            lte(campaignSchedules.scheduledTime, new Date()),
            isNull(campaignSchedules.executedAt),
            isNull(campaignSchedules.deletedAt)
          )
        );

      if (dueSchedules.length > 0) {
        console.log(`[Scheduled Campaign Scheduler] Found ${dueSchedules.length} due schedules`);
      }

      // Queue execution jobs
      for (const schedule of dueSchedules) {
        await jobQueue.send<ExecuteScheduledCampaignJob>(
          'execute-scheduled-campaign',
          {
            scheduleId: schedule.id,
            campaignId: schedule.campaignId,
            workspaceId: schedule.workspaceId,
          },
          {
            priority: 1,
            retryLimit: 3,
          }
        );
      }
    } catch (error) {
      console.error('[Scheduled Campaign Scheduler] Error checking schedules:', error);
    }
  }, INTERVAL_MS);

  console.log('📅 Scheduled campaign scheduler started (checks every 1 minute)');
}
