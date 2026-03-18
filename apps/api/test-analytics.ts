import { db } from '../../packages/db/src/index';
import { crmCampaigns, crmResearchSessions, crmTimelineEvents } from '@agios/db/schema';
import { eq, and, isNull, gte, lte, count, avg, sum, sql, desc } from 'drizzle-orm';

const workspaceId = '3894c44a-d934-4113-b998-c28485948c12';

async function test() {
  try {
    // Campaign summary - this works
    console.log('Testing campaign summary...');
    const campaignSummary = await db
      .select({
        total: count(),
        active: sum(sql<number>`CASE WHEN status = 'active' THEN 1 ELSE 0 END`),
      })
      .from(crmCampaigns)
      .where(
        and(
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      );
    console.log('Campaign summary OK:', campaignSummary);

    // Research summary
    console.log('Testing research summary...');
    const researchSummary = await db
      .select({
        total: count(),
        completed: sum(sql<number>`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`),
        totalFindings: sum(crmResearchSessions.totalFindings),
      })
      .from(crmResearchSessions)
      .where(
        and(
          eq(crmResearchSessions.workspaceId, workspaceId),
          isNull(crmResearchSessions.deletedAt)
        )
      );
    console.log('Research summary OK:', researchSummary);

    // Timeline events - the suspicious query
    console.log('Testing timeline events...');
    const recentActivity = await db
      .select({
        id: crmTimelineEvents.id,
        entityType: crmTimelineEvents.entityType,
        eventType: crmTimelineEvents.eventType,
      })
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.workspaceId, workspaceId),
          isNull(crmTimelineEvents.deletedAt),
          sql`${crmTimelineEvents.eventType} LIKE 'campaign.%' OR ${crmTimelineEvents.eventType} LIKE 'research.%'`
        )
      )
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(10);
    console.log('Timeline events OK:', recentActivity.length);

    // Growth metrics
    console.log('Testing growth metrics...');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekGrowth = await db
      .select({
        campaignsThisWeek: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${weekAgo} THEN 1 END)`,
        campaignsLastWeek: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)} AND ${crmCampaigns.createdAt} < ${weekAgo} THEN 1 END)`,
      })
      .from(crmCampaigns)
      .where(
        and(
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      );
    console.log('Week growth OK:', weekGrowth);

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthGrowth = await db
      .select({
        campaignsThisMonth: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${monthAgo} THEN 1 END)`,
        campaignsLastMonth: sql<number>`COUNT(CASE WHEN ${crmCampaigns.createdAt} >= ${new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)} AND ${crmCampaigns.createdAt} < ${monthAgo} THEN 1 END)`,
      })
      .from(crmCampaigns)
      .where(
        and(
          eq(crmCampaigns.workspaceId, workspaceId),
          isNull(crmCampaigns.deletedAt)
        )
      );
    console.log('Month growth OK:', monthGrowth);

    console.log('\nAll queries passed!');
  } catch (err) {
    console.error('ERROR:', err);
  }

  process.exit(0);
}

test();
