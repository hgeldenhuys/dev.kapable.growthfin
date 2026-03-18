/**
 * Contact Update Tool
 * Allows AI to update contact information with full timeline audit trail
 */

import { db } from '@agios/db';
import { crmContacts, crmTimelineEvents } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export interface ContactUpdate {
  contactId: string;
  workspaceId: string;
  updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    emailSecondary: string;
    phone: string;
    phoneSecondary: string;
    mobile: string;
    title: string;
    department: string;
    customFields: Record<string, any>;
    tags: string[];
    leadScore: number;
    engagementScore: number;
    lifecycleStage: 'raw' | 'verified' | 'engaged' | 'customer';
    status: 'active' | 'inactive' | 'do_not_contact';
  }>;
  reason: string; // Why AI is making this update
  source: string; // Which enrichment source prompted this (e.g., "linkedin", "web_search")
}

export interface ContactUpdateResult {
  success: boolean;
  contactId: string;
  timelineEventId?: string;
  updatedFields: string[];
  error?: string;
}

export class ContactUpdateTool {
  /**
   * Update a contact with AI-driven changes and log to timeline
   */
  async updateContact(update: ContactUpdate): Promise<ContactUpdateResult> {
    try {
      // Validate contact exists and belongs to workspace
      const [contact] = await db
        .select()
        .from(crmContacts)
        .where(eq(crmContacts.id, update.contactId))
        .limit(1);

      if (!contact) {
        return {
          success: false,
          contactId: update.contactId,
          updatedFields: [],
          error: 'Contact not found',
        };
      }

      if (contact.workspaceId !== update.workspaceId) {
        return {
          success: false,
          contactId: update.contactId,
          updatedFields: [],
          error: 'Contact does not belong to this workspace',
        };
      }

      // Track what changed
      const dataChanges: Record<string, { old: any; new: any }> = {};
      const updatedFields: string[] = [];

      // Build changes object
      for (const [field, newValue] of Object.entries(update.updates)) {
        const oldValue = contact[field as keyof typeof contact];

        // Only track actual changes
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          dataChanges[field] = {
            old: oldValue,
            new: newValue,
          };
          updatedFields.push(field);
        }
      }

      // If nothing changed, return success without updating
      if (updatedFields.length === 0) {
        return {
          success: true,
          contactId: update.contactId,
          updatedFields: [],
        };
      }

      // Update contact
      await db
        .update(crmContacts)
        .set({
          ...update.updates,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, update.contactId));

      // Create timeline event for audit trail
      const summary = `AI enrichment updated ${updatedFields.length} field${
        updatedFields.length === 1 ? '' : 's'
      }: ${updatedFields.join(', ')}`;

      const [timelineEvent] = await db
        .insert(crmTimelineEvents)
        .values({
          workspaceId: update.workspaceId,
          entityType: 'contact',
          entityId: update.contactId,
          eventType: 'contact.ai_enriched',
          eventCategory: 'data',
          eventLabel: 'AI Enrichment',
          summary,
          description: update.reason,
          occurredAt: new Date(),
          actorType: 'system',
          actorName: 'AI Enrichment',
          dataChanges,
          metadata: {
            source: update.source,
            updatedFields,
            aiDriven: true,
          },
        })
        .returning();

      console.log(
        `✅ Contact ${update.contactId} updated: ${updatedFields.join(', ')}`
      );

      return {
        success: true,
        contactId: update.contactId,
        timelineEventId: timelineEvent.id,
        updatedFields,
      };
    } catch (error) {
      console.error(
        '❌ Contact update failed:',
        error instanceof Error ? error.message : error
      );
      return {
        success: false,
        contactId: update.contactId,
        updatedFields: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch update multiple contacts
   */
  async batchUpdateContacts(
    updates: ContactUpdate[]
  ): Promise<ContactUpdateResult[]> {
    const results: ContactUpdateResult[] = [];

    for (const update of updates) {
      const result = await this.updateContact(update);
      results.push(result);
    }

    return results;
  }

  /**
   * Format result for AI consumption
   */
  formatForAI(result: ContactUpdateResult): string {
    if (!result.success) {
      return `Failed to update contact: ${result.error}`;
    }

    if (result.updatedFields.length === 0) {
      return 'No changes needed - contact already has this information.';
    }

    let formatted = `Successfully updated contact:\n`;
    formatted += `Updated fields: ${result.updatedFields.join(', ')}\n`;
    formatted += `Timeline event created: ${result.timelineEventId}\n`;

    return formatted;
  }
}

// Singleton instance
let contactUpdateToolInstance: ContactUpdateTool | null = null;

/**
 * Get or create singleton contact update tool instance
 */
export function getContactUpdateTool(): ContactUpdateTool {
  if (!contactUpdateToolInstance) {
    contactUpdateToolInstance = new ContactUpdateTool();
  }
  return contactUpdateToolInstance;
}

/**
 * OpenRouter function definition for contact update tool
 */
export const contactUpdateFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'update_contact',
    description:
      'Update a contact with enriched information. Use this to save verified data from other tools (web search, LinkedIn, email verification, etc.) to the contact record. All updates are logged to the timeline for full audit trail. Only update fields where you have high confidence in the data quality.',
    parameters: {
      type: 'object',
      properties: {
        contact_id: {
          type: 'string',
          description: 'UUID of the contact to update',
        },
        workspace_id: {
          type: 'string',
          description: 'UUID of the workspace',
        },
        updates: {
          type: 'object',
          description: 'Fields to update (only include fields you want to change)',
          properties: {
            first_name: { type: 'string', description: 'First name' },
            last_name: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Primary email' },
            email_secondary: { type: 'string', description: 'Secondary email' },
            phone: { type: 'string', description: 'Primary phone' },
            phone_secondary: { type: 'string', description: 'Secondary phone' },
            mobile: { type: 'string', description: 'Mobile phone' },
            title: { type: 'string', description: 'Job title' },
            department: { type: 'string', description: 'Department' },
            custom_fields: {
              type: 'object',
              description:
                'Custom fields (JSON object) - store enriched data like linkedin_url, company_info, etc.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to add or replace',
            },
            lead_score: {
              type: 'number',
              description: 'Lead score 0-100',
              minimum: 0,
              maximum: 100,
            },
            engagement_score: {
              type: 'number',
              description: 'Engagement score 0-100',
              minimum: 0,
              maximum: 100,
            },
            lifecycle_stage: {
              type: 'string',
              enum: ['raw', 'verified', 'engaged', 'customer'],
              description: 'Contact lifecycle stage',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'do_not_contact'],
              description: 'Contact status',
            },
          },
        },
        reason: {
          type: 'string',
          description:
            'Brief explanation of why you are making this update (e.g., "LinkedIn profile shows current title as CTO")',
        },
        source: {
          type: 'string',
          description:
            'Which enrichment source prompted this update (e.g., "linkedin", "web_search", "email_verification")',
        },
      },
      required: ['contact_id', 'workspace_id', 'updates', 'reason', 'source'],
    },
  },
};
