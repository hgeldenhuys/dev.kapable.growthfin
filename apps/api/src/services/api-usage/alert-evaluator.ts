/**
 * Alert Evaluator for API Usage Monitoring
 * Evaluates usage snapshots against thresholds, creates alerts, avoids duplicates
 */

import { db, apiUsageAlerts } from '@agios/db';
import type { ApiAlertLevel } from '@agios/db';
import type { UsageSnapshot } from './provider-adapters';
import { eq, and, isNull, desc } from 'drizzle-orm';

// Thresholds for alert levels (percentage used)
const THRESHOLDS: { level: ApiAlertLevel; minPercent: number }[] = [
  { level: 'depleted', minPercent: 99 },
  { level: 'critical', minPercent: 95 },
  { level: 'warning', minPercent: 80 },
  { level: 'info', minPercent: 50 },
];

// Alert level priority (higher = more severe)
const LEVEL_PRIORITY: Record<ApiAlertLevel, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  depleted: 3,
};

export interface AlertAction {
  alert: typeof apiUsageAlerts.$inferSelect;
  isNew: boolean;  // true if newly created, false if already existed
}

/**
 * Evaluate a single snapshot and create/resolve alerts as needed
 */
export async function evaluateSnapshot(
  snapshot: UsageSnapshot,
  snapshotId: string
): Promise<AlertAction | null> {
  // Determine alert level based on usagePercent or unreachability
  let alertLevel: ApiAlertLevel | null = null;

  if (!snapshot.isReachable) {
    alertLevel = 'critical';
  } else if (snapshot.usagePercent != null) {
    for (const threshold of THRESHOLDS) {
      if (snapshot.usagePercent >= threshold.minPercent) {
        alertLevel = threshold.level;
        break;
      }
    }
  }

  // Get current active (unresolved) alert for this provider
  const [existingAlert] = await db
    .select()
    .from(apiUsageAlerts)
    .where(
      and(
        eq(apiUsageAlerts.provider, snapshot.provider),
        isNull(apiUsageAlerts.resolvedAt)
      )
    )
    .orderBy(desc(apiUsageAlerts.createdAt))
    .limit(1);

  // No alert needed and none exists - nothing to do
  if (!alertLevel && !existingAlert) {
    return null;
  }

  // Usage recovered - resolve existing alert
  if (!alertLevel && existingAlert) {
    const [resolved] = await db
      .update(apiUsageAlerts)
      .set({ resolvedAt: new Date() })
      .where(eq(apiUsageAlerts.id, existingAlert.id))
      .returning();
    return { alert: resolved, isNew: false };
  }

  // Alert needed
  if (alertLevel) {
    // If existing alert is same or higher severity, skip (deduplication)
    const existingPriority = existingAlert ? (LEVEL_PRIORITY[existingAlert.alertLevel as ApiAlertLevel] ?? -1) : -1;
    const currentPriority = LEVEL_PRIORITY[alertLevel] ?? 0;
    if (existingAlert && existingPriority >= currentPriority) {
      return { alert: existingAlert, isNew: false };
    }

    // If existing alert is lower severity, resolve it before creating new one
    if (existingAlert) {
      await db
        .update(apiUsageAlerts)
        .set({ resolvedAt: new Date() })
        .where(eq(apiUsageAlerts.id, existingAlert.id));
    }

    // Create new alert
    const message = buildAlertMessage(snapshot, alertLevel);
    const [newAlert] = await db
      .insert(apiUsageAlerts)
      .values({
        provider: snapshot.provider,
        alertLevel,
        message,
        snapshotId,
      })
      .returning();

    return { alert: newAlert, isNew: true };
  }

  return null;
}

function buildAlertMessage(snapshot: UsageSnapshot, level: ApiAlertLevel): string {
  const providerName = snapshot.provider.charAt(0).toUpperCase() + snapshot.provider.slice(1).replace('_', ' ');

  if (!snapshot.isReachable) {
    return `${providerName} is unreachable: ${snapshot.lastError || 'Unknown error'}`;
  }

  const pct = snapshot.usagePercent?.toFixed(1) ?? 'unknown';

  if (snapshot.balanceRemaining != null) {
    return `${providerName} balance ${level}: ${snapshot.balanceRemaining} ${snapshot.balanceUnit || ''} remaining (${pct}% used)`;
  }

  if (snapshot.quotaUsed != null && snapshot.quotaLimit != null) {
    return `${providerName} quota ${level}: ${snapshot.quotaUsed}/${snapshot.quotaLimit} ${snapshot.quotaUnit || ''} (${pct}% used)`;
  }

  if (snapshot.estimatedCostPeriod != null) {
    return `${providerName} estimated spend ${level}: $${snapshot.estimatedCostPeriod.toFixed(2)} this period (${pct}% of budget)`;
  }

  return `${providerName} usage ${level}: ${pct}% used`;
}

/**
 * Evaluate all snapshots and return actions taken
 */
export async function evaluateAllSnapshots(
  snapshots: UsageSnapshot[],
  snapshotIds: string[]
): Promise<AlertAction[]> {
  const actions: AlertAction[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const snapshotId = snapshotIds[i];
    if (!snapshot || !snapshotId) continue;
    const action = await evaluateSnapshot(snapshot, snapshotId);
    if (action) actions.push(action);
  }
  return actions;
}
