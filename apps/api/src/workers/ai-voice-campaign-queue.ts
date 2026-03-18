/**
 * AI Voice Campaign Queue Worker (Phase N)
 * Processes AI voice campaign calls sequentially with rate limiting
 *
 * Key differences from SMS campaign execution:
 * - Sequential execution (1 call at a time per workspace)
 * - Respects preferred calling hours
 * - Handles retries with delay
 * - Updates queue status in real-time
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { crmAiVoiceQueue, crmCampaigns, crmCampaignRecipients, crmAiCalls, AI_VOICE_DEFAULTS } from '@agios/db';
import { eq, and, or, lte, isNull, asc, sql } from 'drizzle-orm';
import { getElevenLabsVoiceAdapter } from '../lib/channels/adapters/elevenlabs-voice-adapter';
import { timelineService } from '../modules/crm/services/timeline';
import { AiVoiceRateLimitService } from '../modules/crm/services/ai-voice-rate-limit.service';
import type { AiVoiceQueueStatus } from '@agios/db';

export interface ProcessAiVoiceQueueJob {
  workspaceId: string;
  campaignId?: string;
}

/**
 * Process the next pending AI voice call from the queue
 */
async function processNextQueueItem(workspaceId: string, campaignId?: string): Promise<boolean> {
  // Check rate limits before processing
  const rateLimitCheck = await AiVoiceRateLimitService.checkLimit(workspaceId, 1);
  if (!rateLimitCheck.allowed) {
    const waitMs = AiVoiceRateLimitService.calculateWaitTime(rateLimitCheck.resetAt);
    console.log(`[AI Voice Queue] Rate limit reached for workspace ${workspaceId}. Waiting ${Math.ceil(waitMs / 1000)}s until reset...`);
    return false; // Signal to wait
  }

  // Get next pending item from queue
  const baseConditions = [
    eq(crmAiVoiceQueue.workspaceId, workspaceId),
    or(
      eq(crmAiVoiceQueue.status, 'pending'),
      and(
        eq(crmAiVoiceQueue.status, 'scheduled'),
        lte(crmAiVoiceQueue.scheduledAt, new Date())
      )
    ),
    or(
      isNull(crmAiVoiceQueue.nextAttemptAt),
      lte(crmAiVoiceQueue.nextAttemptAt, new Date())
    ),
  ];

  if (campaignId) {
    baseConditions.push(eq(crmAiVoiceQueue.campaignId, campaignId));
  }

  const [queueItem] = await db
    .select()
    .from(crmAiVoiceQueue)
    .where(and(...baseConditions))
    .orderBy(
      asc(crmAiVoiceQueue.priority), // Higher priority (lower number) first
      asc(crmAiVoiceQueue.createdAt) // Then by creation time
    )
    .limit(1);

  if (!queueItem) {
    console.log(`[AI Voice Queue] No pending items for workspace ${workspaceId}`);
    return false;
  }

  // Check if within preferred calling hours
  const preferredHours = queueItem.preferredHoursStart && queueItem.preferredHoursEnd
    ? `${queueItem.preferredHoursStart}-${queueItem.preferredHoursEnd}`
    : AI_VOICE_DEFAULTS.preferredHours;
  const timezone = queueItem.timezone || AI_VOICE_DEFAULTS.timezone;

  if (!AiVoiceRateLimitService.isWithinCallingHours(preferredHours, timezone)) {
    console.log(`[AI Voice Queue] Outside preferred calling hours (${preferredHours} ${timezone}). Scheduling for next slot.`);

    // Schedule for next available slot
    const nextSlot = AiVoiceRateLimitService.getNextCallingSlot(preferredHours, timezone);
    await db
      .update(crmAiVoiceQueue)
      .set({
        status: 'scheduled',
        scheduledAt: nextSlot,
        updatedAt: new Date(),
      })
      .where(eq(crmAiVoiceQueue.id, queueItem.id));

    return false;
  }

  // Mark as processing
  await db
    .update(crmAiVoiceQueue)
    .set({
      status: 'processing',
      startedAt: new Date(),
      attemptCount: (queueItem.attemptCount || 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(crmAiVoiceQueue.id, queueItem.id));

  // Get ElevenLabs adapter
  const adapter = getElevenLabsVoiceAdapter();
  if (!adapter) {
    console.error('[AI Voice Queue] ElevenLabs adapter not available');
    await updateQueueItemStatus(queueItem.id, 'failed', 'ElevenLabs adapter not configured');
    return true; // Continue to next item
  }

  try {
    console.log(`[AI Voice Queue] Initiating call to ${queueItem.toNumber} (attempt ${queueItem.attemptCount || 1 + 1}/${queueItem.maxAttempts || 3})`);

    // Initiate the AI voice call
    const result = await adapter.send({
      to: queueItem.toNumber,
      content: '', // AI agent handles conversation
      workspaceId,
      campaignId: queueItem.campaignId || undefined,
      recipientId: queueItem.recipientId || undefined,
      contactId: queueItem.contactId || undefined,
      metadata: {
        leadId: queueItem.leadId || undefined,
        contactId: queueItem.contactId || undefined,
        campaignId: queueItem.campaignId || undefined,
        scriptId: queueItem.aiScriptId || undefined,
      },
    } as any);

    if (result.success) {
      // Update queue item with call reference
      await db
        .update(crmAiVoiceQueue)
        .set({
          aiCallId: result.messageId, // The AI call ID returned from adapter
          updatedAt: new Date(),
        })
        .where(eq(crmAiVoiceQueue.id, queueItem.id));

      // Increment rate limit counter
      await AiVoiceRateLimitService.incrementCounter(workspaceId, 1);

      // Update campaign recipient status if linked
      if (queueItem.recipientId) {
        await db
          .update(crmCampaignRecipients)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(crmCampaignRecipients.id, queueItem.recipientId));
      }

      // Timeline event
      if (queueItem.contactId || queueItem.leadId) {
        await timelineService.create(db, {
          workspaceId,
          entityType: queueItem.contactId ? 'contact' : 'lead',
          entityId: queueItem.contactId || queueItem.leadId!,
          eventType: 'campaign.ai_voice_initiated',
          eventCategory: 'system',
          eventLabel: 'AI Voice Call Initiated',
          summary: `AI voice call initiated to ${queueItem.toNumber}`,
          occurredAt: new Date(),
          actorType: 'system',
          actorId: null,
          actorName: 'AI Voice Queue Worker',
          metadata: {
            queueItemId: queueItem.id,
            aiCallId: result.messageId,
            campaignId: queueItem.campaignId,
            attemptNumber: (queueItem.attemptCount || 0) + 1,
          },
        });
      }

      console.log(`[AI Voice Queue] Call initiated successfully: ${result.messageId}`);

      // Note: Final status (completed/failed) will be updated by webhook
      // For now, keep status as 'processing' until webhook confirms result
    } else {
      throw new Error(result.error || 'Failed to initiate call');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AI Voice Queue] Call failed:`, errorMessage);

    // Check if we should retry
    const currentAttempt = (queueItem.attemptCount || 0) + 1;
    const maxAttempts = queueItem.maxAttempts || AI_VOICE_DEFAULTS.maxAttempts;

    if (currentAttempt < maxAttempts) {
      // Schedule retry
      const retryDelayMs = AI_VOICE_DEFAULTS.retryDelayMinutes * 60 * 1000;
      const nextAttemptAt = new Date(Date.now() + retryDelayMs);

      await db
        .update(crmAiVoiceQueue)
        .set({
          status: 'pending',
          nextAttemptAt,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(crmAiVoiceQueue.id, queueItem.id));

      console.log(`[AI Voice Queue] Scheduled retry for ${nextAttemptAt.toISOString()}`);
    } else {
      // Max retries exceeded
      await updateQueueItemStatus(queueItem.id, 'failed', errorMessage);

      // Update campaign recipient status
      if (queueItem.recipientId) {
        await db
          .update(crmCampaignRecipients)
          .set({
            status: 'failed',
            statusReason: errorMessage,
          })
          .where(eq(crmCampaignRecipients.id, queueItem.recipientId));
      }

      // Timeline event for failure
      if (queueItem.contactId || queueItem.leadId) {
        await timelineService.create(db, {
          workspaceId,
          entityType: queueItem.contactId ? 'contact' : 'lead',
          entityId: queueItem.contactId || queueItem.leadId!,
          eventType: 'campaign.ai_voice_failed',
          eventCategory: 'system',
          eventLabel: 'AI Voice Call Failed',
          summary: `AI voice call to ${queueItem.toNumber} failed after ${maxAttempts} attempts`,
          occurredAt: new Date(),
          actorType: 'system',
          actorId: null,
          actorName: 'AI Voice Queue Worker',
          metadata: {
            queueItemId: queueItem.id,
            campaignId: queueItem.campaignId,
            error: errorMessage,
            totalAttempts: maxAttempts,
          },
        });
      }
    }
  }

  return true; // Processed an item, continue
}

/**
 * Update queue item status
 */
async function updateQueueItemStatus(
  queueItemId: string,
  status: AiVoiceQueueStatus,
  error?: string
): Promise<void> {
  await db
    .update(crmAiVoiceQueue)
    .set({
      status,
      lastError: error,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(crmAiVoiceQueue.id, queueItemId));
}

/**
 * Process the entire queue for a workspace
 */
async function processAiVoiceQueue(job: ProcessAiVoiceQueueJob): Promise<void> {
  const { workspaceId, campaignId } = job;

  console.log(`[AI Voice Queue] Starting queue processing for workspace ${workspaceId}${campaignId ? `, campaign ${campaignId}` : ''}`);

  // Process items sequentially until none remain or rate limited
  let processedCount = 0;
  let continueProcessing = true;

  while (continueProcessing) {
    continueProcessing = await processNextQueueItem(workspaceId, campaignId);
    if (continueProcessing) {
      processedCount++;

      // Small delay between calls to avoid hammering the API
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`[AI Voice Queue] Processed ${processedCount} items for workspace ${workspaceId}`);

  // Check if campaign is complete (all items processed)
  if (campaignId) {
    const pendingItems = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmAiVoiceQueue)
      .where(
        and(
          eq(crmAiVoiceQueue.campaignId, campaignId),
          or(
            eq(crmAiVoiceQueue.status, 'pending'),
            eq(crmAiVoiceQueue.status, 'processing'),
            eq(crmAiVoiceQueue.status, 'scheduled')
          )
        )
      );

    if (pendingItems[0]?.count === 0) {
      // All items processed, mark campaign as completed
      await db
        .update(crmCampaigns)
        .set({
          status: 'completed',
          endedAt: new Date(),
        })
        .where(eq(crmCampaigns.id, campaignId));

      console.log(`[AI Voice Queue] Campaign ${campaignId} completed`);
    }
  }
}

/**
 * Handle call completion webhook (called from webhook handler)
 */
export async function handleAiCallCompletion(
  aiCallId: string,
  outcome: 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed'
): Promise<void> {
  // Find queue item by AI call ID
  const [queueItem] = await db
    .select()
    .from(crmAiVoiceQueue)
    .where(eq(crmAiVoiceQueue.aiCallId, aiCallId))
    .limit(1);

  if (!queueItem) {
    console.warn(`[AI Voice Queue] No queue item found for AI call ${aiCallId}`);
    return;
  }

  // Update queue item
  await db
    .update(crmAiVoiceQueue)
    .set({
      status: 'completed',
      callOutcome: outcome,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(crmAiVoiceQueue.id, queueItem.id));

  // Update campaign recipient status based on outcome
  if (queueItem.recipientId) {
    const recipientStatus = outcome === 'interested' ? 'converted' :
                           outcome === 'callback' ? 'sent' : // Will be retried
                           outcome === 'failed' ? 'failed' : 'sent';

    await db
      .update(crmCampaignRecipients)
      .set({
        status: recipientStatus,
        statusReason: `AI call outcome: ${outcome}`,
      })
      .where(eq(crmCampaignRecipients.id, queueItem.recipientId));
  }

  // Schedule callback if requested
  if (outcome === 'callback') {
    // Re-queue for callback (schedule for next day)
    const nextAttemptAt = new Date();
    nextAttemptAt.setDate(nextAttemptAt.getDate() + 1);

    await db
      .update(crmAiVoiceQueue)
      .set({
        status: 'scheduled',
        scheduledAt: nextAttemptAt,
        callOutcome: null, // Reset for new call
        completedAt: null,
        aiCallId: null,
        attemptCount: 0, // Reset attempts for callback
        updatedAt: new Date(),
      })
      .where(eq(crmAiVoiceQueue.id, queueItem.id));

    console.log(`[AI Voice Queue] Callback scheduled for ${nextAttemptAt.toISOString()}`);
  }

  console.log(`[AI Voice Queue] Call ${aiCallId} completed with outcome: ${outcome}`);
}

/**
 * Register the AI voice queue worker
 */
export async function registerAiVoiceQueueWorker(): Promise<void> {
  await jobQueue.work<ProcessAiVoiceQueueJob>(
    'process-ai-voice-queue',
    {
      teamSize: 1, // Only 1 worker to ensure sequential processing
      teamConcurrency: 1,
    },
    async (job) => {
      await processAiVoiceQueue(job.data);
    }
  );
}
