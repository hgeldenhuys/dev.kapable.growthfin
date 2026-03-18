/**
 * Analytics Export Service
 * Generates CSV exports for campaign analytics data
 *
 * Story: US-ANALYTICS-005
 * Performance requirement: <5s for typical campaigns
 */

import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  crmCampaigns,
  crmCampaignRecipients,
  crmCampaignMessages,
  crmContacts,
} from '@agios/db/schema';
import { generateCSV } from '../../../lib/csv-utils';
import { getCampaignMetrics } from './campaign-metrics';
import { getCampaignFunnel } from './campaign-funnel';
import { getCampaignCostROI } from './campaign-cost-roi';

/**
 * Export types supported
 */
export type ExportType = 'campaign_metrics' | 'funnel_data' | 'channel_performance' | 'recipient_details';

/**
 * Generate campaign metrics CSV
 * When campaignId is null, exports metrics for all campaigns in the workspace
 */
async function exportCampaignMetrics(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string | null
): Promise<string> {
  if (campaignId) {
    // Single campaign export
    const metrics = await getCampaignMetrics(db, workspaceId, campaignId);
    const costROI = await getCampaignCostROI(db, workspaceId, campaignId);

    if (!metrics) {
      throw new Error('Campaign not found');
    }

    const data = [
      {
        'Campaign ID': metrics.campaignId,
        'Campaign Name': metrics.campaignName,
        'Total Recipients': metrics.totalRecipients,
        'Total Sent': metrics.totalSent,
        'Total Delivered': metrics.totalDelivered,
        'Total Opened': metrics.totalOpened,
        'Total Clicked': metrics.totalClicked,
        'Total Bounced': metrics.totalBounced,
        'Delivery Rate (%)': (metrics.deliveryRate * 100).toFixed(2),
        'Open Rate (%)': (metrics.openRate * 100).toFixed(2),
        'Click Rate (%)': (metrics.clickRate * 100).toFixed(2),
        'Bounce Rate (%)': (metrics.bounceRate * 100).toFixed(2),
        'Engagement Score': metrics.engagementScore.toFixed(2),
        ...(costROI && {
          'Total Cost': costROI.totalCost,
          'Cost Per Lead': costROI.costPerLead,
          'Cost Per Acquisition': costROI.costPerAcquisition,
          'Estimated Revenue': costROI.estimatedRevenue,
          'ROI (%)': costROI.roi,
          'ROI Indicator': costROI.roiIndicator,
          'Leads Created': costROI.leadsCreated,
          'Opportunities Created': costROI.opportunitiesCreated,
        }),
        'Exported At': new Date().toISOString(),
      },
    ];

    return generateCSV(data);
  }

  // Workspace-wide: export summary for all campaigns
  const campaigns = await db
    .select({
      id: crmCampaigns.id,
      name: crmCampaigns.name,
      status: crmCampaigns.status,
      channels: crmCampaigns.channels,
      totalSent: crmCampaigns.totalSent,
      totalDelivered: crmCampaigns.totalDelivered,
      totalOpened: crmCampaigns.totalOpened,
      totalClicked: crmCampaigns.totalClicked,
      createdAt: crmCampaigns.createdAt,
      updatedAt: crmCampaigns.updatedAt,
    })
    .from(crmCampaigns)
    .where(
      and(
        eq(crmCampaigns.workspaceId, workspaceId),
        isNull(crmCampaigns.deletedAt)
      )
    )
    .orderBy(desc(crmCampaigns.createdAt));

  const data = [];
  for (const c of campaigns) {
    const sent = Number(c.totalSent || 0);
    const delivered = Number(c.totalDelivered || 0);
    const opened = Number(c.totalOpened || 0);
    const clicked = Number(c.totalClicked || 0);
    const bounced = sent - delivered;

    data.push({
      'Campaign ID': c.id,
      'Campaign Name': c.name,
      'Status': c.status || '',
      'Channels': Array.isArray(c.channels) ? (c.channels as string[]).join(', ') : '',
      'Total Sent': sent,
      'Total Delivered': delivered,
      'Total Opened': opened,
      'Total Clicked': clicked,
      'Total Bounced': bounced,
      'Delivery Rate (%)': sent > 0 ? ((delivered / sent) * 100).toFixed(2) : '0.00',
      'Open Rate (%)': delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : '0.00',
      'Click Rate (%)': opened > 0 ? ((clicked / opened) * 100).toFixed(2) : '0.00',
      'Bounce Rate (%)': sent > 0 ? ((bounced / sent) * 100).toFixed(2) : '0.00',
      'Created At': c.createdAt?.toISOString() || '',
      'Last Updated': c.updatedAt?.toISOString() || '',
      'Exported At': new Date().toISOString(),
    });
  }

  if (data.length === 0) {
    data.push({
      'Campaign ID': '',
      'Campaign Name': 'No campaigns found',
      'Status': '',
      'Channels': '',
      'Total Sent': 0,
      'Total Delivered': 0,
      'Total Opened': 0,
      'Total Clicked': 0,
      'Total Bounced': 0,
      'Delivery Rate (%)': '0.00',
      'Open Rate (%)': '0.00',
      'Click Rate (%)': '0.00',
      'Bounce Rate (%)': '0.00',
      'Created At': '',
      'Last Updated': '',
      'Exported At': new Date().toISOString(),
    });
  }

  return generateCSV(data);
}

/**
 * Generate funnel data CSV
 * Requires a specific campaignId
 */
async function exportFunnelData(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string | null
): Promise<string> {
  if (!campaignId) {
    throw new Error('Funnel export requires a specific campaign. Please select a campaign first.');
  }

  const funnel = await getCampaignFunnel(db, workspaceId, campaignId);

  if (!funnel) {
    throw new Error('Campaign not found');
  }

  const data = funnel.stages.map((stage: any, index: number) => ({
    'Stage Order': index + 1,
    'Stage Name': stage.name,
    'Count': stage.count,
    'Percentage (%)': stage.percentage.toFixed(2),
    'Drop Off from Previous': index > 0
      ? (funnel.stages[index - 1].count - stage.count).toString()
      : '0',
    'Drop Off Rate (%)': index > 0
      ? (((funnel.stages[index - 1].count - stage.count) / funnel.stages[index - 1].count) * 100).toFixed(2)
      : '0.00',
  }));

  // Add conversion rates summary
  data.push({
    'Stage Order': '',
    'Stage Name': '--- CONVERSION RATES ---',
    'Count': '',
    'Percentage (%)': '',
    'Drop Off from Previous': '',
    'Drop Off Rate (%)': '',
  });

  data.push({
    'Stage Order': '',
    'Stage Name': 'Recipient → Lead',
    'Count': '',
    'Percentage (%)': (funnel.conversionRates.recipientToLead * 100).toFixed(3),
    'Drop Off from Previous': '',
    'Drop Off Rate (%)': '',
  });

  data.push({
    'Stage Order': '',
    'Stage Name': 'Lead → Qualified',
    'Count': '',
    'Percentage (%)': (funnel.conversionRates.leadToQualified * 100).toFixed(3),
    'Drop Off from Previous': '',
    'Drop Off Rate (%)': '',
  });

  data.push({
    'Stage Order': '',
    'Stage Name': 'Qualified → Opportunity',
    'Count': '',
    'Percentage (%)': (funnel.conversionRates.qualifiedToOpportunity * 100).toFixed(3),
    'Drop Off from Previous': '',
    'Drop Off Rate (%)': '',
  });

  data.push({
    'Stage Order': '',
    'Stage Name': 'Overall Conversion',
    'Count': '',
    'Percentage (%)': (funnel.conversionRates.overallConversion * 100).toFixed(3),
    'Drop Off from Previous': '',
    'Drop Off Rate (%)': '',
  });

  return generateCSV(data);
}

/**
 * Generate channel performance CSV
 * When campaignId is null, aggregates across all campaigns
 */
async function exportChannelPerformance(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string | null
): Promise<string> {
  // Build campaign filter
  const campaignFilter = campaignId
    ? and(
        eq(crmCampaignRecipients.campaignId, campaignId),
        eq(crmCampaignRecipients.workspaceId, workspaceId),
        isNull(crmCampaignRecipients.deletedAt)
      )
    : and(
        eq(crmCampaignRecipients.workspaceId, workspaceId),
        isNull(crmCampaignRecipients.deletedAt)
      );

  // Get channel breakdown by joining recipients → messages for channel info
  const channelStats = await db
    .select({
      channel: crmCampaignMessages.channel,
      totalSent: sql<number>`COUNT(CASE WHEN ${crmCampaignRecipients.status} IN ('sent', 'delivered', 'bounced') THEN 1 END)`,
      totalDelivered: sql<number>`COUNT(CASE WHEN ${crmCampaignRecipients.status} = 'delivered' THEN 1 END)`,
      totalOpened: sql<number>`COUNT(CASE WHEN ${crmCampaignRecipients.openCount} > 0 THEN 1 END)`,
      totalClicked: sql<number>`COUNT(CASE WHEN ${crmCampaignRecipients.clickCount} > 0 THEN 1 END)`,
    })
    .from(crmCampaignRecipients)
    .leftJoin(crmCampaignMessages, eq(crmCampaignRecipients.messageId, crmCampaignMessages.id))
    .where(campaignFilter)
    .groupBy(crmCampaignMessages.channel);

  const channelData = [];
  for (const row of channelStats) {
    const sent = Number(row.totalSent || 0);
    const delivered = Number(row.totalDelivered || 0);
    const opened = Number(row.totalOpened || 0);
    const clicked = Number(row.totalClicked || 0);

    channelData.push({
      'Channel': row.channel || 'unknown',
      'Total Sent': sent,
      'Total Delivered': delivered,
      'Total Opened': opened,
      'Total Clicked': clicked,
      'Delivery Rate (%)': sent > 0 ? ((delivered / sent) * 100).toFixed(2) : '0.00',
      'Open Rate (%)': delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : '0.00',
      'Click Rate (%)': opened > 0 ? ((clicked / opened) * 100).toFixed(2) : '0.00',
    });
  }

  if (channelData.length === 0) {
    channelData.push({
      'Channel': 'No data',
      'Total Sent': 0,
      'Total Delivered': 0,
      'Total Opened': 0,
      'Total Clicked': 0,
      'Delivery Rate (%)': '0.00',
      'Open Rate (%)': '0.00',
      'Click Rate (%)': '0.00',
    });
  }

  return generateCSV(channelData);
}

/**
 * Generate recipient details CSV
 * Joins with crmContacts for name/email since crmCampaignRecipients only has contactId
 * When campaignId is null, exports across all campaigns
 */
async function exportRecipientDetails(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string | null
): Promise<string> {
  // Build filter
  const filters = [
    eq(crmCampaignRecipients.workspaceId, workspaceId),
    isNull(crmCampaignRecipients.deletedAt),
  ];
  if (campaignId) {
    filters.push(eq(crmCampaignRecipients.campaignId, campaignId));
  }

  // Join with contacts for name/email and campaigns for campaign name
  const recipients = await db
    .select({
      id: crmCampaignRecipients.id,
      campaignId: crmCampaignRecipients.campaignId,
      campaignName: crmCampaigns.name,
      contactEmail: crmContacts.email,
      contactFirstName: crmContacts.firstName,
      contactLastName: crmContacts.lastName,
      contactTitle: crmContacts.title,
      status: crmCampaignRecipients.status,
      statusReason: crmCampaignRecipients.statusReason,
      sentAt: crmCampaignRecipients.sentAt,
      deliveredAt: crmCampaignRecipients.deliveredAt,
      openCount: crmCampaignRecipients.openCount,
      clickCount: crmCampaignRecipients.clickCount,
      firstOpenedAt: crmCampaignRecipients.firstOpenedAt,
      firstClickedAt: crmCampaignRecipients.firstClickedAt,
      bounceType: crmCampaignRecipients.bounceType,
      bounceDescription: crmCampaignRecipients.bounceDescription,
      channel: crmCampaignMessages.channel,
    })
    .from(crmCampaignRecipients)
    .leftJoin(crmContacts, eq(crmCampaignRecipients.contactId, crmContacts.id))
    .leftJoin(crmCampaigns, eq(crmCampaignRecipients.campaignId, crmCampaigns.id))
    .leftJoin(crmCampaignMessages, eq(crmCampaignRecipients.messageId, crmCampaignMessages.id))
    .where(and(...filters))
    .orderBy(desc(crmCampaignRecipients.sentAt))
    .limit(10000);

  const data = [];
  for (const r of recipients) {
    data.push({
      'Recipient ID': r.id,
      'Campaign': r.campaignName || r.campaignId || '',
      'Email': r.contactEmail || '',
      'First Name': r.contactFirstName || '',
      'Last Name': r.contactLastName || '',
      'Title': r.contactTitle || '',
      'Channel': r.channel || '',
      'Status': r.status,
      'Status Reason': r.statusReason || '',
      'Sent At': r.sentAt ? new Date(r.sentAt).toISOString() : '',
      'Delivered At': r.deliveredAt ? new Date(r.deliveredAt).toISOString() : '',
      'Open Count': r.openCount || 0,
      'Click Count': r.clickCount || 0,
      'First Opened At': r.firstOpenedAt ? new Date(r.firstOpenedAt).toISOString() : '',
      'First Clicked At': r.firstClickedAt ? new Date(r.firstClickedAt).toISOString() : '',
      'Bounce Type': r.bounceType || '',
      'Bounce Description': r.bounceDescription || '',
    });
  }

  if (data.length === 0) {
    data.push({
      'Recipient ID': '',
      'Campaign': '',
      'Email': 'No recipients found',
      'First Name': '',
      'Last Name': '',
      'Title': '',
      'Channel': '',
      'Status': '',
      'Status Reason': '',
      'Sent At': '',
      'Delivered At': '',
      'Open Count': 0,
      'Click Count': 0,
      'First Opened At': '',
      'First Clicked At': '',
      'Bounce Type': '',
      'Bounce Description': '',
    });
  }

  return generateCSV(data);
}

/**
 * Main export function - routes to appropriate export generator
 */
export async function generateAnalyticsExport(
  db: PostgresJsDatabase<any>,
  workspaceId: string,
  campaignId: string | null,
  exportType: ExportType
): Promise<string> {
  const startTime = Date.now();

  let csvData: string;

  switch (exportType) {
    case 'campaign_metrics':
      csvData = await exportCampaignMetrics(db, workspaceId, campaignId);
      break;
    case 'funnel_data':
      csvData = await exportFunnelData(db, workspaceId, campaignId);
      break;
    case 'channel_performance':
      csvData = await exportChannelPerformance(db, workspaceId, campaignId);
      break;
    case 'recipient_details':
      csvData = await exportRecipientDetails(db, workspaceId, campaignId);
      break;
    default:
      throw new Error(`Unsupported export type: ${exportType}`);
  }

  // Add UTF-8 BOM for proper Excel encoding
  const bom = '\uFEFF';
  const csvWithBOM = bom + csvData;

  const queryTime = Date.now() - startTime;

  // Log performance warning if export takes too long
  if (queryTime > 5000) {
    console.warn(
      `[analytics-export] Export took ${queryTime}ms for campaign ${campaignId || 'all'} type ${exportType} (threshold: 5000ms)`
    );
  }

  return csvWithBOM;
}
