/**
 * Check API Usage Worker
 * Background worker that polls external API usage/credits every 6 hours
 * Stores snapshots, evaluates alert thresholds, sends notifications
 */

import { jobQueue, type CheckApiUsageJob } from '../lib/queue';
import { db, apiUsageSnapshots } from '@agios/db';
import { lt } from 'drizzle-orm';
import { collectAllUsageSnapshots } from '../services/api-usage/provider-adapters';
import { evaluateAllSnapshots } from '../services/api-usage/alert-evaluator';
import { sendApiUsageNotifications } from '../services/api-usage/notifications';

export async function registerCheckApiUsageWorker() {
  await jobQueue.work<CheckApiUsageJob>(
    'check-api-usage',
    {
      teamSize: 1,
      teamConcurrency: 1,
    },
    async (_job) => {
      console.log('[Check API Usage Worker] Starting usage check...');

      // 1. Collect snapshots from all 10 providers
      const snapshots = await collectAllUsageSnapshots();
      console.log(`[Check API Usage Worker] Collected ${snapshots.length} provider snapshots`);

      // 2. Insert snapshot rows
      const insertedIds: string[] = [];
      for (const snapshot of snapshots) {
        const [row] = await db
          .insert(apiUsageSnapshots)
          .values({
            provider: snapshot.provider,
            trackingMethod: snapshot.trackingMethod,
            balanceRemaining: snapshot.balanceRemaining?.toString(),
            balanceUnit: snapshot.balanceUnit,
            quotaUsed: snapshot.quotaUsed?.toString(),
            quotaLimit: snapshot.quotaLimit?.toString(),
            quotaUnit: snapshot.quotaUnit,
            quotaResetAt: snapshot.quotaResetAt,
            callCountPeriod: snapshot.callCountPeriod,
            estimatedCostPeriod: snapshot.estimatedCostPeriod?.toString(),
            usagePercent: snapshot.usagePercent?.toString(),
            isReachable: snapshot.isReachable,
            lastError: snapshot.lastError,
            latencyMs: snapshot.latencyMs,
            rawResponse: snapshot.rawResponse,
          })
          .returning();
        insertedIds.push(row.id);
      }
      console.log(`[Check API Usage Worker] Stored ${insertedIds.length} snapshots`);

      // 3. Evaluate thresholds and create/resolve alerts
      const alertActions = await evaluateAllSnapshots(snapshots, insertedIds);
      const newAlerts = alertActions.filter(a => a.isNew);
      console.log(`[Check API Usage Worker] ${newAlerts.length} new alerts, ${alertActions.length - newAlerts.length} existing`);

      // 4. Send notifications for new alerts
      if (newAlerts.length > 0) {
        await sendApiUsageNotifications(newAlerts.map(a => a.alert));
        console.log(`[Check API Usage Worker] Notifications sent for ${newAlerts.length} alerts`);
      }

      // 5. Prune old snapshots (older than 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const pruned = await db
        .delete(apiUsageSnapshots)
        .where(lt(apiUsageSnapshots.createdAt, ninetyDaysAgo))
        .returning();
      if (pruned.length > 0) {
        console.log(`[Check API Usage Worker] Pruned ${pruned.length} old snapshots`);
      }

      console.log('[Check API Usage Worker] Usage check complete');
    }
  );

  console.log('Check API usage worker registered');
}

/**
 * Schedule usage checks every 6 hours
 */
export async function startApiUsageCheckScheduler() {
  console.log('Starting API usage check scheduler (every 6 hours)...');

  await jobQueue.schedule(
    'check-api-usage',
    '0 */6 * * *', // Every 6 hours
    {} // No specific data needed
  );

  console.log('API usage check scheduler started');
}
