/**
 * Campaign Trigger Evaluation Worker
 * Evaluates event-based triggers and executes matching campaigns
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { campaignTriggers } from '@agios/db/schema';
import { crmCampaigns, crmCampaignRecipients } from '@agios/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  evaluateTrigger,
  recordTriggerExecution,
  getTriggersForEvent,
} from '../modules/crm/services/campaign-triggers';
import { timelineService } from '../modules/crm/services/timeline';
import type { TriggerEvent } from '@agios/db/schema';

export interface EvaluateCampaignTriggerJob {
  triggerEvent: TriggerEvent;
  leadId: string;
  workspaceId: string;
  eventData?: Record<string, any>; // Additional context about the event
}

/**
 * Evaluate triggers for a specific lead event
 */
async function evaluateCampaignTriggers(job: EvaluateCampaignTriggerJob): Promise<void> {
  const { triggerEvent, leadId, workspaceId, eventData } = job;

  console.log(`[Campaign Trigger Worker] Evaluating triggers for event: ${triggerEvent}, lead: ${leadId}`);

  try {
    // Get all active triggers for this event type
    const triggers = await getTriggersForEvent(db, workspaceId, triggerEvent);

    if (triggers.length === 0) {
      console.log(`[Campaign Trigger Worker] No active triggers found for event: ${triggerEvent}`);
      return;
    }

    console.log(`[Campaign Trigger Worker] Found ${triggers.length} active triggers for event: ${triggerEvent}`);

    // Evaluate each trigger
    for (const trigger of triggers) {
      try {
        // Evaluate conditions
        const shouldTrigger = await evaluateTrigger(db, trigger, leadId);

        if (!shouldTrigger) {
          console.log(`[Campaign Trigger Worker] Trigger ${trigger.id} conditions not met for lead ${leadId}`);
          continue;
        }

        console.log(`[Campaign Trigger Worker] Trigger ${trigger.id} conditions met for lead ${leadId}`);

        // Get campaign
        const campaigns = await db
          .select()
          .from(crmCampaigns)
          .where(
            and(
              eq(crmCampaigns.id, trigger.campaignId),
              eq(crmCampaigns.workspaceId, workspaceId),
              isNull(crmCampaigns.deletedAt)
            )
          );

        const campaign = campaigns[0];
        if (!campaign) {
          console.error(`[Campaign Trigger Worker] Campaign ${trigger.campaignId} not found`);
          continue;
        }

        // Add lead as recipient if not already added
        const existingRecipient = await db
          .select()
          .from(crmCampaignRecipients)
          .where(
            and(
              eq(crmCampaignRecipients.campaignId, campaign.id),
              eq(crmCampaignRecipients.contactId, leadId), // Note: Using leadId as contactId
              isNull(crmCampaignRecipients.deletedAt)
            )
          );

        if (existingRecipient.length === 0) {
          await db.insert(crmCampaignRecipients).values({
            campaignId: campaign.id,
            contactId: leadId,
            workspaceId,
            status: 'pending',
            addedBy: null, // Automatically added by trigger
          });

          console.log(`[Campaign Trigger Worker] Added lead ${leadId} as recipient to campaign ${campaign.id}`);
        }

        // Get campaign messages
        const campaignData = await db.query.crmCampaigns.findFirst({
          where: (campaigns, { eq }) => eq(campaigns.id, campaign.id),
          with: {
            messages: true,
          },
        });

        if (!campaignData || !campaignData.messages.length) {
          console.error(`[Campaign Trigger Worker] Campaign ${campaign.id} has no messages`);
          continue;
        }

        // Queue campaign execution for this specific lead
        await jobQueue.send(
          'execute-campaign',
          {
            campaignId: campaign.id,
            messageId: campaignData.messages[0].id,
            workspaceId,
          },
          {
            priority: 2, // Higher priority for triggered campaigns
            retryLimit: 3,
          }
        );

        // Record trigger execution
        await recordTriggerExecution(db, trigger.id, leadId, workspaceId);

        // Create timeline event
        await timelineService.create(db, {
          workspaceId,
          entityType: 'lead',
          entityId: leadId,
          eventType: 'campaign.triggered',
          eventCategory: 'system',
          eventLabel: 'Campaign Triggered',
          summary: `Campaign "${campaign.name}" was triggered by ${triggerEvent}`,
          occurredAt: new Date(),
          actorType: 'system',
          actorId: null,
          actorName: 'Campaign Trigger System',
          metadata: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            triggerId: trigger.id,
            triggerName: trigger.name,
            triggerEvent,
            eventData,
          },
        });

        console.log(`[Campaign Trigger Worker] Successfully triggered campaign ${campaign.id} for lead ${leadId}`);
      } catch (error) {
        console.error(`[Campaign Trigger Worker] Error evaluating trigger ${trigger.id}:`, error);
        // Continue with other triggers even if one fails
      }
    }
  } catch (error) {
    console.error(`[Campaign Trigger Worker] Error evaluating triggers:`, error);
    throw error;
  }
}

/**
 * Register the campaign trigger worker
 */
export async function registerEvaluateCampaignTriggersWorker() {
  await jobQueue.work<EvaluateCampaignTriggerJob>(
    'evaluate-campaign-triggers',
    {
      teamSize: 10,
      teamConcurrency: 5,
    },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await evaluateCampaignTriggers(job.data);
          await job.done();
        } catch (error) {
          console.error('[Campaign Trigger Worker] Job failed:', error);
          await job.done(error as Error);
        }
      }
    }
  );

  console.log('✅ Campaign trigger worker registered');
}

/**
 * Helper function to queue trigger evaluation from application code
 */
export async function queueTriggerEvaluation(
  triggerEvent: TriggerEvent,
  leadId: string,
  workspaceId: string,
  eventData?: Record<string, any>
): Promise<void> {
  await jobQueue.send<EvaluateCampaignTriggerJob>(
    'evaluate-campaign-triggers',
    {
      triggerEvent,
      leadId,
      workspaceId,
      eventData,
    },
    {
      priority: 3, // High priority for event-based triggers
      retryLimit: 3,
    }
  );
}
