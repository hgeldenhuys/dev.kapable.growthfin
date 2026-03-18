/**
 * Engagement Signals Component (20 points)
 * Evaluates recent activity and historical response patterns
 */

import type { CrmActivity } from '@agios/db/schema';
import type { ComponentScore } from '../types';

/**
 * Score engagement signals based on activity history
 *
 * Scoring breakdown:
 * - Recent activity (within 7 days): 10 points
 * - Response rate (based on completed activities): 10 points
 *
 * @param activities - Lead's activity history (last 90 days)
 * @returns Component score with details
 */
export function scoreEngagement(activities: CrmActivity[]): ComponentScore {
  const details: ComponentScore['details'] = {};
  let score = 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Recent activity (10 points)
  const recentActivities = activities.filter(
    (activity) => activity.createdAt >= sevenDaysAgo
  );

  if (recentActivities.length > 0) {
    score += 10;
    details.recentActivity = {
      points: 10,
      maxPoints: 10,
      value: recentActivities.length,
      reason: `${recentActivities.length} activities in the last 7 days`,
    };
  } else {
    const lastActivityDate = activities[0]?.createdAt;
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor(
          (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    details.recentActivity = {
      points: 0,
      maxPoints: 10,
      value: lastActivityDate,
      reason: lastActivityDate
        ? `Last activity was ${daysSinceLastActivity} days ago`
        : 'No activity history',
    };
  }

  // Response rate (10 points)
  // Calculate based on ratio of completed activities to total activities
  const totalActivities = activities.length;
  const completedActivities = activities.filter(
    (activity) => activity.status === 'completed'
  ).length;

  if (totalActivities === 0) {
    details.responseRate = {
      points: 0,
      maxPoints: 10,
      value: 0,
      reason: 'No activity history to calculate response rate',
    };
  } else {
    const responseRate = completedActivities / totalActivities;

    // Score based on response rate thresholds
    let responsePoints = 0;
    if (responseRate >= 0.7) {
      responsePoints = 10; // Excellent response rate (70%+)
    } else if (responseRate >= 0.5) {
      responsePoints = 7; // Good response rate (50-69%)
    } else if (responseRate >= 0.3) {
      responsePoints = 4; // Fair response rate (30-49%)
    } else if (responseRate > 0) {
      responsePoints = 2; // Poor response rate (1-29%)
    }

    score += responsePoints;
    details.responseRate = {
      points: responsePoints,
      maxPoints: 10,
      value: Math.round(responseRate * 100),
      reason: `${Math.round(responseRate * 100)}% response rate (${completedActivities}/${totalActivities} completed)`,
    };
  }

  return {
    score,
    max: 20,
    details,
  };
}
