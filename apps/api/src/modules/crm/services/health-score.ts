/**
 * Health Score Calculation Service
 * Calculates account health scores based on activity, engagement, and revenue
 */

import type { Database } from '@agios/db';
import { crmOpportunities, crmContacts, crmActivities } from '@agios/db';
import { eq, and, gte, inArray, desc } from 'drizzle-orm';

export interface HealthScoreFactors {
  recentActivity: number; // 0-1
  winRate: number; // 0-1
  engagement: number; // 0-1
  revenueHealth: number; // 0-1
}

export interface HealthScoreResult {
  healthScore: number; // 0-100
  factors: HealthScoreFactors;
}

/**
 * Calculate health score for an account
 *
 * Formula: healthScore = (recentActivity × 0.3 + winRate × 0.3 + engagement × 0.2 + revenueHealth × 0.2) × 100
 *
 * @param accountId - The account ID to calculate for
 * @param workspaceId - The workspace ID (for isolation)
 * @param db - Database connection
 * @returns Health score (0-100) and factor breakdown
 */
export async function calculateHealthScore(
  accountId: string,
  workspaceId: string,
  db: Database
): Promise<HealthScoreResult> {
  // Calculate all factors in parallel
  const [recentActivity, winRate, engagement, revenueHealth] = await Promise.all([
    calculateRecentActivityFactor(accountId, workspaceId, db),
    calculateWinRateFactor(accountId, workspaceId, db),
    calculateEngagementFactor(accountId, workspaceId, db),
    calculateRevenueHealthFactor(accountId, workspaceId, db),
  ]);

  // Weighted average (all factors 0-1, weights sum to 1.0)
  const weightedScore =
    recentActivity * 0.3 +
    winRate * 0.3 +
    engagement * 0.2 +
    revenueHealth * 0.2;

  // Scale to 0-100
  const healthScore = Math.round(weightedScore * 100);

  return {
    healthScore,
    factors: {
      recentActivity,
      winRate,
      engagement,
      revenueHealth,
    },
  };
}

/**
 * Recent Activity Factor (30%)
 * Based on opportunities, contacts, and activities in last 30 days
 *
 * @returns Score 0-1 (0 = no activity, 1 = high activity)
 */
async function calculateRecentActivityFactor(
  accountId: string,
  workspaceId: string,
  db: Database
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get opportunities created/updated in last 30 days
  const opportunities = await db
    .select()
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.accountId, accountId),
        eq(crmOpportunities.workspaceId, workspaceId),
        gte(crmOpportunities.updatedAt, thirtyDaysAgo)
      )
    );
  const opportunitiesCount = opportunities.length;

  // Get contacts updated in last 30 days
  const contacts = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.accountId, accountId),
        eq(crmContacts.workspaceId, workspaceId),
        gte(crmContacts.updatedAt, thirtyDaysAgo)
      )
    );
  const contactsCount = contacts.length;

  // Get activities in last 30 days
  const activities = await db
    .select()
    .from(crmActivities)
    .where(
      and(
        eq(crmActivities.accountId, accountId),
        eq(crmActivities.workspaceId, workspaceId),
        gte(crmActivities.createdAt, thirtyDaysAgo)
      )
    );
  const activitiesCount = activities.length;

  // Weighted activity score
  const activityScore =
    opportunitiesCount * 0.4 +
    contactsCount * 0.3 +
    activitiesCount * 0.3;

  // Scale to 0-1 (30 activities = 1.0, linear scaling)
  const maxExpectedActivity = 30;
  return Math.min(1.0, activityScore / maxExpectedActivity);
}

/**
 * Win Rate Factor (30%)
 * Based on closed won / total closed opportunities
 *
 * @returns Score 0-1 (0 = 0% win rate, 1 = 100% win rate, 0.5 = neutral if no closed opps)
 */
async function calculateWinRateFactor(
  accountId: string,
  workspaceId: string,
  db: Database
): Promise<number> {
  // Get closed opportunities
  const closedOpportunities = await db
    .select()
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.accountId, accountId),
        eq(crmOpportunities.workspaceId, workspaceId),
        inArray(crmOpportunities.stage, ['closed_won', 'closed_lost'])
      )
    );

  // No closed opportunities = neutral score (0.5)
  if (closedOpportunities.length === 0) {
    return 0.5;
  }

  // Count wins
  const wonCount = closedOpportunities.filter(
    (opp) => opp.stage === 'closed_won'
  ).length;

  // Calculate win rate
  return wonCount / closedOpportunities.length;
}

/**
 * Engagement Factor (20%)
 * Based on days since last contact (90-day decay)
 *
 * @returns Score 0-1 (0 = 90+ days, 1 = today)
 */
async function calculateEngagementFactor(
  accountId: string,
  workspaceId: string,
  db: Database
): Promise<number> {
  // Get most recent contact update
  const contacts = await db
    .select({ updatedAt: crmContacts.updatedAt })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.accountId, accountId),
        eq(crmContacts.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(crmContacts.updatedAt))
    .limit(1);

  // No contacts = no engagement
  if (contacts.length === 0) {
    return 0;
  }

  const lastContactDate = contacts[0].updatedAt;
  const daysSinceLastContact = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Linear decay: 0 days = 1.0, 90+ days = 0.0
  const decayPeriod = 90;
  return Math.max(0, 1 - daysSinceLastContact / decayPeriod);
}

/**
 * Revenue Health Factor (20%)
 * Based on active opportunity value (scaled to $100k)
 *
 * @returns Score 0-1 (0 = $0, 1 = $100k+)
 */
async function calculateRevenueHealthFactor(
  accountId: string,
  workspaceId: string,
  db: Database
): Promise<number> {
  // Get active opportunities (not closed)
  const activeOpportunities = await db
    .select({ amount: crmOpportunities.amount })
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.accountId, accountId),
        eq(crmOpportunities.workspaceId, workspaceId),
        inArray(crmOpportunities.stage, [
          'prospecting',
          'qualification',
          'proposal',
          'negotiation',
        ])
      )
    );

  // No active opportunities = 0
  if (activeOpportunities.length === 0) {
    return 0;
  }

  // Sum active opportunity values
  const totalActiveValue = activeOpportunities.reduce((sum, opp) => {
    const amount = typeof opp.amount === 'string' ? parseFloat(opp.amount) : Number(opp.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  // Scale to 0-1 ($0 = 0.0, $100k+ = 1.0)
  const revenueTarget = 100000;
  return Math.min(1.0, totalActiveValue / revenueTarget);
}
