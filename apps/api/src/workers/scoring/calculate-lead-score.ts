/**
 * Lead Scoring Worker
 * Calculates propensity scores for leads asynchronously
 *
 * Triggered by:
 * - Lead creation (priority 10)
 * - Lead updates (priority 5)
 * - Manual recalculation (priority 7)
 *
 * Updates:
 * - crm_leads: propensity_score, propensity_score_updated_at, score_breakdown
 * - crm_lead_score_history: Creates audit record
 *
 * Real-time updates handled by SignalDB table triggers
 */

import type PgBoss from 'pg-boss';
import { db } from '@agios/db';
import { crmLeads, crmLeadScoreHistory } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { calculatePropensityScore } from '../../services/scoring';

export interface CalculateLeadScoreJob {
  leadId: string;
  workspaceId: string;
  trigger: 'created' | 'updated' | 'manual';
  triggerUserId?: string;
  triggerReason?: string;
}

/**
 * Process a lead scoring job
 *
 * Steps:
 * 1. Fetch current lead data
 * 2. Calculate new propensity score
 * 3. Update lead record with new score
 * 4. Create score history audit record
 * 5. Real-time update handled by SignalDB table triggers
 *
 * @throws Error if scoring calculation fails (missing leads complete gracefully)
 */
export async function processLeadScoreJob(job: PgBoss.Job<CalculateLeadScoreJob>): Promise<void> {
  const { leadId, workspaceId, trigger, triggerUserId, triggerReason } = job.data;

  console.log(`[Scoring Worker] Processing lead ${leadId}, trigger: ${trigger}`);

  const startTime = Date.now();

  try {
    // 1. Fetch current lead data
    const lead = await db.query.crmLeads.findFirst({
      where: eq(crmLeads.id, leadId),
    });

    if (!lead) {
      console.warn(`[Scoring Worker] Lead not found: ${leadId}, completing job (lead may have been deleted)`);
      return; // Complete the job successfully so pg-boss doesn't retry
    }

    if (lead.workspaceId !== workspaceId) {
      console.warn(`[Scoring Worker] Workspace mismatch for lead ${leadId}: expected ${workspaceId}, got ${lead.workspaceId}, completing job`);
      return; // Complete the job successfully — data inconsistency, don't retry
    }

    const scoreBefore = lead.propensityScore;

    // 2. Calculate new propensity score
    const { score, breakdown } = await calculatePropensityScore(leadId);

    // 3. Update lead record
    await db
      .update(crmLeads)
      .set({
        propensityScore: score,
        propensityScoreUpdatedAt: new Date(),
        scoreBreakdown: breakdown,
        updatedAt: new Date(),
        updatedBy: triggerUserId,
      })
      .where(eq(crmLeads.id, leadId));

    // 4. Create score history audit record (scoreDelta is a generated column)
    await db.insert(crmLeadScoreHistory).values({
      workspaceId,
      leadId,
      scoreBefore,
      scoreAfter: score,
      scoreBreakdown: breakdown,
      triggerType: trigger,
      triggerUserId,
      triggerReason,
      createdAt: new Date(),
    });

    // Real-time event is handled automatically by SignalDB's table triggers
    // on the crm_leads UPDATE above — no manual pg_notify needed.

    const duration = Date.now() - startTime;
    console.log(
      `[Scoring Worker] ✅ Lead ${leadId} scored: ${scoreBefore || 0} → ${score} (${duration}ms)`
    );
  } catch (error) {
    console.error(`[Scoring Worker] ❌ Failed to score lead ${leadId}:`, error);
    throw error; // Let pg-boss handle retry logic
  }
}
