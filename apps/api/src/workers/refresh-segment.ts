/**
 * Segment Refresh Worker
 * Refreshes segment memberships based on criteria and schedules auto-refresh
 */

import { jobQueue, type RefreshSegmentJob } from '../lib/queue';
import { db } from '@agios/db';
import { leadSegments, leadSegmentMemberships, crmLeads } from '@agios/db';
import { eq, and, sql, inArray, isNull } from 'drizzle-orm';
import { evaluateSegmentCriteria, type Criteria } from '../modules/crm/services/segment-query-evaluator';

/**
 * Register segment workers
 */
export async function registerSegmentWorkers() {
  // Worker: refresh-segment
  await jobQueue.work<RefreshSegmentJob>(
    'refresh-segment',
    {
      teamSize: 3, // Process up to 3 segments in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { segmentId, workspaceId, forceRefresh } = job.data;

      console.log(`[Segment Refresh] Starting refresh for segment ${segmentId}`);

      try {
        // Get segment definition
        const segment = await db.query.leadSegments.findFirst({
          where: and(
            eq(leadSegments.id, segmentId),
            eq(leadSegments.workspaceId, workspaceId),
            isNull(leadSegments.deletedAt)
          ),
        });

        if (!segment) {
          console.warn(`[Segment Refresh] Segment ${segmentId} not found or deleted`);
          return;
        }

        // Build SQL WHERE clause from criteria
        const whereClause = evaluateSegmentCriteria(segment.criteria as Criteria);

        // Find matching leads
        const matchingLeads = await db
          .select({ id: crmLeads.id })
          .from(crmLeads)
          .where(
            and(
              eq(crmLeads.workspaceId, workspaceId),
              isNull(crmLeads.deletedAt),
              sql`${whereClause}`
            )
          );

        const matchingLeadIds = matchingLeads.map((l) => l.id);

        console.log(`[Segment Refresh] Found ${matchingLeadIds.length} matching leads`);

        // Get current memberships
        const currentMemberships = await db
          .select()
          .from(leadSegmentMemberships)
          .where(
            and(
              eq(leadSegmentMemberships.segmentId, segmentId),
              isNull(leadSegmentMemberships.removedAt)
            )
          );

        const currentLeadIds = currentMemberships.map((m) => m.leadId);

        // Find adds and removes
        const toAdd = matchingLeadIds.filter((id) => !currentLeadIds.includes(id));
        const toRemove = currentLeadIds.filter((id) => !matchingLeadIds.includes(id));

        console.log(`[Segment Refresh] To add: ${toAdd.length}, To remove: ${toRemove.length}`);

        // Add new memberships
        if (toAdd.length > 0) {
          // Batch insert in chunks of 500
          const chunkSize = 500;
          for (let i = 0; i < toAdd.length; i += chunkSize) {
            const chunk = toAdd.slice(i, i + chunkSize);
            await db.insert(leadSegmentMemberships).values(
              chunk.map((leadId) => ({
                segmentId,
                leadId,
                workspaceId,
                addedAt: new Date(),
              }))
            );
          }
        }

        // Remove old memberships (soft delete)
        if (toRemove.length > 0) {
          // Batch update in chunks of 500
          const chunkSize = 500;
          for (let i = 0; i < toRemove.length; i += chunkSize) {
            const chunk = toRemove.slice(i, i + chunkSize);
            await db
              .update(leadSegmentMemberships)
              .set({ removedAt: new Date() })
              .where(
                and(
                  eq(leadSegmentMemberships.segmentId, segmentId),
                  inArray(leadSegmentMemberships.leadId, chunk),
                  isNull(leadSegmentMemberships.removedAt)
                )
              );
          }
        }

        // Update segment member_count and last_refreshed_at
        const previousCount = segment.memberCount;
        await db
          .update(leadSegments)
          .set({
            memberCount: matchingLeadIds.length,
            lastMemberCount: previousCount,
            lastRefreshedAt: new Date(),
            nextRefreshAt: segment.autoRefresh
              ? new Date(Date.now() + (segment.refreshIntervalMinutes || 15) * 60 * 1000)
              : null,
          })
          .where(eq(leadSegments.id, segmentId));

        // Real-time event handled automatically by SignalDB's table triggers

        console.log(
          `[Segment Refresh] Completed refresh for segment ${segmentId}: ${matchingLeadIds.length} members`
        );
      } catch (error: any) {
        console.error(`[Segment Refresh] Failed to refresh segment ${segmentId}:`, error);
        throw error;
      }
    }
  );

  // Schedule auto-refresh every 15 minutes
  try {
    await jobQueue.schedule(
      'refresh-segment',
      '*/15 * * * *', // Every 15 minutes
      {},
      {
        timezone: 'UTC',
      }
    );

    console.log('✅ Segment auto-refresh scheduler started (every 15 minutes)');
  } catch (error) {
    console.error('❌ Failed to start segment auto-refresh scheduler:', error);
  }

  // Worker: Process all segments with auto-refresh enabled
  await jobQueue.work(
    'refresh-segment',
    {
      teamSize: 1,
      teamConcurrency: 1,
    },
    async (job) => {
      // This worker handles the scheduled cron job
      // It finds all segments with auto_refresh enabled and enqueues refresh jobs

      console.log('[Segment Scheduler] Checking for segments to auto-refresh');

      try {
        // Find all segments with auto_refresh enabled that are due for refresh
        const now = new Date();
        const segments = await db.query.leadSegments.findMany({
          where: and(
            eq(leadSegments.autoRefresh, true),
            isNull(leadSegments.deletedAt),
            sql`(${leadSegments.nextRefreshAt} IS NULL OR ${leadSegments.nextRefreshAt} <= ${now})`
          ),
        });

        console.log(`[Segment Scheduler] Found ${segments.length} segments to refresh`);

        // Enqueue refresh job for each segment
        for (const segment of segments) {
          await jobQueue.send<RefreshSegmentJob>(
            'refresh-segment',
            {
              segmentId: segment.id,
              workspaceId: segment.workspaceId,
              forceRefresh: false,
            },
            {
              singletonKey: `segment-refresh-${segment.id}`, // Prevent duplicate jobs
              retryLimit: 3,
              retryDelay: 60,
            }
          );
        }

        console.log(`[Segment Scheduler] Enqueued ${segments.length} refresh jobs`);
      } catch (error) {
        console.error('[Segment Scheduler] Failed to schedule refreshes:', error);
        throw error;
      }
    }
  );

  console.log('✅ Segment workers registered');
}
