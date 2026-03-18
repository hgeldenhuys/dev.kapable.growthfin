/**
 * Qualification Service
 * Handles lead qualification with BANT framework (US-CRM-STATE-MACHINE T-011)
 */

import type { Database } from '@agios/db';
import { crmLeads, type CrmLead } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { timelineService } from './timeline';

interface BANTInput {
  budget?: boolean;
  authority?: boolean;
  need?: boolean;
  timing?: boolean;
}

export const qualificationService = {
  /**
   * Update BANT qualification with auto-score calculation
   * BANT scoring: Budget=30%, Authority=25%, Need=25%, Timing=20%
   */
  async updateQualification(
    db: Database,
    leadId: string,
    workspaceId: string,
    bant: BANTInput,
    manualScore?: number,
    notes?: string,
    userId?: string
  ): Promise<CrmLead> {
    // Get current lead state
    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      );

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Check if lead is blacklisted or converted
    if (lead.contactability === 'blacklisted') {
      throw new Error('Cannot qualify a blacklisted lead');
    }

    if (lead.contactability === 'converted') {
      throw new Error('Lead is already converted');
    }

    const now = new Date();

    // Calculate auto BANT score if BANT fields provided
    let calculatedScore: number | undefined;
    if (Object.keys(bant).length > 0) {
      calculatedScore = this.calculateBANTScore(bant);
    }

    // Determine effective qualification score and source
    const qualificationScore = manualScore !== undefined ? manualScore : calculatedScore;
    const qualificationSource = manualScore !== undefined ? 'manual' : 'auto';

    // Prepare update data
    const updateData: any = {
      updatedAt: now,
      updatedBy: userId,
    };

    // Update BANT fields if provided
    if (bant.budget !== undefined) updateData.bantBudget = bant.budget;
    if (bant.authority !== undefined) updateData.bantAuthority = bant.authority;
    if (bant.need !== undefined) updateData.bantNeed = bant.need;
    if (bant.timing !== undefined) updateData.bantTiming = bant.timing;

    // Update qualification fields
    if (qualificationScore !== undefined) {
      updateData.qualificationScore = qualificationScore;
      updateData.qualificationSource = qualificationSource;
      updateData.qualifiedAt = now;
      updateData.qualifiedBy = userId;
    }

    if (notes) {
      updateData.qualificationNotes = notes;
    }

    // Update lead
    const [updated] = await db
      .update(crmLeads)
      .set(updateData)
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.workspaceId, workspaceId),
          isNull(crmLeads.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to update lead qualification');
    }

    // Create timeline event
    await timelineService.create(db, {
      workspaceId,
      entityType: 'lead',
      entityId: leadId,
      eventType: 'lead.qualified',
      eventCategory: 'milestone',
      eventLabel: 'Lead Qualified',
      summary: `Lead qualification updated: Score ${qualificationScore} (${qualificationSource})`,
      description: notes,
      occurredAt: now,
      actorType: userId ? 'user' : 'system',
      actorId: userId,
      dataChanges: {
        bant,
        qualificationScore,
        qualificationSource,
      },
    });

    return updated;
  },

  /**
   * Calculate effective score from BANT
   * Budget=30%, Authority=25%, Need=25%, Timing=20%
   */
  calculateBANTScore(bant: BANTInput): number {
    let score = 0;
    let totalWeight = 0;

    const weights = {
      budget: 30,
      authority: 25,
      need: 25,
      timing: 20,
    };

    for (const [key, weight] of Object.entries(weights)) {
      const value = bant[key as keyof BANTInput];
      if (value !== undefined) {
        if (value) {
          score += weight;
        }
        totalWeight += weight;
      }
    }

    // If no BANT fields provided, return 0
    if (totalWeight === 0) {
      return 0;
    }

    // Calculate percentage score
    return Math.round((score / totalWeight) * 100);
  },
};
