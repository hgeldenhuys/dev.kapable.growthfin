/**
 * Lead Queue Service
 * Handles sales rep lead queue operations, claiming, and prioritization
 * Story: US-SALES-QUEUE-001
 */

import { and, eq, isNull, desc, asc, sql, lte, gt, or } from 'drizzle-orm';
import type { Database } from '../../../db';
import { crmLeads } from '@agios/db/schema';

export interface QueueLead {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  leadScore: number;
  propensityScore: number;
  callbackDate: Date | null;
  lastContactDate: Date | null;
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
}

export interface QueueStats {
  totalAssigned: number;
  overdueCallbacks: number;
  todayCallbacks: number;
  averagePropensityScore: number;
}

export interface GetMyQueueParams {
  workspaceId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

export interface ClaimNextLeadParams {
  workspaceId: string;
  userId: string;
  maxPropensityScore?: number;
  excludeTags?: string[];
}

/**
 * Get prioritized queue for a sales rep
 * Priority order:
 * 1. Overdue callbacks (callback_date <= NOW)
 * 2. Future callbacks (callback_date > NOW)
 * 3. High propensity scores (propensity_score DESC)
 * 4. FIFO (created_at ASC)
 */
export async function getMyQueue(
  db: Database,
  params: GetMyQueueParams
): Promise<{ leads: QueueLead[]; stats: QueueStats; total: number }> {
  const { workspaceId, userId, limit = 50, offset = 0 } = params;

  // Get leads with priority ordering
  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, workspaceId),
        eq(crmLeads.ownerId, userId),
        isNull(crmLeads.deletedAt),
        or(
          eq(crmLeads.status, 'new'),
          eq(crmLeads.status, 'contacted'),
          eq(crmLeads.status, 'qualified')
        )
      )
    )
    .orderBy(
      // Priority 1: Overdue callbacks first (0), then future callbacks (1), then no callback (2)
      sql`CASE
        WHEN ${crmLeads.callbackDate} <= NOW() THEN 0
        WHEN ${crmLeads.callbackDate} IS NOT NULL THEN 1
        ELSE 2
      END`,
      // Priority 2: Within each group, sort by propensity score DESC
      desc(crmLeads.propensityScore),
      // Priority 3: FIFO for same propensity
      asc(crmLeads.createdAt)
    )
    .limit(limit)
    .offset(offset);

  // Get stats
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const statsResult = await db
    .select({
      total: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) FILTER (WHERE callback_date <= NOW())::int`,
      today: sql<number>`count(*) FILTER (WHERE callback_date > NOW() AND callback_date <= ${todayEnd.toISOString()})::int`,
      avgScore: sql<number>`avg(propensity_score)::int`,
    })
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, workspaceId),
        eq(crmLeads.ownerId, userId),
        isNull(crmLeads.deletedAt),
        or(
          eq(crmLeads.status, 'new'),
          eq(crmLeads.status, 'contacted'),
          eq(crmLeads.status, 'qualified')
        )
      )
    );

  const stats: QueueStats = {
    totalAssigned: statsResult[0]?.total || 0,
    overdueCallbacks: statsResult[0]?.overdue || 0,
    todayCallbacks: statsResult[0]?.today || 0,
    averagePropensityScore: statsResult[0]?.avgScore || 0,
  };

  return {
    leads: leads as QueueLead[],
    stats,
    total: stats.totalAssigned,
  };
}

/**
 * Claim the next available unassigned lead
 * Uses FOR UPDATE SKIP LOCKED for concurrency safety
 */
export async function claimNextLead(
  db: Database,
  params: ClaimNextLeadParams
): Promise<{ success: boolean; lead?: QueueLead; message?: string }> {
  const { workspaceId, userId, maxPropensityScore, excludeTags = [] } = params;

  try {
    // Use transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Build where conditions
      const whereConditions = [
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.ownerId),
        isNull(crmLeads.deletedAt),
        eq(crmLeads.status, 'new'),
      ];

      // Optional: max propensity score filter
      if (maxPropensityScore !== undefined) {
        whereConditions.push(lte(crmLeads.propensityScore, maxPropensityScore));
      }

      // Find next lead with row lock (SKIP LOCKED prevents waiting for other transactions)
      const nextLeads = await tx
        .select()
        .from(crmLeads)
        .where(and(...whereConditions))
        .orderBy(
          desc(crmLeads.propensityScore),
          asc(crmLeads.createdAt)
        )
        .limit(1)
        .for('update', { skipLocked: true });

      if (nextLeads.length === 0) {
        return { success: false, message: 'No leads available to claim' };
      }

      const nextLead = nextLeads[0];

      // Check tag exclusions
      if (excludeTags.length > 0 && nextLead.tags) {
        const hasExcludedTag = nextLead.tags.some((tag) => excludeTags.includes(tag));
        if (hasExcludedTag) {
          return { success: false, message: 'Next lead has excluded tags' };
        }
      }

      // Update lead ownership
      const updated = await tx
        .update(crmLeads)
        .set({
          ownerId: userId,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(crmLeads.id, nextLead.id))
        .returning();

      if (updated.length === 0) {
        return { success: false, message: 'Failed to claim lead' };
      }

      return {
        success: true,
        lead: updated[0] as QueueLead,
      };
    });

    return result;
  } catch (error) {
    console.error('[claimNextLead] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available leads count for a workspace
 */
export async function getAvailableLeadsCount(
  db: Database,
  workspaceId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.ownerId),
        isNull(crmLeads.deletedAt),
        eq(crmLeads.status, 'new')
      )
    );

  return result[0]?.count || 0;
}

export const queueService = {
  getMyQueue,
  claimNextLead,
  getAvailableLeadsCount,
};
