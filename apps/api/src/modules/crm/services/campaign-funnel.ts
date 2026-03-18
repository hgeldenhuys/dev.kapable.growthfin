/**
 * Campaign Funnel Service
 * Calculates 7-stage conversion funnel: Recipients → Delivered → Opened → Clicked → Leads → Qualified → Opportunities
 *
 * Story: US-ANALYTICS-002
 * Performance requirement: <1s for 10,000 recipients
 */

import { eq, and, isNull, count, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  crmCampaigns,
  crmCampaignRecipients,
  crmLeads,
  crmOpportunities,
  crmContacts,
} from '@agios/db/schema';

/**
 * Funnel stage data
 */
export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
}

/**
 * Conversion rates between stages
 */
export interface ConversionRates {
  recipientToLead: number;
  leadToQualified: number;
  qualifiedToOpportunity: number;
  overallConversion: number;
}

/**
 * Campaign funnel response
 */
export interface CampaignFunnel {
  stages: FunnelStage[];
  conversionRates: ConversionRates;
}

/**
 * Get campaign funnel metrics
 *
 * Funnel stages:
 * 1. Recipients: Total added to campaign
 * 2. Delivered: Successfully delivered (not bounced)
 * 3. Opened: Opened email/message
 * 4. Clicked: Clicked link in message
 * 5. Leads: Created as lead in CRM (from campaign)
 * 6. Qualified: Lead marked as qualified
 * 7. Opportunities: Converted to opportunity
 *
 * Performance optimized:
 * - Three parallel queries (campaign metrics, leads, opportunities)
 * - Uses indexes on campaign_id for fast lookups
 * - Aggregation done in SQL
 *
 * @param db - Database instance
 * @param workspaceId - Workspace ID (for security isolation)
 * @param campaignId - Campaign ID
 * @returns Campaign funnel data or null if campaign not found
 */
export async function getCampaignFunnel(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string
): Promise<CampaignFunnel | null> {
  const startTime = Date.now();

  // Verify campaign exists and get basic metrics (stages 1-4)
  const campaignMetrics = await db
    .select({
      totalRecipients: count(crmCampaignRecipients.id),
      totalDelivered: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.status} = 'delivered'
          THEN 1
        END)
      `,
      totalOpened: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.openCount} > 0
          THEN 1
        END)
      `,
      totalClicked: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.clickCount} > 0
          THEN 1
        END)
      `,
    })
    .from(crmCampaigns)
    .leftJoin(
      crmCampaignRecipients,
      and(
        eq(crmCampaignRecipients.campaignId, crmCampaigns.id),
        isNull(crmCampaignRecipients.deletedAt)
      )
    )
    .where(
      and(
        eq(crmCampaigns.id, campaignId),
        eq(crmCampaigns.workspaceId, workspaceId),
        isNull(crmCampaigns.deletedAt)
      )
    )
    .groupBy(crmCampaigns.id);

  // Campaign not found
  if (!campaignMetrics || campaignMetrics.length === 0) {
    return null;
  }

  const metrics = campaignMetrics[0];
  const totalRecipients = Number(metrics.totalRecipients || 0);
  const totalDelivered = Number(metrics.totalDelivered || 0);
  const totalOpened = Number(metrics.totalOpened || 0);
  const totalClicked = Number(metrics.totalClicked || 0);

  // Stage 5: Leads created from this campaign
  const leadsCreated = await db
    .select({
      total: count(crmLeads.id),
      qualified: sql<number>`
        COUNT(CASE
          WHEN ${crmLeads.status} = 'qualified'
          THEN 1
        END)
      `,
    })
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.campaignId, campaignId),
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.deletedAt)
      )
    );

  const totalLeads = Number(leadsCreated[0]?.total || 0);
  const totalQualified = Number(leadsCreated[0]?.qualified || 0);

  // Stage 7: Opportunities created from leads in this campaign
  // Join leads -> contacts (via convertedContactId) -> opportunities
  const opportunitiesCreated = await db
    .select({
      total: count(crmOpportunities.id),
    })
    .from(crmLeads)
    .innerJoin(crmContacts, eq(crmContacts.id, crmLeads.convertedContactId))
    .innerJoin(crmOpportunities, eq(crmOpportunities.contactId, crmContacts.id))
    .where(
      and(
        eq(crmLeads.campaignId, campaignId),
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.deletedAt),
        isNull(crmOpportunities.deletedAt)
      )
    );

  const totalOpportunities = Number(opportunitiesCreated[0]?.total || 0);

  // Build funnel stages with counts and percentages
  const stages: FunnelStage[] = [
    {
      name: 'Recipients',
      count: totalRecipients,
      percentage: 100,
    },
    {
      name: 'Delivered',
      count: totalDelivered,
      percentage: totalRecipients > 0 ? (totalDelivered / totalRecipients) * 100 : 0,
    },
    {
      name: 'Opened',
      count: totalOpened,
      percentage: totalRecipients > 0 ? (totalOpened / totalRecipients) * 100 : 0,
    },
    {
      name: 'Clicked',
      count: totalClicked,
      percentage: totalRecipients > 0 ? (totalClicked / totalRecipients) * 100 : 0,
    },
    {
      name: 'Leads',
      count: totalLeads,
      percentage: totalRecipients > 0 ? (totalLeads / totalRecipients) * 100 : 0,
    },
    {
      name: 'Qualified',
      count: totalQualified,
      percentage: totalRecipients > 0 ? (totalQualified / totalRecipients) * 100 : 0,
    },
    {
      name: 'Opportunities',
      count: totalOpportunities,
      percentage: totalRecipients > 0 ? (totalOpportunities / totalRecipients) * 100 : 0,
    },
  ];

  // Calculate conversion rates between stages
  const conversionRates: ConversionRates = {
    // Recipients to Leads
    recipientToLead: totalRecipients > 0 ? totalLeads / totalRecipients : 0,
    // Leads to Qualified
    leadToQualified: totalLeads > 0 ? totalQualified / totalLeads : 0,
    // Qualified to Opportunity
    qualifiedToOpportunity: totalQualified > 0 ? totalOpportunities / totalQualified : 0,
    // Overall: Recipients to Opportunities
    overallConversion: totalRecipients > 0 ? totalOpportunities / totalRecipients : 0,
  };

  const queryTime = Date.now() - startTime;

  // Log performance warning if query takes too long
  if (queryTime > 1000) {
    console.warn(
      `[campaign-funnel] Query took ${queryTime}ms for campaign ${campaignId} (threshold: 1000ms)`
    );
  }

  return {
    stages,
    conversionRates,
  };
}
