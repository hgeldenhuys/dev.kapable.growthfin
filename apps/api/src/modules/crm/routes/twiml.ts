/**
 * TwiML Routes
 * Generates TwiML (Twilio Markup Language) responses for voice calls
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { voiceActivityService } from '../services/voice-activity';

export const twimlRoutes = new Elysia({ prefix: '/twiml' })

  /**
   * Voice TwiML endpoint
   *
   * Route: GET /api/v1/crm/twiml/voice
   *
   * Generates TwiML instructions for Twilio voice calls.
   * When a call is initiated, Twilio fetches instructions from this endpoint.
   *
   * Query Parameters:
   * - content: The message to speak using text-to-speech
   * - workspaceId: The workspace ID for tracking
   * - voice: Optional voice type (default: 'Polly.Joanna')
   * - language: Optional language code (default: 'en-US')
   */
  .get('/voice', ({ query, set }) => {
    const { content, workspaceId, voice = 'Polly.Joanna', language = 'en-US' } = query;

    // Validate required parameters
    if (!content) {
      set.status = 400;
      return {
        error: 'Missing required parameter: content',
      };
    }

    // Log TwiML request
    console.log(`[TwiML] Generating voice TwiML`, {
      contentLength: content.length,
      workspaceId,
      voice,
      language,
    });

    // Set content type to XML for TwiML
    set.headers['Content-Type'] = 'text/xml';

    // Generate TwiML response
    // Using Polly voices for better quality: https://www.twilio.com/docs/voice/twiml/say/text-speech#amazon-polly
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${voice}" language="${language}">${escapeXml(content)}</Say>
</Response>`;

    return twiml;
  }, {
    query: t.Object({
      content: t.String({ description: 'Message to speak via text-to-speech' }),
      workspaceId: t.Optional(t.String({ description: 'Workspace ID for tracking' })),
      voice: t.Optional(t.String({ description: 'Voice type (e.g., Polly.Joanna, Polly.Matthew)' })),
      language: t.Optional(t.String({ description: 'Language code (e.g., en-US, es-ES)' })),
    }),
    detail: {
      tags: ['TwiML'],
      summary: 'Generate voice TwiML',
      description: 'Returns TwiML instructions for Twilio voice calls with text-to-speech',
    },
  })

  /**
   * Voice TwiML with gather (for interactive responses)
   *
   * Route: GET /api/v1/crm/twiml/voice/gather
   *
   * Generates TwiML with <Gather> for collecting user input via keypad or speech.
   * Useful for interactive voice response (IVR) systems.
   *
   * Query Parameters:
   * - content: The message to speak
   * - action: Callback URL for gathered input
   * - numDigits: Number of digits to collect (default: 1)
   * - timeout: Timeout in seconds (default: 5)
   */
  .get('/voice/gather', ({ query, set }) => {
    const {
      content,
      action,
      numDigits = '1',
      timeout = '5',
      voice = 'Polly.Joanna',
      language = 'en-US',
    } = query;

    // Validate required parameters
    if (!content || !action) {
      set.status = 400;
      return {
        error: 'Missing required parameters: content and action',
      };
    }

    console.log(`[TwiML] Generating gather TwiML`, {
      contentLength: content.length,
      action,
      numDigits,
      timeout,
    });

    set.headers['Content-Type'] = 'text/xml';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="dtmf speech" action="${escapeXml(action)}" numDigits="${numDigits}" timeout="${timeout}">
        <Say voice="${voice}" language="${language}">${escapeXml(content)}</Say>
    </Gather>
    <Say voice="${voice}" language="${language}">We did not receive any input. Goodbye!</Say>
</Response>`;

    return twiml;
  }, {
    query: t.Object({
      content: t.String({ description: 'Message to speak before gathering input' }),
      action: t.String({ description: 'Callback URL for gathered input' }),
      numDigits: t.Optional(t.String({ description: 'Number of digits to collect (1-30)' })),
      timeout: t.Optional(t.String({ description: 'Timeout in seconds (1-60)' })),
      voice: t.Optional(t.String({ description: 'Voice type' })),
      language: t.Optional(t.String({ description: 'Language code' })),
    }),
    detail: {
      tags: ['TwiML'],
      summary: 'Generate interactive voice TwiML with gather',
      description: 'Returns TwiML with <Gather> for collecting user input via keypad or speech',
    },
  })

  /**
   * Voice TwiML with forward
   *
   * Route: GET /api/v1/crm/twiml/voice/forward
   *
   * Generates TwiML to forward/dial to another number.
   * Useful for call routing and transfer scenarios.
   *
   * Query Parameters:
   * - to: Phone number to forward the call to
   * - content: Optional message to speak before forwarding
   */
  .get('/voice/forward', ({ query, set }) => {
    const { to, content, voice = 'Polly.Joanna', language = 'en-US' } = query;

    // Validate required parameters
    if (!to) {
      set.status = 400;
      return {
        error: 'Missing required parameter: to',
      };
    }

    console.log(`[TwiML] Generating forward TwiML`, {
      to,
      hasMessage: !!content,
    });

    set.headers['Content-Type'] = 'text/xml';

    const sayTag = content
      ? `    <Say voice="${voice}" language="${language}">${escapeXml(content)}</Say>\n`
      : '';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${sayTag}    <Dial>${escapeXml(to)}</Dial>
</Response>`;

    return twiml;
  }, {
    query: t.Object({
      to: t.String({ description: 'Phone number to forward call to (E.164 format)' }),
      content: t.Optional(t.String({ description: 'Optional message to speak before forwarding' })),
      voice: t.Optional(t.String({ description: 'Voice type' })),
      language: t.Optional(t.String({ description: 'Language code' })),
    }),
    detail: {
      tags: ['TwiML'],
      summary: 'Generate call forwarding TwiML',
      description: 'Returns TwiML to forward/dial to another phone number',
    },
  })

  /**
   * Browser Client Voice TwiML (VOICE-001)
   *
   * Route: POST /api/v1/crm/twiml/client-voice
   *
   * This endpoint is called by Twilio when a browser client initiates an outbound call.
   * It receives the call parameters and generates TwiML to dial the destination number.
   *
   * When a TwiML App receives a call from a browser client (via Twilio Device),
   * it POSTs to this endpoint with call parameters including:
   * - To: Destination phone number
   * - From: Twilio phone number to use as caller ID
   * - CallSid: Unique identifier for this call
   * - Custom parameters passed from browser (WorkspaceId, LeadId, ContactId, UserId)
   */
  .post('/client-voice', async ({ body, set }) => {
    // Extract parameters from Twilio's POST body
    // Twilio sends form data, but Elysia parses it as body
    const {
      To: to,
      From: from,
      CallSid: callSid,
      // Custom parameters passed from browser via device.connect()
      // Note: Browser client sends these with capital letters (WorkspaceId, LeadId, etc.)
      WorkspaceId: workspaceId,
      LeadId: leadId,
      ContactId: contactId,
      UserId: userId,
    } = body as Record<string, string>;

    // Validate destination number
    if (!to) {
      console.error('[TwiML/client-voice] Missing destination number (To)');
      set.status = 400;
      set.headers['Content-Type'] = 'text/xml';
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Error: No destination number provided.</Say>
</Response>`;
    }

    // Use configured Twilio number if From is not a valid phone number
    // When browser clients call, Twilio sets From to the client identity (e.g., "client:agent_xxx")
    // which is not valid as a caller ID for outbound phone calls
    const isValidPhoneNumber = from && from.startsWith('+');
    const callerId = isValidPhoneNumber ? from : process.env.TWILIO_PHONE_NUMBER;

    if (!callerId) {
      console.error('[TwiML/client-voice] No caller ID available');
      set.status = 500;
      set.headers['Content-Type'] = 'text/xml';
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Error: No caller ID configured.</Say>
</Response>`;
    }

    // Build status callback URL for call progress tracking
    // Note: The webhook path is 'twilio-voice' to match the TwilioVoiceAdapter.getWebhookPath()
    // Supports both leadId and contactId (one or the other)
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const statusCallbackParams = new URLSearchParams({
      ...(workspaceId && { workspaceId }),
      ...(leadId && { leadId }),
      ...(contactId && { contactId }),
      ...(userId && { userId }),
    });
    const statusCallbackUrl = `${baseUrl}/api/v1/crm/webhooks/twilio-voice?${statusCallbackParams.toString()}`;

    // Build recording callback URL for recording completion
    // H.4 - Call Recording & Transcription
    const recordingCallbackUrl = `${baseUrl}/api/v1/crm/webhooks/twilio-voice/recording?${statusCallbackParams.toString()}`;

    console.log(`[TwiML/client-voice] Browser call initiated`, {
      callSid,
      to,
      callerId,
      workspaceId,
      leadId,
      contactId,
      userId,
      statusCallbackUrl,
    });

    // Create activity record for this call
    // This must happen before returning TwiML so webhooks can update the activity
    if (workspaceId && callSid && (leadId || contactId) && userId) {
      try {
        const activity = await voiceActivityService.createCallActivity(db, {
          workspaceId,
          leadId: leadId || undefined,
          contactId: contactId || undefined,
          userId,
          callSid,
          phoneNumber: to,
          direction: 'outbound',
        });
        console.log(`[TwiML/client-voice] Created call activity`, {
          activityId: activity.id,
          callSid,
          entityType: leadId ? 'lead' : 'contact',
        });
      } catch (error) {
        // Log error but still return TwiML so the call can proceed
        console.error(`[TwiML/client-voice] Failed to create activity`, {
          callSid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      console.warn(`[TwiML/client-voice] Missing params for activity creation`, {
        workspaceId: !!workspaceId,
        callSid: !!callSid,
        leadId: !!leadId,
        contactId: !!contactId,
        userId: !!userId,
      });
    }

    // Set content type to XML
    set.headers['Content-Type'] = 'text/xml';

    // Generate TwiML to dial the destination number
    // The <Dial> verb connects the browser caller to the destination
    // statusCallback tracks call progress (ringing, answered, completed)
    // H.4 - Call Recording: record="record-from-answer" starts recording when call is answered
    // recordingStatusCallback receives notification when recording is complete
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="${escapeXml(callerId)}"
          record="record-from-answer"
          recordingStatusCallback="${escapeXml(recordingCallbackUrl)}"
          recordingStatusCallbackEvent="completed">
        <Number statusCallback="${escapeXml(statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed">${escapeXml(to)}</Number>
    </Dial>
</Response>`;

    return twiml;
  }, {
    // Twilio sends form-encoded data, but we'll accept any body format
    // Elysia's body parser handles both JSON and form data
    body: t.Any(),
    detail: {
      tags: ['TwiML'],
      summary: 'Handle browser-initiated outbound calls',
      description: `
Called by Twilio when a browser client initiates an outbound call via the TwiML Application.

**Flow:**
1. Browser calls device.connect({ To: '+1234567890', workspaceId: '...', leadId: '...' })
2. Twilio fetches TwiML from this endpoint
3. This endpoint returns <Dial><Number>...</Number></Dial> TwiML
4. Twilio connects the browser to the destination number

**Parameters (sent by Twilio as form data):**
- To: Destination phone number (E.164 format)
- From: Caller ID (defaults to TWILIO_PHONE_NUMBER)
- CallSid: Unique call identifier
- workspaceId, leadId, userId: Custom tracking parameters

**Status Callbacks:**
The returned TwiML includes statusCallback to track call progress at /api/v1/crm/webhooks/voice
      `,
    },
  })

  /**
   * TwiML health check
   */
  .get('/health', () => {
    return {
      status: 'ok',
      endpoints: [
        '/voice',
        '/voice/gather',
        '/voice/forward',
        '/client-voice',
      ],
    };
  }, {
    detail: {
      tags: ['TwiML'],
      summary: 'TwiML health check',
      description: 'Returns status of TwiML endpoints',
    },
  });

/**
 * Escape XML special characters
 * Prevents XML injection and ensures valid TwiML
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
