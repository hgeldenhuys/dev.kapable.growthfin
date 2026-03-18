/**
 * Campaign Cost & ROI Service
 * Calculates financial performance metrics for campaigns
 *
 * Story: US-ANALYTICS-004
 * Performance requirement: <500ms
 */

import { eq, and, isNull, sum, sql, count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { crmCampaigns, crmLeads, crmOpportunities } from '@agios/db/schema';

/**
 * Cost & ROI metrics response structure
 */
export interface CampaignCostROI {
  campaignId: string;
  campaignName: string;
  totalCost: number;
  costPerLead: number;
  costPerAcquisition: number; // Cost per opportunity
  estimatedRevenue: number;
  roi: number; // ROI percentage
  leadsCreated: number;
  opportunitiesCreated: number;
  roiIndicator: 'positive' | 'negative' | 'breakeven' | 'insufficient_data';
}

/**
 * Get cost and ROI metrics for a specific campaign
 *
 * Calculations:
 * - totalCost: from campaign.customFields.totalCost (placeholder for MVP)
 * - costPerLead: totalCost / leadsCreated
 * - costPerAcquisition: totalCost / opportunitiesCreated
 * - estimatedRevenue: SUM(opportunities.amount) where lead.sourceEntity = 'campaign'
 * - roi: ((estimatedRevenue - totalCost) / totalCost) * 100
 *
 * @param db - Database instance
 * @param workspaceId - Workspace ID (for security isolation)
 * @param campaignId - Campaign ID
 * @returns Cost & ROI metrics or null if not found
 */
export async function getCampaignCostROI(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string
): Promise<CampaignCostROI | null> {
  const startTime = Date.now();

  // 1. Get campaign details and extract cost from customFields
  const campaign = await db.query.crmCampaigns.findFirst({
    where: and(
      eq(crmCampaigns.id, campaignId),
      eq(crmCampaigns.workspaceId, workspaceId),
      isNull(crmCampaigns.deletedAt)
    ),
    columns: {
      id: true,
      name: true,
      customFields: true,
    },
  });

  if (!campaign) {
    return null;
  }

  // Extract cost from customFields (placeholder for MVP)
  const totalCost = (campaign.customFields as any)?.totalCost || 0;

  // 2. Count leads generated from this campaign
  const leadsResult = await db
    .select({
      count: count(),
    })
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, workspaceId),
        eq(crmLeads.sourceEntity, 'campaign'),
        eq(crmLeads.sourceEntityId, campaignId),
        isNull(crmLeads.deletedAt)
      )
    );

  const leadsCreated = Number(leadsResult[0]?.count || 0);

  // 3. Get opportunities generated from leads that came from this campaign
  // AND sum their amounts for estimated revenue
  const opportunitiesResult = await db
    .select({
      count: count(),
      totalAmount: sum(crmOpportunities.amount),
    })
    .from(crmOpportunities)
    .innerJoin(crmLeads, eq(crmOpportunities.leadId, crmLeads.id))
    .where(
      and(
        eq(crmOpportunities.workspaceId, workspaceId),
        eq(crmLeads.sourceEntity, 'campaign'),
        eq(crmLeads.sourceEntityId, campaignId),
        isNull(crmOpportunities.deletedAt),
        isNull(crmLeads.deletedAt)
      )
    );

  const opportunitiesCreated = Number(opportunitiesResult[0]?.count || 0);
  const estimatedRevenue = Number(opportunitiesResult[0]?.totalAmount || 0);

  // 4. Calculate metrics with division by zero protection
  const costPerLead = leadsCreated > 0 ? totalCost / leadsCreated : 0;
  const costPerAcquisition = opportunitiesCreated > 0 ? totalCost / opportunitiesCreated : 0;

  // ROI calculation: ((revenue - cost) / cost) * 100
  // If no cost, ROI is N/A (handle as 0 with indicator)
  let roi = 0;
  let roiIndicator: 'positive' | 'negative' | 'breakeven' | 'insufficient_data' = 'insufficient_data';

  if (totalCost > 0 && estimatedRevenue > 0) {
    roi = ((estimatedRevenue - totalCost) / totalCost) * 100;

    // Determine indicator based on ROI
    if (roi > 5) {
      roiIndicator = 'positive'; // >5% is positive
    } else if (roi < -5) {
      roiIndicator = 'negative'; // <-5% is negative
    } else {
      roiIndicator = 'breakeven'; // Between -5% and 5% is breakeven
    }
  } else if (totalCost === 0 && estimatedRevenue > 0) {
    roiIndicator = 'positive'; // Revenue with no cost is always positive
    roi = Infinity; // Technically infinite ROI, but we'll represent as very high number
  }

  const queryTime = Date.now() - startTime;

  // Log performance warning if query takes too long
  if (queryTime > 500) {
    console.warn(
      `[campaign-cost-roi] Query took ${queryTime}ms for campaign ${campaignId} (threshold: 500ms)`
    );
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    totalCost,
    costPerLead: Number(costPerLead.toFixed(2)),
    costPerAcquisition: Number(costPerAcquisition.toFixed(2)),
    estimatedRevenue: Number(estimatedRevenue.toFixed(2)),
    roi: roi === Infinity ? 999999 : Number(roi.toFixed(2)), // Cap infinity at 999999%
    leadsCreated,
    opportunitiesCreated,
    roiIndicator,
  };
}
