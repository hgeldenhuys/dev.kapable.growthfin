/**
 * Campaign Metrics Service
 * Aggregates campaign performance metrics from recipients data
 *
 * Story: US-ANALYTICS-001
 * Performance requirement: <500ms for 10,000+ recipients
 */

import { eq, and, isNull, count, sum, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { crmCampaigns, crmCampaignRecipients } from '@agios/db/schema';

/**
 * Campaign metrics response structure
 */
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  engagementScore: number;
}

/**
 * Get comprehensive metrics for a specific campaign
 *
 * Performance optimized:
 * - Single database query using LEFT JOIN
 * - Aggregation done in SQL (not JavaScript)
 * - Leverages existing indexes on campaign_id and workspace_id
 *
 * @param db - Database instance
 * @param workspaceId - Workspace ID (for security isolation)
 * @param campaignId - Campaign ID
 * @returns Campaign metrics or null if not found
 */
export async function getCampaignMetrics(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string
): Promise<CampaignMetrics | null> {
  const startTime = Date.now();

  // Single optimized query that:
  // 1. Verifies campaign exists and belongs to workspace
  // 2. Aggregates all recipient metrics in one pass
  // 3. Uses CASE statements for conditional counting
  const result = await db
    .select({
      campaignId: crmCampaigns.id,
      campaignName: crmCampaigns.name,
      // Total recipients count
      totalRecipients: count(crmCampaignRecipients.id),
      // Sent = any status that indicates message was sent
      totalSent: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.status} IN ('sent', 'delivered', 'bounced')
          THEN 1
        END)
      `,
      // Delivered = successfully delivered
      totalDelivered: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.status} = 'delivered'
          THEN 1
        END)
      `,
      // Opened = recipients who opened at least once
      totalOpened: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.openCount} > 0
          THEN 1
        END)
      `,
      // Clicked = recipients who clicked at least once
      totalClicked: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.clickCount} > 0
          THEN 1
        END)
      `,
      // Bounced = hard or soft bounce
      totalBounced: sql<number>`
        COUNT(CASE
          WHEN ${crmCampaignRecipients.status} = 'bounced'
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
    .groupBy(crmCampaigns.id, crmCampaigns.name);

  // Campaign not found or doesn't belong to workspace
  if (!result || result.length === 0) {
    return null;
  }

  const data = result[0];

  // Convert aggregation results to numbers (SQL returns strings for aggregates)
  const totalRecipients = Number(data.totalRecipients || 0);
  const totalSent = Number(data.totalSent || 0);
  const totalDelivered = Number(data.totalDelivered || 0);
  const totalOpened = Number(data.totalOpened || 0);
  const totalClicked = Number(data.totalClicked || 0);
  const totalBounced = Number(data.totalBounced || 0);

  // Calculate rates with division by zero protection
  const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;
  const openRate = totalDelivered > 0 ? totalOpened / totalDelivered : 0;
  const clickRate = totalOpened > 0 ? totalClicked / totalOpened : 0;
  const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;

  // Engagement score: weighted average of open rate (40%) and click rate (60%)
  // Scaled to 0-100 for easier interpretation
  const engagementScore = (openRate * 0.4 + clickRate * 0.6) * 100;

  const queryTime = Date.now() - startTime;

  // Log performance warning if query takes too long
  if (queryTime > 500) {
    console.warn(
      `[campaign-metrics] Query took ${queryTime}ms for campaign ${campaignId} (threshold: 500ms)`
    );
  }

  return {
    campaignId: data.campaignId,
    campaignName: data.campaignName,
    totalRecipients,
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    deliveryRate,
    openRate,
    clickRate,
    bounceRate,
    engagementScore,
  };
}
