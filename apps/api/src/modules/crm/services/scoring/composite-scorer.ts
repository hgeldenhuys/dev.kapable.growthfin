/**
 * Composite Score Calculator
 * Combines multiple scoring dimensions into a single prioritization score
 * Epic 5 - Sprint 2: US-LEAD-SCORE-005
 */

export interface ScoreWeights {
  propensity: number; // Weight for propensity score (default: 0.40)
  engagement: number; // Weight for engagement score (default: 0.30)
  fit: number; // Weight for fit score (default: 0.30)
}

export interface CompositeScoreResult {
  compositeScore: number; // 0-100
  weights: ScoreWeights; // Weights used in calculation
  contributionBreakdown: {
    // How much each dimension contributed
    propensity: number;
    engagement: number;
    fit: number;
  };
}

/**
 * Default composite score weights
 * Based on PRD specifications
 */
export const DEFAULT_COMPOSITE_WEIGHTS: ScoreWeights = {
  propensity: 0.4, // 40% - Likelihood to buy
  engagement: 0.3, // 30% - Recent activity level
  fit: 0.3, // 30% - Matches ICP
};

/**
 * Calculate composite score from multiple dimensions
 * @param propensityScore - Propensity score (0-100)
 * @param engagementScore - Engagement score (0-100)
 * @param fitScore - Fit score (0-100)
 * @param weights - Score weights (optional, uses defaults)
 * @returns Composite score result with breakdown
 */
export function calculateCompositeScore(
  propensityScore: number | null,
  engagementScore: number | null,
  fitScore: number | null,
  weights: ScoreWeights = DEFAULT_COMPOSITE_WEIGHTS
): CompositeScoreResult {
  // Validate weights sum to 1.0 (with small tolerance for floating point)
  const weightSum = weights.propensity + weights.engagement + weights.fit;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Weights must sum to 1.0 (got ${weightSum}). Adjust weights: propensity=${weights.propensity}, engagement=${weights.engagement}, fit=${weights.fit}`
    );
  }

  // Handle null scores (use 0 if dimension not calculated yet)
  const propensity = propensityScore ?? 0;
  const engagement = engagementScore ?? 0;
  const fit = fitScore ?? 0;

  // Calculate weighted contributions
  const propensityContribution = propensity * weights.propensity;
  const engagementContribution = engagement * weights.engagement;
  const fitContribution = fit * weights.fit;

  // Calculate composite score
  const composite = propensityContribution + engagementContribution + fitContribution;

  // Round to 2 decimal places
  const compositeScore = Math.round(composite * 100) / 100;

  return {
    compositeScore,
    weights,
    contributionBreakdown: {
      propensity: Math.round(propensityContribution * 100) / 100,
      engagement: Math.round(engagementContribution * 100) / 100,
      fit: Math.round(fitContribution * 100) / 100,
    },
  };
}

/**
 * Validate score weights
 * @param weights - Score weights to validate
 * @returns Validation result
 */
export function validateScoreWeights(weights: Partial<ScoreWeights>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check all weights are provided
  if (
    weights.propensity === undefined ||
    weights.engagement === undefined ||
    weights.fit === undefined
  ) {
    errors.push('All weights must be provided (propensity, engagement, fit)');
    return { valid: false, errors };
  }

  // Check weights are positive
  if (weights.propensity < 0 || weights.engagement < 0 || weights.fit < 0) {
    errors.push('All weights must be positive numbers');
  }

  // Check weights are <= 1.0
  if (weights.propensity > 1.0 || weights.engagement > 1.0 || weights.fit > 1.0) {
    errors.push('Individual weights cannot exceed 1.0');
  }

  // Check weights sum to 1.0 (with tolerance)
  const sum = weights.propensity + weights.engagement + weights.fit;
  if (Math.abs(sum - 1.0) > 0.01) {
    errors.push(
      `Weights must sum to 1.0 (currently sum to ${sum.toFixed(4)}). Adjust weights proportionally.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize weights to sum to 1.0
 * Useful when user provides weights that don't quite sum to 1.0
 * @param weights - Weights to normalize
 * @returns Normalized weights
 */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = weights.propensity + weights.engagement + weights.fit;

  if (sum === 0) {
    // If all weights are 0, return defaults
    return { ...DEFAULT_COMPOSITE_WEIGHTS };
  }

  return {
    propensity: weights.propensity / sum,
    engagement: weights.engagement / sum,
    fit: weights.fit / sum,
  };
}

/**
 * Get composite score tier
 * @param score - Composite score (0-100)
 * @returns Tier label and priority
 */
export function getCompositeTier(
  score: number
): {
  tier: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  color: string; // Hex color for UI
} {
  if (score >= 80) {
    return { tier: 'Hot Lead', priority: 'critical', color: '#dc2626' }; // Red
  }
  if (score >= 60) {
    return { tier: 'Warm Lead', priority: 'high', color: '#f59e0b' }; // Orange
  }
  if (score >= 40) {
    return { tier: 'Qualified Lead', priority: 'medium', color: '#3b82f6' }; // Blue
  }
  if (score >= 20) {
    return { tier: 'Cold Lead', priority: 'low', color: '#6b7280' }; // Gray
  }
  return { tier: 'Unqualified', priority: 'minimal', color: '#9ca3af' }; // Light Gray
}

/**
 * Generate recommended actions based on composite score and contributions
 * @param compositeScore - Overall composite score
 * @param contributions - Contribution breakdown from each dimension
 * @returns Array of recommended actions
 */
export function generateRecommendedActions(
  compositeScore: number,
  contributions: { propensity: number; engagement: number; fit: number }
): string[] {
  const actions: string[] = [];

  // High composite score - prioritize closing
  if (compositeScore >= 80) {
    actions.push('Schedule demo or sales call immediately');
    actions.push('Assign to senior sales rep');
    actions.push('Fast-track to opportunity stage');
  }

  // Moderate composite - nurture and qualify
  else if (compositeScore >= 60) {
    actions.push('Continue nurturing with relevant content');
    actions.push('Invite to webinar or product event');
  }

  // Low engagement - re-engage
  if (contributions.engagement < 20) {
    actions.push('Send re-engagement campaign');
    actions.push('Offer valuable content or resource');
  }

  // Low fit - re-qualify or disqualify
  if (contributions.fit < 20) {
    actions.push('Re-qualify lead against ICP');
    actions.push('Consider marking as low priority or unqualified');
  }

  // Low propensity - long-term nurture
  if (contributions.propensity < 20) {
    actions.push('Add to long-term nurture drip campaign');
    actions.push('Educate on product value proposition');
  }

  return actions;
}

/**
 * Compare two composite scores and provide insights
 * @param currentScore - Current composite score
 * @param previousScore - Previous composite score
 * @returns Comparison insights
 */
export function compareCompositeScores(
  currentScore: number,
  previousScore: number
): {
  change: number;
  changePercent: number;
  trend: 'improving' | 'declining' | 'stable';
  insight: string;
} {
  const change = currentScore - previousScore;
  const changePercent = previousScore > 0 ? (change / previousScore) * 100 : 0;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (change > 5) trend = 'improving';
  else if (change < -5) trend = 'declining';

  // Generate insight
  let insight = '';
  if (trend === 'improving') {
    insight = `Lead is warming up (+${change.toFixed(1)} points). Increase engagement frequency.`;
  } else if (trend === 'declining') {
    insight = `Lead is cooling down (${change.toFixed(1)} points). Re-engage immediately.`;
  } else {
    insight = 'Lead score stable. Continue current engagement strategy.';
  }

  return {
    change: Math.round(change * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    trend,
    insight,
  };
}
