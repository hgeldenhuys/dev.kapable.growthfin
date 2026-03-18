/**
 * Voice Activity Service (VOICE-001)
 * Activity logging for browser-initiated WebRTC calls
 *
 * This service handles creating and updating activity records for calls
 * initiated from the browser using Twilio Voice SDK. It integrates with
 * the existing CRM activity system and timeline.
 */

import type { Database } from '@agios/db';
import { crmActivities, crmLeads, crmContacts } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';

/**
 * Parameters for creating a call activity when a browser call is initiated
 * Supports either leadId OR contactId (exactly one must be provided)
 */
export interface CreateCallActivityParams {
  workspaceId: string;
  /** Lead ID - provide either leadId OR contactId, not both */
  leadId?: string;
  /** Contact ID - provide either leadId OR contactId, not both */
  contactId?: string;
  userId: string;
  callSid: string;
  phoneNumber: string;
  direction?: 'inbound' | 'outbound';
}

/**
 * Parameters for updating a call activity with call outcome
 */
export interface UpdateCallActivityParams {
  duration?: number; // in seconds
  status?: 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled';
  disposition?: string;
  outcome?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Voice Activity Service
 * Handles CRM activity tracking for browser-based WebRTC calls
 */
export const voiceActivityService = {
  /**
   * Create a call activity when a browser call is initiated
   *
   * Called when the browser starts a call via Twilio Device.
   * Creates an activity in "planned" status that will be updated
   * when the call ends via status callback webhooks.
   *
   * Supports both leads and contacts - exactly one must be provided.
   *
   * @param db - Database instance
   * @param params - Call initiation parameters
   * @returns Created activity record
   */
  async createCallActivity(db: Database, params: CreateCallActivityParams) {
    const { workspaceId, leadId, contactId, userId, callSid, phoneNumber, direction = 'outbound' } = params;

    // Validate exactly one of leadId or contactId is provided
    if (!leadId && !contactId) {
      throw new Error('Either leadId or contactId is required');
    }

    // Lead takes precedence if somehow both are provided
    const isLeadCall = !!leadId;

    if (isLeadCall) {
      // Validate lead exists and is in this workspace
      const [lead] = await db
        .select()
        .from(crmLeads)
        .where(
          and(
            eq(crmLeads.id, leadId!),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        )
        .limit(1);

      if (!lead) {
        throw new Error('LEAD_NOT_FOUND');
      }
    } else {
      // Validate contact exists and is in this workspace
      const [contact] = await db
        .select()
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.id, contactId!),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        )
        .limit(1);

      if (!contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }
    }

    // Create activity with status "planned" (will be updated to "completed" or "cancelled" when call ends)
    // Note: CRM schema only has planned/completed/cancelled - planned represents "in progress" for calls
    const [activity] = await db
      .insert(crmActivities)
      .values({
        workspaceId,
        leadId: isLeadCall ? leadId : undefined,
        contactId: isLeadCall ? undefined : contactId,
        type: 'call',
        direction,
        channel: 'call',
        subject: `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${phoneNumber}`,
        description: `Browser-initiated call via Twilio Voice SDK`,
        status: 'planned',
        assigneeId: userId,
        createdBy: userId,
        updatedBy: userId,
        // Store call SID in channelMetadata for correlation with webhooks
        channelMessageId: callSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid,
          phoneNumber,
          provider: 'twilio',
          source: 'browser',
          initiatedAt: new Date().toISOString(),
          // Store entity info for webhook processing
          entityType: isLeadCall ? 'lead' : 'contact',
          entityId: isLeadCall ? leadId : contactId,
        },
      })
      .returning();

    // Create timeline event for call initiation
    await timelineService.create(db, {
      workspaceId,
      entityType: isLeadCall ? 'lead' : 'contact',
      entityId: (isLeadCall ? leadId : contactId)!,
      eventType: 'activity.call_initiated',
      eventCategory: 'communication',
      eventLabel: 'Call Started',
      summary: `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call initiated to ${phoneNumber}`,
      occurredAt: new Date(),
      actorType: 'user',
      actorId: userId,
      metadata: {
        activityId: activity.id,
        callSid,
        phoneNumber,
        source: 'browser',
      },
    });

    console.log(`[voice-activity] Created call activity`, {
      activityId: activity.id,
      callSid,
      leadId,
      contactId,
      entityType: isLeadCall ? 'lead' : 'contact',
      workspaceId,
    });

    return activity;
  },

  /**
   * Update a call activity when call status changes
   *
   * Called from webhook handlers when Twilio sends status callbacks.
   * Updates the activity with duration, outcome, and final status.
   *
   * @param db - Database instance
   * @param callSid - Twilio Call SID to identify the activity
   * @param updates - Fields to update
   * @returns Updated activity record or null if not found
   */
  async updateCallActivity(db: Database, callSid: string, updates: UpdateCallActivityParams) {
    // Find activity by callSid stored in channelMessageId
    const [existingActivity] = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.channelMessageId, callSid),
          isNull(crmActivities.deletedAt)
        )
      )
      .limit(1);

    if (!existingActivity) {
      console.warn(`[voice-activity] Activity not found for callSid: ${callSid}`);
      return null;
    }

    // Map call status to activity status
    let activityStatus: 'completed' | 'cancelled' | 'planned' = 'planned';
    let channelStatus = updates.status || 'unknown';

    switch (updates.status) {
      case 'completed':
        activityStatus = 'completed';
        break;
      case 'no-answer':
      case 'busy':
      case 'failed':
      case 'canceled':
        activityStatus = 'cancelled';
        break;
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      channelStatus,
    };

    if (activityStatus !== 'planned') {
      updateData.status = activityStatus;
    }

    if (updates.duration !== undefined) {
      // Convert seconds to minutes for the duration field
      updateData.duration = Math.ceil(updates.duration / 60);
      // Store raw seconds in metadata
      updateData.channelMetadata = {
        ...(existingActivity.channelMetadata as Record<string, any>),
        durationSeconds: updates.duration,
        completedAt: new Date().toISOString(),
      };
    }

    if (updates.disposition) {
      updateData.disposition = updates.disposition;
    }

    if (updates.outcome) {
      updateData.outcome = updates.outcome;
    }

    if (updates.errorCode || updates.errorMessage) {
      updateData.channelErrorCode = updates.errorCode;
      updateData.channelMetadata = {
        ...(existingActivity.channelMetadata as Record<string, any>),
        ...(updateData.channelMetadata || {}),
        errorCode: updates.errorCode,
        errorMessage: updates.errorMessage,
      };
    }

    // Set completedDate when call ends
    if (activityStatus === 'completed' || activityStatus === 'cancelled') {
      updateData.completedDate = new Date();
    }

    // Update the activity
    const [updated] = await db
      .update(crmActivities)
      .set(updateData)
      .where(eq(crmActivities.id, existingActivity.id))
      .returning();

    // Determine entity type from activity (lead or contact)
    const isLeadActivity = !!existingActivity.leadId;
    const entityId = existingActivity.leadId || existingActivity.contactId;

    // Create timeline event for call completion
    if (activityStatus !== 'planned' && entityId) {
      const eventLabel =
        activityStatus === 'completed'
          ? 'Call Completed'
          : updates.status === 'no-answer'
            ? 'No Answer'
            : updates.status === 'busy'
              ? 'Line Busy'
              : updates.status === 'failed'
                ? 'Call Failed'
                : 'Call Cancelled';

      await timelineService.create(db, {
        workspaceId: existingActivity.workspaceId,
        entityType: isLeadActivity ? 'lead' : 'contact',
        entityId,
        eventType: `activity.call_${updates.status?.replace('-', '_') || 'ended'}`,
        eventCategory: 'communication',
        eventLabel,
        summary: `Call ${updates.status || 'ended'}${updates.duration ? ` (${Math.ceil(updates.duration / 60)} min)` : ''}`,
        occurredAt: new Date(),
        actorType: 'system',
        communication: {
          channel: 'call',
          disposition: updates.disposition,
          outcome: updates.outcome,
          duration: updates.duration ? Math.ceil(updates.duration / 60) : undefined,
        },
        metadata: {
          activityId: existingActivity.id,
          callSid,
          status: updates.status,
          durationSeconds: updates.duration,
        },
      });
    }

    // Update lead's last contact date on call completion
    if (activityStatus === 'completed' && existingActivity.leadId) {
      await db
        .update(crmLeads)
        .set({
          lastContactDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(crmLeads.id, existingActivity.leadId));
    }

    // Update contact's updatedAt on call completion (contacts don't have lastContactDate)
    if (activityStatus === 'completed' && existingActivity.contactId) {
      await db
        .update(crmContacts)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, existingActivity.contactId));
    }

    console.log(`[voice-activity] Updated call activity`, {
      activityId: existingActivity.id,
      callSid,
      status: updates.status,
      duration: updates.duration,
    });

    return updated;
  },

  /**
   * Update call activity with recording metadata (H.4 - Call Recording)
   *
   * Called when Twilio sends a recording completion callback.
   * Stores recording URL and metadata, marks transcription as pending.
   *
   * @param db - Database instance
   * @param callSid - Twilio Call SID to identify the activity
   * @param recording - Recording metadata from Twilio
   * @returns Updated activity record or null if not found
   */
  async updateCallRecording(
    db: Database,
    callSid: string,
    recording: {
      recordingSid: string;
      recordingUrl: string;
      recordingDuration: number;
    }
  ) {
    // Find activity by callSid stored in channelMessageId
    const [existingActivity] = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.channelMessageId, callSid),
          isNull(crmActivities.deletedAt)
        )
      )
      .limit(1);

    if (!existingActivity) {
      console.warn(`[voice-activity] Activity not found for callSid: ${callSid} (recording update)`);
      return null;
    }

    const existingMetadata = (existingActivity.channelMetadata as Record<string, any>) || {};

    // Update activity with recording metadata
    const [updated] = await db
      .update(crmActivities)
      .set({
        updatedAt: new Date(),
        channelMetadata: {
          ...existingMetadata,
          recording: {
            sid: recording.recordingSid,
            url: recording.recordingUrl,
            duration: recording.recordingDuration,
            status: 'available',
            recordedAt: new Date().toISOString(),
          },
          transcription: {
            status: 'pending',
          },
        },
      })
      .where(eq(crmActivities.id, existingActivity.id))
      .returning();

    console.log(`[voice-activity] Updated call recording`, {
      activityId: existingActivity.id,
      callSid,
      recordingSid: recording.recordingSid,
      duration: recording.recordingDuration,
    });

    return updated;
  },

  /**
   * Update call activity with transcription data (H.4 - Call Transcription)
   *
   * Called when transcription worker completes ElevenLabs processing.
   *
   * @param db - Database instance
   * @param callSid - Twilio Call SID to identify the activity
   * @param transcription - Transcription data from ElevenLabs
   * @returns Updated activity record or null if not found
   */
  async updateCallTranscription(
    db: Database,
    callSid: string,
    transcription: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      text?: string;
      language?: string;
      languageConfidence?: number;
      speakers?: Array<{
        speakerId: string;
        segments: Array<{ start: number; end: number; text: string }>;
      }>;
      words?: Array<{
        text: string;
        start: number;
        end: number;
        speakerId?: string;
        confidence?: number;
      }>;
      provider?: string;
      model?: string;
      error?: string;
    }
  ) {
    // Find activity by callSid stored in channelMessageId
    const [existingActivity] = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.channelMessageId, callSid),
          isNull(crmActivities.deletedAt)
        )
      )
      .limit(1);

    if (!existingActivity) {
      console.warn(`[voice-activity] Activity not found for callSid: ${callSid} (transcription update)`);
      return null;
    }

    const existingMetadata = (existingActivity.channelMetadata as Record<string, any>) || {};
    const existingTranscription = existingMetadata.transcription || {};

    // Determine final status
    const finalStatus = transcription.error ? 'failed' : transcription.text ? 'completed' : transcription.status || 'processing';

    // Update activity with transcription data
    const [updated] = await db
      .update(crmActivities)
      .set({
        updatedAt: new Date(),
        channelMetadata: {
          ...existingMetadata,
          transcription: {
            ...existingTranscription,
            ...transcription,
            status: finalStatus,
            processedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(crmActivities.id, existingActivity.id))
      .returning();

    console.log(`[voice-activity] Updated call transcription`, {
      activityId: existingActivity.id,
      callSid,
      status: finalStatus,
      hasText: !!transcription.text,
      speakerCount: transcription.speakers?.length || 0,
    });

    return updated;
  },

  /**
   * Get activity by call SID
   *
   * Useful for checking if an activity exists for a given call.
   *
   * @param db - Database instance
   * @param callSid - Twilio Call SID
   * @returns Activity record or null
   */
  async getByCallSid(db: Database, callSid: string) {
    const [activity] = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.channelMessageId, callSid),
          isNull(crmActivities.deletedAt)
        )
      )
      .limit(1);

    return activity || null;
  },

  /**
   * Update call activity with disposition
   *
   * Called when agent logs a disposition after the call.
   * This can be called separately from updateCallActivity for manual disposition entry.
   *
   * @param db - Database instance
   * @param activityId - Activity ID
   * @param userId - User logging the disposition
   * @param disposition - Call disposition code
   * @param notes - Optional notes
   * @returns Updated activity
   */
  async logDisposition(
    db: Database,
    activityId: string,
    userId: string,
    disposition: string,
    notes?: string
  ) {
    const [updated] = await db
      .update(crmActivities)
      .set({
        disposition,
        outcome: notes,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(crmActivities.id, activityId),
          isNull(crmActivities.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('ACTIVITY_NOT_FOUND');
    }

    // Determine entity type from activity (lead or contact)
    const isLeadActivity = !!updated.leadId;
    const entityId = updated.leadId || updated.contactId;

    // Create timeline event
    if (entityId) {
      await timelineService.create(db, {
        workspaceId: updated.workspaceId,
        entityType: isLeadActivity ? 'lead' : 'contact',
        entityId,
        eventType: 'activity.disposition_logged',
        eventCategory: 'communication',
        eventLabel: `Disposition: ${disposition}`,
        summary: `Call disposition logged: ${disposition}`,
        description: notes,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
        metadata: {
          activityId: updated.id,
          disposition,
        },
      });
    }

    return updated;
  },
};
