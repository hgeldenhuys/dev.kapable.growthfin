/**
 * AI Call Context Service
 * Aggregates lead/contact data for AI voice calls
 * Provides full context to ElevenLabs agent
 */

import { eq, and, desc, isNull } from 'drizzle-orm';
import {
  crmLeads,
  crmContacts,
  crmTimelineEvents,
  crmAiCallScripts,
  crmCalls,
} from '@agios/db/schema';
import type { Database } from '@agios/db';

/**
 * Contact context for AI calls
 */
export interface AiCallContactContext {
  // Basic info
  id: string;
  entityType: 'lead' | 'contact';
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email?: string;

  // Company info
  companyName?: string;
  title?: string;
  department?: string;

  // Status
  status?: string;
  lifecycleStage?: string;
  leadScore?: number;

  // Custom fields
  customFields?: Record<string, any>;

  // History summary
  previousCalls: number;
  previousEmails: number;
  lastContactDate?: string;
  daysSinceLastContact?: number;

  // Recent timeline (last 5 events)
  recentActivity: Array<{
    type: string;
    summary: string;
    date: string;
  }>;

  // Notes summary
  notesSummary?: string;
}

/**
 * Script context for AI calls
 */
export interface AiCallScriptContext {
  id: string;
  name: string;
  purpose: string;
  objective?: string;
  opening: string;
  talkingPoints: string[];
  objectionHandlers: Record<string, string>;
  qualifyingQuestions: string[];
  closing?: string;
  endConditions?: {
    success: string[];
    failure: string[];
    neutral: string[];
  };
  systemPrompt?: string;
  voiceStyle?: {
    tone?: string;
    pace?: string;
    enthusiasm?: string;
  };
}

/**
 * Full context passed to AI agent
 */
export interface AiCallFullContext {
  contact: AiCallContactContext;
  script: AiCallScriptContext;
  companyContext: {
    name: string;
    productInfo?: string;
  };
}

/**
 * Build the system prompt for ElevenLabs agent
 */
export function buildSystemPrompt(context: AiCallFullContext): string {
  const { contact, script, companyContext } = context;

  // If script has a custom system prompt, use it with variable replacement
  if (script.systemPrompt) {
    return replaceVariables(script.systemPrompt, context);
  }

  // Build dynamic system prompt
  const prompt = `You are a professional ${getVoiceTone(script.voiceStyle?.tone)} sales representative from ${companyContext.name}.

## YOUR OBJECTIVE
${script.objective || `Complete the ${script.purpose} call successfully.`}

## WHO YOU'RE CALLING
- Name: ${contact.fullName}
${contact.companyName ? `- Company: ${contact.companyName}` : ''}
${contact.title ? `- Title: ${contact.title}` : ''}
${contact.status ? `- Status: ${contact.status}` : ''}
${contact.daysSinceLastContact !== undefined ? `- Last contact: ${contact.daysSinceLastContact} days ago` : ''}

## CALL HISTORY
- Previous calls: ${contact.previousCalls}
- Previous emails: ${contact.previousEmails}
${contact.recentActivity.length > 0 ? `
## RECENT ACTIVITY
${contact.recentActivity.map(a => `- ${a.date}: ${a.summary}`).join('\n')}
` : ''}
${contact.notesSummary ? `
## IMPORTANT NOTES
${contact.notesSummary}
` : ''}

## KEY TALKING POINTS
${script.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## QUESTIONS TO ASK
${script.qualifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## OBJECTION HANDLING
${Object.entries(script.objectionHandlers).map(([objection, response]) =>
  `If they say "${objection}": ${response}`
).join('\n')}

## HOW TO END THE CALL
Success conditions (goal achieved):
${script.endConditions?.success?.map(c => `- ${c}`).join('\n') || '- Lead agrees to next steps'}

If not interested:
${script.endConditions?.failure?.map(c => `- ${c}`).join('\n') || '- Thank them for their time and end politely'}

${script.closing ? `
## CLOSING SCRIPT
${script.closing}
` : ''}

## IMPORTANT RULES
- Be ${script.voiceStyle?.tone || 'professional'} and ${script.voiceStyle?.enthusiasm === 'high' ? 'enthusiastic' : 'calm'}
- Speak at a ${script.voiceStyle?.pace || 'normal'} pace
- Listen actively and respond naturally
- Never be pushy or aggressive
- If they need to go, offer to call back at a better time
- When the conversation naturally concludes, say goodbye and end the call`;

  return prompt;
}

/**
 * Build the first message (greeting)
 */
export function buildFirstMessage(context: AiCallFullContext): string {
  return replaceVariables(context.script.opening, context);
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(template: string, context: AiCallFullContext): string {
  const { contact, companyContext } = context;

  return template
    .replace(/\{\{contact_name\}\}/g, contact.firstName || 'there')
    .replace(/\{\{full_name\}\}/g, contact.fullName || 'there')
    .replace(/\{\{first_name\}\}/g, contact.firstName || 'there')
    .replace(/\{\{last_name\}\}/g, contact.lastName || '')
    .replace(/\{\{company\}\}/g, contact.companyName || 'your company')
    .replace(/\{\{title\}\}/g, contact.title || '')
    .replace(/\{\{company_name\}\}/g, companyContext.name)
    .replace(/\{\{status\}\}/g, contact.status || '')
    .replace(/\{\{days_since_contact\}\}/g, String(contact.daysSinceLastContact || 'a while'));
}

/**
 * Get voice tone description
 */
function getVoiceTone(tone?: string): string {
  switch (tone) {
    case 'friendly': return 'friendly and approachable';
    case 'casual': return 'casual and relaxed';
    case 'formal': return 'formal and respectful';
    default: return 'professional and courteous';
  }
}

/**
 * AI Call Context Service
 */
export const aiCallContextService = {
  /**
   * Get lead context for AI call
   */
  async getLeadContext(db: Database, leadId: string, workspaceId: string): Promise<AiCallContactContext | null> {
    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      )
      .limit(1);

    if (!lead) return null;

    // Get timeline events
    const timeline = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, leadId),
          eq(crmTimelineEvents.entityType, 'lead')
        )
      )
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(5);

    // Count previous calls and emails
    const callEvents = timeline.filter(e => e.eventType?.includes('call') || e.eventType?.includes('voice'));
    const emailEvents = timeline.filter(e => e.eventType?.includes('email'));

    // Calculate days since last contact
    let daysSinceLastContact: number | undefined;
    if (lead.lastContactDate) {
      const lastContact = new Date(lead.lastContactDate);
      const now = new Date();
      daysSinceLastContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      id: lead.id,
      entityType: 'lead',
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      fullName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.companyName || 'Unknown',
      phone: lead.phone || '',
      email: lead.email || undefined,
      companyName: lead.companyName || undefined,
      title: lead.title || undefined,
      status: lead.status || undefined,
      lifecycleStage: lead.lifecycleStage || undefined,
      leadScore: lead.leadScore || undefined,
      customFields: (lead.customFields as Record<string, any>) || undefined,
      previousCalls: callEvents.length,
      previousEmails: emailEvents.length,
      lastContactDate: lead.lastContactDate?.toISOString(),
      daysSinceLastContact,
      recentActivity: timeline.map(e => ({
        type: e.eventType || 'unknown',
        summary: e.summary || '',
        date: e.occurredAt?.toISOString().split('T')[0] || '',
      })),
      notesSummary: undefined, // TODO: Aggregate notes if needed
    };
  },

  /**
   * Get contact context for AI call
   */
  async getContactContext(db: Database, contactId: string, workspaceId: string): Promise<AiCallContactContext | null> {
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.workspaceId, workspaceId),
          isNull(crmContacts.deletedAt)
        )
      )
      .limit(1);

    if (!contact) return null;

    // Get timeline events
    const timeline = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, contactId),
          eq(crmTimelineEvents.entityType, 'contact')
        )
      )
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(5);

    // Count previous calls and emails
    const callEvents = timeline.filter(e => e.eventType?.includes('call') || e.eventType?.includes('voice'));
    const emailEvents = timeline.filter(e => e.eventType?.includes('email'));

    return {
      id: contact.id,
      entityType: 'contact',
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
      phone: contact.phone || contact.mobile || '',
      email: contact.email || undefined,
      title: contact.title || undefined,
      department: contact.department || undefined,
      status: contact.status || undefined,
      lifecycleStage: contact.lifecycleStage || undefined,
      customFields: (contact.customFields as Record<string, any>) || undefined,
      previousCalls: callEvents.length,
      previousEmails: emailEvents.length,
      lastContactDate: undefined, // Contacts don't have lastContactDate
      daysSinceLastContact: undefined,
      recentActivity: timeline.map(e => ({
        type: e.eventType || 'unknown',
        summary: e.summary || '',
        date: e.occurredAt?.toISOString().split('T')[0] || '',
      })),
      notesSummary: undefined,
    };
  },

  /**
   * Get script context for AI call
   */
  async getScriptContext(db: Database, scriptId: string, workspaceId: string): Promise<AiCallScriptContext | null> {
    const [script] = await db
      .select()
      .from(crmAiCallScripts)
      .where(
        and(
          eq(crmAiCallScripts.id, scriptId),
          eq(crmAiCallScripts.workspaceId, workspaceId),
          eq(crmAiCallScripts.isActive, true)
        )
      )
      .limit(1);

    if (!script) return null;

    return {
      id: script.id,
      name: script.name,
      purpose: script.purpose || 'custom',
      objective: script.objective || undefined,
      opening: script.opening,
      talkingPoints: (script.talkingPoints as string[]) || [],
      objectionHandlers: (script.objectionHandlers as Record<string, string>) || {},
      qualifyingQuestions: (script.qualifyingQuestions as string[]) || [],
      closing: script.closing || undefined,
      endConditions: script.endConditions as AiCallScriptContext['endConditions'],
      systemPrompt: script.systemPrompt || undefined,
      voiceStyle: script.voiceStyle as AiCallScriptContext['voiceStyle'],
    };
  },

  /**
   * Get default script for workspace
   */
  async getDefaultScript(db: Database, workspaceId: string): Promise<AiCallScriptContext | null> {
    const [script] = await db
      .select()
      .from(crmAiCallScripts)
      .where(
        and(
          eq(crmAiCallScripts.workspaceId, workspaceId),
          eq(crmAiCallScripts.isDefault, true),
          eq(crmAiCallScripts.isActive, true)
        )
      )
      .limit(1);

    if (!script) {
      // Fall back to any active script
      const [anyScript] = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.workspaceId, workspaceId),
            eq(crmAiCallScripts.isActive, true)
          )
        )
        .orderBy(desc(crmAiCallScripts.useCount))
        .limit(1);

      if (!anyScript) return null;

      return {
        id: anyScript.id,
        name: anyScript.name,
        purpose: anyScript.purpose || 'custom',
        objective: anyScript.objective || undefined,
        opening: anyScript.opening,
        talkingPoints: (anyScript.talkingPoints as string[]) || [],
        objectionHandlers: (anyScript.objectionHandlers as Record<string, string>) || {},
        qualifyingQuestions: (anyScript.qualifyingQuestions as string[]) || [],
        closing: anyScript.closing || undefined,
        endConditions: anyScript.endConditions as AiCallScriptContext['endConditions'],
        systemPrompt: anyScript.systemPrompt || undefined,
        voiceStyle: anyScript.voiceStyle as AiCallScriptContext['voiceStyle'],
      };
    }

    return {
      id: script.id,
      name: script.name,
      purpose: script.purpose || 'custom',
      objective: script.objective || undefined,
      opening: script.opening,
      talkingPoints: (script.talkingPoints as string[]) || [],
      objectionHandlers: (script.objectionHandlers as Record<string, string>) || {},
      qualifyingQuestions: (script.qualifyingQuestions as string[]) || [],
      closing: script.closing || undefined,
      endConditions: script.endConditions as AiCallScriptContext['endConditions'],
      systemPrompt: script.systemPrompt || undefined,
      voiceStyle: script.voiceStyle as AiCallScriptContext['voiceStyle'],
    };
  },

  /**
   * Get full context for AI call
   */
  async getFullContext(
    db: Database,
    params: {
      workspaceId: string;
      leadId?: string;
      contactId?: string;
      scriptId?: string;
    }
  ): Promise<AiCallFullContext | null> {
    // Get contact context
    let contactContext: AiCallContactContext | null = null;
    if (params.leadId) {
      contactContext = await this.getLeadContext(db, params.leadId, params.workspaceId);
    } else if (params.contactId) {
      contactContext = await this.getContactContext(db, params.contactId, params.workspaceId);
    }

    if (!contactContext) return null;

    // Get script context
    let scriptContext: AiCallScriptContext | null = null;
    if (params.scriptId) {
      scriptContext = await this.getScriptContext(db, params.scriptId, params.workspaceId);
    }
    if (!scriptContext) {
      scriptContext = await this.getDefaultScript(db, params.workspaceId);
    }

    // If no script, create a basic fallback
    if (!scriptContext) {
      scriptContext = {
        id: 'default',
        name: 'Default Script',
        purpose: 'qualification',
        objective: 'Qualify the lead and determine their interest',
        opening: `Hi {{contact_name}}, this is a call from {{company_name}}. Is now a good time to talk?`,
        talkingPoints: [
          'Understand their current challenges',
          'Explain how we can help',
          'Gauge their interest level',
        ],
        objectionHandlers: {
          'not interested': "I understand. Could you share what's holding you back? We might have a solution.",
          'too busy': "No problem at all. When would be a better time to connect?",
          'already have a solution': "That's great you have something in place. What would make you consider alternatives?",
        },
        qualifyingQuestions: [
          'What challenges are you currently facing in this area?',
          'What solutions have you tried before?',
          'What would an ideal solution look like for you?',
        ],
        closing: "Thank you for your time today. I'll follow up with the information we discussed.",
        endConditions: {
          success: ['Lead agrees to a follow-up', 'Lead requests more information'],
          failure: ['Lead explicitly not interested', 'Wrong contact'],
          neutral: ['Lead needs time to think', 'Call back requested'],
        },
      };
    }

    return {
      contact: contactContext,
      script: scriptContext,
      companyContext: {
        name: 'GrowthFin', // TODO: Get from workspace settings
        productInfo: undefined,
      },
    };
  },
};
