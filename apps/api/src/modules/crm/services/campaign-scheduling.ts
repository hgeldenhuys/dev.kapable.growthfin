/**
 * Campaign Scheduling Service
 * Business logic for one-time campaign scheduling
 */

import type { Database } from '@agios/db';
import {
  campaignSchedules,
  type NewCampaignSchedule,
  type CampaignSchedule,
} from '@agios/db/schema';
import { crmCampaigns } from '@agios/db/schema';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { validateTimezone, toUTC } from '../utils/timezone';

export interface ScheduleOneTimeCampaignParams {
  campaignId: string;
  workspaceId: string;
  scheduledAt: Date; // UTC time
  timezone: string; // IANA timezone
  userId: string;
}

/**
 * Schedule a one-time campaign execution
 */
export async function scheduleOneTimeCampaign(
  db: Database,
  params: ScheduleOneTimeCampaignParams
): Promise<CampaignSchedule> {
  const { campaignId, workspaceId, scheduledAt, timezone, userId } = params;

  // Validate timezone
  if (!validateTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Validate scheduled time is in the future
  if (scheduledAt <= new Date()) {
    throw new Error('Scheduled time must be in the future');
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

  // Check for existing active schedule for this campaign
  const existingSchedule = await db
    .select()
    .from(campaignSchedules)
    .where(
      and(
        eq(campaignSchedules.campaignId, campaignId),
        eq(campaignSchedules.status, 'active'),
        isNull(campaignSchedules.deletedAt)
      )
    );

  if (existingSchedule.length > 0) {
    throw new Error('Campaign already has an active schedule. Cancel or complete it first.');
  }

  // Create schedule
  const scheduleData: NewCampaignSchedule = {
    workspaceId,
    campaignId,
    scheduleType: 'once',
    scheduledTime: scheduledAt,
    timezone,
    status: 'active',
    createdBy: userId,
    updatedBy: userId,
  };

  const results = await db.insert(campaignSchedules).values(scheduleData).returning();

  return results[0];
}

/**
 * Get all campaign schedules for a workspace
 */
export async function getCampaignSchedules(
  db: Database,
  workspaceId: string,
  filters?: {
    status?: 'active' | 'paused' | 'completed' | 'cancelled';
    scheduledAfter?: Date;
    scheduledBefore?: Date;
  }
): Promise<CampaignSchedule[]> {
  const conditions = [
    eq(campaignSchedules.workspaceId, workspaceId),
    isNull(campaignSchedules.deletedAt),
  ];

  if (filters?.status) {
    conditions.push(eq(campaignSchedules.status, filters.status));
  }

  if (filters?.scheduledAfter) {
    conditions.push(gte(campaignSchedules.scheduledTime, filters.scheduledAfter));
  }

  if (filters?.scheduledBefore) {
    conditions.push(lte(campaignSchedules.scheduledTime, filters.scheduledBefore));
  }

  return db
    .select()
    .from(campaignSchedules)
    .where(and(...conditions));
}

/**
 * Get schedule by ID
 */
export async function getScheduleById(
  db: Database,
  scheduleId: string,
  workspaceId: string
): Promise<CampaignSchedule | null> {
  const results = await db
    .select()
    .from(campaignSchedules)
    .where(
      and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.workspaceId, workspaceId),
        isNull(campaignSchedules.deletedAt)
      )
    );

  return results[0] || null;
}

/**
 * Reschedule a campaign to a new time
 */
export async function rescheduleCampaign(
  db: Database,
  scheduleId: string,
  workspaceId: string,
  newTime: Date,
  userId: string
): Promise<CampaignSchedule> {
  // Validate new time is in the future
  if (newTime <= new Date()) {
    throw new Error('New scheduled time must be in the future');
  }

  // Get existing schedule
  const schedule = await getScheduleById(db, scheduleId, workspaceId);

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Can only reschedule active or paused schedules
  if (schedule.status !== 'active' && schedule.status !== 'paused') {
    throw new Error('Can only reschedule active or paused schedules');
  }

  // Update schedule
  const results = await db
    .update(campaignSchedules)
    .set({
      scheduledTime: newTime,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.workspaceId, workspaceId),
        isNull(campaignSchedules.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Cancel a scheduled campaign
 */
export async function cancelSchedule(
  db: Database,
  scheduleId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignSchedule> {
  // Get existing schedule
  const schedule = await getScheduleById(db, scheduleId, workspaceId);

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Can only cancel active or paused schedules
  if (schedule.status !== 'active' && schedule.status !== 'paused') {
    throw new Error('Can only cancel active or paused schedules');
  }

  // Update status to cancelled
  const results = await db
    .update(campaignSchedules)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.workspaceId, workspaceId),
        isNull(campaignSchedules.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Mark schedule as executed
 */
export async function markScheduleExecuted(
  db: Database,
  scheduleId: string,
  workspaceId: string
): Promise<CampaignSchedule> {
  const results = await db
    .update(campaignSchedules)
    .set({
      status: 'completed',
      executedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaignSchedules.id, scheduleId),
        eq(campaignSchedules.workspaceId, workspaceId),
        isNull(campaignSchedules.deletedAt)
      )
    )
    .returning();

  if (!results.length) {
    throw new Error('Schedule not found');
  }

  return results[0];
}

/**
 * Get schedules due for execution
 */
export async function getSchedulesDueForExecution(
  db: Database,
  beforeTime: Date = new Date()
): Promise<CampaignSchedule[]> {
  return db
    .select()
    .from(campaignSchedules)
    .where(
      and(
        eq(campaignSchedules.status, 'active'),
        eq(campaignSchedules.scheduleType, 'once'),
        lte(campaignSchedules.scheduledTime, beforeTime),
        isNull(campaignSchedules.executedAt),
        isNull(campaignSchedules.deletedAt)
      )
    );
}
