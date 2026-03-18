/**
 * Campaign Triggers Service
 * Business logic for event-based campaign triggers
 */

import type { Database } from '@agios/db';
import {
  campaignTriggers,
  campaignTriggerExecutions,
  type NewCampaignTrigger,
  type NewCampaignTriggerExecution,
  type CampaignTrigger,
  type CampaignTriggerExecution,
  type TriggerEvent,
} from '@agios/db/schema';
import { crmCampaigns } from '@agios/db/schema';
import { crmLeads } from '@agios/db/schema';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import {
  evaluateConditionGroup,
  validateConditionGroup,
  type TriggerConditionGroup,
} from '../utils/trigger-evaluator';

export interface CreateTriggerParams {
  campaignId: string;
  workspaceId: string;
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
  conditions: TriggerConditionGroup;
  maxTriggersPerLeadPerDay?: number;
  userId: string;
}

/**
 * Create a campaign trigger
 */
export async function createTrigger(
  db: Database,
  params: CreateTriggerParams
): Promise<CampaignTrigger> {
  const {
    campaignId,
    workspaceId,
    name,
    description,
    triggerEvent,
    conditions,
    maxTriggersPerLeadPerDay = 1,
    userId,
  } = params;

  // Validate conditions structure
  validateConditionGroup(conditions);

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

  // Create trigger
  const triggerData: NewCampaignTrigger = {
    workspaceId,
    campaignId,
    name,
    description,
    triggerEvent,
    conditions: conditions as any, // JSONB
    maxTriggersPerLeadPerDay,
    status: 'active',
    createdBy: userId,
    updatedBy: userId,
  };

  const results = await db.insert(campaignTriggers).values(triggerData).returning();

  return results[0];
}

/**
 * Get all campaign triggers for a workspace
 */
export async function getCampaignTriggers(
  db: Database,
  workspaceId: string,
  filters?: {
    status?: 'active' | 'paused' | 'deleted';
    campaignId?: string;
    triggerEvent?: TriggerEvent;
  }
): Promise<CampaignTrigger[]> {
  const conditions = [
    eq(campaignTriggers.workspaceId, workspaceId),
    isNull(campaignTriggers.deletedAt),
  ];

  if (filters?.status) {
    conditions.push(eq(campaignTriggers.status, filters.status));
  }

  if (filters?.campaignId) {
    conditions.push(eq(campaignTriggers.campaignId, filters.campaignId));
  }

  if (filters?.triggerEvent) {
    conditions.push(eq(campaignTriggers.triggerEvent, filters.triggerEvent));
  }

  return db
    .select()
    .from(campaignTriggers)
    .where(and(...conditions));
}

/**
 * Get trigger by ID
 */
export async function getTriggerById(
  db: Database,
  triggerId: string,
  workspaceId: string
): Promise<CampaignTrigger | null> {
  const results = await db
    .select()
    .from(campaignTriggers)
    .where(
      and(
        eq(campaignTriggers.id, triggerId),
        eq(campaignTriggers.workspaceId, workspaceId),
        isNull(campaignTriggers.deletedAt)
      )
    );

  return results[0] || null;
}

/**
 * Update a trigger
 */
export async function updateTrigger(
  db: Database,
  triggerId: string,
  workspaceId: string,
  updates: {
    name?: string;
    description?: string;
    conditions?: TriggerConditionGroup;
    maxTriggersPerLeadPerDay?: number;
  },
  userId: string
): Promise<CampaignTrigger> {
  const trigger = await getTriggerById(db, triggerId, workspaceId);

  if (!trigger) {
    throw new Error('Trigger not found');
  }

  // Validate conditions if provided
  if (updates.conditions) {
    validateConditionGroup(updates.conditions);
  }

  const updateData: any = {
    ...updates,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  if (updates.conditions) {
    updateData.conditions = updates.conditions as any; // JSONB
  }

  const results = await db
    .update(campaignTriggers)
    .set(updateData)
    .where(
      and(
        eq(campaignTriggers.id, triggerId),
        eq(campaignTriggers.workspaceId, workspaceId),
        isNull(campaignTriggers.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Pause a trigger
 */
export async function pauseTrigger(
  db: Database,
  triggerId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignTrigger> {
  const trigger = await getTriggerById(db, triggerId, workspaceId);

  if (!trigger) {
    throw new Error('Trigger not found');
  }

  if (trigger.status !== 'active') {
    throw new Error('Can only pause active triggers');
  }

  const results = await db
    .update(campaignTriggers)
    .set({
      status: 'paused',
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignTriggers.id, triggerId),
        eq(campaignTriggers.workspaceId, workspaceId),
        isNull(campaignTriggers.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Activate a trigger
 */
export async function activateTrigger(
  db: Database,
  triggerId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignTrigger> {
  const trigger = await getTriggerById(db, triggerId, workspaceId);

  if (!trigger) {
    throw new Error('Trigger not found');
  }

  if (trigger.status !== 'paused') {
    throw new Error('Can only activate paused triggers');
  }

  const results = await db
    .update(campaignTriggers)
    .set({
      status: 'active',
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignTriggers.id, triggerId),
        eq(campaignTriggers.workspaceId, workspaceId),
        isNull(campaignTriggers.deletedAt)
      )
    )
    .returning();

  return results[0];
}

/**
 * Delete a trigger (soft delete)
 */
export async function deleteTrigger(
  db: Database,
  triggerId: string,
  workspaceId: string,
  userId: string
): Promise<CampaignTrigger> {
  const trigger = await getTriggerById(db, triggerId, workspaceId);

  if (!trigger) {
    throw new Error('Trigger not found');
  }

  const results = await db
    .update(campaignTriggers)
    .set({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(campaignTriggers.id, triggerId),
        eq(campaignTriggers.workspaceId, workspaceId)
      )
    )
    .returning();

  return results[0];
}

/**
 * Evaluate if a trigger should fire for a specific lead
 */
export async function evaluateTrigger(
  db: Database,
  trigger: CampaignTrigger,
  leadId: string
): Promise<boolean> {
  // Get lead data
  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.id, leadId),
        eq(crmLeads.workspaceId, trigger.workspaceId),
        isNull(crmLeads.deletedAt)
      )
    );

  if (!leads.length) {
    return false;
  }

  const lead = leads[0];

  // Check debouncing - has this trigger fired for this lead today?
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayExecutions = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignTriggerExecutions)
    .where(
      and(
        eq(campaignTriggerExecutions.triggerId, trigger.id),
        eq(campaignTriggerExecutions.leadId, leadId),
        gte(campaignTriggerExecutions.triggeredAt, todayStart)
      )
    );

  const executionCount = Number(todayExecutions[0]?.count || 0);

  if (executionCount >= trigger.maxTriggersPerLeadPerDay) {
    return false; // Already triggered max times today
  }

  // Evaluate conditions
  const conditions = trigger.conditions as TriggerConditionGroup;
  const leadData = {
    ...lead,
    // Add computed fields for easier condition evaluation
    propensity_score: lead.propensityScore,
    lead_score: lead.leadScore,
    first_name: lead.firstName,
    last_name: lead.lastName,
    company_name: lead.companyName,
  };

  return evaluateConditionGroup(conditions, leadData);
}

/**
 * Record a trigger execution
 */
export async function recordTriggerExecution(
  db: Database,
  triggerId: string,
  leadId: string,
  workspaceId: string,
  campaignExecutionId?: string
): Promise<CampaignTriggerExecution> {
  const executionData: NewCampaignTriggerExecution = {
    workspaceId,
    triggerId,
    leadId,
    campaignExecutionId,
  };

  const results = await db
    .insert(campaignTriggerExecutions)
    .values(executionData)
    .returning();

  // Update trigger statistics
  await db
    .update(campaignTriggers)
    .set({
      triggerCount: sql`${campaignTriggers.triggerCount} + 1`,
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaignTriggers.id, triggerId));

  return results[0];
}

/**
 * Preview how many leads would match a trigger
 */
export async function previewTriggerMatches(
  db: Database,
  triggerId: string,
  workspaceId: string
): Promise<number> {
  const trigger = await getTriggerById(db, triggerId, workspaceId);

  if (!trigger) {
    throw new Error('Trigger not found');
  }

  // Get all active leads in workspace
  const leads = await db
    .select()
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.workspaceId, workspaceId),
        isNull(crmLeads.deletedAt)
      )
    );

  // Evaluate conditions for each lead
  const conditions = trigger.conditions as TriggerConditionGroup;
  let matchCount = 0;

  for (const lead of leads) {
    const leadData = {
      ...lead,
      propensity_score: lead.propensityScore,
      lead_score: lead.leadScore,
      first_name: lead.firstName,
      last_name: lead.lastName,
      company_name: lead.companyName,
    };

    if (evaluateConditionGroup(conditions, leadData)) {
      matchCount++;
    }
  }

  return matchCount;
}

/**
 * Get active triggers for a specific event type
 */
export async function getTriggersForEvent(
  db: Database,
  workspaceId: string,
  triggerEvent: TriggerEvent
): Promise<CampaignTrigger[]> {
  return db
    .select()
    .from(campaignTriggers)
    .where(
      and(
        eq(campaignTriggers.workspaceId, workspaceId),
        eq(campaignTriggers.triggerEvent, triggerEvent),
        eq(campaignTriggers.status, 'active'),
        isNull(campaignTriggers.deletedAt)
      )
    );
}
