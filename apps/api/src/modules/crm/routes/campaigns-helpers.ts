/**
 * Campaign Helpers
 * Shared utility functions used across campaign routes
 */

import { eq, and, gt, gte, isNull } from 'drizzle-orm';
import type { Database } from '@agios/db';
import { crmCampaignRecipients } from '@agios/db';

/**
 * Engagement criteria for result list generation
 */
export interface EngagementCriteria {
  type: 'opened' | 'clicked' | 'bounced' | 'no_response' | 'delivered';
  minOpenCount?: number;
  minClickCount?: number;
}

/**
 * Query campaign recipients based on engagement criteria
 * Returns array of contact IDs matching the criteria
 */
export async function queryRecipientsByCriteria(
  db: Database,
  campaignId: string,
  workspaceId: string,
  criteria: EngagementCriteria
): Promise<string[]> {
  const baseConditions = [
    eq(crmCampaignRecipients.campaignId, campaignId),
    eq(crmCampaignRecipients.workspaceId, workspaceId),
    isNull(crmCampaignRecipients.deletedAt),
  ];

  let query = db
    .select({ contactId: crmCampaignRecipients.contactId })
    .from(crmCampaignRecipients);

  // Apply criteria-specific filtering
  switch (criteria.type) {
    case 'opened':
      query = query.where(
        and(
          ...baseConditions,
          gte(crmCampaignRecipients.openCount, criteria.minOpenCount || 0)
        )
      );
      break;

    case 'clicked':
      query = query.where(
        and(
          ...baseConditions,
          gte(crmCampaignRecipients.clickCount, criteria.minClickCount || 0)
        )
      );
      break;

    case 'bounced':
      query = query.where(
        and(
          ...baseConditions,
          eq(crmCampaignRecipients.status, 'bounced')
        )
      );
      break;

    case 'no_response':
      query = query.where(
        and(
          ...baseConditions,
          eq(crmCampaignRecipients.openCount, 0),
          eq(crmCampaignRecipients.clickCount, 0),
          eq(crmCampaignRecipients.status, 'delivered')
        )
      );
      break;

    case 'delivered':
      query = query.where(
        and(
          ...baseConditions,
          eq(crmCampaignRecipients.status, 'delivered')
        )
      );
      break;

    default:
      throw new Error(`Unknown engagement criteria type: ${criteria.type}`);
  }

  const results = await query;
  return results.map(r => r.contactId);
}
