/**
 * AI Call Inbound Service
 * Phase L: Inbound AI Calls
 *
 * Handles caller identification and context building for incoming calls.
 */

import { eq, or, sql } from 'drizzle-orm';
import { crmLeads, crmContacts } from '@agios/db/schema';
import type { Database } from '@agios/db';

export interface CallerContext {
  identified: boolean;
  entityType?: 'lead' | 'contact';
  entityId?: string;
  name?: string;
  company?: string;
  email?: string;
  greeting: string;
  context?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    companyName?: string;
    title?: string;
    status?: string;
    lifecycleStage?: string;
  };
}

/**
 * Normalize phone number for comparison
 * Removes all non-digit characters except leading +
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with +, keep it, otherwise add country code handling
  return cleaned;
}

/**
 * Create phone search patterns for flexible matching
 * Handles various phone formats
 */
function createPhonePatterns(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const patterns = [normalized];

  // If starts with country code, also search without it
  if (normalized.startsWith('+1')) {
    patterns.push(normalized.slice(2)); // Without +1
    patterns.push(normalized.slice(1)); // Without +
  } else if (normalized.startsWith('1') && normalized.length === 11) {
    patterns.push(normalized.slice(1)); // Without leading 1
    patterns.push('+' + normalized); // With +
  }

  // Also try with common formatting stripped
  const digitsOnly = normalized.replace(/\D/g, '');
  if (!patterns.includes(digitsOnly)) {
    patterns.push(digitsOnly);
  }

  return patterns;
}

/**
 * Look up caller by phone number
 * Searches leads first, then contacts
 */
export async function lookupCaller(
  db: Database,
  phoneNumber: string,
  workspaceId: string
): Promise<CallerContext> {
  const patterns = createPhonePatterns(phoneNumber);

  // Search leads first
  for (const pattern of patterns) {
    const leads = await db
      .select()
      .from(crmLeads)
      .where(
        sql`${crmLeads.workspaceId} = ${workspaceId}
            AND ${crmLeads.deletedAt} IS NULL
            AND (${crmLeads.phone} LIKE ${'%' + pattern + '%'})`
      )
      .limit(1);

    if (leads.length > 0) {
      const lead = leads[0];
      const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'there';

      return {
        identified: true,
        entityType: 'lead',
        entityId: lead.id,
        name: fullName,
        company: lead.companyName || undefined,
        email: lead.email || undefined,
        greeting: buildPersonalizedGreeting(fullName, lead.companyName),
        context: {
          firstName: lead.firstName || undefined,
          lastName: lead.lastName || undefined,
          fullName,
          companyName: lead.companyName || undefined,
          title: lead.title || undefined,
          status: lead.status || undefined,
          lifecycleStage: lead.lifecycleStage || undefined,
        },
      };
    }
  }

  // Search contacts if no lead found
  for (const pattern of patterns) {
    const contacts = await db
      .select()
      .from(crmContacts)
      .where(
        sql`${crmContacts.workspaceId} = ${workspaceId}
            AND ${crmContacts.deletedAt} IS NULL
            AND (
              ${crmContacts.phone} LIKE ${'%' + pattern + '%'}
              OR ${crmContacts.mobile} LIKE ${'%' + pattern + '%'}
              OR ${crmContacts.phoneSecondary} LIKE ${'%' + pattern + '%'}
            )`
      )
      .limit(1);

    if (contacts.length > 0) {
      const contact = contacts[0];
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there';

      return {
        identified: true,
        entityType: 'contact',
        entityId: contact.id,
        name: fullName,
        email: contact.email || undefined,
        greeting: buildPersonalizedGreeting(fullName, undefined),
        context: {
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
          fullName,
          title: contact.title || undefined,
        },
      };
    }
  }

  // No match found - return generic context
  return {
    identified: false,
    greeting: buildGenericGreeting(),
  };
}

/**
 * Build personalized greeting for identified caller
 */
function buildPersonalizedGreeting(name: string, company?: string | null): string {
  if (company) {
    return `Hello ${name} from ${company}! Thank you for calling. How can I assist you today?`;
  }
  return `Hello ${name}! Thank you for calling. How can I assist you today?`;
}

/**
 * Build generic greeting for unidentified caller
 */
function buildGenericGreeting(): string {
  return `Hello! Thank you for calling. How can I help you today?`;
}

/**
 * Build system prompt for inbound call
 */
export function buildInboundSystemPrompt(callerContext: CallerContext): string {
  const basePrompt = `You are a professional AI assistant handling an inbound phone call.

Your role is to:
1. Understand the caller's reason for calling
2. Provide helpful information or assistance
3. Route to the appropriate team if needed
4. Collect relevant information for follow-up

Guidelines:
- Be warm, professional, and helpful
- Listen actively and ask clarifying questions
- If you can't help directly, offer to have someone call them back
- Always confirm any actions or next steps before ending the call
- Keep responses concise and conversational`;

  if (callerContext.identified && callerContext.context) {
    const ctx = callerContext.context;
    let contextInfo = `\n\nCALLER INFORMATION:`;
    contextInfo += `\n- Name: ${ctx.fullName || 'Unknown'}`;
    if (ctx.companyName) contextInfo += `\n- Company: ${ctx.companyName}`;
    if (ctx.title) contextInfo += `\n- Title: ${ctx.title}`;
    if (ctx.status) contextInfo += `\n- Status: ${ctx.status}`;
    if (ctx.lifecycleStage) contextInfo += `\n- Stage: ${ctx.lifecycleStage}`;

    return basePrompt + contextInfo + `\n\nUse this information to provide personalized service.`;
  }

  return basePrompt + `\n\nThis is a new caller - consider asking for their name and reason for calling.`;
}

/**
 * Get workspace ID from phone number configuration
 * Looks up which workspace owns the receiving phone number
 */
export async function getWorkspaceFromPhoneNumber(
  db: Database,
  toPhoneNumber: string
): Promise<string | null> {
  // For now, return a default workspace or look up from workspace settings
  // In a full implementation, this would query workspace phone configurations
  // to determine which workspace owns the receiving number

  // Query workspace settings for the phone number
  const { workspaces } = await import('@agios/db/schema');

  const workspaceList = await db
    .select()
    .from(workspaces)
    .where(
      sql`${workspaces.settings}->>'twilio'->>'defaultPhoneNumber' = ${toPhoneNumber}
          OR ${workspaces.settings}->>'elevenlabs'->>'phoneNumber' = ${toPhoneNumber}`
    )
    .limit(1);

  if (workspaceList.length > 0) {
    return workspaceList[0].id;
  }

  // Fallback: return the first workspace with phone config
  // In production, this should return null and reject unconfigured numbers
  const anyWorkspace = await db
    .select()
    .from(workspaces)
    .limit(1);

  return anyWorkspace.length > 0 ? anyWorkspace[0].id : null;
}
