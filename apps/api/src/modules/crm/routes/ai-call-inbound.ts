/**
 * AI Call Inbound Routes
 * Phase L: Inbound AI Calls
 *
 * Handles incoming call webhooks from ElevenLabs and lists inbound calls.
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { crmAiCalls, crmAiCallEvents, crmTimelineEvents, crmCalls } from '@agios/db/schema';
import {
  lookupCaller,
  buildInboundSystemPrompt,
  getWorkspaceFromPhoneNumber,
  type CallerContext,
} from '../services/ai-call-inbound';

/**
 * Create timeline event for inbound AI call
 */
async function createInboundCallTimelineEvent(
  db: any,
  params: {
    workspaceId: string;
    entityType: 'lead' | 'contact';
    entityId: string;
    eventType: string;
    summary: string;
    aiCallId?: string;
    conversationId?: string;
    callerPhone?: string;
  }
) {
  await db.insert(crmTimelineEvents).values({
    workspaceId: params.workspaceId,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: params.eventType,
    eventCategory: 'communication',
    eventLabel: 'Inbound AI Call',
    summary: params.summary,
    occurredAt: new Date(),
    actorType: 'system',
    metadata: {
      aiCallId: params.aiCallId,
      conversationId: params.conversationId,
      callerPhone: params.callerPhone,
      channel: 'ai_voice',
      direction: 'inbound',
    },
  });
}

export const aiCallInboundRoutes = new Elysia({ prefix: '/webhooks/elevenlabs' })
  /**
   * POST /inbound - Receive incoming call webhook from ElevenLabs
   * This is called when ElevenLabs receives an incoming call on a configured number
   */
  .post(
    '/inbound',
    async ({ db, body, set }) => {
      console.log('[Inbound AI Call] Received webhook:', JSON.stringify(body, null, 2));

      try {
        const {
          conversation_id,
          agent_id,
          from_number, // Caller's phone number
          to_number,   // Our phone number that received the call
        } = body;

        if (!conversation_id || !from_number || !to_number) {
          console.error('[Inbound AI Call] Missing required fields');
          set.status = 400;
          return { error: 'Missing required fields: conversation_id, from_number, to_number' };
        }

        // Determine workspace from the receiving phone number
        let workspaceId = await getWorkspaceFromPhoneNumber(db, to_number);

        if (!workspaceId) {
          console.error('[Inbound AI Call] Could not determine workspace for phone:', to_number);
          // Use a fallback workspace if available from body
          workspaceId = body.workspace_id;
        }

        if (!workspaceId) {
          set.status = 400;
          return { error: 'Could not determine workspace for this phone number' };
        }

        // Look up the caller
        const callerContext = await lookupCaller(db, from_number, workspaceId);
        console.log('[Inbound AI Call] Caller context:', callerContext);

        // Create the base call record
        const [callRecord] = await db.insert(crmCalls).values({
          workspaceId,
          direction: 'inbound',
          toNumber: to_number,
          fromNumber: from_number,
          status: 'in_progress',
          purpose: 'ai_inbound',
          leadId: callerContext.entityType === 'lead' ? callerContext.entityId : null,
          contactId: callerContext.entityType === 'contact' ? callerContext.entityId : null,
          startedAt: new Date(),
        }).returning();

        // Create the AI call record
        const [aiCallRecord] = await db.insert(crmAiCalls).values({
          workspaceId,
          callId: callRecord.id,
          conversationId: conversation_id,
          agentId: agent_id || process.env['ELEVENLABS_AGENT_ID'] || 'default',
          direction: 'inbound',
          callerIdentified: callerContext.identified,
          identifiedEntityType: callerContext.entityType || null,
          identifiedEntityId: callerContext.entityId || null,
          callerPhoneNumber: from_number,
        }).returning();

        // Create conversation started event
        await db.insert(crmAiCallEvents).values({
          aiCallId: aiCallRecord.id,
          eventType: 'conversation_started',
          timestamp: new Date(),
          content: `Inbound call from ${from_number}`,
          metadata: {
            callerIdentified: callerContext.identified,
            entityType: callerContext.entityType,
            entityId: callerContext.entityId,
            callerName: callerContext.name,
          },
        });

        // Create timeline event if caller was identified
        if (callerContext.identified && callerContext.entityType && callerContext.entityId) {
          await createInboundCallTimelineEvent(db, {
            workspaceId,
            entityType: callerContext.entityType,
            entityId: callerContext.entityId,
            eventType: 'ai_call.inbound_received',
            summary: `Inbound AI call received from ${from_number}`,
            aiCallId: aiCallRecord.id,
            conversationId: conversation_id,
            callerPhone: from_number,
          });
        }

        // Build response with agent configuration
        // This tells ElevenLabs how to handle the call
        const systemPrompt = buildInboundSystemPrompt(callerContext);

        console.log('[Inbound AI Call] Created record:', aiCallRecord.id);

        return {
          success: true,
          aiCallId: aiCallRecord.id,
          callId: callRecord.id,
          conversationId: conversation_id,
          callerContext: {
            identified: callerContext.identified,
            entityType: callerContext.entityType,
            entityId: callerContext.entityId,
            name: callerContext.name,
          },
          // Agent configuration for ElevenLabs
          agent_config: {
            first_message: callerContext.greeting,
            system_prompt: systemPrompt,
            variables: {
              caller_name: callerContext.name || 'caller',
              caller_company: callerContext.context?.companyName || '',
              caller_phone: from_number,
              call_direction: 'inbound',
            },
          },
        };
      } catch (error) {
        console.error('[Inbound AI Call] Error:', error);
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : 'Failed to process inbound call',
        };
      }
    },
    {
      body: t.Object({
        conversation_id: t.String(),
        agent_id: t.Optional(t.String()),
        from_number: t.String(),
        to_number: t.String(),
        workspace_id: t.Optional(t.String()),
        // Additional ElevenLabs fields
        call_sid: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Calls', 'Webhooks'],
        summary: 'Receive inbound call webhook',
        description: 'Process incoming call from ElevenLabs with caller identification',
      },
    }
  );

/**
 * Inbound AI Call List Routes
 */
export const aiCallInboundListRoutes = new Elysia({ prefix: '/ai-calls/inbound' })
  /**
   * GET / - List inbound AI calls
   */
  .get(
    '/',
    async ({ db, query }) => {
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            eq(crmAiCalls.direction, 'inbound')
          )
        )
        .orderBy(desc(crmAiCalls.createdAt))
        .limit(query.limit ? parseInt(query.limit, 10) : 50);

      return { aiCalls };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Calls'],
        summary: 'List inbound AI calls',
        description: 'List all inbound AI voice calls for a workspace',
      },
    }
  )

  /**
   * GET /stats - Get inbound call statistics
   */
  .get(
    '/stats',
    async ({ db, query }) => {
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            eq(crmAiCalls.direction, 'inbound')
          )
        );

      const total = aiCalls.length;
      const identified = aiCalls.filter(c => c.callerIdentified).length;
      const unidentified = total - identified;
      const identificationRate = total > 0 ? Math.round(identified / total * 100) : 0;

      // Breakdown by entity type
      const leadCalls = aiCalls.filter(c => c.identifiedEntityType === 'lead').length;
      const contactCalls = aiCalls.filter(c => c.identifiedEntityType === 'contact').length;

      return {
        total,
        identified,
        unidentified,
        identificationRate,
        breakdown: {
          leads: leadCalls,
          contacts: contactCalls,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['AI Calls'],
        summary: 'Get inbound call statistics',
        description: 'Get statistics for inbound AI calls including identification rate',
      },
    }
  );
