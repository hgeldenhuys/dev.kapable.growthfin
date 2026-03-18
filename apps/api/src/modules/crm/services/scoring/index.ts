/**
 * Lead Scoring Service - Orchestrator
 * Coordinates all scoring dimensions and manages score persistence
 * Epic 5 - Sprint 2: US-LEAD-SCORE-005
 */

import {
  db,
  leadScores,
  leadScoreHistory,
  leadScoringModels,
  crmActivities,
  crmLeads,
  crmAccounts,
  crmContacts,
  type LeadScore,
  type NewLeadScore,
  type LeadScoringModel,
} from '@agios/db';
import { eq, and, desc } from 'drizzle-orm';
import {
  calculateEngagementScore,
  DEFAULT_ENGAGEMENT_FACTORS,
  type EngagementFactors,
} from './engagement-scorer';
import { calculateFitScore, DEFAULT_FIT_WEIGHTS, type FitCriteria } from './fit-scorer';
import {
  calculateCompositeScore,
  DEFAULT_COMPOSITE_WEIGHTS,
  type ScoreWeights,
} from './composite-scorer';

export interface CalculateScoresOptions {
  leadIds: string[];
  workspaceId: string;
  scoreTypes?: ('propensity' | 'engagement' | 'fit' | 'composite')[];
  saveToDatabase?: boolean; // Default: true
}

export interface LeadScoresResult {
  leadId: string;
  propensityScore: number | null;
  engagementScore: number | null;
  fitScore: number | null;
  compositeScore: number | null;
  breakdown: {
    engagement?: Record<string, number>;
    fit?: Record<string, number>;
    composite?: {
      propensity: number;
      engagement: number;
      fit: number;
    };
  };
  calculatedAt: Date;
}

/**
 * Calculate scores for multiple leads
 * Main entry point for score calculation
 * @param options - Calculation options
 * @returns Array of score results
 */
export async function calculateLeadScores(
  options: CalculateScoresOptions
): Promise<LeadScoresResult[]> {
  const { leadIds, workspaceId, scoreTypes, saveToDatabase = true } = options;

  // Determine which score types to calculate
  const typesToCalculate = scoreTypes || ['propensity', 'engagement', 'fit', 'composite'];

  // Fetch active scoring models for workspace
  const scoringModels = await getScoringModels(workspaceId);

  // Process each lead
  const results: LeadScoresResult[] = [];

  for (const leadId of leadIds) {
    // Fetch lead data with related entities
    const leadData = await fetchLeadData(leadId, workspaceId);

    if (!leadData) {
      console.warn(`[calculateLeadScores] Lead ${leadId} not found`);
      continue;
    }

    // Calculate each score dimension
    const scoreResult = await calculateAllScores(leadData, scoringModels, typesToCalculate);

    results.push(scoreResult);

    // Save to database if requested
    if (saveToDatabase) {
      await saveLeadScore(scoreResult, workspaceId);
    }
  }

  return results;
}

/**
 * Fetch lead data with all related entities
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @returns Lead data with relations
 */
async function fetchLeadData(leadId: string, workspaceId: string) {
  // Fetch lead
  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1);

  if (!lead) return null;

  // Fetch account
  const account = lead.accountId
    ? await db.select().from(crmAccounts).where(eq(crmAccounts.id, lead.accountId)).limit(1)
    : [];

  // Fetch contact
  const contact = lead.contactId
    ? await db.select().from(crmContacts).where(eq(crmContacts.id, lead.contactId)).limit(1)
    : [];

  // Fetch recent activities (last 90 days)
  const activities = await db
    .select()
    .from(crmActivities)
    .where(
      and(
        eq(crmActivities.workspaceId, workspaceId),
        eq(crmActivities.leadId, leadId)
      )
    )
    .orderBy(desc(crmActivities.createdAt))
    .limit(100);

  return {
    lead,
    account: account[0] || null,
    contact: contact[0] || null,
    activities,
  };
}

/**
 * Calculate all score dimensions for a lead
 * @param leadData - Lead data with relations
 * @param scoringModels - Active scoring models
 * @param typesToCalculate - Which score types to calculate
 * @returns Score result
 */
async function calculateAllScores(
  leadData: {
    lead: any;
    account: any;
    contact: any;
    activities: any[];
  },
  scoringModels: Record<string, LeadScoringModel>,
  typesToCalculate: string[]
): Promise<LeadScoresResult> {
  const { lead, account, contact, activities } = leadData;

  let propensityScore: number | null = null;
  let engagementScore: number | null = null;
  let fitScore: number | null = null;
  let compositeScore: number | null = null;
  const breakdown: any = {};

  // 1. Propensity Score (use existing from crm_leads.propensity_score)
  if (typesToCalculate.includes('propensity')) {
    propensityScore = lead.propensityScore || 0;
  }

  // 2. Engagement Score
  if (typesToCalculate.includes('engagement')) {
    const engagementModel = scoringModels['engagement'];
    const engagementFactors: EngagementFactors = engagementModel?.engagementFactors || DEFAULT_ENGAGEMENT_FACTORS;

    const result = calculateEngagementScore(activities, engagementFactors, 30);
    engagementScore = result.score;
    breakdown.engagement = result.breakdown;
  }

  // 3. Fit Score
  if (typesToCalculate.includes('fit')) {
    const fitModel = scoringModels['fit'];
    const fitCriteria: FitCriteria = fitModel?.fitCriteria || {
      companySize: { min: 10, max: 10000, weight: DEFAULT_FIT_WEIGHTS.companySize },
      industries: ['Technology', 'Finance', 'Financial Services', 'Banking', 'Healthcare', 'Insurance', 'Retail', 'E-commerce', 'Mining', 'Manufacturing', 'Telecommunications', 'Media', 'Entertainment', 'Energy', 'Agriculture'],
      industryWeight: DEFAULT_FIT_WEIGHTS.industry,
      revenue: { min: 1000000, max: 100000000 },
      revenueWeight: DEFAULT_FIT_WEIGHTS.revenue,
      countries: ['United States', 'Canada', 'United Kingdom', 'South Africa'],
      geoWeight: DEFAULT_FIT_WEIGHTS.geography,
      targetRoles: ['CEO', 'CTO', 'VP', 'Director', 'Manager', 'Managing Director', 'MD'],
      roleWeight: DEFAULT_FIT_WEIGHTS.role,
    };

    const result = calculateFitScore(lead, account, contact, fitCriteria, lead.customFields as Record<string, any>);
    fitScore = result.score;
    breakdown.fit = result.breakdown;
  }

  // 4. Composite Score (combines all dimensions)
  if (typesToCalculate.includes('composite')) {
    const compositeModel = scoringModels['composite'];
    const weights: ScoreWeights = {
      propensity: compositeModel?.propensityWeight
        ? parseFloat(compositeModel.propensityWeight as any)
        : DEFAULT_COMPOSITE_WEIGHTS.propensity,
      engagement: compositeModel?.engagementWeight
        ? parseFloat(compositeModel.engagementWeight as any)
        : DEFAULT_COMPOSITE_WEIGHTS.engagement,
      fit: compositeModel?.fitWeight
        ? parseFloat(compositeModel.fitWeight as any)
        : DEFAULT_COMPOSITE_WEIGHTS.fit,
    };

    const result = calculateCompositeScore(propensityScore, engagementScore, fitScore, weights);
    compositeScore = result.compositeScore;
    breakdown.composite = result.contributionBreakdown;
  }

  return {
    leadId: lead.id,
    propensityScore,
    engagementScore,
    fitScore,
    compositeScore,
    breakdown,
    calculatedAt: new Date(),
  };
}

/**
 * Get active scoring models for a workspace
 * @param workspaceId - Workspace ID
 * @returns Map of model type to model
 */
async function getScoringModels(workspaceId: string): Promise<Record<string, LeadScoringModel>> {
  const models = await db
    .select()
    .from(leadScoringModels)
    .where(and(eq(leadScoringModels.workspaceId, workspaceId), eq(leadScoringModels.isActive, true)));

  const modelMap: Record<string, LeadScoringModel> = {};
  for (const model of models) {
    modelMap[model.modelType] = model;
  }

  return modelMap;
}

/**
 * Save or update lead score in database
 * @param scoreResult - Score result to save
 * @param workspaceId - Workspace ID
 */
async function saveLeadScore(scoreResult: LeadScoresResult, workspaceId: string): Promise<void> {
  const { leadId, propensityScore, engagementScore, fitScore, compositeScore, breakdown } =
    scoreResult;

  // Check if score already exists for this lead
  const [existingScore] = await db
    .select()
    .from(leadScores)
    .where(eq(leadScores.leadId, leadId))
    .limit(1);

  if (existingScore) {
    // Archive old score to history
    await db.insert(leadScoreHistory).values({
      workspaceId,
      leadId,
      propensityScore: existingScore.propensityScore,
      engagementScore: existingScore.engagementScore,
      fitScore: existingScore.fitScore,
      compositeScore: existingScore.compositeScore,
      scoreBreakdown: existingScore.scoreBreakdown,
      recordedAt: existingScore.calculatedAt,
    });

    // Update existing score
    await db
      .update(leadScores)
      .set({
        propensityScore: propensityScore?.toString() || null,
        engagementScore: engagementScore?.toString() || null,
        fitScore: fitScore?.toString() || null,
        compositeScore: compositeScore?.toString() || null,
        scoreBreakdown: breakdown,
        calculatedAt: new Date(),
      })
      .where(eq(leadScores.leadId, leadId));
  } else {
    // Insert new score
    await db.insert(leadScores).values({
      workspaceId,
      leadId,
      propensityScore: propensityScore?.toString() || null,
      engagementScore: engagementScore?.toString() || null,
      fitScore: fitScore?.toString() || null,
      compositeScore: compositeScore?.toString() || null,
      scoreBreakdown: breakdown,
      calculatedAt: new Date(),
    });
  }

  console.log(
    `[saveLeadScore] Saved scores for lead ${leadId}: composite=${compositeScore}, engagement=${engagementScore}, fit=${fitScore}`
  );
}

/**
 * Get scores for a single lead
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @returns Lead scores or null
 */
export async function getLeadScores(
  leadId: string,
  workspaceId: string
): Promise<LeadScore | null> {
  const [score] = await db
    .select()
    .from(leadScores)
    .where(and(eq(leadScores.leadId, leadId), eq(leadScores.workspaceId, workspaceId)))
    .limit(1);

  return score || null;
}

/**
 * Get score history for a lead
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @param daysLookback - Number of days to look back (default: 30)
 * @returns Array of historical scores
 */
export async function getLeadScoreHistory(
  leadId: string,
  workspaceId: string,
  daysLookback: number = 30
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLookback);

  return db
    .select()
    .from(leadScoreHistory)
    .where(and(eq(leadScoreHistory.leadId, leadId), eq(leadScoreHistory.workspaceId, workspaceId)))
    .orderBy(desc(leadScoreHistory.recordedAt))
    .limit(90); // Max 90 data points
}

// Export scoring functions for direct use
export * from './engagement-scorer';
export * from './fit-scorer';
export * from './composite-scorer';
