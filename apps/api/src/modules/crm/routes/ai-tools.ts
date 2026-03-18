/**
 * AI Tools Webhook Routes
 * Phase J: Webhook endpoints called by ElevenLabs during AI conversations
 *
 * These endpoints are invoked by the AI agent during active calls to:
 * - Schedule callbacks
 * - Send SMS messages
 * - Look up account information
 * - Create follow-up tasks
 * - Log issues encountered during calls
 *
 * IMPORTANT: ElevenLabs sends conversation_id in headers, not body:
 * - x-elevenlabs-conversation-id: The active conversation ID
 * - x-elevenlabs-agent-id: The agent ID
 */

import Elysia, { t } from 'elysia';
import { db } from '@agios/db';
import {
  crmLeads,
  crmContacts,
  crmAiCalls,
  crmTimelineEvents,
  workItems,
  crmOpportunities,
} from '@agios/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getTwilioSMSAdapter } from '../../../lib/channels';
import { parseNaturalDateTime } from '../../../lib/utils/date-parser';
import { resolveOutboundNumber } from '../../../lib/utils/phone-validation';

/**
 * Standard webhook response format for ElevenLabs
 */
interface ToolResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Extract conversation ID from headers or body
 * ElevenLabs sends it in x-elevenlabs-conversation-id header
 */
function extractConversationId(headers: Record<string, string | undefined>, body: any): string | null {
  // Try header first (ElevenLabs standard)
  const headerConvId = headers['x-elevenlabs-conversation-id'];
  if (headerConvId) return headerConvId;

  // Fallback to body (for manual testing or alternative integrations)
  if (body?.conversation_id) return body.conversation_id;

  return null;
}

/**
 * Extract workspace and entity info from the conversation
 */
async function getConversationContext(conversationId: string): Promise<{
  workspaceId: string | null;
  leadId: string | null;
  contactId: string | null;
  phone: string | null;
} | null> {
  // Look up the AI call by conversation ID
  const [aiCall] = await db.select()
    .from(crmAiCalls)
    .where(eq(crmAiCalls.conversationId, conversationId))
    .limit(1);

  if (!aiCall) {
    console.warn(`[AI Tools] Unknown conversation: ${conversationId}`);
    return null;
  }

  console.log(`[AI Tools] Found AI call:`, {
    conversationId: aiCall.conversationId,
    workspaceId: aiCall.workspaceId,
    callId: aiCall.callId,
    identifiedEntityType: aiCall.identifiedEntityType,
    identifiedEntityId: aiCall.identifiedEntityId,
  });

  // Get lead/contact info from the associated call
  let leadId: string | null = null;
  let contactId: string | null = null;
  let phone: string | null = null;

  if (aiCall.identifiedEntityType === 'lead' && aiCall.identifiedEntityId) {
    leadId = aiCall.identifiedEntityId;
    const [lead] = await db.select()
      .from(crmLeads)
      .where(eq(crmLeads.id, leadId))
      .limit(1);
    phone = lead?.phone || null;
  } else if (aiCall.identifiedEntityType === 'contact' && aiCall.identifiedEntityId) {
    contactId = aiCall.identifiedEntityId;
    const [contact] = await db.select()
      .from(crmContacts)
      .where(eq(crmContacts.id, contactId))
      .limit(1);
    phone = contact?.phone || contact?.mobile || null;
  }

  // If no entity identified, try to get from the base call
  if (!leadId && !contactId && aiCall.callId) {
    const crmCalls = (await import('@agios/db/schema')).crmCalls;
    const [call] = await db.select()
      .from(crmCalls)
      .where(eq(crmCalls.id, aiCall.callId))
      .limit(1);

    if (call) {
      leadId = call.leadId;
      contactId = call.contactId;
      phone = call.toNumber || null;
    }
  }

  return {
    workspaceId: aiCall.workspaceId,
    leadId,
    contactId,
    phone,
  };
}

export const aiToolsRoutes = new Elysia({ prefix: '/ai-tools' })
  /**
   * Schedule a callback
   * Called by AI when prospect requests to be called back later
   */
  .post('/schedule-callback', async ({ body, headers }) => {
    try {
      const { callback_time, callback_reason, timezone } = body;
      const conversation_id = extractConversationId(headers as Record<string, string | undefined>, body);

      if (!conversation_id) {
        console.warn('[AI Tools] Schedule callback called without conversation_id');
        return {
          success: true,
          message: 'Noted. The callback request has been recorded.',
        } as ToolResponse;
      }

      console.log(`[AI Tools] Schedule callback for conversation ${conversation_id}`);

      const context = await getConversationContext(conversation_id);
      console.log(`[AI Tools] Context lookup result:`, JSON.stringify(context));

      if (!context?.workspaceId) {
        console.warn(`[AI Tools] No workspace found for conversation ${conversation_id}`);
        return { success: true, message: 'Noted. The callback request has been recorded.' } as ToolResponse;
      }

      // Parse the natural language time
      const parsedTime = parseNaturalDateTime(callback_time, timezone);
      const callbackDate = parsedTime || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow

      // Determine entity type and ID
      const entityId = context.leadId || context.contactId;
      const entityType = context.leadId ? 'lead' : (context.contactId ? 'contact' : 'lead');

      console.log(`[AI Tools] Entity: ${entityType} ${entityId}`);

      if (!entityId) {
        console.warn(`[AI Tools] No entity found for conversation ${conversation_id}`);
        return {
          success: false,
          message: 'No associated lead or contact found for this call',
        } as ToolResponse;
      }

      console.log(`[AI Tools] Creating work item for ${entityType} ${entityId}`);
      // Create a work item for the callback
      let workItem;
      try {
        [workItem] = await db.insert(workItems).values({
        workspaceId: context.workspaceId,
        entityType: entityType as 'lead' | 'contact',
        entityId,
        workItemType: 'follow_up',
        title: `Callback: ${callback_reason || 'Requested during AI call'}`,
        description: `The prospect requested a callback during an AI voice call.\n\nRequested time: ${callback_time}\n${callback_reason ? `Reason: ${callback_reason}` : ''}`,
        priority: 1, // High priority
        status: 'pending',
        dueAt: callbackDate,
        metadata: {
          source: 'ai_call',
          conversationId: conversation_id,
          originalRequest: callback_time,
          timezone,
          callbackType: 'scheduled',
        },
      }).returning();
      } catch (dbError) {
        console.error('[AI Tools] DB INSERT ERROR:', dbError);
        console.error('[AI Tools] DB Error details:', {
          name: (dbError as Error).name,
          message: (dbError as Error).message,
          code: (dbError as any).code,
          detail: (dbError as any).detail,
        });
        throw dbError;
      }

      // Create timeline event
      await db.insert(crmTimelineEvents).values({
        workspaceId: context.workspaceId,
        entityId,
        entityType: entityType as 'lead' | 'contact',
        eventType: 'callback_scheduled',
        eventCategory: 'milestone',
        eventLabel: 'AI Call Callback',
        actorType: 'integration',
        summary: `Callback scheduled for ${callbackDate.toLocaleDateString()} ${callbackDate.toLocaleTimeString()}`,
        occurredAt: new Date(),
      });

      console.log(`[AI Tools] Callback scheduled: ${workItem.id} for ${callbackDate}`);

      return {
        success: true,
        message: `Callback has been scheduled for ${callbackDate.toLocaleDateString()} at ${callbackDate.toLocaleTimeString()}. A task has been created for the team.`,
        data: {
          workItemId: workItem.id,
          scheduledFor: callbackDate.toISOString(),
        },
      } as ToolResponse;

    } catch (error) {
      console.error('[AI Tools] Schedule callback error:', error);
      console.error('[AI Tools] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 3),
      });
      return {
        success: true,
        message: 'Noted. The callback request has been recorded.',
      } as ToolResponse;
    }
  }, {
    body: t.Object({
      conversation_id: t.Optional(t.String()), // Optional - prefer header
      callback_time: t.String(),
      callback_reason: t.Optional(t.String()),
      timezone: t.Optional(t.String()),
    }),
  })

  /**
   * Send SMS to the prospect
   * Called by AI to send confirmation or follow-up messages
   */
  .post('/send-sms', async ({ body, headers }) => {
    try {
      const { message, purpose } = body;
      const conversation_id = extractConversationId(headers as Record<string, string | undefined>, body);

      if (!conversation_id) {
        console.warn('[AI Tools] Send SMS called without conversation_id');
        return {
          success: true,
          message: 'Noted. The SMS request has been recorded.',
        } as ToolResponse;
      }

      console.log(`[AI Tools] Send SMS for conversation ${conversation_id}`);

      const context = await getConversationContext(conversation_id);
      if (!context?.workspaceId) {
        return { success: true, message: 'Noted. The SMS request has been recorded.' } as ToolResponse;
      }

      if (!context.phone) {
        return {
          success: false,
          message: 'No phone number available for this contact',
        } as ToolResponse;
      }

      // Get SMS adapter
      const smsAdapter = getTwilioSMSAdapter();
      if (!smsAdapter) {
        return {
          success: false,
          message: 'SMS service is not configured',
        } as ToolResponse;
      }

      // Resolve outbound number with geo-matching
      const fromNumber = await resolveOutboundNumber({
        recipientPhone: context.phone,
        workspaceId: context.workspaceId,
        capability: 'sms',
      });

      // Send the SMS
      const result = await smsAdapter.send({
        to: context.phone,
        from: fromNumber,
        message,
        workspaceId: context.workspaceId,
        metadata: {
          source: 'ai_call',
          conversationId: conversation_id,
          purpose,
        },
      });

      if (!result.success) {
        return {
          success: false,
          message: 'Failed to send SMS. Please note the message for follow-up.',
        } as ToolResponse;
      }

      // Create timeline event
      const entityId = context.leadId || context.contactId;
      const entityType = context.leadId ? 'lead' : 'contact';

      if (entityId) {
        await db.insert(crmTimelineEvents).values({
          workspaceId: context.workspaceId,
          entityId,
          entityType,
          eventType: 'sms_sent',
          eventCategory: 'communication',
          eventLabel: 'AI Call SMS',
          actorType: 'integration',
          summary: `SMS sent during AI call: ${purpose || 'follow-up'}`,
          metadata: {
            message,
            purpose,
            source: 'ai_call',
            messageId: result.messageId,
          },
          occurredAt: new Date(),
        });
      }

      console.log(`[AI Tools] SMS sent: ${result.messageId}`);

      return {
        success: true,
        message: 'SMS has been sent successfully.',
        data: {
          messageId: result.messageId,
        },
      } as ToolResponse;

    } catch (error) {
      console.error('[AI Tools] Send SMS error:', error);
      return {
        success: true,
        message: 'Noted. The SMS request has been recorded.',
      } as ToolResponse;
    }
  }, {
    body: t.Object({
      conversation_id: t.Optional(t.String()), // Optional - prefer header
      message: t.String(),
      purpose: t.Optional(t.String()),
    }),
  })

  /**
   * Look up account information
   * Called by AI to get additional context about the prospect
   */
  .post('/lookup-account', async ({ body, headers }) => {
    try {
      const { lookup_type } = body;
      const conversation_id = extractConversationId(headers as Record<string, string | undefined>, body);

      if (!conversation_id) {
        console.warn('[AI Tools] Lookup account called without conversation_id');
        return {
          success: true,
          message: 'No additional account information available at this time.',
        } as ToolResponse;
      }

      console.log(`[AI Tools] Lookup ${lookup_type} for conversation ${conversation_id}`);

      const context = await getConversationContext(conversation_id);
      if (!context?.workspaceId) {
        return { success: true, message: 'No additional account information available at this time.' } as ToolResponse;
      }

      let data: any = {};
      let summary = '';

      switch (lookup_type) {
        case 'contact_history': {
          // Get recent timeline events
          const entityId = context.leadId || context.contactId;
          const entityType = context.leadId ? 'lead' : 'contact';

          if (entityId) {
            const events = await db.select()
              .from(crmTimelineEvents)
              .where(
                and(
                  eq(crmTimelineEvents.entityId, entityId),
                  eq(crmTimelineEvents.entityType, entityType)
                )
              )
              .orderBy(desc(crmTimelineEvents.occurredAt))
              .limit(10);

            data.recentEvents = events.map(e => ({
              type: e.eventType,
              summary: e.summary,
              date: e.occurredAt?.toISOString().split('T')[0],
            }));

            summary = `Found ${events.length} recent interactions. `;
            if (events.length > 0) {
              const lastEvent = events[0];
              summary += `Last interaction was ${lastEvent.eventType} on ${lastEvent.occurredAt?.toISOString().split('T')[0]}: ${lastEvent.summary}`;
            }
          } else {
            summary = 'No contact history available.';
          }
          break;
        }

        case 'company_info': {
          // Get company/lead info
          if (context.leadId) {
            const [lead] = await db.select()
              .from(crmLeads)
              .where(eq(crmLeads.id, context.leadId))
              .limit(1);

            if (lead) {
              data.company = {
                name: lead.companyName,
                industry: lead.industry,
                size: lead.companySize,
                website: lead.website,
              };
              summary = lead.companyName
                ? `Company: ${lead.companyName}. ${lead.industry ? `Industry: ${lead.industry}.` : ''} ${lead.companySize ? `Size: ${lead.companySize}.` : ''}`
                : 'No company information on file.';
            }
          } else {
            summary = 'No company information available.';
          }
          break;
        }

        case 'previous_purchases': {
          // Get closed won opportunities
          const entityId = context.leadId || context.contactId;
          if (entityId) {
            const opps = await db.select()
              .from(crmOpportunities)
              .where(
                and(
                  eq(crmOpportunities.workspaceId, context.workspaceId),
                  eq(crmOpportunities.stage, 'closed_won')
                )
              )
              .orderBy(desc(crmOpportunities.closedDate))
              .limit(5);

            data.purchases = opps.map(o => ({
              name: o.name,
              amount: o.amount,
              date: o.closedDate?.toISOString().split('T')[0],
            }));

            if (opps.length > 0) {
              const totalValue = opps.reduce((sum, o) => sum + Number(o.amount || 0), 0);
              summary = `Found ${opps.length} previous purchases totaling $${totalValue.toLocaleString()}.`;
            } else {
              summary = 'No previous purchases on record.';
            }
          } else {
            summary = 'No purchase history available.';
          }
          break;
        }

        case 'open_opportunities': {
          // Get open opportunities
          const opps = await db.select()
            .from(crmOpportunities)
            .where(
              and(
                eq(crmOpportunities.workspaceId, context.workspaceId),
                isNull(crmOpportunities.closedDate)
              )
            )
            .orderBy(desc(crmOpportunities.createdAt))
            .limit(5);

          data.opportunities = opps.map(o => ({
            name: o.name,
            stage: o.stage,
            amount: o.amount,
            expectedClose: o.expectedCloseDate?.toISOString().split('T')[0],
          }));

          if (opps.length > 0) {
            const totalPipeline = opps.reduce((sum, o) => sum + Number(o.amount || 0), 0);
            summary = `Found ${opps.length} open opportunities worth $${totalPipeline.toLocaleString()} in pipeline.`;
          } else {
            summary = 'No open opportunities at this time.';
          }
          break;
        }

        default:
          summary = `Unknown lookup type: ${lookup_type}`;
      }

      console.log(`[AI Tools] Lookup result: ${summary}`);

      return {
        success: true,
        message: summary,
        data,
      } as ToolResponse;

    } catch (error) {
      console.error('[AI Tools] Lookup error:', error);
      return {
        success: true,
        message: 'No additional account information available at this time.',
      } as ToolResponse;
    }
  }, {
    body: t.Object({
      conversation_id: t.Optional(t.String()), // Optional - prefer header
      lookup_type: t.String(),
    }),
  })

  /**
   * Create a follow-up task
   * Called by AI when there's an action item from the call
   */
  .post('/create-task', async ({ body, headers }) => {
    try {
      const { task_title, task_description, priority, due_date } = body;
      const conversation_id = extractConversationId(headers as Record<string, string | undefined>, body);

      if (!conversation_id) {
        console.warn('[AI Tools] Create task called without conversation_id');
        return {
          success: true,
          message: 'Noted. The task has been recorded.',
        } as ToolResponse;
      }

      console.log(`[AI Tools] Create task for conversation ${conversation_id}`);

      const context = await getConversationContext(conversation_id);
      if (!context?.workspaceId) {
        return { success: true, message: 'Noted. The task has been recorded.' } as ToolResponse;
      }

      // Parse due date
      let dueDate: Date | undefined;
      if (due_date) {
        const parsed = parseNaturalDateTime(due_date);
        dueDate = parsed || undefined;
      }
      if (!dueDate) {
        // Default to 3 days from now
        dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }

      // Determine entity type and ID
      const entityId = context.leadId || context.contactId;
      const entityType = context.leadId ? 'lead' : (context.contactId ? 'contact' : 'lead');

      if (!entityId) {
        return {
          success: false,
          message: 'No associated lead or contact found for this call',
        } as ToolResponse;
      }

      // Map priority to number
      const priorityMap: Record<string, number> = { high: 1, medium: 2, low: 3 };
      const priorityNum = priorityMap[priority || 'medium'] || 2;

      // Create the work item
      const [workItem] = await db.insert(workItems).values({
        workspaceId: context.workspaceId,
        entityType: entityType as 'lead' | 'contact',
        entityId,
        workItemType: 'follow_up',
        title: task_title,
        description: task_description,
        priority: priorityNum,
        status: 'pending',
        dueAt: dueDate,
        metadata: {
          source: 'ai_call',
          conversationId: conversation_id,
          originalPriority: priority,
        },
      }).returning();

      // Create timeline event
      await db.insert(crmTimelineEvents).values({
        workspaceId: context.workspaceId,
        entityId,
        entityType: entityType as 'lead' | 'contact',
        eventType: 'task_created',
        eventCategory: 'milestone',
        eventLabel: 'AI Call Task',
        actorType: 'integration',
        summary: `Task created during AI call: ${task_title}`,
        metadata: {
          workItemId: workItem.id,
          description: task_description,
          priority,
          dueDate: dueDate.toISOString(),
          source: 'ai_call',
        },
        occurredAt: new Date(),
      });

      console.log(`[AI Tools] Work item created: ${workItem.id}`);

      return {
        success: true,
        message: `Task "${task_title}" has been created for the team with ${priority || 'medium'} priority, due ${dueDate.toLocaleDateString()}.`,
        data: {
          workItemId: workItem.id,
          dueDate: dueDate.toISOString(),
        },
      } as ToolResponse;

    } catch (error) {
      console.error('[AI Tools] Create task error:', error);
      return {
        success: true,
        message: 'Noted. The task has been recorded.',
      } as ToolResponse;
    }
  }, {
    body: t.Object({
      conversation_id: t.Optional(t.String()), // Optional - prefer header
      task_title: t.String(),
      task_description: t.String(),
      priority: t.Optional(t.String()),
      due_date: t.Optional(t.String()),
    }),
  })

  /**
   * Log an issue encountered during the call
   * Called by AI when it encounters problems or needs to report something
   * This is designed to be resilient - it should always succeed
   */
  .post('/log-issue', async ({ body, headers }) => {
    const startTime = Date.now();
    const conversation_id = extractConversationId(headers as Record<string, string | undefined>, body);

    try {
      const { issue_type, description, severity, context } = body;

      console.log(`[AI Tools] Log issue: ${issue_type} - ${description}`);
      console.log(`[AI Tools] Issue context:`, {
        conversation_id,
        severity,
        context,
        headers: {
          agentId: headers['x-elevenlabs-agent-id'],
        },
      });

      // If we have a conversation context, try to record in database
      if (conversation_id) {
        try {
          const ctx = await getConversationContext(conversation_id);

          if (ctx?.workspaceId) {
            const entityId = ctx.leadId || ctx.contactId;
            const entityType = ctx.leadId ? 'lead' : 'contact';

            // Create timeline event for the issue
            await db.insert(crmTimelineEvents).values({
              workspaceId: ctx.workspaceId,
              entityId: entityId || 'unknown',
              entityType: (entityType || 'lead') as 'lead' | 'contact',
              eventType: 'ai_issue_reported',
              eventCategory: 'system',
              eventLabel: 'AI Issue Report',
              actorType: 'integration',
              summary: `AI reported: ${issue_type}`,
              metadata: {
                issueType: issue_type,
                description,
                severity: severity || 'medium',
                context,
                conversationId: conversation_id,
                source: 'ai_call',
              },
              occurredAt: new Date(),
            });

            console.log(`[AI Tools] Issue logged to timeline for ${entityType} ${entityId}`);
          }
        } catch (dbError) {
          // Don't fail the whole request if DB insert fails
          console.error('[AI Tools] Failed to persist issue to database:', dbError);
        }
      }

      // Always return success - this tool should never fail from the AI's perspective
      return {
        success: true,
        message: 'Thank you for reporting that. The issue has been logged and our team will review it.',
        data: {
          logged: true,
          issueType: issue_type,
          responseTimeMs: Date.now() - startTime,
        },
      } as ToolResponse;

    } catch (error) {
      // Even on error, return success to the AI to avoid confusion
      console.error('[AI Tools] Log issue error (but returning success):', error);
      return {
        success: true,
        message: 'The issue has been noted. Thank you for the feedback.',
        data: {
          logged: false,
          fallback: true,
          responseTimeMs: Date.now() - startTime,
        },
      } as ToolResponse;
    }
  }, {
    body: t.Object({
      conversation_id: t.Optional(t.String()),
      issue_type: t.String({ description: 'Type of issue: tool_failure, unclear_request, system_error, other' }),
      description: t.String({ description: 'Description of what happened' }),
      severity: t.Optional(t.String({ description: 'low, medium, high' })),
      context: t.Optional(t.String({ description: 'Additional context about the situation' })),
    }),
  });
