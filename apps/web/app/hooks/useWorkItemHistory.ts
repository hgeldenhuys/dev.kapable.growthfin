/**
 * useWorkItemHistory Hook (UI-001)
 * Derives timeline events from work item state
 *
 * Note: If audit_events table exists in the future, this hook can be updated
 * to fetch real audit trail data. For now, it derives events from the work item.
 */

import { useMemo } from 'react';
import type { WorkItem } from '@agios/db';

export interface WorkItemHistoryEvent {
  id: string;
  type: 'created' | 'claimed' | 'unclaimed' | 'completed' | 'expired' | 'cancelled' | 'updated';
  timestamp: Date;
  actor?: string;
  actorType?: 'user' | 'ai' | 'system';
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Derive timeline events from work item state
 * This creates a basic timeline from the work item's lifecycle fields
 */
export function useWorkItemHistory(workItem: WorkItem | null | undefined): WorkItemHistoryEvent[] {
  return useMemo(() => {
    if (!workItem) return [];

    const events: WorkItemHistoryEvent[] = [];

    // Created event (always present)
    events.push({
      id: `${workItem.id}-created`,
      type: 'created',
      timestamp: new Date(workItem.createdAt),
      actor: workItem.createdBy || undefined,
      actorType: 'user',
      description: 'Work item created',
      metadata: {
        title: workItem.title,
        entityType: workItem.entityType,
        workItemType: workItem.workItemType,
      },
    });

    // Claimed event
    if (workItem.claimedAt && workItem.claimedBy) {
      events.push({
        id: `${workItem.id}-claimed`,
        type: 'claimed',
        timestamp: new Date(workItem.claimedAt),
        actor: workItem.claimedBy,
        actorType: 'user',
        description: 'Work item claimed',
      });
    }

    // Completed event
    if (workItem.completedAt) {
      events.push({
        id: `${workItem.id}-completed`,
        type: 'completed',
        timestamp: new Date(workItem.completedAt),
        actorType: workItem.completedBy || 'user',
        description: `Work item completed by ${workItem.completedBy || 'user'}`,
        metadata: workItem.result ? { result: workItem.result } : undefined,
      });
    }

    // Expired event (derived from status)
    if (workItem.status === 'expired') {
      events.push({
        id: `${workItem.id}-expired`,
        type: 'expired',
        timestamp: workItem.expiresAt ? new Date(workItem.expiresAt) : new Date(workItem.updatedAt),
        actorType: 'system',
        description: 'Work item expired',
      });
    }

    // Cancelled event (derived from status)
    if (workItem.status === 'cancelled') {
      events.push({
        id: `${workItem.id}-cancelled`,
        type: 'cancelled',
        timestamp: new Date(workItem.updatedAt),
        actorType: 'system',
        description: 'Work item cancelled',
      });
    }

    // Sort by timestamp (oldest first)
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }, [workItem]);
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
