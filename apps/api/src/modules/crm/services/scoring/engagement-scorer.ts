/**
 * Engagement Score Calculator
 * Calculates lead engagement based on activities and interactions
 * Epic 5 - Sprint 2: US-LEAD-SCORE-005
 */

import type { CrmActivity } from '@agios/db';

export interface EngagementFactors {
  email_open?: number; // Points per email open
  email_click?: number; // Points per email click
  website_visit?: number; // Points per website visit
  call?: number; // Points per call
  meeting?: number; // Points per meeting
  form_submit?: number; // Points per form submission
  [key: string]: number | undefined; // Allow dynamic activity types
}

export interface EngagementScoreResult {
  score: number; // 0-100
  breakdown: Record<string, number>; // Points per activity type
  activityCount: number; // Total activities counted
}

/**
 * Default engagement factors (points per activity type)
 * Based on PRD specifications
 */
export const DEFAULT_ENGAGEMENT_FACTORS: EngagementFactors = {
  email_open: 5,
  email_click: 10,
  website_visit: 15,
  call: 12,
  meeting: 20,
  form_submit: 18,
};

/**
 * Calculate engagement score based on recent activities
 * @param activities - Array of CRM activities
 * @param factors - Points per activity type (optional, uses defaults)
 * @param daysLookback - Number of days to consider (default: 30)
 * @returns Engagement score result with breakdown
 */
export function calculateEngagementScore(
  activities: CrmActivity[],
  factors: EngagementFactors = DEFAULT_ENGAGEMENT_FACTORS,
  daysLookback: number = 30
): EngagementScoreResult {
  // Filter activities to last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLookback);

  const recentActivities = activities.filter((activity) => {
    const activityDate = new Date(activity.activityDate);
    return activityDate >= cutoffDate;
  });

  // Calculate points for each activity type
  const breakdown: Record<string, number> = {};
  let totalPoints = 0;
  let activityCount = 0;

  for (const activity of recentActivities) {
    // Map CRM activity type to factor key
    const factorKey = mapActivityTypeToFactor(activity.activityType);
    const points = factors[factorKey] || 0;

    if (points > 0) {
      totalPoints += points;
      breakdown[factorKey] = (breakdown[factorKey] || 0) + points;
      activityCount++;
    }
  }

  // Cap at 100
  const score = Math.min(totalPoints, 100);

  return {
    score,
    breakdown,
    activityCount,
  };
}

/**
 * Map CRM activity type to engagement factor key
 * @param activityType - CRM activity type from database
 * @returns Factor key for scoring
 */
function mapActivityTypeToFactor(activityType: string): string {
  // Normalize to lowercase for matching
  const normalized = activityType.toLowerCase().replace(/[-_]/g, '_');

  // Map common activity types
  const mappings: Record<string, string> = {
    email: 'email_open',
    email_sent: 'email_open',
    email_opened: 'email_open',
    email_clicked: 'email_click',
    email_click: 'email_click',
    website_visit: 'website_visit',
    page_view: 'website_visit',
    call: 'call',
    phone_call: 'call',
    meeting: 'meeting',
    demo: 'meeting',
    form_submit: 'form_submit',
    form_submission: 'form_submit',
  };

  return mappings[normalized] || normalized;
}

/**
 * Get engagement score tier
 * @param score - Engagement score (0-100)
 * @returns Tier label
 */
export function getEngagementTier(score: number): string {
  if (score >= 80) return 'Very High';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

/**
 * Calculate engagement trend
 * @param currentScore - Current engagement score
 * @param previousScore - Previous engagement score
 * @returns Trend direction and percentage change
 */
export function calculateEngagementTrend(
  currentScore: number,
  previousScore: number
): {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
} {
  if (previousScore === 0) {
    return { direction: 'stable', changePercent: 0 };
  }

  const changePercent = ((currentScore - previousScore) / previousScore) * 100;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (changePercent > 5) direction = 'up';
  else if (changePercent < -5) direction = 'down';

  return {
    direction,
    changePercent: Math.round(changePercent * 10) / 10, // Round to 1 decimal
  };
}
