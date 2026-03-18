/**
 * Lead Health Scoring Service
 * Calculates and tracks lead engagement health over time
 * Story: US-LEAD-AI-013
 */

import {
  db,
  leadHealthScores,
  healthScoreHistory,
  crmLeads,
  intentSignals,
  crmActivities,
  type LeadHealthScore,
  type HealthStatus,
  type HealthTrend,
} from '@agios/db';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

interface ComponentScores {
  engagementScore: number;
  responsivenessScore: number;
  activityScore: number;
  relationshipScore: number;
}

interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number;
  description: string;
}

interface PositiveFactor {
  factor: string;
  impact: number;
  description: string;
}

interface HealthScoreResult {
  lead_id: string;
  health_score: number;
  health_status: HealthStatus;
  risk_factors: RiskFactor[];
  positive_factors: PositiveFactor[];
  recommended_actions: string[];
  trend: HealthTrend;
  last_calculated: Date;
}

export class HealthCalculationService {
  /**
   * Calculate health score for a lead
   */
  async calculateHealthScore(leadId: string, workspaceId: string): Promise<HealthScoreResult> {
    // 1. Get lead data
    const lead = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)),
    });

    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // 2. Calculate component scores
    const scores = await this.calculateComponentScores(lead);

    // 3. Calculate composite health score (weighted average)
    const healthScore = Math.round(
      scores.engagementScore * 0.3 +
        scores.responsivenessScore * 0.25 +
        scores.activityScore * 0.25 +
        scores.relationshipScore * 0.2
    );

    // 4. Determine health status
    const healthStatus = this.determineHealthStatus(healthScore);

    // 5. Identify risk factors
    const riskFactors = await this.identifyRiskFactors(lead, scores);

    // 6. Identify positive factors
    const positiveFactors = await this.identifyPositiveFactors(lead, scores);

    // 7. Determine trend
    const trend = await this.determineTrend(leadId);

    // 8. Recommend actions
    const recommendedActions = this.recommendActions(healthStatus, riskFactors);

    // 9. Store health score
    await this.storeHealthScore(leadId, workspaceId, {
      health_score: healthScore,
      health_status: healthStatus,
      trend,
      engagement_score: scores.engagementScore,
      responsiveness_score: scores.responsivenessScore,
      activity_score: scores.activityScore,
      relationship_score: scores.relationshipScore,
      risk_factors: riskFactors,
      positive_factors: positiveFactors,
      recommended_actions: recommendedActions,
    });

    return {
      lead_id: leadId,
      health_score: healthScore,
      health_status: healthStatus,
      risk_factors: riskFactors,
      positive_factors: positiveFactors,
      recommended_actions: recommendedActions,
      trend,
      last_calculated: new Date(),
    };
  }

  /**
   * Calculate all component scores
   */
  private async calculateComponentScores(lead: any): Promise<ComponentScores> {
    const [engagementScore, responsivenessScore, activityScore, relationshipScore] = await Promise.all([
      this.calculateEngagementScore(lead),
      this.calculateResponsivenessScore(lead),
      this.calculateActivityScore(lead),
      this.calculateRelationshipScore(lead),
    ]);

    return {
      engagementScore,
      responsivenessScore,
      activityScore,
      relationshipScore,
    };
  }

  /**
   * Calculate engagement score (0-100)
   * Based on interaction count in last 30 days
   */
  private async calculateEngagementScore(lead: any): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count interactions in last 30 days from intent_signals and activities
    const [signals, activities] = await Promise.all([
      db.query.intentSignals.findMany({
        where: and(eq(intentSignals.leadId, lead.id), gte(intentSignals.detectedAt, thirtyDaysAgo)),
      }),
      db.query.crmActivities.findMany({
        where: and(eq(crmActivities.leadId, lead.id), gte(crmActivities.createdAt, thirtyDaysAgo)),
      }),
    ]);

    const totalInteractions = signals.length + activities.length;

    // Score based on interaction count (plateau at 20 interactions = 100)
    const interactionScore = Math.min(totalInteractions / 20, 1) * 100;

    return Math.round(interactionScore);
  }

  /**
   * Calculate responsiveness score (0-100)
   * Based on response times from activity log
   */
  private async calculateResponsivenessScore(lead: any): Promise<number> {
    // Get recent activities with response times
    const activities = await db.query.crmActivities.findMany({
      where: eq(crmActivities.leadId, lead.id),
      orderBy: [desc(crmActivities.createdAt)],
      limit: 10,
    });

    if (activities.length === 0) {
      return 50; // Neutral if no data
    }

    // Calculate average response time based on activity patterns
    // For now, use a simplified scoring based on activity frequency
    const now = new Date();
    const responseScores = activities.map((activity) => {
      const hoursSinceActivity = (now.getTime() - activity.createdAt.getTime()) / (1000 * 60 * 60);
      // Recent activity = high score
      if (hoursSinceActivity < 4) return 100;
      if (hoursSinceActivity < 24) return 70;
      if (hoursSinceActivity < 72) return 40;
      return 20;
    });

    const avgScore = responseScores.reduce((sum, score) => sum + score, 0) / responseScores.length;
    return Math.round(avgScore);
  }

  /**
   * Calculate activity score (0-100)
   * Based on days since last activity (inverse scoring)
   */
  private async calculateActivityScore(lead: any): Promise<number> {
    const now = new Date();

    // Get last activity from both signals and activities
    const [lastSignal, lastActivity] = await Promise.all([
      db.query.intentSignals.findFirst({
        where: eq(intentSignals.leadId, lead.id),
        orderBy: [desc(intentSignals.detectedAt)],
      }),
      db.query.crmActivities.findFirst({
        where: eq(crmActivities.leadId, lead.id),
        orderBy: [desc(crmActivities.createdAt)],
      }),
    ]);

    // Get most recent timestamp
    const lastSignalTime = lastSignal?.detectedAt?.getTime() || 0;
    const lastActivityTime = lastActivity?.createdAt?.getTime() || 0;
    const lastActivityTimestamp = Math.max(lastSignalTime, lastActivityTime);

    if (!lastActivityTimestamp) {
      return 0; // No activity at all
    }

    const daysSinceActivity = (now.getTime() - lastActivityTimestamp) / (1000 * 60 * 60 * 24);

    // Score based on recency
    if (daysSinceActivity < 1) return 100;
    if (daysSinceActivity < 3) return 80;
    if (daysSinceActivity < 7) return 50;
    if (daysSinceActivity < 14) return 30;
    return 20;
  }

  /**
   * Calculate relationship score (0-100)
   * Based on pipeline time, touchpoints, and multi-channel engagement
   */
  private async calculateRelationshipScore(lead: any): Promise<number> {
    // Time in pipeline (longer = better relationship, up to 90 days)
    const pipelineDays = (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const pipelineScore = Math.min(pipelineDays / 90, 1) * 40; // Max 40 points

    // Number of touchpoints
    const [signals, activities] = await Promise.all([
      db.query.intentSignals.findMany({
        where: eq(intentSignals.leadId, lead.id),
      }),
      db.query.crmActivities.findMany({
        where: eq(crmActivities.leadId, lead.id),
      }),
    ]);
    const touchpoints = signals.length + activities.length;
    const touchpointScore = Math.min(touchpoints / 10, 1) * 30; // Max 30 points

    // Multi-channel engagement (email, phone, demo, etc.)
    const activityTypes = new Set(activities.map((a) => a.type));
    const channelScore = Math.min(activityTypes.size / 4, 1) * 30; // Max 30 points

    return Math.round(pipelineScore + touchpointScore + channelScore);
  }

  /**
   * Identify risk factors
   */
  private async identifyRiskFactors(lead: any, scores: ComponentScores): Promise<RiskFactor[]> {
    const risks: RiskFactor[] = [];

    // No activity in 7+ days
    const daysSinceActivity = await this.getDaysSinceLastActivity(lead.id);
    if (daysSinceActivity >= 7) {
      risks.push({
        factor: 'no_activity_7_days',
        severity: daysSinceActivity >= 14 ? 'high' : 'medium',
        impact: -20,
        description: `No engagement in last ${Math.round(daysSinceActivity)} days`,
      });
    }

    // Low engagement score
    if (scores.engagementScore < 40) {
      risks.push({
        factor: 'low_engagement',
        severity: 'medium',
        impact: -15,
        description: 'Below-average engagement level',
      });
    }

    // Slow responses
    if (scores.responsivenessScore < 50) {
      risks.push({
        factor: 'slow_responses',
        severity: 'medium',
        impact: -10,
        description: 'Taking longer to respond to communications',
      });
    }

    // Very low activity score (dormant lead)
    if (scores.activityScore < 30) {
      risks.push({
        factor: 'dormant_lead',
        severity: 'high',
        impact: -25,
        description: 'Lead has been inactive for extended period',
      });
    }

    return risks;
  }

  /**
   * Identify positive factors
   */
  private async identifyPositiveFactors(lead: any, scores: ComponentScores): Promise<PositiveFactor[]> {
    const positives: PositiveFactor[] = [];

    // High engagement
    if (scores.engagementScore >= 70) {
      positives.push({
        factor: 'high_engagement',
        impact: +20,
        description: 'Consistent and frequent engagement',
      });
    }

    // Fast responses
    if (scores.responsivenessScore >= 80) {
      positives.push({
        factor: 'fast_responses',
        impact: +15,
        description: 'Quick to respond to communications',
      });
    }

    // Recent activity
    if (scores.activityScore >= 80) {
      positives.push({
        factor: 'recent_activity',
        impact: +15,
        description: 'Very recent engagement',
      });
    }

    // Strong relationship
    if (scores.relationshipScore >= 70) {
      positives.push({
        factor: 'strong_relationship',
        impact: +10,
        description: 'Well-established relationship with multiple touchpoints',
      });
    }

    return positives;
  }

  /**
   * Determine health status from score
   */
  private determineHealthStatus(score: number): HealthStatus {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'healthy';
    if (score >= 40) return 'at_risk';
    return 'critical';
  }

  /**
   * Determine trend from historical data
   */
  private async determineTrend(leadId: string): Promise<HealthTrend> {
    // Get last 7 days of health scores
    const history = await db.query.healthScoreHistory.findMany({
      where: eq(healthScoreHistory.leadId, leadId),
      orderBy: [desc(healthScoreHistory.calculatedAt)],
      limit: 7,
    });

    if (history.length < 3) {
      return 'stable'; // Not enough data
    }

    const scores = history.map((h) => h.healthScore).reverse(); // Oldest to newest
    const trend = this.calculateTrendSlope(scores);

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(scores: number[]): number {
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = scores;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Recommend actions based on health status
   */
  private recommendActions(status: HealthStatus, riskFactors: RiskFactor[]): string[] {
    const actions: string[] = [];

    if (status === 'critical') {
      actions.push('immediate_followup');
      actions.push('escalate_to_manager');
    }

    if (status === 'at_risk') {
      actions.push('send_reengagement_email');
      actions.push('schedule_check_in_call');
    }

    // Specific actions based on risk factors
    for (const risk of riskFactors) {
      if (risk.factor === 'no_activity_7_days') {
        actions.push('send_value_reminder');
      }
      if (risk.factor === 'slow_responses') {
        actions.push('ask_if_still_interested');
      }
      if (risk.factor === 'dormant_lead') {
        actions.push('send_reactivation_campaign');
      }
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Store health score in database
   */
  private async storeHealthScore(
    leadId: string,
    workspaceId: string,
    data: {
      health_score: number;
      health_status: HealthStatus;
      trend: HealthTrend;
      engagement_score: number;
      responsiveness_score: number;
      activity_score: number;
      relationship_score: number;
      risk_factors: RiskFactor[];
      positive_factors: PositiveFactor[];
      recommended_actions: string[];
    }
  ): Promise<void> {
    // Get previous score
    const previous = await db.query.leadHealthScores.findFirst({
      where: eq(leadHealthScores.leadId, leadId),
    });

    const now = new Date();

    // Insert or update current health score
    await db
      .insert(leadHealthScores)
      .values({
        workspaceId,
        leadId,
        healthScore: data.health_score,
        healthStatus: data.health_status,
        trend: data.trend,
        engagementScore: data.engagement_score,
        responsivenessScore: data.responsiveness_score,
        activityScore: data.activity_score,
        relationshipScore: data.relationship_score,
        riskFactors: data.risk_factors,
        positiveFactors: data.positive_factors,
        recommendedActions: data.recommended_actions,
        calculatedAt: now,
        previousScore: previous?.healthScore,
        scoreChangedAt: previous && previous.healthScore !== data.health_score ? now : previous?.scoreChangedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: leadHealthScores.leadId,
        set: {
          healthScore: data.health_score,
          healthStatus: data.health_status,
          trend: data.trend,
          engagementScore: data.engagement_score,
          responsivenessScore: data.responsiveness_score,
          activityScore: data.activity_score,
          relationshipScore: data.relationship_score,
          riskFactors: data.risk_factors,
          positiveFactors: data.positive_factors,
          recommendedActions: data.recommended_actions,
          calculatedAt: now,
          previousScore: previous?.healthScore,
          scoreChangedAt: previous && previous.healthScore !== data.health_score ? now : previous?.scoreChangedAt,
          updatedAt: now,
        },
      });

    // Insert history record
    await db.insert(healthScoreHistory).values({
      workspaceId,
      leadId,
      healthScore: data.health_score,
      healthStatus: data.health_status,
      scoreDelta: previous ? data.health_score - previous.healthScore : null,
      statusChanged: previous ? previous.healthStatus !== data.health_status : false,
      calculatedAt: now,
    });
  }

  /**
   * Get days since last activity
   */
  private async getDaysSinceLastActivity(leadId: string): Promise<number> {
    const [lastSignal, lastActivity] = await Promise.all([
      db.query.intentSignals.findFirst({
        where: eq(intentSignals.leadId, leadId),
        orderBy: [desc(intentSignals.detectedAt)],
      }),
      db.query.crmActivities.findFirst({
        where: eq(crmActivities.leadId, leadId),
        orderBy: [desc(crmActivities.createdAt)],
      }),
    ]);

    const lastSignalTime = lastSignal?.detectedAt?.getTime() || 0;
    const lastActivityTime = lastActivity?.createdAt?.getTime() || 0;
    const lastActivityTimestamp = Math.max(lastSignalTime, lastActivityTime);

    if (!lastActivityTimestamp) {
      return 999; // No activity ever
    }

    return (Date.now() - lastActivityTimestamp) / (1000 * 60 * 60 * 24);
  }
}

export const healthService = new HealthCalculationService();
