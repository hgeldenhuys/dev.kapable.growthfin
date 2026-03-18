/**
 * Intent Detection Service (US-LEAD-AI-012)
 * Track and analyze buying intent signals from lead behavior
 */

import { db } from '@agios/db';
import {
  intentSignals,
  intentSignalTypes,
  leadIntentScores,
  intentScoreHistory,
  type IntentSignal,
  type IntentSignalType,
  type LeadIntentScore,
  type IntentLevel,
  type IntentAction,
} from '@agios/db';
import { and, eq, desc, gte, sql } from 'drizzle-orm';
import { jobQueue } from '../../lib/queue';

// ============================================================================
// TYPES
// ============================================================================

export interface ProcessedIntentSignal {
  signal_type: string;
  detected_at: Date;
  weight: number;
  decay_rate: number;
  description: string;
}

export interface IntentScore {
  lead_id: string;
  intent_score: number;
  intent_level: IntentLevel;
  signals_detected: ProcessedIntentSignal[];
  recommended_action: IntentAction;
  action_reason: string;
  confidence: number;
  last_calculated: Date;
}

export interface TrackSignalOptions {
  signalType: string;
  signalValue?: string;
  source?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// INTENT DETECTION SERVICE
// ============================================================================

export class IntentDetectionService {
  /**
   * Track a new intent signal for a lead
   */
  async trackSignal(
    leadId: string,
    workspaceId: string,
    options: TrackSignalOptions
  ): Promise<IntentSignal> {
    const { signalType, signalValue, source = 'manual', metadata = {} } = options;

    // Insert signal
    const [signal] = await db
      .insert(intentSignals)
      .values({
        workspaceId,
        leadId,
        signalType,
        signalValue,
        source,
        metadata,
        detectedAt: new Date(),
      })
      .returning();

    // Queue intent recalculation (async)
    await jobQueue.send('calculate-intent', {
      leadId,
      workspaceId,
      triggerSignalType: signalType,
    });

    return signal;
  }

  /**
   * Calculate intent score for a lead based on detected signals
   */
  async calculateIntentScore(leadId: string, workspaceId: string): Promise<IntentScore> {
    // 1. Fetch all signals for this lead (last 90 days to limit scope)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const signals = await db.query.intentSignals.findMany({
      where: and(
        eq(intentSignals.leadId, leadId),
        eq(intentSignals.workspaceId, workspaceId),
        gte(intentSignals.detectedAt, ninetyDaysAgo)
      ),
      orderBy: [desc(intentSignals.detectedAt)],
    });

    if (signals.length === 0) {
      throw new Error('INSUFFICIENT_DATA');
    }

    // 2. Get signal type configurations
    const signalConfigs = await this.getSignalConfigs(workspaceId);

    // 3. Calculate time-decayed weighted score
    const now = new Date();
    let totalWeightedScore = 0;
    let totalWeight = 0;

    const processedSignals: ProcessedIntentSignal[] = [];

    for (const signal of signals) {
      const config = signalConfigs.get(signal.signalType);
      if (!config || !config.isActive) continue;

      // Calculate time decay
      const daysSinceDetection =
        (now.getTime() - new Date(signal.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
      const decayMultiplier = Math.pow(Number(config.decayRate), daysSinceDetection);

      // Effective weight after decay
      const effectiveWeight = Number(config.baseWeight) * decayMultiplier;

      totalWeightedScore += effectiveWeight;
      totalWeight += Number(config.baseWeight); // For normalization

      processedSignals.push({
        signal_type: signal.signalType,
        detected_at: new Date(signal.detectedAt),
        weight: effectiveWeight,
        decay_rate: Number(config.decayRate),
        description: this.generateSignalDescription(signal, config),
      });
    }

    // 4. Normalize to 0-100 scale
    const normalizedScore =
      totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 0;

    // 5. Determine intent level
    const intentLevel = this.determineIntentLevel(normalizedScore);

    // 6. Recommend action
    const { action, reason } = this.recommendAction(
      normalizedScore,
      intentLevel,
      processedSignals
    );

    // 7. Calculate confidence (based on signal count and recency)
    const confidence = this.calculateConfidence(processedSignals);

    // 8. Store score
    await this.storeIntentScore(leadId, workspaceId, {
      intent_score: normalizedScore,
      intent_level: intentLevel,
      confidence: String(confidence),
      signal_count: signals.length,
      top_signals: processedSignals.slice(0, 5),
      recommended_action: action,
      action_reason: reason,
    });

    return {
      lead_id: leadId,
      intent_score: normalizedScore,
      intent_level: intentLevel,
      signals_detected: processedSignals,
      recommended_action: action,
      action_reason: reason,
      confidence,
      last_calculated: now,
    };
  }

  /**
   * Get cached intent score for a lead
   */
  async getIntentScore(leadId: string, workspaceId: string): Promise<LeadIntentScore | null> {
    const score = await db.query.leadIntentScores.findFirst({
      where: and(
        eq(leadIntentScores.leadId, leadId),
        eq(leadIntentScores.workspaceId, workspaceId)
      ),
    });

    return score || null;
  }

  /**
   * Get intent score history for a lead
   */
  async getIntentHistory(leadId: string, workspaceId: string, limit = 30) {
    return await db.query.intentScoreHistory.findMany({
      where: and(
        eq(intentScoreHistory.leadId, leadId),
        eq(intentScoreHistory.workspaceId, workspaceId)
      ),
      orderBy: [desc(intentScoreHistory.calculatedAt)],
      limit,
    });
  }

  /**
   * Get top leads by intent score
   */
  async getTopIntentLeads(workspaceId: string, minScore = 60, limit = 50) {
    return await db.query.leadIntentScores.findMany({
      where: and(
        eq(leadIntentScores.workspaceId, workspaceId),
        gte(leadIntentScores.intentScore, minScore)
      ),
      orderBy: [desc(leadIntentScores.intentScore), desc(leadIntentScores.calculatedAt)],
      limit,
    });
  }

  /**
   * Get all signals for a lead
   */
  async getLeadSignals(leadId: string, workspaceId: string, limit = 100) {
    return await db.query.intentSignals.findMany({
      where: and(eq(intentSignals.leadId, leadId), eq(intentSignals.workspaceId, workspaceId)),
      orderBy: [desc(intentSignals.detectedAt)],
      limit,
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Get signal type configurations for workspace
   */
  private async getSignalConfigs(workspaceId: string): Promise<Map<string, IntentSignalType>> {
    const configs = await db.query.intentSignalTypes.findMany({
      where: and(eq(intentSignalTypes.workspaceId, workspaceId), eq(intentSignalTypes.isActive, true)),
    });

    return new Map(configs.map((config) => [config.signalType, config]));
  }

  /**
   * Generate human-readable description of signal
   */
  private generateSignalDescription(signal: IntentSignal, config: IntentSignalType): string {
    const base = config.displayName;
    const daysAgo = Math.floor(
      (Date.now() - new Date(signal.detectedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysAgo === 0) {
      return `${base} (today)`;
    } else if (daysAgo === 1) {
      return `${base} (yesterday)`;
    } else {
      return `${base} (${daysAgo} days ago)`;
    }
  }

  /**
   * Determine intent level from score
   */
  private determineIntentLevel(score: number): IntentLevel {
    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Recommend action based on intent score and signals
   */
  private recommendAction(
    score: number,
    level: IntentLevel,
    signals: ProcessedIntentSignal[]
  ): { action: IntentAction; reason: string } {
    // Check for high-intent signals (demo, pricing, trial)
    const hasHighIntentSignal = signals.some((s) =>
      ['demo_request', 'pricing_page_visit', 'trial_signup', 'contact_sales'].includes(
        s.signal_type
      )
    );

    if (level === 'very_high' || (level === 'high' && hasHighIntentSignal)) {
      return {
        action: 'immediate_outreach',
        reason: 'Lead shows very strong buying intent with multiple high-value signals',
      };
    }

    if (level === 'high') {
      return {
        action: 'schedule_demo',
        reason: 'Lead is actively researching and comparing solutions',
      };
    }

    if (level === 'medium') {
      return {
        action: 'nurture',
        reason: 'Lead is engaged but needs more education before sales conversation',
      };
    }

    return {
      action: 'wait',
      reason: 'Lead shows minimal intent signals, continue monitoring',
    };
  }

  /**
   * Calculate confidence in intent score
   */
  private calculateConfidence(signals: ProcessedIntentSignal[]): number {
    // More signals + more recent signals = higher confidence
    const signalCount = signals.length;

    if (signalCount === 0) return 0;

    const avgRecency =
      signals.reduce((sum, s) => {
        const daysAgo = (Date.now() - s.detected_at.getTime()) / (1000 * 60 * 60 * 24);
        return sum + Math.max(0, 1 - daysAgo / 30); // Decay over 30 days
      }, 0) / signalCount;

    // Confidence formula: signal count (40%) + recency (60%)
    const signalCountScore = Math.min(signalCount / 10, 1); // Plateau at 10 signals
    const confidence = signalCountScore * 0.4 + avgRecency * 0.6;

    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  }

  /**
   * Store calculated intent score
   */
  private async storeIntentScore(
    leadId: string,
    workspaceId: string,
    scoreData: {
      intent_score: number;
      intent_level: IntentLevel;
      confidence: string;
      signal_count: number;
      top_signals: ProcessedIntentSignal[];
      recommended_action: IntentAction;
      action_reason: string;
    }
  ): Promise<void> {
    // Get previous score
    const previous = await db.query.leadIntentScores.findFirst({
      where: eq(leadIntentScores.leadId, leadId),
    });

    const scoreChanged = previous && previous.intentScore !== scoreData.intent_score;

    // Insert or update current score
    await db
      .insert(leadIntentScores)
      .values({
        leadId,
        workspaceId,
        intentScore: scoreData.intent_score,
        intentLevel: scoreData.intent_level,
        confidence: scoreData.confidence,
        signalCount: scoreData.signal_count,
        topSignals: scoreData.top_signals,
        recommendedAction: scoreData.recommended_action,
        actionReason: scoreData.action_reason,
        previousScore: previous?.intentScore,
        scoreChangedAt: scoreChanged ? new Date() : previous?.scoreChangedAt,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leadIntentScores.leadId,
        set: {
          intentScore: scoreData.intent_score,
          intentLevel: scoreData.intent_level,
          confidence: scoreData.confidence,
          signalCount: scoreData.signal_count,
          topSignals: scoreData.top_signals,
          recommendedAction: scoreData.recommended_action,
          actionReason: scoreData.action_reason,
          previousScore: previous?.intentScore,
          scoreChangedAt: scoreChanged ? sql`NOW()` : leadIntentScores.scoreChangedAt,
          calculatedAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        },
      });

    // Record in history if score changed or this is the first calculation
    if (!previous || scoreChanged) {
      await db.insert(intentScoreHistory).values({
        leadId,
        workspaceId,
        intentScore: scoreData.intent_score,
        intentLevel: scoreData.intent_level,
        scoreDelta: previous ? scoreData.intent_score - previous.intentScore : 0,
        calculatedAt: new Date(),
      });
    }
  }
}

// Export singleton instance
export const intentDetectionService = new IntentDetectionService();
