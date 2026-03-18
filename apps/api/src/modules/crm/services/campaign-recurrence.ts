/**
 * Campaign Recurrence Service
 * Business logic for recurring campaign management
 */

import type { Database } from '@agios/db';
import {
  campaignRecurrences,
  type NewCampaignRecurrence,
  type CampaignRecurrence,
  type RecurrencePattern,
  type RecurrenceEndCondition,
} from '@agios/db/schema';
import { crmCampaigns } from '@agios/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import {
  calculateNextExecution,
  calculateNextExecutions,
  validateRecurrenceConfig,
  hasRecurrenceEnded,
  type RecurrenceConfig,
} from '../utils/recurrence';
import { validateTimezone } from '../utils/timezone';

export interface CreateRecurringCampaignParams {
  campaignId: string;
  workspaceId: string;
  pattern: RecurrencePattern;
  config: RecurrenceConfig;
  timezone: string;
  endCondition: RecurrenceEndCondition;
  maxExecutions?: number;
  endDate?: Date;
  userId: string;
}

/**
 * Create a recurring campaign schedule
 */
export async function createRecurringCampaign(
  db: Database,
  params: CreateRecurringCampaignParams
): Promise<CampaignRecurrence> {
  const {
    campaignId,
    workspaceId,
    pattern,
    config,
    timezone,
    endCondition,
    maxExecutions,
    endDate,
    userId,
  } = params;

  // Validate timezone
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Validate recurrence config
  validateRecurrenceConfig(pattern, config);

  // Validate end condition parameters
  if (endCondition === 'after_executions' && !maxExecutions) {
    throw new Error('maxExecutions is required for after_executions end condition');
  }

  if (endCondition === 'end_date' && !endDate) {
    throw new Error('endDate is required for end_date end condition');
  }

  if (endCondition === 'end_date' && endDate && endDate <= new Date()) {
    throw new Error('End date must be in the future');
  }

  // Verify campaign exists
  const campaign = await db
    .select()
    .from(crmCampaigns)
    .where(
      and(
        eq(crmCampaigns.id, campaignId),
        eq(crmCampaigns.workspaceId, workspaceId),
        isNull(crmCampaigns.deletedAt)
      )
    );

  if (!campaign.length) {
    throw new Error('Campaign not found');
  }

  // Check for existing active recurrence for this campaign
  const existingRecurrence = await db
    .select()
    .from(campaignRecurrences)
    .where(
      and(
        eq(campaignRecurrences.campaignId, campaignId),
        eq(campaignRecurrences.status, 'active'),
        isNull(campaignRecurrences.deletedAt)
      )
    );

  if (existingRecurrence.length > 0) {
    throw new Error('Campaign already has an active recurrence. Pause or delete it first.');
  }

  // Calculate next execution time
  const nextExecutionAt = calculateNextExecution(pattern, config, timezone);

  // Create recurrence
  const recurrenceData: NewCampaignRecurrence = {
    workspaceId,
    campaignId,
    pattern,
    config: config as any, // JSONB type
    timezone,
    endCondition,
    maxExecutions,
    endDate,
    executionCount: 0,
    nextExecutionAt,
    status: 'active',
    createdBy: userId,
    updatedBy: userId,
  };

  const results = await db.insert(campaignRecurrences).values(recurrenceData).returning();

  return results[0];
}

/**
 * Get all campaign recurrences for a workspace
 */
export async function getCampaignRecurrences(
  db: Database,
  workspaceId: string,
  filters?: {
    status?: 'active' | 'paused' | 'completed' | 'cancelled';
    campaignId?: string;
  }
): Promise<CampaignRecurrence[]> {
  const conditions = [
    eq(campaignRecurrences.workspaceId, workspaceId),
    isNull(campaignRecurrences.deletedAt),
  ];

  if (filters?.status) {
    conditions.push(eq(campaignRecurrences.status, filters.status));
  }

  if (filters?.campaignId) {
    conditions.push(eq(campaignRecurrences.campaignId, filters.campaignId));
  }

  return db
    .select()
    .from(campaignRecurrences)
    .where(and(...conditions));
}

/**
 * Get recurrence by ID
 */
export async function getRecurrenceById(
  db: Database,
  recurrenceId: string,
  workspaceId: string
): Promise<CampaignRecurrence | null> {
  const results = await db
    .select()
    .from(campaignRecurrences)
    .where(
      and(
        eq(campaignRecurrences.id, recurrenceId),
        eq(campaignRecurrences.workspaceId, workspaceId),
        isNull(campaignRecurrences.deletedAt)
      )
    );

  return results[0] || null;
}

/**
 * Pause a recurring campaign
 */
export async function pauseRecurrence(
  db: Database,
  recurrenceId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignRecurrence> {
  const recurrence = await getRecurrenceById(db, recurrenceId, workspaceId);

  if (!recurrence) {
    throw new Error('Recurrence not found');
  }

  if (recurrence.status !== 'active') {
    throw new Error('Can only pause active recurrences');
  }

  const results = await db
    .update(campaignRecurrences)
    .set({
      status: 'paused',
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignRecurrences.id, recurrenceId),
        eq(campaignRecurrences.workspaceId, workspaceId),
        isNull(campaignRecurrences.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Resume a paused recurring campaign
 */
export async function resumeRecurrence(
  db: Database,
  recurrenceId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignRecurrence> {
  const recurrence = await getRecurrenceById(db, recurrenceId, workspaceId);

  if (!recurrence) {
    throw new Error('Recurrence not found');
  }

  if (recurrence.status !== 'paused') {
    throw new Error('Can only resume paused recurrences');
  }

  // Recalculate next execution time (in case it's now in the past)
  const config = recurrence.config as RecurrenceConfig;
  const nextExecutionAt = calculateNextExecution(
    recurrence.pattern,
    config,
    recurrence.timezone
  );

  const results = await db
    .update(campaignRecurrences)
    .set({
      status: 'active',
      nextExecutionAt,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignRecurrences.id, recurrenceId),
        eq(campaignRecurrences.workspaceId, workspaceId),
        isNull(campaignRecurrences.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Delete (soft delete) a recurring campaign
 */
export async function deleteRecurrence(
  db: Database,
  recurrenceId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignRecurrence> {
  const recurrence = await getRecurrenceById(db, recurrenceId, workspaceId);

  if (!recurrence) {
    throw new Error('Recurrence not found');
  }

  const results = await db
    .update(campaignRecurrences)
    .set({
      status: 'cancelled',
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignRecurrences.id, recurrenceId),
        eq(campaignRecurrences.workspaceId, workspaceId)
      )
    )
    .returning();

  return results[0];
}

/**
 * Mark recurrence execution as completed and calculate next execution
 */
export async function markRecurrenceExecuted(
  db: Database,
  recurrenceId: string,
  workspaceId: string
): Promise<CampaignRecurrence> {
  const recurrence = await getRecurrenceById(db, recurrenceId, workspaceId);

  if (!recurrence) {
    throw new Error('Recurrence not found');
  }

  const newExecutionCount = recurrence.executionCount + 1;

  // Check if recurrence has ended
  const ended = hasRecurrenceEnded(
    newExecutionCount,
    recurrence.endCondition,
    recurrence.maxExecutions || undefined,
    recurrence.endDate || undefined
  );

  let updateData: any = {
    executionCount: newExecutionCount,
    lastExecutionAt: new Date(),
    updatedAt: new Date(),
  };

  if (ended) {
    // Mark as completed
    updateData.status = 'completed';
    updateData.nextExecutionAt = null;
  } else {
    // Calculate next execution
    const config = recurrence.config as RecurrenceConfig;
    const nextExecutionAt = calculateNextExecution(
      recurrence.pattern,
      config,
      recurrence.timezone
    );
    updateData.nextExecutionAt = nextExecutionAt;
  }

  const results = await db
    .update(campaignRecurrences)
    .set(updateData)
    .where(
      and(
        eq(campaignRecurrences.id, recurrenceId),
        eq(campaignRecurrences.workspaceId, workspaceId),
        isNull(campaignRecurrences.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Get recurrences due for execution
 */
export async function getRecurrencesDueForExecution(
  db: Database,
  beforeTime: Date = new Date()
): Promise<CampaignRecurrence[]> {
  return db
    .select()
    .from(campaignRecurrences)
    .where(
      and(
        eq(campaignRecurrences.status, 'active'),
        lte(campaignRecurrences.nextExecutionAt, beforeTime),
        isNull(campaignRecurrences.deletedAt)
      )
    );
}

/**
 * Preview next N execution times
 */
export async function previewNextExecutions(
  db: Database,
  recurrenceId: string,
  workspaceId: string,
  count: number = 5
): Promise<Date[]> {
  const recurrence = await getRecurrenceById(db, recurrenceId, workspaceId);

  if (!recurrence) {
    throw new Error('Recurrence not found');
  }

  const config = recurrence.config as RecurrenceConfig;

  return calculateNextExecutions(
    recurrence.pattern,
    config,
    recurrence.timezone,
    count
  );
}
