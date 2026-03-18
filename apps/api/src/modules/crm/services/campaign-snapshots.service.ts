/**
 * Campaign Snapshots Service
 * Business logic for creating immutable list membership snapshots
 */

import type { Database } from '@agios/db';
import { and, eq, sql, inArray } from 'drizzle-orm';
import {
  crmCampaignSnapshots,
  crmCampaigns,
  type NewCrmCampaignSnapshot,
  type RecipientSelectionConfig,
  type CampaignSnapshotData,
  type CampaignSnapshotMetadata,
} from '@agios/db/schema';
import { getListById } from './lists.service';
import { getListMembers, type ListMemberWithEntity } from './list-members.service';

/**
 * Snapshot creation result
 */
export interface SnapshotCreationResult {
  snapshotId: string;
  totalListSize: number;
  selectedCount: number;
  excludedCount: number;
  createdAt: Date;
}

/**
 * Apply 'first' selection strategy
 * Takes first N members (after optional sorting)
 */
function applyFirstStrategy(
  members: ListMemberWithEntity[],
  config: RecipientSelectionConfig
): ListMemberWithEntity[] {
  let result = [...members];

  // Sort if specified
  if (config.sortCriteria) {
    result = sortMembers(result, config.sortCriteria.field, config.sortCriteria.direction);
  }

  // Limit if specified
  if (config.maxRecipients && config.maxRecipients > 0) {
    result = result.slice(0, config.maxRecipients);
  }

  return result;
}

/**
 * Apply 'random' selection strategy
 * Randomly shuffle and take first N members
 */
function applyRandomStrategy(
  members: ListMemberWithEntity[],
  config: RecipientSelectionConfig
): ListMemberWithEntity[] {
  // Fisher-Yates shuffle algorithm
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Limit if specified
  if (config.maxRecipients && config.maxRecipients > 0) {
    return shuffled.slice(0, config.maxRecipients);
  }

  return shuffled;
}

/**
 * Apply 'prioritized' selection strategy
 * Requires sortCriteria - selects highest priority members
 */
function applyPrioritizedStrategy(
  members: ListMemberWithEntity[],
  config: RecipientSelectionConfig
): ListMemberWithEntity[] {
  if (!config.sortCriteria) {
    throw new Error('Prioritized selection strategy requires sortCriteria');
  }

  // Sort by priority field
  const sorted = sortMembers(
    [...members],
    config.sortCriteria.field,
    config.sortCriteria.direction
  );

  // Take top N
  if (config.maxRecipients && config.maxRecipients > 0) {
    return sorted.slice(0, config.maxRecipients);
  }

  return sorted;
}

/**
 * Sort members by a field in entity data
 */
function sortMembers(
  members: ListMemberWithEntity[],
  field: string,
  direction: 'ASC' | 'DESC'
): ListMemberWithEntity[] {
  return members.sort((a, b) => {
    const aValue = getNestedValue(a.entity, field);
    const bValue = getNestedValue(b.entity, field);

    // Handle null/undefined
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === 'ASC' ? 1 : -1;
    if (bValue == null) return direction === 'ASC' ? -1 : 1;

    // Compare values
    if (aValue < bValue) return direction === 'ASC' ? -1 : 1;
    if (aValue > bValue) return direction === 'ASC' ? 1 : -1;
    return 0;
  });
}

/**
 * Get nested value from object using dot notation (e.g., "customFields.lead_score")
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Apply selection strategy to members (EXPORTED for reuse in audience calculation)
 */
export function applySelectionStrategy(
  members: ListMemberWithEntity[],
  config: RecipientSelectionConfig
): ListMemberWithEntity[] {
  switch (config.selectionStrategy) {
    case 'first':
      return applyFirstStrategy(members, config);
    case 'random':
      return applyRandomStrategy(members, config);
    case 'prioritized':
      return applyPrioritizedStrategy(members, config);
    default:
      throw new Error(`Unknown selection strategy: ${config.selectionStrategy}`);
  }
}

/**
 * Get member IDs from previous campaign snapshots (EXPORTED for reuse in audience calculation)
 */
export async function getPreviousRecipientIds(
  db: Database,
  campaignId: string,
  workspaceId: string
): Promise<Set<string>> {
  const previousSnapshots = await db
    .select({
      snapshotData: crmCampaignSnapshots.snapshotData,
    })
    .from(crmCampaignSnapshots)
    .where(
      and(
        eq(crmCampaignSnapshots.campaignId, campaignId),
        eq(crmCampaignSnapshots.workspaceId, workspaceId)
      )
    );

  const previousMemberIds = new Set<string>();
  for (const snapshot of previousSnapshots) {
    const data = snapshot.snapshotData as CampaignSnapshotData;
    for (const memberId of data.memberIds || []) {
      previousMemberIds.add(memberId);
    }
  }

  return previousMemberIds;
}

/**
 * Exclude members who were contacted in previous campaign executions (EXPORTED for reuse)
 */
export function excludePreviousRecipients(
  members: ListMemberWithEntity[],
  previousRecipientIds: Set<string>
): { filtered: ListMemberWithEntity[]; excludedCount: number } {
  const filtered = members.filter((member) => !previousRecipientIds.has(member.entityId));
  const excludedCount = members.length - filtered.length;

  return { filtered, excludedCount };
}

/**
 * Create an immutable snapshot of list membership for a campaign
 */
export async function createSnapshot(
  db: Database,
  campaignId: string,
  listId: string,
  workspaceId: string,
  recipientSelection: RecipientSelectionConfig
): Promise<SnapshotCreationResult> {
  // 1. Validate workspace ownership of list
  const list = await getListById(db, listId, workspaceId);
  if (!list) {
    throw new Error('List not found or does not belong to workspace');
  }

  // 2. Validate campaign exists and belongs to workspace
  const campaign = await db
    .select()
    .from(crmCampaigns)
    .where(and(eq(crmCampaigns.id, campaignId), eq(crmCampaigns.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign[0]) {
    throw new Error('Campaign not found or does not belong to workspace');
  }

  // 3. Get all list members
  const { members: allMembers } = await getListMembers(db, listId, workspaceId);
  const totalListSize = allMembers.length;

  // 4. Exclude previous recipients if configured
  let membersToSelect = allMembers;
  let excludedDueToPreviousContact = 0;

  if (recipientSelection.excludePreviousRecipients) {
    const previousRecipientIds = await getPreviousRecipientIds(db, campaignId, workspaceId);
    const { filtered, excludedCount } = excludePreviousRecipients(allMembers, previousRecipientIds);
    membersToSelect = filtered;
    excludedDueToPreviousContact = excludedCount;
  }

  // 5. Apply selection strategy
  const selectedMembers = applySelectionStrategy(membersToSelect, recipientSelection);
  const selectedCount = selectedMembers.length;

  // 6. Build snapshot data
  const snapshotData: CampaignSnapshotData = {
    memberIds: selectedMembers.map((m) => m.entityId),
    totalListSize,
    selectedCount,
  };

  const snapshotMetadata: CampaignSnapshotMetadata = {
    selectionStrategy: recipientSelection.selectionStrategy,
    sortCriteria: recipientSelection.sortCriteria,
    excludedCount: totalListSize - membersToSelect.length,
  };

  if (recipientSelection.excludePreviousRecipients) {
    snapshotMetadata['excludedDueToPreviousContact'] = excludedDueToPreviousContact;
  }

  // 7. Insert snapshot (immutable - INSERT only)
  const [snapshot] = await db
    .insert(crmCampaignSnapshots)
    .values({
      campaignId,
      listId,
      workspaceId,
      snapshotData,
      snapshotMetadata,
    })
    .returning();

  return {
    snapshotId: snapshot.id,
    totalListSize,
    selectedCount,
    excludedCount: totalListSize - membersToSelect.length,
    createdAt: snapshot.createdAt,
  };
}

/**
 * Get a snapshot by ID
 */
export async function getSnapshot(
  db: Database,
  snapshotId: string,
  workspaceId: string
) {
  const snapshots = await db
    .select()
    .from(crmCampaignSnapshots)
    .where(
      and(
        eq(crmCampaignSnapshots.id, snapshotId),
        eq(crmCampaignSnapshots.workspaceId, workspaceId)
      )
    )
    .limit(1);

  return snapshots[0] || null;
}

/**
 * List all snapshots for a campaign
 */
export async function listSnapshots(
  db: Database,
  campaignId: string,
  workspaceId: string
) {
  return db
    .select()
    .from(crmCampaignSnapshots)
    .where(
      and(
        eq(crmCampaignSnapshots.campaignId, campaignId),
        eq(crmCampaignSnapshots.workspaceId, workspaceId)
      )
    )
    .orderBy(crmCampaignSnapshots.createdAt);
}

export const campaignSnapshotsService = {
  createSnapshot,
  getSnapshot,
  listSnapshots,
};
