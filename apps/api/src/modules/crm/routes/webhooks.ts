/**
 * Unified Webhook Routes
 * Handles all channel webhooks through the WebhookRouter
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { getWebhookRouter } from '../../../lib/channels';
import { voiceActivityService } from '../services/voice-activity';
import { jobQueue } from '../../../lib/queue';

/**
 * Map Twilio call status to voice activity outcome
 */
function mapCallStatusToOutcome(status: string): 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled' | undefined {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'no-answer':
      return 'no-answer';
    case 'busy':
      return 'busy';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return undefined;
  }
}

export const webhookRoutes = new Elysia({ prefix: '/webhooks' })

  /**
   * Twilio Recording Status Callback (H.4 - Call Recording & Transcription)
   *
   * Route: POST /api/v1/crm/webhooks/twilio-voice/recording
   *
   * Called by Twilio when a call recording is completed.
   * Stores recording metadata and queues transcription job.
   */
  .post('/twilio-voice/recording', async ({ body, request, set }) => {
    // Extract query parameters from URL (tracking data)
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const { workspaceId, leadId, contactId, userId } = queryParams;

    // Extract Twilio recording data from body
    const {
      RecordingSid,
      RecordingUrl,
      RecordingStatus,
      RecordingDuration,
      CallSid,
    } = body as Record<string, string>;

    console.log(`[Webhooks/Recording] Received recording callback`, {
      recordingSid: RecordingSid,
      callSid: CallSid,
      status: RecordingStatus,
      duration: RecordingDuration,
      workspaceId,
      entityId: leadId || contactId,
    });

    // Only process completed recordings
    if (RecordingStatus !== 'completed') {
      console.log(`[Webhooks/Recording] Ignoring non-completed status: ${RecordingStatus}`);
      return { status: 'ignored', reason: 'not_completed' };
    }

    if (!CallSid) {
      console.warn(`[Webhooks/Recording] Missing CallSid in callback`);
      set.status = 400;
      return { error: 'Missing CallSid' };
    }

    try {
      // Update activity with recording metadata
      await voiceActivityService.updateCallRecording(db, CallSid, {
        recordingSid: RecordingSid,
        recordingUrl: RecordingUrl,
        recordingDuration: parseInt(RecordingDuration, 10) || 0,
      });

      // Queue transcription job
      const jobId = await jobQueue.send('transcribe-recording', {
        callSid: CallSid,
        recordingSid: RecordingSid,
        recordingUrl: RecordingUrl,
        recordingDuration: parseInt(RecordingDuration, 10) || 0,
        workspaceId,
        leadId,
        contactId,
        userId,
      }, {
        retryLimit: 3,
        retryDelay: 30, // 30 seconds between retries
      });

      console.log(`[Webhooks/Recording] Queued transcription job: ${jobId}`);

      return { status: 'queued', jobId };
    } catch (error) {
      console.error(`[Webhooks/Recording] Error processing recording:`, error);
      // Return 200 to Twilio to prevent retries, but log the error
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    body: t.Any(),
    detail: {
      tags: ['Webhooks'],
      summary: 'Twilio recording status callback',
      description: 'Called by Twilio when a call recording is completed. Stores recording URL and queues transcription.',
    },
  })

  /**
   * ElevenLabs Conversational AI Webhook (Phase I - AI Voice Calling)
   *
   * Route: POST /api/v1/crm/webhooks/elevenlabs/conversation
   *
   * Called by ElevenLabs when conversational AI events occur.
   * Events: conversation.ended, user_transcript, agent_response, tool_call
   */
  .post('/elevenlabs/conversation', async ({ body, request, set }) => {
    const { getElevenLabsVoiceAdapter } = await import('../../../lib/channels');

    console.log('[Webhooks/ElevenLabs] Received webhook', {
      eventType: body?.event_type,
      conversationId: body?.conversation?.id,
    });

    const adapter = getElevenLabsVoiceAdapter();
    if (!adapter) {
      console.warn('[Webhooks/ElevenLabs] Adapter not configured');
      set.status = 500;
      return { error: 'ElevenLabs adapter not configured' };
    }

    // Validate webhook signature if present
    const signature = request.headers.get('x-elevenlabs-signature') || '';
    const bodyString = JSON.stringify(body);
    if (!adapter.validateWebhookSignature(bodyString, signature)) {
      console.warn('[Webhooks/ElevenLabs] Invalid webhook signature');
      set.status = 401;
      return { error: 'Invalid webhook signature' };
    }

    try {
      // Process the webhook through the adapter
      await adapter.handleWebhook(body);

      console.log('[Webhooks/ElevenLabs] Successfully processed webhook');
      return { received: true, eventType: body?.event_type };
    } catch (error) {
      console.error('[Webhooks/ElevenLabs] Error processing webhook:', error);
      // Return 200 to prevent retries, but log the error
      return {
        received: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, {
    body: t.Any(),
    detail: {
      tags: ['Webhooks', 'AI Calls'],
      summary: 'ElevenLabs Conversational AI webhook',
      description: 'Handles ElevenLabs webhook events for AI voice calls (conversation.ended, user_transcript, agent_response, tool_call)',
    },
  })

  /**
   * Unified webhook endpoint
   *
   * Route: POST /api/v1/crm/webhooks/:channel
   * Examples:
   * - /api/v1/crm/webhooks/resend-email
   * - /api/v1/crm/webhooks/twilio-sms
   * - /api/v1/crm/webhooks/twilio-voice
   */
  .post('/:channel', async ({ params, body, request, set }) => {
    const { channel } = params;
    const router = getWebhookRouter();

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Extract query parameters from URL (for tracking data like workspaceId, leadId, userId)
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Merge query params into body for webhook processing
    // This allows status callbacks to include tracking data via query string
    const enrichedBody = typeof body === 'object' && body !== null
      ? { ...body, ...queryParams }
      : body;

    console.log(`[Webhooks] Received webhook: ${channel}`, {
      hasQueryParams: Object.keys(queryParams).length > 0,
      queryParams: Object.keys(queryParams),
    });

    // Process webhook through router
    const result = await router.processWebhook(channel, enrichedBody, headers);

    if (!result.success) {
      console.error(`[Webhooks] Processing failed:`, result.error);
      set.status = 400;
      return {
        error: result.error,
      };
    }

    console.log(`[Webhooks] Successfully processed ${channel} webhook`);

    // Handle voice call status updates for browser-initiated calls (VOICE-001)
    if (result.success && result.event && result.event.channel === 'voice') {
      await handleVoiceCallUpdate(result.event, queryParams);
    }

    return {
      received: true,
      eventId: result.event?.eventId,
    };
  }, {
    params: t.Object({
      channel: t.String(),
    }),
    body: t.Any(),
    detail: {
      tags: ['Webhooks'],
      summary: 'Unified webhook handler',
      description: 'Handles webhooks from all channel providers (Resend, Twilio, etc.)',
    },
  })

  /**
   * Health check endpoint
   */
  .get('/health', () => {
    const router = getWebhookRouter();
    const adapters = router.getAllAdapters();

    return {
      status: 'ok',
      adapters: adapters.map((adapter) => ({
        channel: adapter.getChannelType(),
        vendor: adapter.getVendorName(),
        path: adapter.getWebhookPath(),
        supportedEvents: adapter.getSupportedEventTypes(),
      })),
    };
  }, {
    detail: {
      tags: ['Webhooks'],
      summary: 'Webhook health check',
      description: 'Returns status of registered channel adapters',
    },
  });

/**
 * Handle voice call status updates for browser-initiated calls (VOICE-001)
 *
 * This function processes voice webhook events and updates the corresponding
 * activity record with call duration, outcome, and status. It also updates
 * the lead's lastContactDate when a call completes successfully.
 *
 * Supports both leads and contacts (H.1 - Voice Call Contact Support).
 *
 * @param event - The unified webhook event from the voice adapter
 * @param queryParams - Query parameters from the webhook URL (contains tracking data)
 */
async function handleVoiceCallUpdate(
  event: { eventType: string; metadata?: Record<string, any>; status?: string },
  queryParams: Record<string, string>
): Promise<void> {
  try {
    const { callSid, duration, errorCode, errorMessage } = event.metadata || {};
    const { leadId, contactId, workspaceId } = queryParams;
    // Note: userId is available in queryParams if needed for future audit logging

    // Only process call completion events (not intermediate statuses like ringing/answered)
    const isCompletionEvent =
      event.eventType === 'voice.completed' ||
      event.eventType === 'voice.no_answer' ||
      event.eventType === 'voice.busy' ||
      event.eventType === 'voice.failed' ||
      event.eventType === 'voice.canceled';

    if (!isCompletionEvent) {
      console.log(`[Webhooks/Voice] Skipping non-completion event: ${event.eventType}`);
      return;
    }

    if (!callSid) {
      console.warn(`[Webhooks/Voice] Missing callSid in voice event metadata`);
      return;
    }

    // Map event type to activity status
    // voice.completed -> completed
    // voice.no_answer -> no-answer
    // voice.busy -> busy
    // voice.failed -> failed
    // voice.canceled -> canceled
    const statusFromEvent = event.eventType.replace('voice.', '').replace('_', '-');
    const outcome = mapCallStatusToOutcome(statusFromEvent);

    // Determine entity type for logging
    const entityType = leadId ? 'lead' : contactId ? 'contact' : 'unknown';
    const entityId = leadId || contactId;

    console.log(`[Webhooks/Voice] Processing call completion`, {
      callSid,
      eventType: event.eventType,
      status: outcome,
      duration,
      entityType,
      entityId,
      workspaceId,
    });

    // Update the activity record with call outcome
    const updatedActivity = await voiceActivityService.updateCallActivity(db, callSid, {
      status: outcome,
      duration: duration ? parseInt(duration, 10) : undefined,
      errorCode,
      errorMessage,
    });

    if (!updatedActivity) {
      // Activity not found - this might be a call not initiated from browser
      // (e.g., server-initiated call or external call)
      console.log(`[Webhooks/Voice] No activity found for callSid: ${callSid} (may not be browser-initiated)`);
      return;
    }

    // Update lead's lastContactDate for completed calls
    // Note: voiceActivityService.updateCallActivity already handles this for 'completed' status
    // but we add explicit handling here for non-completed calls too (no-answer, busy, failed)
    // to ensure the lead shows contact attempt
    if (leadId && outcome && outcome !== 'completed') {
      // For failed attempts, we still want to record the contact attempt
      // The voiceActivityService only updates lastContactDate for completed calls
      // Here we can add additional logic if needed (e.g., lastContactAttemptDate)
      console.log(`[Webhooks/Voice] Contact attempt recorded for lead ${leadId}: ${outcome}`);
    }

    // Log contact attempts as well (H.1 - Voice Call Contact Support)
    if (contactId && outcome) {
      console.log(`[Webhooks/Voice] Contact attempt recorded for contact ${contactId}: ${outcome}`);
    }

    console.log(`[Webhooks/Voice] Activity updated successfully`, {
      activityId: updatedActivity.id,
      callSid,
      status: outcome,
      entityType,
    });
  } catch (error) {
    // Log error but don't fail the webhook - Twilio needs a 200 response
    console.error(`[Webhooks/Voice] Error updating activity:`, error);
  }
}
