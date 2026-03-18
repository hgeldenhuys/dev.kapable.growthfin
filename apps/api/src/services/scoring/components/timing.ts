/**
 * Timing & Readiness Component (20 points)
 * Evaluates lead age, prior engagement quality, and account health signals
 */

import type { CrmLead, CrmAccount, CrmActivity } from '@agios/db/schema';
import type { ComponentScore } from '../types';

/**
 * Positive dispositions indicating successful engagement
 */
const POSITIVE_DISPOSITIONS = [
  'connected',
  'interested',
  'callback_requested',
  'meeting_scheduled',
];

/**
 * Score timing and readiness based on lead age, prior engagement, and account health
 *
 * Scoring breakdown:
 * - Lead age (fresher = better): 10 points
 * - Prior positive engagement: 5 points
 * - Account health score: 5 points
 *
 * @param lead - CRM lead
 * @param account - CRM account (may be null)
 * @param activities - Lead's activity history
 * @returns Component score with details
 */
export function scoreTimingReadiness(
  lead: CrmLead,
  account: CrmAccount | null,
  activities: CrmActivity[]
): ComponentScore {
  const details: ComponentScore['details'] = {};
  let score = 0;

  const now = new Date();

  // Lead age (10 points) - fresher leads score higher
  const leadAgeMs = now.getTime() - lead.createdAt.getTime();
  const leadAgeDays = Math.floor(leadAgeMs / (1000 * 60 * 60 * 24));

  let leadAgePoints = 0;
  let leadAgeReason = '';

  if (leadAgeDays <= 7) {
    leadAgePoints = 10;
    leadAgeReason = `Brand new lead (${leadAgeDays} days old)`;
  } else if (leadAgeDays <= 14) {
    leadAgePoints = 8;
    leadAgeReason = `Recent lead (${leadAgeDays} days old)`;
  } else if (leadAgeDays <= 30) {
    leadAgePoints = 6;
    leadAgeReason = `Moderately fresh lead (${leadAgeDays} days old)`;
  } else if (leadAgeDays <= 60) {
    leadAgePoints = 4;
    leadAgeReason = `Aging lead (${leadAgeDays} days old)`;
  } else if (leadAgeDays <= 90) {
    leadAgePoints = 2;
    leadAgeReason = `Old lead (${leadAgeDays} days old)`;
  } else {
    leadAgePoints = 0;
    leadAgeReason = `Very old lead (${leadAgeDays} days old)`;
  }

  score += leadAgePoints;
  details.leadAge = {
    points: leadAgePoints,
    maxPoints: 10,
    value: leadAgeDays,
    reason: leadAgeReason,
  };

  // Prior positive engagement (5 points)
  const positiveActivities = activities.filter((activity) => {
    if (!activity.disposition) return false;
    const dispositionLower = activity.disposition.toLowerCase();
    // Exact match or starts with the positive disposition keyword
    return POSITIVE_DISPOSITIONS.some((pos) => {
      const posLower = pos.toLowerCase();
      return dispositionLower === posLower || dispositionLower.startsWith(posLower + ' ');
    });
  });

  if (positiveActivities.length > 0) {
    score += 5;
    details.priorEngagement = {
      points: 5,
      maxPoints: 5,
      value: positiveActivities.length,
      reason: `${positiveActivities.length} positive engagement(s) recorded`,
    };
  } else {
    const hasAnyActivities = activities.length > 0;
    details.priorEngagement = {
      points: 0,
      maxPoints: 5,
      value: 0,
      reason: hasAnyActivities
        ? 'No positive engagements yet'
        : 'No engagement history',
    };
  }

  // Account health score (5 points)
  const healthScore = account?.healthScore;

  if (healthScore !== null && healthScore !== undefined) {
    // Map health score (0-100) to points (0-5)
    const healthPoints = Math.round((healthScore / 100) * 5);

    score += healthPoints;
    details.accountHealth = {
      points: healthPoints,
      maxPoints: 5,
      value: healthScore,
      reason: `Account health score: ${healthScore}/100`,
    };
  } else {
    // Default to neutral score (2.5 points) if no account or no health score
    const defaultPoints = 2;
    score += defaultPoints;
    details.accountHealth = {
      points: defaultPoints,
      maxPoints: 5,
      value: null,
      reason: 'No account health data (neutral score)',
    };
  }

  return {
    score,
    max: 20,
    details,
  };
}
