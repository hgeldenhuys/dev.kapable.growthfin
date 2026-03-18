/**
 * ElevenLabs Voice Adapter
 * Integrates ElevenLabs conversational AI for voice calling
 * Phase I: AI Voice Calling (ElevenLabs Conversational AI)
 */

import { BaseChannelAdapter } from '../base-adapter';
import type { OutboundMessage, SendResult, UnifiedWebhookEvent } from '../types';
import { db } from '@agios/db';
import { crmCalls, crmAiCalls, crmAiCallEvents } from '@agios/db/schema';
import { resolveOutboundNumber } from '../../utils/phone-validation';
import { aiCallContextService, buildSystemPrompt, buildFirstMessage, type AiCallFullContext } from '../../../modules/crm/services/ai-call-context';
import { eq } from 'drizzle-orm';

// Singleton instance for adapter reuse
let elevenLabsVoiceAdapterInstance: ElevenLabsVoiceAdapter | null = null;

/**
 * Get the singleton ElevenLabs Voice adapter instance
 * Returns null if ElevenLabs is not configured
 */
export function getElevenLabsVoiceAdapter(): ElevenLabsVoiceAdapter | null {
  if (!elevenLabsVoiceAdapterInstance) {
    if (!process.env['ELEVENLABS_API_KEY'] || !process.env['ELEVENLABS_AGENT_ID'] || !process.env['ELEVENLABS_PHONE_NUMBER_ID']) {
      console.warn('[ElevenLabs] Missing configuration - adapter not available');
      return null;
    }
    elevenLabsVoiceAdapterInstance = new ElevenLabsVoiceAdapter();
  }
  return elevenLabsVoiceAdapterInstance;
}

/**
 * Extended OutboundMessage with metadata for AI voice calls
 */
interface AiVoiceOutboundMessage extends OutboundMessage {
  metadata?: {
    leadId?: string;
    contactId?: string;
    campaignId?: string;
    contactName?: string;
    customPrompt?: string;
    scriptId?: string; // Script to use for the call
  };
}

export class ElevenLabsVoiceAdapter extends BaseChannelAdapter {
  private apiKey: string;
  private agentId: string;
  private phoneNumberId: string;

  constructor() {
    super('ai_voice', 'elevenlabs');

    this.apiKey = process.env['ELEVENLABS_API_KEY'] || '';
    this.agentId = process.env['ELEVENLABS_AGENT_ID'] || '';
    this.phoneNumberId = process.env['ELEVENLABS_PHONE_NUMBER_ID'] || '';

    if (!this.apiKey) {
      console.warn('[ElevenLabs] Missing API key - adapter will not function');
    }
  }

  /**
   * Get supported event types for AI voice calls
   */
  getSupportedEventTypes(): string[] {
    return [
      'ai_voice.initiated',
      'ai_voice.ringing',
      'ai_voice.answered',
      'ai_voice.completed',
      'ai_voice.no_answer',
      'ai_voice.failed',
      'ai_voice.transcript_available',
      // Phase L: Inbound call events
      'ai_voice.inbound_received',
      'ai_voice.inbound_identified',
      'ai_voice.inbound_completed',
    ];
  }

  /**
   * Send an outbound message (initiate an AI voice call)
   * This overrides the base send() method for AI voice-specific logic
   */
  override async send(message: OutboundMessage): Promise<SendResult> {
    try {
      if (!this.apiKey || !this.agentId || !this.phoneNumberId) {
        return {
          success: false,
          messageId: '',
          channel: 'ai_voice',
          error: 'ElevenLabs configuration missing (API key, agent ID, or phone number ID)',
        };
      }

      console.log(`[ElevenLabs] Initiating AI call to ${message.to}`);

      // Cast to extended type to access metadata
      const aiMessage = message as AiVoiceOutboundMessage;

      // Build full context for AI call (script + contact history)
      let fullContext: AiCallFullContext | null = null;
      let systemPrompt: string | undefined;
      let firstMessage: string | undefined;

      try {
        fullContext = await aiCallContextService.getFullContext(db, {
          workspaceId: message.workspaceId,
          leadId: aiMessage.metadata?.leadId,
          contactId: aiMessage.metadata?.contactId,
          scriptId: aiMessage.metadata?.scriptId,
        });

        if (fullContext) {
          systemPrompt = buildSystemPrompt(fullContext);
          firstMessage = buildFirstMessage(fullContext);
          console.log(`[ElevenLabs] Using script: ${fullContext.script.name}`);
          console.log(`[ElevenLabs] Contact: ${fullContext.contact.fullName}`);
        }
      } catch (contextError) {
        console.warn('[ElevenLabs] Failed to build context, using defaults:', contextError);
      }

      // Initiate call via ElevenLabs Twilio integration
      const response = await fetch(
        'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: this.agentId,
            agent_phone_number_id: this.phoneNumberId,
            to_number: message.to,
            // Webhook URL for conversation events (transcripts, completion, etc.)
            webhook_url: process.env['ELEVENLABS_WEBHOOK_URL'] || 'https://api.newleads.co.za/api/v1/crm/webhooks/elevenlabs/conversation',
            // Configure conversation behavior with full context
            // See: https://elevenlabs.io/docs/agents-platform/customization/personalization/twilio-personalization
            conversation_initiation_client_data: {
              // Dynamic variables that the agent can use in prompts
              // Must match variables defined in agent configuration
              dynamic_variables: {
                contact_name: fullContext?.contact.firstName || aiMessage.metadata?.contactName || 'there',
                full_name: fullContext?.contact.fullName || aiMessage.metadata?.contactName || 'there',
                company_name: fullContext?.companyContext.name || 'GrowthFin',
                lead_id: aiMessage.metadata?.leadId,
                contact_id: aiMessage.metadata?.contactId,
                campaign_id: aiMessage.metadata?.campaignId,
                // Pass context summary for variables
                contact_company: fullContext?.contact.companyName || '',
                contact_title: fullContext?.contact.title || '',
                previous_calls: fullContext?.contact.previousCalls?.toString() || '0',
                previous_emails: fullContext?.contact.previousEmails?.toString() || '0',
              },
              // Override agent configuration for this conversation
              conversation_config_override: {
                agent: {
                  // Use script's system prompt or custom prompt
                  prompt: systemPrompt || aiMessage.metadata?.customPrompt ? {
                    prompt: systemPrompt || aiMessage.metadata?.customPrompt,
                  } : undefined,
                  // Use script's opening message
                  first_message: firstMessage || message.content || "Hi, this is an automated call from GrowthFin. Is now a good time to talk?",
                },
              },
            },
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        // Detect Twilio trial account errors (unverified number)
        const isTrialError = response.status === 400 &&
          (errorText.toLowerCase().includes('unverified') ||
           errorText.toLowerCase().includes('trial'));

        if (isTrialError) {
          console.warn(`[ElevenLabs] Twilio trial account error: ${errorText}`);
          return {
            success: false,
            messageId: '',
            channel: 'ai_voice',
            error: `Cannot call ${message.to}: This number is not verified on the Twilio trial account. ` +
              `Either verify the number in Twilio Console (Settings → Verified Caller IDs) ` +
              `or upgrade the Twilio account to remove trial restrictions.`,
          };
        }

        throw new Error(`ElevenLabs API error: ${errorText}`);
      }

      const result = await response.json();

      // Check if call was successfully initiated
      if (!result.success) {
        throw new Error(result.message || 'Failed to initiate call');
      }

      // Create call record in database
      const [call] = await db.insert(crmCalls).values({
        workspaceId: message.workspaceId,
        contactId: aiMessage.metadata?.contactId,
        leadId: aiMessage.metadata?.leadId,
        direction: 'outbound',
        toNumber: message.to,
        fromNumber: await resolveOutboundNumber({
          recipientPhone: message.to,
          workspaceId: message.workspaceId,
          capability: 'voice',
        }),
        status: 'initiated',
        purpose: 'ai_outreach',
        externalCallId: result.callSid,
      }).returning();

      // Create AI call tracking record
      const [aiCall] = await db.insert(crmAiCalls).values({
        workspaceId: message.workspaceId,
        callId: call.id,
        conversationId: result.conversation_id,
        agentId: this.agentId,
      }).returning();

      console.log(`[ElevenLabs] Call initiated successfully!`);
      console.log(`  Conversation ID: ${result.conversation_id}`);
      console.log(`  Twilio Call SID: ${result.callSid}`);

      return {
        success: true,
        messageId: call.id,
        channel: 'ai_voice',
        metadata: {
          conversationId: result.conversation_id,
          callId: call.id,
          aiCallId: aiCall.id,
          callSid: result.callSid,
        }
      };

    } catch (error) {
      console.error('[ElevenLabs] Send failed:', error);
      return {
        success: false,
        messageId: '',
        channel: 'ai_voice',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Implement abstract sendMessage for base class compatibility
   * This is called by base.send() but we override send() directly
   */
  protected async sendMessage(message: OutboundMessage): Promise<SendResult> {
    // Direct send() override handles this
    return this.send(message);
  }

  /**
   * Transform ElevenLabs webhook to unified format
   */
  protected async transformWebhook(
    rawPayload: any,
    _headers?: Record<string, string>
  ): Promise<UnifiedWebhookEvent> {
    const { event_type, conversation } = rawPayload;

    // Determine if this is an inbound call
    const isInbound = rawPayload.direction === 'inbound' ||
                      rawPayload.call_direction === 'inbound';

    // Map ElevenLabs event types to our unified format
    let eventType: string;
    switch (event_type) {
      case 'conversation.started':
        eventType = isInbound ? 'inbound_received' : 'initiated';
        break;
      case 'conversation.ended':
        eventType = isInbound ? 'inbound_completed' : 'completed';
        break;
      case 'user_transcript':
      case 'agent_response':
        eventType = 'transcript_available';
        break;
      default:
        eventType = event_type;
    }

    // Find the AI call record to get workspace info
    let workspaceId = '';
    let leadId: string | undefined;
    let contactId: string | undefined;
    let direction: 'outbound' | 'inbound' = 'outbound';

    if (conversation?.id) {
      const [aiCall] = await db.select()
        .from(crmAiCalls)
        .where(eq(crmAiCalls.conversationId, conversation.id))
        .limit(1);

      if (aiCall) {
        workspaceId = aiCall.workspaceId;
        direction = (aiCall.direction as 'outbound' | 'inbound') || 'outbound';

        // For inbound calls, use identified entity
        if (direction === 'inbound') {
          if (aiCall.identifiedEntityType === 'lead') {
            leadId = aiCall.identifiedEntityId || undefined;
          } else if (aiCall.identifiedEntityType === 'contact') {
            contactId = aiCall.identifiedEntityId || undefined;
          }
        }

        // Get lead/contact from the associated call for outbound
        if (aiCall.callId && direction === 'outbound') {
          const [call] = await db.select()
            .from(crmCalls)
            .where(eq(crmCalls.id, aiCall.callId))
            .limit(1);

          if (call) {
            leadId = call.leadId || undefined;
            contactId = call.contactId || undefined;
          }
        }
      }
    }

    return {
      eventId: '', // Will be set by base class
      vendorEventId: conversation?.id || rawPayload.event_id || '',
      channel: 'ai_voice',
      eventType: `ai_voice.${eventType}`,
      direction,
      from: direction === 'inbound'
        ? rawPayload.from_number || ''
        : process.env['TWILIO_PHONE_NUMBER'] || '',
      to: direction === 'inbound'
        ? rawPayload.to_number || process.env['TWILIO_PHONE_NUMBER'] || ''
        : rawPayload.to_number || '',
      content: rawPayload.transcript || rawPayload.text || undefined,
      metadata: {
        conversationId: conversation?.id,
        duration: conversation?.duration,
        sentiment: rawPayload.analysis?.sentiment,
        outcome: rawPayload.analysis?.outcome,
        direction,
        callerIdentified: rawPayload.caller_identified,
      },
      workspaceId,
      leadId,
      contactId,
      occurredAt: new Date(rawPayload.timestamp || Date.now()),
    };
  }

  /**
   * Validate webhook signature from ElevenLabs
   */
  protected validateWebhookSignature(
    _payload: any,
    headers: Record<string, string>
  ): boolean {
    // ElevenLabs webhook signature validation
    const webhookSecret = process.env['ELEVENLABS_WEBHOOK_SECRET'];

    if (!webhookSecret) {
      console.warn('[ElevenLabs] No webhook secret configured - skipping validation');
      return true;
    }

    // Get signature from headers
    const signature = headers['x-elevenlabs-signature'] || headers['X-Elevenlabs-Signature'];

    if (!signature) {
      console.warn('[ElevenLabs] No signature header found');
      return true; // Allow for now until signature validation is implemented
    }

    // TODO: Implement actual HMAC-SHA256 signature validation
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === expectedSignature;

    return true; // Placeholder
  }

  /**
   * Handle webhook from ElevenLabs about call events
   * This is called directly by the webhook route for specialized processing
   */
  async handleWebhook(webhookData: any): Promise<void> {
    const { event_type, conversation } = webhookData;

    console.log(`[ElevenLabs Webhook] Received event: ${event_type}`);

    // Find the AI call record
    const [aiCall] = await db.select()
      .from(crmAiCalls)
      .where(eq(crmAiCalls.conversationId, conversation.id))
      .limit(1);

    if (!aiCall) {
      console.warn(`[ElevenLabs] Unknown conversation: ${conversation.id}`);
      return;
    }

    switch (event_type) {
      case 'conversation.ended':
        await this.handleCallEnded(aiCall.id, webhookData);
        break;

      case 'user_transcript':
        await this.handleUserSpeech(aiCall.id, webhookData);
        break;

      case 'agent_response':
        await this.handleAgentResponse(aiCall.id, webhookData);
        break;

      case 'tool_call':
        await this.handleToolCall(aiCall.id, webhookData);
        break;

      default:
        console.log(`[ElevenLabs] Unhandled event type: ${event_type}`);
    }
  }

  /**
   * Handle call ended event
   * Phase J: Enhanced post-call processing with collected_data and workflow triggers
   */
  private async handleCallEnded(aiCallId: string, data: any): Promise<void> {
    console.log('[ElevenLabs] Processing call ended event');

    const { conversation, analysis, collected_data } = data;

    // Calculate call cost
    const durationSeconds = conversation?.duration || 0;
    const cost = this.calculateCost(durationSeconds);

    // Determine lead quality based on conversation and collected data
    const leadQuality = this.determineLeadQuality(analysis, collected_data);

    // Transform collected_data to camelCase for storage
    const collectedData = collected_data ? {
      interestLevel: collected_data.interest_level,
      callbackRequested: collected_data.callback_requested,
      preferredCallbackTime: collected_data.preferred_callback_time,
      meetingScheduled: collected_data.meeting_scheduled,
      meetingDatetime: collected_data.meeting_datetime,
      sentiment: collected_data.sentiment,
      keyPainPoints: collected_data.key_pain_points,
      nextSteps: collected_data.next_steps,
      objectionsRaised: collected_data.objections_raised,
      budgetMentioned: collected_data.budget_mentioned,
      decisionMaker: collected_data.decision_maker,
      timeline: collected_data.timeline,
    } : null;

    // Update AI call record
    await db.update(crmAiCalls)
      .set({
        transcript: conversation?.transcript,
        callOutcome: analysis?.outcome || collected_data?.interest_level === 'high' ? 'interested' :
                     collected_data?.callback_requested ? 'callback' :
                     analysis?.outcome || 'no_answer',
        sentiment: analysis?.sentiment || collected_data?.sentiment || 'neutral',
        keyPoints: analysis?.key_points || collected_data?.key_pain_points || [],
        analysis: {
          intent: analysis?.intent,
          objections: analysis?.objections || collected_data?.objections_raised || [],
          nextSteps: analysis?.next_steps || (collected_data?.next_steps ? [collected_data.next_steps] : []),
          leadQuality,
        },
        collectedData,
        audioSeconds: durationSeconds,
        cost: cost.toString(),
        updatedAt: new Date(),
      })
      .where(eq(crmAiCalls.id, aiCallId));

    // Get the AI call to access workspace and entity info
    const [aiCall] = await db.select()
      .from(crmAiCalls)
      .where(eq(crmAiCalls.id, aiCallId))
      .limit(1);

    if (aiCall) {
      // Process post-call actions
      await this.processPostCallActions(aiCall, collectedData, leadQuality, conversation);
    }

    console.log(`[ElevenLabs] Call ended - Duration: ${durationSeconds}s, Cost: $${cost}, Quality: ${leadQuality}`);
    if (collectedData) {
      console.log(`[ElevenLabs] Collected data:`, {
        interestLevel: collectedData.interestLevel,
        callbackRequested: collectedData.callbackRequested,
        meetingScheduled: collectedData.meetingScheduled,
      });
    }
  }

  /**
   * Process post-call actions based on collected data
   * Phase J: Update leads, create timeline events, trigger workflows
   */
  private async processPostCallActions(
    aiCall: any,
    collectedData: any,
    leadQuality: 'hot' | 'warm' | 'cold',
    conversation: any
  ): Promise<void> {
    // Import required modules
    const { crmTimelineEvents } = await import('@agios/db/schema');

    // Get entity info
    let entityId: string | null = null;
    let entityType: 'lead' | 'contact' = 'lead';

    if (aiCall.identifiedEntityType === 'lead' && aiCall.identifiedEntityId) {
      entityId = aiCall.identifiedEntityId;
      entityType = 'lead';
    } else if (aiCall.identifiedEntityType === 'contact' && aiCall.identifiedEntityId) {
      entityId = aiCall.identifiedEntityId;
      entityType = 'contact';
    } else if (aiCall.callId) {
      // Try to get from base call
      const [call] = await db.select()
        .from(crmCalls)
        .where(eq(crmCalls.id, aiCall.callId))
        .limit(1);

      if (call) {
        if (call.leadId) {
          entityId = call.leadId;
          entityType = 'lead';
        } else if (call.contactId) {
          entityId = call.contactId;
          entityType = 'contact';
        }
      }
    }

    if (!entityId) {
      console.warn('[ElevenLabs] No entity found for post-call processing');
      return;
    }

    // 1. Create timeline event for the call
    const callSummary = this.buildCallSummary(collectedData, leadQuality, conversation);
    await db.insert(crmTimelineEvents).values({
      workspaceId: aiCall.workspaceId,
      entityId,
      entityType,
      eventType: 'ai_call_completed',
      summary: callSummary,
      details: {
        aiCallId: aiCall.id,
        conversationId: aiCall.conversationId,
        duration: conversation?.duration,
        leadQuality,
        collectedData,
        outcome: collectedData?.interestLevel || 'unknown',
      },
      occurredAt: new Date(),
    });

    // 2. Update lead/contact based on collected data
    if (collectedData) {
      if (entityType === 'lead') {
        await this.updateLeadFromCallData(entityId, collectedData, leadQuality);
      } else {
        await this.updateContactFromCallData(entityId, collectedData);
      }
    }

    // 3. Create follow-up work items if needed
    if (collectedData?.callbackRequested || collectedData?.meetingScheduled) {
      await this.createFollowUpWorkItems(aiCall.workspaceId, entityId, entityType, collectedData, aiCall.conversationId);
    }

    console.log(`[ElevenLabs] Post-call processing completed for ${entityType} ${entityId}`);
  }

  /**
   * Build a human-readable call summary
   */
  private buildCallSummary(collectedData: any, leadQuality: 'hot' | 'warm' | 'cold', conversation: any): string {
    const parts: string[] = [];

    parts.push(`AI call completed (${Math.round((conversation?.duration || 0) / 60)} min)`);

    if (collectedData?.interestLevel) {
      parts.push(`Interest: ${collectedData.interestLevel}`);
    }

    if (leadQuality) {
      parts.push(`Quality: ${leadQuality}`);
    }

    if (collectedData?.meetingScheduled) {
      parts.push('Meeting scheduled');
    } else if (collectedData?.callbackRequested) {
      parts.push('Callback requested');
    }

    if (collectedData?.keyPainPoints?.length > 0) {
      parts.push(`Pain points: ${collectedData.keyPainPoints.slice(0, 2).join(', ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Update lead record based on call data
   */
  private async updateLeadFromCallData(
    leadId: string,
    collectedData: any,
    leadQuality: 'hot' | 'warm' | 'cold'
  ): Promise<void> {
    const updates: any = {
      lastContactDate: new Date(),
      updatedAt: new Date(),
    };

    // Update lifecycle stage based on interest
    if (collectedData.interestLevel === 'high' || collectedData.meetingScheduled) {
      updates.lifecycleStage = 'qualified';
    } else if (collectedData.interestLevel === 'medium' || collectedData.callbackRequested) {
      updates.lifecycleStage = 'engaged';
    }

    // Store pain points and other data in customFields
    const customFieldUpdates: Record<string, any> = {};
    if (collectedData.keyPainPoints?.length > 0) {
      customFieldUpdates['painPoints'] = collectedData.keyPainPoints;
    }
    if (collectedData.timeline) {
      customFieldUpdates['decisionTimeline'] = collectedData.timeline;
    }
    if (collectedData.budgetMentioned !== undefined) {
      customFieldUpdates['budgetDiscussed'] = collectedData.budgetMentioned;
    }
    if (collectedData.decisionMaker !== undefined) {
      customFieldUpdates['isDecisionMaker'] = collectedData.decisionMaker;
    }

    if (Object.keys(customFieldUpdates).length > 0) {
      // Get current customFields and merge
      const { crmLeads } = await import('@agios/db/schema');
      const [lead] = await db.select({ customFields: crmLeads.customFields })
        .from(crmLeads)
        .where(eq(crmLeads.id, leadId))
        .limit(1);

      updates.customFields = {
        ...(lead?.customFields as Record<string, any> || {}),
        ...customFieldUpdates,
        lastAiCallDate: new Date().toISOString(),
        lastAiCallQuality: leadQuality,
      };
    }

    const { crmLeads } = await import('@agios/db/schema');
    await db.update(crmLeads)
      .set(updates)
      .where(eq(crmLeads.id, leadId));

    console.log(`[ElevenLabs] Updated lead ${leadId} with call data`);
  }

  /**
   * Update contact record based on call data
   */
  private async updateContactFromCallData(contactId: string, collectedData: any): Promise<void> {
    const updates: any = {
      updatedAt: new Date(),
    };

    // Store call insights in customFields
    const customFieldUpdates: Record<string, any> = {
      lastAiCallDate: new Date().toISOString(),
    };

    if (collectedData.keyPainPoints?.length > 0) {
      customFieldUpdates['painPoints'] = collectedData.keyPainPoints;
    }

    const { crmContacts } = await import('@agios/db/schema');
    const [contact] = await db.select({ customFields: crmContacts.customFields })
      .from(crmContacts)
      .where(eq(crmContacts.id, contactId))
      .limit(1);

    updates.customFields = {
      ...(contact?.customFields as Record<string, any> || {}),
      ...customFieldUpdates,
    };

    await db.update(crmContacts)
      .set(updates)
      .where(eq(crmContacts.id, contactId));

    console.log(`[ElevenLabs] Updated contact ${contactId} with call data`);
  }

  /**
   * Create follow-up work items based on call outcomes
   */
  private async createFollowUpWorkItems(
    workspaceId: string,
    entityId: string,
    entityType: 'lead' | 'contact',
    collectedData: any,
    conversationId: string
  ): Promise<void> {
    const { workItems } = await import('@agios/db/schema');

    // Create callback work item if requested
    if (collectedData.callbackRequested && collectedData.preferredCallbackTime) {
      let callbackDate: Date;
      try {
        callbackDate = new Date(collectedData.preferredCallbackTime);
        if (isNaN(callbackDate.getTime())) {
          callbackDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow
        }
      } catch {
        callbackDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      await db.insert(workItems).values({
        workspaceId,
        entityType,
        entityId,
        workItemType: 'follow_up',
        title: 'Callback requested during AI call',
        description: `The prospect requested a callback during an AI voice call.\nPreferred time: ${collectedData.preferredCallbackTime}`,
        priority: 1, // High
        status: 'pending',
        dueAt: callbackDate,
        metadata: {
          source: 'ai_call_auto',
          conversationId,
          callbackRequested: true,
        },
      });

      console.log(`[ElevenLabs] Created callback work item for ${entityType} ${entityId}`);
    }

    // Create meeting follow-up if scheduled
    if (collectedData.meetingScheduled && collectedData.meetingDatetime) {
      let meetingDate: Date;
      try {
        meetingDate = new Date(collectedData.meetingDatetime);
        if (isNaN(meetingDate.getTime())) {
          meetingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 1 week
        }
      } catch {
        meetingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      await db.insert(workItems).values({
        workspaceId,
        entityType,
        entityId,
        workItemType: 'follow_up',
        title: 'Meeting scheduled via AI call',
        description: `A meeting was scheduled during an AI voice call.\nScheduled for: ${collectedData.meetingDatetime}`,
        priority: 1, // High
        status: 'pending',
        dueAt: meetingDate,
        metadata: {
          source: 'ai_call_auto',
          conversationId,
          meetingScheduled: true,
        },
      });

      console.log(`[ElevenLabs] Created meeting follow-up work item for ${entityType} ${entityId}`);
    }
  }

  /**
   * Handle user speech event
   */
  private async handleUserSpeech(aiCallId: string, data: any): Promise<void> {
    await db.insert(crmAiCallEvents).values({
      aiCallId,
      eventType: 'user_speech',
      timestamp: new Date(data.timestamp || Date.now()),
      content: data.transcript,
      metadata: {
        confidence: data.confidence,
      },
    });
  }

  /**
   * Handle agent response event
   */
  private async handleAgentResponse(aiCallId: string, data: any): Promise<void> {
    await db.insert(crmAiCallEvents).values({
      aiCallId,
      eventType: 'agent_response',
      timestamp: new Date(data.timestamp || Date.now()),
      content: data.text,
      metadata: {
        audioUrl: data.audio_url,
        duration: data.duration,
      },
    });
  }

  /**
   * Handle tool call event
   */
  private async handleToolCall(aiCallId: string, data: any): Promise<void> {
    await db.insert(crmAiCallEvents).values({
      aiCallId,
      eventType: 'tool_use',
      timestamp: new Date(data.timestamp || Date.now()),
      content: `Called: ${data.tool_name}`,
      metadata: {
        tool: data.tool_name,
        parameters: data.parameters,
        result: data.result,
      },
    });
  }

  /**
   * Handle inbound call event (Phase L)
   * Called when ElevenLabs receives an incoming call
   */
  async handleInboundCall(data: {
    conversationId: string;
    fromNumber: string;
    toNumber: string;
    workspaceId: string;
    callerContext?: {
      identified: boolean;
      entityType?: 'lead' | 'contact';
      entityId?: string;
      name?: string;
    };
  }): Promise<void> {
    console.log(`[ElevenLabs] Processing inbound call from ${data.fromNumber}`);

    // Find the AI call record
    const [aiCall] = await db.select()
      .from(crmAiCalls)
      .where(eq(crmAiCalls.conversationId, data.conversationId))
      .limit(1);

    if (!aiCall) {
      console.warn(`[ElevenLabs] Inbound call record not found: ${data.conversationId}`);
      return;
    }

    // Log the inbound event
    await db.insert(crmAiCallEvents).values({
      aiCallId: aiCall.id,
      eventType: 'conversation_started',
      timestamp: new Date(),
      content: `Inbound call from ${data.fromNumber}`,
      metadata: {
        direction: 'inbound',
        callerIdentified: data.callerContext?.identified,
        entityType: data.callerContext?.entityType,
        entityId: data.callerContext?.entityId,
        callerName: data.callerContext?.name,
      },
    });
  }

  /**
   * Handle inbound call ended event (Phase L)
   * Updates the AI call record when an inbound call completes
   */
  async handleInboundCallEnded(aiCallId: string, data: any): Promise<void> {
    console.log('[ElevenLabs] Processing inbound call ended event');

    const { conversation, analysis } = data;

    // Calculate call cost (same as outbound)
    const durationSeconds = conversation?.duration || 0;
    const cost = this.calculateCost(durationSeconds);

    await db.update(crmAiCalls)
      .set({
        transcript: conversation?.transcript,
        callOutcome: analysis?.outcome || 'completed',
        sentiment: analysis?.sentiment || 'neutral',
        keyPoints: analysis?.key_points || [],
        analysis: {
          intent: analysis?.intent || 'inquiry',
          objections: analysis?.objections || [],
          nextSteps: analysis?.next_steps || [],
          leadQuality: this.determineLeadQuality(analysis),
        },
        audioSeconds: durationSeconds,
        cost: cost.toString(),
        updatedAt: new Date(),
      })
      .where(eq(crmAiCalls.id, aiCallId));

    // Update the base call record status
    const [aiCall] = await db.select()
      .from(crmAiCalls)
      .where(eq(crmAiCalls.id, aiCallId))
      .limit(1);

    if (aiCall?.callId) {
      await db.update(crmCalls)
        .set({
          status: 'completed',
          endedAt: new Date(),
          duration: durationSeconds,
        })
        .where(eq(crmCalls.id, aiCall.callId));
    }

    console.log(`[ElevenLabs] Inbound call ended - Duration: ${durationSeconds}s, Cost: $${cost}`);
  }

  /**
   * Determine lead quality based on analysis and collected data
   * Phase J: Enhanced with collected_data consideration
   */
  private determineLeadQuality(analysis: any, collectedData?: any): 'hot' | 'warm' | 'cold' {
    // Check collected_data first (Phase J)
    if (collectedData) {
      // Hot lead indicators from collected data
      if (
        collectedData.interest_level === 'high' ||
        collectedData.meeting_scheduled ||
        (collectedData.decision_maker && collectedData.budget_mentioned && collectedData.timeline === 'immediate')
      ) {
        return 'hot';
      }

      // Warm lead indicators from collected data
      if (
        collectedData.interest_level === 'medium' ||
        collectedData.callback_requested ||
        collectedData.sentiment === 'positive' ||
        collectedData.decision_maker ||
        collectedData.timeline === '1_3_months'
      ) {
        return 'warm';
      }

      // Cold if interest is explicitly low/none
      if (collectedData.interest_level === 'low' || collectedData.interest_level === 'none') {
        return 'cold';
      }
    }

    // Fall back to analysis-based determination
    if (!analysis) return 'cold';

    // Hot lead indicators
    if (
      analysis.outcome === 'interested' &&
      analysis.sentiment === 'positive' &&
      (analysis.scheduled_meeting || analysis.requested_demo)
    ) {
      return 'hot';
    }

    // Warm lead indicators
    if (
      (analysis.outcome === 'callback' || analysis.outcome === 'interested') ||
      analysis.sentiment === 'positive' ||
      analysis.asked_questions
    ) {
      return 'warm';
    }

    // Default to cold
    return 'cold';
  }

  /**
   * Calculate cost for the call
   * ElevenLabs: ~$0.09/min for audio generation
   * Twilio: ~$0.025/min for outbound calls
   * Total: ~$0.115/min
   */
  private calculateCost(durationSeconds: number): number {
    const minutes = durationSeconds / 60;
    const elevenLabsCost = minutes * 0.09;
    const twilioCost = minutes * 0.025;
    return Number((elevenLabsCost + twilioCost).toFixed(4));
  }
}
