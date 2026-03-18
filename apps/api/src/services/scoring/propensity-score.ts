/**
 * Propensity Score Calculator
 * Main scoring function that orchestrates all component scorers
 */

import { db } from '@agios/db';
import { crmLeads, crmContacts, crmAccounts, crmActivities } from '@agios/db/schema';
import { eq, and, gte } from 'drizzle-orm';

import { scoreContactQuality } from './components/contact-quality';
import { scoreCompanyFit } from './components/company-fit';
import { scoreEngagement } from './components/engagement';
import { scoreTimingReadiness } from './components/timing';

import type { ScoreBreakdown, ScoringData } from './types';

/**
 * Calculate propensity score for a lead
 *
 * Orchestrates all 4 scoring components:
 * 1. Contact Quality (30 pts)
 * 2. Company Fit (30 pts)
 * 3. Engagement Signals (20 pts)
 * 4. Timing & Readiness (20 pts)
 *
 * @param leadId - UUID of the lead to score
 * @returns Score and detailed breakdown
 * @throws Error if lead not found
 */
export async function calculatePropensityScore(
  leadId: string
): Promise<{ score: number; breakdown: ScoreBreakdown }> {
  // 1. Fetch all data needed for scoring
  const data = await fetchScoringData(leadId);

  if (!data.lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // 2. Calculate component scores
  const contactQuality = scoreContactQuality(data.contact, data.lead);
  const companyFit = scoreCompanyFit(data.account);
  const engagement = scoreEngagement(data.activities);
  const timing = scoreTimingReadiness(data.lead, data.account, data.activities);

  // 3. Sum components to get total score
  const total = Math.min(
    100,
    Math.max(
      0,
      contactQuality.score + companyFit.score + engagement.score + timing.score
    )
  );

  // 4. Build breakdown
  const breakdown: ScoreBreakdown = {
    total,
    components: {
      contactQuality,
      companyFit,
      engagement,
      timing,
    },
  };

  return { score: total, breakdown };
}

/**
 * Fetch all data needed for scoring
 *
 * Efficiently loads:
 * - Lead record
 * - Converted contact (if exists)
 * - Associated account (if exists)
 * - Recent activities (last 90 days)
 *
 * @param leadId - Lead UUID
 * @returns All scoring data or nulls if not found
 */
async function fetchScoringData(leadId: string): Promise<ScoringData> {
  // Fetch lead with relations
  const lead = await db.query.crmLeads.findFirst({
    where: eq(crmLeads.id, leadId),
    with: {
      convertedContact: {
        with: {
          account: true,
        },
      },
    },
  });

  if (!lead) {
    return { lead: null, contact: null, account: null, activities: [] };
  }

  const contact = lead.convertedContact;
  const account = contact?.account || null;

  // Fetch activities for engagement scoring (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const activities = await db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.leadId, leadId), gte(crmActivities.createdAt, ninetyDaysAgo)))
    .orderBy(crmActivities.createdAt)
    .limit(50);

  return { lead, contact: contact || null, account, activities };
}

/**
 * Calculate propensity scores for multiple leads (bulk operation)
 *
 * @param leadIds - Array of lead UUIDs
 * @returns Map of leadId -> score result
 */
export async function calculatePropensityScoresBulk(
  leadIds: string[]
): Promise<Map<string, { score: number; breakdown: ScoreBreakdown }>> {
  const results = new Map();

  // Process leads sequentially for now
  // TODO: Optimize with batched queries in future
  for (const leadId of leadIds) {
    try {
      const result = await calculatePropensityScore(leadId);
      results.set(leadId, result);
    } catch (error) {
      console.error(`Failed to score lead ${leadId}:`, error);
      // Continue processing other leads
    }
  }

  return results;
}
