/**
 * Opportunity Outcome Service
 * Handles opportunity stage progression and closure (US-CRM-STATE-MACHINE T-013)
 */

import type { Database } from '@agios/db';
import { crmOpportunities, type OpportunityStage, type LostReason, type CrmOpportunity } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';

interface CloseOptions {
  amount?: number;
  lostReason?: LostReason;
  notes?: string;
  userId?: string;
}

export const outcomeService = {
  /**
   * Advance opportunity to next stage
   */
  async advanceStage(
    db: Database,
    opportunityId: string,
    workspaceId: string,
    nextStage: OpportunityStage,
    userId?: string
  ): Promise<CrmOpportunity> {
    // Get current opportunity state
    const [opportunity] = await db
      .select()
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.id, opportunityId),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt)
        )
      );

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    // Prevent advancing closed opportunities
    if (opportunity.outcome === 'won' || opportunity.outcome === 'lost') {
      throw new Error(`Cannot advance a ${opportunity.outcome} opportunity`);
    }

    // Validate stage progression
    const validStages: OpportunityStage[] = [
      'prospecting',
      'qualification',
      'proposal',
      'negotiation',
      'closed_won',
      'closed_lost',
    ];

    if (!validStages.includes(nextStage)) {
      throw new Error(`Invalid stage: ${nextStage}`);
    }

    // Auto-set probability based on stage
    const probabilityByStage: Record<OpportunityStage, number> = {
      prospecting: 10,
      qualification: 25,
      proposal: 50,
      negotiation: 75,
      closed_won: 100,
      closed_lost: 0,
    };

    const now = new Date();

    // Prepare update data
    const updateData: any = {
      stage: nextStage,
      probability: probabilityByStage[nextStage],
      updatedAt: now,
      updatedBy: userId,
    };

    // Update opportunity
    const [updated] = await db
      .update(crmOpportunities)
      .set(updateData)
      .where(
        and(
          eq(crmOpportunities.id, opportunityId),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to advance opportunity stage');
    }

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'opportunity',
      entityId: opportunityId,
      eventType: 'opportunity.stage_advanced',
      eventCategory: 'milestone',
      eventLabel: 'Stage Advanced',
      summary: `Opportunity advanced from ${opportunity.stage} to ${nextStage}`,
      occurredAt: now,
      actorType: userId ? 'user' : 'system',
      actorId: userId,
      dataChanges: {
        oldStage: opportunity.stage,
        newStage: nextStage,
        oldProbability: opportunity.probability,
        newProbability: probabilityByStage[nextStage],
      },
    });

    return updated;
  },

  /**
   * Close opportunity as won or lost
   */
  async closeOpportunity(
    db: Database,
    opportunityId: string,
    workspaceId: string,
    outcome: 'won' | 'lost',
    options?: CloseOptions
  ): Promise<CrmOpportunity> {
    // Get current opportunity state
    const [opportunity] = await db
      .select()
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.id, opportunityId),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt)
        )
      );

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    // Prevent re-closing already closed opportunities
    if (opportunity.outcome === 'won' || opportunity.outcome === 'lost') {
      throw new Error(`Opportunity is already closed as ${opportunity.outcome}`);
    }

    // Validate lost requirements
    if (outcome === 'lost' && !options?.lostReason) {
      throw new Error('Lost opportunities require a lostReason');
    }

    const now = new Date();

    // Prepare update data
    const updateData: any = {
      outcome,
      status: outcome,
      actualCloseDate: now,
      closedBy: options?.userId,
      updatedAt: now,
      updatedBy: options?.userId,
    };

    // Set stage based on outcome
    if (outcome === 'won') {
      updateData.stage = 'closed_won';
      updateData.probability = 100;
      updateData.wonAmount = options?.amount !== undefined ? options.amount.toString() : opportunity.amount;
      updateData.contractSignedAt = now;
    } else {
      updateData.stage = 'closed_lost';
      updateData.probability = 0;
      updateData.lostReason = options?.lostReason;
      updateData.lostNotes = options?.notes;
    }

    // Update opportunity
    const [updated] = await db
      .update(crmOpportunities)
      .set(updateData)
      .where(
        and(
          eq(crmOpportunities.id, opportunityId),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to close opportunity');
    }

    // Create timeline event
    const eventLabel = outcome === 'won' ? 'Opportunity Won' : 'Opportunity Lost';
    let summary = `Opportunity closed as ${outcome}`;
    if (outcome === 'lost' && options?.lostReason) {
      summary += ` (reason: ${options.lostReason})`;
    }
    if (outcome === 'won' && options?.amount) {
      summary += ` (amount: ${options.amount})`;
    }

    await timelineService.create(db, {
      workspaceId,
      entityType: 'opportunity',
      entityId: opportunityId,
      eventType: outcome === 'won' ? 'opportunity.won' : 'opportunity.lost',
      eventCategory: 'milestone',
      eventLabel,
      summary,
      description: options?.notes,
      occurredAt: now,
      actorType: options?.userId ? 'user' : 'system',
      actorId: options?.userId,
      dataChanges: {
        outcome,
        lostReason: outcome === 'lost' ? options?.lostReason : undefined,
        wonAmount: outcome === 'won' ? options?.amount : undefined,
      },
    });

    return updated;
  },
};
