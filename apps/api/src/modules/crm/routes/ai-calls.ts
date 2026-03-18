/**
 * AI Voice Call Routes
 * Endpoints for initiating and managing AI-powered voice calls via ElevenLabs
 * Phase I: AI Voice Calling (ElevenLabs Conversational AI)
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, isNull, lt } from 'drizzle-orm';
import { crmLeads, crmContacts, crmAiCalls, crmAiCallEvents, crmTimelineEvents, crmCalls } from '@agios/db/schema';
import { getElevenLabsVoiceAdapter } from '../../../lib/channels';
import type { Database } from '@agios/db';

/**
 * Get lead by ID with validation
 */
async function getLeadWithValidation(
  db: Database,
  id: string,
  workspaceId: string
) {
  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.id, id),
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.deletedAt)
      )
    )
    .limit(1);

  if (leads.length === 0) {
    throw new Error('Lead not found');
  }

  return leads[0];
}

/**
 * Get contact by ID with validation
 */
async function getContactWithValidation(
  db: Database,
  id: string,
  workspaceId: string
) {
  const contacts = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, id),
        eq(crmContacts.workspaceId, workspaceId),
        isNull(crmContacts.deletedAt)
      )
    )
    .limit(1);

  if (contacts.length === 0) {
    throw new Error('Contact not found');
  }

  return contacts[0];
}

/**
 * Create timeline event for AI call
 */
async function createAiCallTimelineEvent(
  db: Database,
  params: {
    workspaceId: string;
    entityType: 'lead' | 'contact';
    entityId: string;
    eventType: string;
    summary: string;
    aiCallId?: string;
    conversationId?: string;
    userId?: string;
  }
) {
  await db.insert(crmTimelineEvents).values({
    workspaceId: params.workspaceId,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: params.eventType,
    eventCategory: 'communication',
    eventLabel: 'AI Call',
    summary: params.summary,
    occurredAt: new Date(),
    actorType: params.userId ? 'user' : 'system',
    actorId: params.userId,
    metadata: {
      aiCallId: params.aiCallId,
      conversationId: params.conversationId,
      channel: 'ai_voice',
    },
  });
}

export const aiCallRoutes = new Elysia({ prefix: '/ai-calls' })
  /**
   * GET / - List AI calls for a workspace
   */
  .get(
    '/',
    async ({ db, query }) => {
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(eq(crmAiCalls.workspaceId, query.workspaceId))
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
        summary: 'List AI calls',
        description: 'List all AI voice calls for a workspace',
      },
    }
  )

  /**
   * GET /:id - Get AI call details with transcript
   */
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const [aiCall] = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.id, params.id),
            eq(crmAiCalls.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!aiCall) {
        set.status = 404;
        return { error: 'AI call not found' };
      }

      // Get events for this call
      const events = await db
        .select()
        .from(crmAiCallEvents)
        .where(eq(crmAiCallEvents.aiCallId, params.id))
        .orderBy(crmAiCallEvents.timestamp);

      return {
        call: aiCall,
        events,
        transcript: aiCall.transcript,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls'],
        summary: 'Get AI call details',
        description: 'Get AI call details including transcript and events',
      },
    }
  )

  /**
   * POST /:id/sync - Sync AI call data from ElevenLabs
   * Fetches latest conversation data from ElevenLabs API
   */
  .post(
    '/:id/sync',
    async ({ db, params, query, set }) => {
      const [aiCall] = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.id, params.id),
            eq(crmAiCalls.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!aiCall) {
        set.status = 404;
        return { error: 'AI call not found' };
      }

      if (!aiCall.conversationId) {
        set.status = 400;
        return { error: 'No conversation ID available' };
      }

      // Fetch conversation from ElevenLabs
      const apiKey = process.env['ELEVENLABS_API_KEY'];
      if (!apiKey) {
        set.status = 500;
        return { error: 'ElevenLabs API key not configured' };
      }

      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${aiCall.conversationId}`,
          {
            headers: {
              'xi-api-key': apiKey,
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('[AI Call Sync] ElevenLabs API error:', error);
          set.status = 502;
          return { error: 'Failed to fetch from ElevenLabs' };
        }

        const conversation = await response.json();

        // Build transcript from conversation turns
        let transcript = '';
        if (conversation.transcript && Array.isArray(conversation.transcript)) {
          transcript = conversation.transcript
            .map((turn: { role: string; message: string }) =>
              `${turn.role === 'agent' ? 'AI' : 'User'}: ${turn.message}`
            )
            .join('\n');
        }

        // Extract analysis data
        const analysis = conversation.analysis || {};
        const metadata = conversation.metadata || {};

        // Determine call outcome based on ElevenLabs status and metadata
        let callOutcome: string | null = null;
        const elStatus = conversation.status; // 'initiated', 'in-progress', 'processing', 'done', 'failed'
        const duration = metadata.call_duration_secs || 0;
        const termination = metadata.termination_reason || '';

        if (elStatus === 'done') {
          // Call completed - check if successful
          if (analysis.call_successful === true) {
            callOutcome = 'completed';
          } else if (analysis.call_successful === false) {
            callOutcome = 'failed';
          } else if (duration > 0) {
            callOutcome = 'completed';
          } else {
            callOutcome = 'no_answer';
          }
        } else if (elStatus === 'failed') {
          callOutcome = 'failed';
        } else if (elStatus === 'initiated' && duration === 0) {
          // Call never connected - check how old it is
          const createdAt = new Date(aiCall.createdAt);
          const ageMinutes = (Date.now() - createdAt.getTime()) / 60000;
          if (ageMinutes > 5) {
            // Call is over 5 minutes old with no progress - likely failed/no answer
            callOutcome = 'no_answer';
          }
          // Otherwise leave as null (still pending)
        }

        // Map termination reason to outcome if not already set
        if (!callOutcome && termination) {
          if (termination.includes('busy') || termination.includes('rejected')) {
            callOutcome = 'busy';
          } else if (termination.includes('no answer') || termination.includes('timeout')) {
            callOutcome = 'no_answer';
          } else if (termination.includes('voicemail')) {
            callOutcome = 'voicemail';
          } else if (termination.includes('failed') || termination.includes('error')) {
            callOutcome = 'failed';
          }
        }

        // Update the AI call record
        await db
          .update(crmAiCalls)
          .set({
            transcript: transcript || null,
            callOutcome,
            sentiment: analysis.user_sentiment || null,
            keyPoints: analysis.summary ? [analysis.summary] : [],
            analysis: {
              data_collection: analysis.data_collection || {},
              evaluation_criteria: analysis.evaluation_criteria || {},
              call_successful: analysis.call_successful,
              transcript_summary: analysis.transcript_summary,
              elevenlabs_status: elStatus,
              termination_reason: termination,
            },
            audioSeconds: duration || null,
            cost: metadata.cost ? String(metadata.cost) : null,
            updatedAt: new Date(),
          })
          .where(eq(crmAiCalls.id, params.id));

        console.log(`[AI Call Sync] Updated AI call ${params.id}: status=${elStatus}, outcome=${callOutcome}, duration=${duration}s`);

        return {
          success: true,
          conversationStatus: elStatus,
          callOutcome,
          hasTranscript: !!transcript,
          duration,
        };
      } catch (error) {
        console.error('[AI Call Sync] Error:', error);
        set.status = 500;
        return { error: error instanceof Error ? error.message : 'Sync failed' };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls'],
        summary: 'Sync AI call from ElevenLabs',
        description: 'Fetch and sync conversation data from ElevenLabs API',
      },
    }
  )

  /**
   * POST /sync-stale - Batch sync stale AI calls
   * Finds calls stuck in 'initiated' status for >5 minutes and syncs them
   */
  .post(
    '/sync-stale',
    async ({ db, query }) => {
      const apiKey = process.env['ELEVENLABS_API_KEY'];
      if (!apiKey) {
        return { error: 'ElevenLabs API key not configured', synced: 0 };
      }

      // Find AI calls that are stale (no outcome, older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const staleCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            isNull(crmAiCalls.callOutcome),
            lt(crmAiCalls.createdAt, fiveMinutesAgo)
          )
        )
        .limit(50); // Process up to 50 at a time

      const results: { id: string; status: string; outcome: string | null }[] = [];

      for (const aiCall of staleCalls) {
        if (!aiCall.conversationId) continue;

        try {
          const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${aiCall.conversationId}`,
            { headers: { 'xi-api-key': apiKey } }
          );

          if (!response.ok) continue;

          const conversation = await response.json();
          const elStatus = conversation.status;
          const duration = conversation.metadata?.call_duration_secs || 0;
          const termination = conversation.metadata?.termination_reason || '';

          // Determine outcome
          let callOutcome: string | null = null;
          if (elStatus === 'done' && duration > 0) {
            callOutcome = 'completed';
          } else if (elStatus === 'failed') {
            callOutcome = 'failed';
          } else if (elStatus === 'initiated' && duration === 0) {
            callOutcome = 'no_answer';
          } else if (termination.includes('busy')) {
            callOutcome = 'busy';
          } else if (termination.includes('voicemail')) {
            callOutcome = 'voicemail';
          }

          if (callOutcome) {
            // Build transcript
            let transcript = '';
            if (conversation.transcript && Array.isArray(conversation.transcript)) {
              transcript = conversation.transcript
                .map((turn: { role: string; message: string }) =>
                  `${turn.role === 'agent' ? 'AI' : 'User'}: ${turn.message}`
                )
                .join('\n');
            }

            await db
              .update(crmAiCalls)
              .set({
                callOutcome,
                transcript: transcript || null,
                audioSeconds: duration || null,
                cost: conversation.metadata?.cost ? String(conversation.metadata.cost) : null,
                analysis: {
                  elevenlabs_status: elStatus,
                  termination_reason: termination,
                },
                updatedAt: new Date(),
              })
              .where(eq(crmAiCalls.id, aiCall.id));

            results.push({ id: aiCall.id, status: elStatus, outcome: callOutcome });
          }
        } catch (err) {
          console.error(`[AI Call Sync] Failed to sync ${aiCall.id}:`, err);
        }
      }

      console.log(`[AI Call Sync] Batch synced ${results.length} stale calls`);
      return { synced: results.length, results };
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls'],
        summary: 'Batch sync stale AI calls',
        description: 'Find and sync AI calls stuck in initiated status for cleanup',
      },
    }
  );

/**
 * Lead AI Call Routes
 * POST /leads/:id/ai-call - Initiate AI call to a lead
 * GET /leads/:id/ai-calls - List AI calls for a lead
 */
export const leadAiCallRoutes = new Elysia({ prefix: '/leads' })
  /**
   * POST /:id/ai-call - Initiate AI call to lead
   */
  .post(
    '/:id/ai-call',
    async ({ db, params, body, set }) => {
      try {
        // Get lead with validation
        const lead = await getLeadWithValidation(db, params.id, body.workspaceId);

        // Validate phone number
        const phoneNumber = lead.phone;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'AI_CALL_001',
              message: 'Lead has no phone number',
            },
          };
        }

        // Get ElevenLabs adapter
        const elevenLabsAdapter = getElevenLabsVoiceAdapter();
        if (!elevenLabsAdapter) {
          set.status = 500;
          return {
            success: false,
            error: {
              code: 'AI_CALL_002',
              message: 'ElevenLabs voice adapter not configured',
            },
          };
        }

        // Build contact name
        const contactName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.companyName || 'there';

        console.log(`[AI Call] Initiating AI call to lead ${params.id}: ${phoneNumber}`);

        // Initiate AI call via ElevenLabs adapter
        const result = await elevenLabsAdapter.send({
          to: phoneNumber,
          workspaceId: body.workspaceId,
          content: body.customPrompt || '',
          metadata: {
            leadId: params.id,
            contactId: undefined,
            contactName,
            customPrompt: body.customPrompt,
            scriptId: body.scriptId, // Pass script for context building
          },
        } as any); // Cast to any to allow metadata extension

        if (!result.success) {
          console.error(`[AI Call] Failed to initiate:`, result.error);
          set.status = 500;
          return {
            success: false,
            error: {
              code: 'AI_CALL_003',
              message: result.error || 'Failed to initiate AI call',
            },
          };
        }

        // Extract IDs from metadata
        const aiCallId = result.metadata?.['aiCallId'] as string | undefined;
        const callId = result.metadata?.['callId'] as string | undefined;
        const conversationId = result.metadata?.['conversationId'] as string | undefined;

        // Create timeline event
        await createAiCallTimelineEvent(db, {
          workspaceId: body.workspaceId,
          entityType: 'lead',
          entityId: params.id,
          eventType: 'ai_call.initiated',
          summary: `AI call initiated to ${phoneNumber}`,
          aiCallId,
          conversationId,
          userId: body.userId,
        });

        // Update lead's last contact date
        await db
          .update(crmLeads)
          .set({
            lastContactDate: new Date(),
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmLeads.id, params.id));

        console.log(`[AI Call] Successfully initiated AI call. Conversation ID: ${conversationId}`);

        return {
          success: true,
          callId,
          aiCallId,
          conversationId,
        };
      } catch (error) {
        console.error('[AI Call] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'AI_CALL_004',
            message: error instanceof Error ? error.message : 'AI call failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
        customPrompt: t.Optional(t.String()),
        scriptId: t.Optional(t.String()), // AI call script to use
      }),
      detail: {
        tags: ['AI Calls', 'Leads'],
        summary: 'Initiate AI call to lead',
        description: 'Initiate an AI-powered voice call to a lead using ElevenLabs Conversational AI with optional script template',
      },
    }
  )

  /**
   * GET /:id/ai-calls - List AI calls for a lead
   */
  .get(
    '/:id/ai-calls',
    async ({ db, params, query }) => {
      // First get all calls for this lead
      const calls = await db
        .select({ id: crmCalls.id })
        .from(crmCalls)
        .where(
          and(
            eq(crmCalls.leadId, params.id),
            eq(crmCalls.workspaceId, query.workspaceId)
          )
        );

      const callIds = calls.map((c: { id: string }) => c.id);

      if (callIds.length === 0) {
        return { aiCalls: [] };
      }

      // Get AI calls linked to these calls
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(eq(crmAiCalls.workspaceId, query.workspaceId))
        .orderBy(desc(crmAiCalls.createdAt));

      // Filter to only AI calls linked to this lead's calls
      const filteredAiCalls = aiCalls.filter(
        (ac: { callId: string | null }) => ac.callId && callIds.includes(ac.callId)
      );

      return { aiCalls: filteredAiCalls };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls', 'Leads'],
        summary: 'List AI calls for lead',
        description: 'List all AI voice calls made to a specific lead',
      },
    }
  );

/**
 * Contact AI Call Routes
 * POST /contacts/:id/ai-call - Initiate AI call to a contact
 * GET /contacts/:id/ai-calls - List AI calls for a contact
 */
export const contactAiCallRoutes = new Elysia({ prefix: '/contacts' })
  /**
   * POST /:id/ai-call - Initiate AI call to contact
   */
  .post(
    '/:id/ai-call',
    async ({ db, params, body, set }) => {
      try {
        // Get contact with validation
        const contact = await getContactWithValidation(db, params.id, body.workspaceId);

        // Validate phone number (try phone, then mobile, then phoneSecondary)
        const phoneNumber = contact.phone || contact.mobile || contact.phoneSecondary;
        if (!phoneNumber) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'AI_CALL_001',
              message: 'Contact has no phone number',
            },
          };
        }

        // Get ElevenLabs adapter
        const elevenLabsAdapter = getElevenLabsVoiceAdapter();
        if (!elevenLabsAdapter) {
          set.status = 500;
          return {
            success: false,
            error: {
              code: 'AI_CALL_002',
              message: 'ElevenLabs voice adapter not configured',
            },
          };
        }

        // Build contact name
        const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there';

        console.log(`[AI Call] Initiating AI call to contact ${params.id}: ${phoneNumber}`);

        // Initiate AI call via ElevenLabs adapter
        const result = await elevenLabsAdapter.send({
          to: phoneNumber,
          workspaceId: body.workspaceId,
          content: body.customPrompt || '',
          metadata: {
            contactId: params.id,
            leadId: undefined,
            contactName,
            customPrompt: body.customPrompt,
            scriptId: body.scriptId, // Pass script for context building
          },
        } as any); // Cast to any to allow metadata extension

        if (!result.success) {
          console.error(`[AI Call] Failed to initiate:`, result.error);
          set.status = 500;
          return {
            success: false,
            error: {
              code: 'AI_CALL_003',
              message: result.error || 'Failed to initiate AI call',
            },
          };
        }

        // Extract IDs from metadata
        const aiCallId = result.metadata?.['aiCallId'] as string | undefined;
        const callId = result.metadata?.['callId'] as string | undefined;
        const conversationId = result.metadata?.['conversationId'] as string | undefined;

        // Create timeline event
        await createAiCallTimelineEvent(db, {
          workspaceId: body.workspaceId,
          entityType: 'contact',
          entityId: params.id,
          eventType: 'ai_call.initiated',
          summary: `AI call initiated to ${phoneNumber}`,
          aiCallId,
          conversationId,
          userId: body.userId,
        });

        // Update contact (no lastContactDate field on contacts, but updatedAt)
        await db
          .update(crmContacts)
          .set({
            updatedAt: new Date(),
            updatedBy: body.userId,
          })
          .where(eq(crmContacts.id, params.id));

        console.log(`[AI Call] Successfully initiated AI call. Conversation ID: ${conversationId}`);

        return {
          success: true,
          callId,
          aiCallId,
          conversationId,
        };
      } catch (error) {
        console.error('[AI Call] Error:', error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'AI_CALL_004',
            message: error instanceof Error ? error.message : 'AI call failed',
          },
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
        customPrompt: t.Optional(t.String()),
        scriptId: t.Optional(t.String()), // AI call script to use
      }),
      detail: {
        tags: ['AI Calls', 'Contacts'],
        summary: 'Initiate AI call to contact',
        description: 'Initiate an AI-powered voice call to a contact using ElevenLabs Conversational AI with optional script template',
      },
    }
  )

  /**
   * GET /:id/ai-calls - List AI calls for a contact
   */
  .get(
    '/:id/ai-calls',
    async ({ db, params, query }) => {
      // First get all calls for this contact
      const calls = await db
        .select({ id: crmCalls.id })
        .from(crmCalls)
        .where(
          and(
            eq(crmCalls.contactId, params.id),
            eq(crmCalls.workspaceId, query.workspaceId)
          )
        );

      const callIds = calls.map((c: { id: string }) => c.id);

      if (callIds.length === 0) {
        return { aiCalls: [] };
      }

      // Get AI calls linked to these calls
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(eq(crmAiCalls.workspaceId, query.workspaceId))
        .orderBy(desc(crmAiCalls.createdAt));

      // Filter to only AI calls linked to this contact's calls
      const filteredAiCalls = aiCalls.filter(
        (ac: { callId: string | null }) => ac.callId && callIds.includes(ac.callId)
      );

      return { aiCalls: filteredAiCalls };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls', 'Contacts'],
        summary: 'List AI calls for contact',
        description: 'List all AI voice calls made to a specific contact',
      },
    }
  );
