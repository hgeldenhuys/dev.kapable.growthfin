/**
 * Channel Performance Service
 * Aggregates performance metrics by channel (email, SMS, WhatsApp)
 *
 * Story: US-ANALYTICS-003
 * Performance requirement: <2s for all campaigns
 */

import { eq, and, isNull, count, sum, sql, gte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { crmCampaigns, crmCampaignRecipients, crmCampaignMessages } from '@agios/db/schema';

/**
 * Channel performance metrics
 */
export interface ChannelPerformance {
  channel: string;
  totalCampaigns: number;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  costPerSend: number; // Placeholder for future cost tracking
}

/**
 * Date range for filtering
 */
export type DateRange = '7d' | '30d' | '90d' | 'all';

/**
 * Get channel performance metrics
 *
 * Aggregates metrics per channel across all campaigns in the workspace.
 * Supports date range filtering.
 *
 * Performance optimized:
 * - Single query with conditional aggregation by channel
 * - Uses jsonb_array_elements_text to unnest channels array
 * - Leverages workspace_id index
 *
 * @param db - Database instance
 * @param workspaceId - Workspace ID (for security isolation)
 * @param dateRange - Date range filter (7d, 30d, 90d, all)
 * @returns Array of channel performance metrics
 */
export async function getChannelPerformance(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  dateRange: DateRange = '30d'
): Promise<ChannelPerformance[]> {
  const startTime = Date.now();

  // Calculate date filter based on range
  let dateFilter = sql`true`;
  if (dateRange !== 'all') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    dateFilter = gte(crmCampaigns.createdAt, dateThreshold);
  }

  // Query channel performance
  // Note: We use unnest() to expand the text[] channels array
  // This allows us to aggregate per channel even though campaigns can have multiple channels
  const channelMetrics = await db
    .select({
      channel: sql<string>`unnest(${crmCampaigns.channels})`,
      totalCampaigns: sql<number>`COUNT(DISTINCT ${crmCampaigns.id})`,
      totalSent: sum(crmCampaigns.totalSent),
      totalDelivered: sum(crmCampaigns.totalDelivered),
      totalOpened: sum(crmCampaigns.totalOpened),
      totalClicked: sum(crmCampaigns.totalClicked),
    })
    .from(crmCampaigns)
    .where(
      and(
        eq(crmCampaigns.workspaceId, workspaceId),
        isNull(crmCampaigns.deletedAt),
        dateFilter,
        // Only include campaigns that have at least one channel
        sql`array_length(${crmCampaigns.channels}, 1) > 0`
      )
    )
    .groupBy(sql`unnest(${crmCampaigns.channels})`);

  // Transform and calculate rates
  const results: ChannelPerformance[] = channelMetrics.map((metric) => {
    const totalSent = Number(metric.totalSent || 0);
    const totalDelivered = Number(metric.totalDelivered || 0);
    const totalOpened = Number(metric.totalOpened || 0);
    const totalClicked = Number(metric.totalClicked || 0);

    // Calculate rates with division by zero protection
    const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;
    const openRate = totalDelivered > 0 ? totalOpened / totalDelivered : 0;
    const clickRate = totalOpened > 0 ? totalClicked / totalOpened : 0;

    return {
      channel: metric.channel,
      totalCampaigns: Number(metric.totalCampaigns || 0),
      totalSent,
      deliveryRate,
      openRate,
      clickRate,
      costPerSend: 0, // Placeholder - will be calculated when cost tracking is implemented
    };
  });

  const queryTime = Date.now() - startTime;

  // Log performance warning if query takes too long
  if (queryTime > 2000) {
    console.warn(
      `[channel-performance] Query took ${queryTime}ms for workspace ${workspaceId} (threshold: 2000ms)`
    );
  }

  // Sort by total sent (highest first) for better UX
  return results.sort((a, b) => b.totalSent - a.totalSent);
}
