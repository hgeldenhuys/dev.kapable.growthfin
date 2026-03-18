/**
 * Enrichment History Service
 * Business logic for versioned enrichment tracking with content deduplication
 *
 * Epic: Backend API & Services for Enrichment History
 * Story: US-ENRICH-HIST-002
 */

import type { Database } from '@agios/db';
import {
  crmEnrichmentHistory,
  crmEnrichmentContent,
  type NewCrmEnrichmentHistory,
  type NewCrmEnrichmentContent,
  type CrmEnrichmentHistory,
  type CrmEnrichmentContent,
} from '@agios/db';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export interface HistoryListFilters {
  workspaceId: string;
  entityId: string;
  entityType: 'contact' | 'lead';
  limit?: number;
  offset?: number;
}

export interface HistoryEntryWithContent extends CrmEnrichmentHistory {
  enrichmentReport: string | null;
}

export interface CreateHistoryEntryData {
  workspaceId: string;
  entityId: string;
  entityType: 'contact' | 'lead';
  enrichmentReport: string; // Markdown content
  templateSnapshot: object;
  taskId?: string;
  jobId?: string;
  enrichmentSummary?: string;
  changesSinceLast?: string;
  metadata?: Record<string, any>;
}

/**
 * Compute SHA-256 hash of content for deduplication
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export const enrichmentHistoryService = {
  /**
   * Get paginated history for an entity
   */
  async getHistory(
    db: Database,
    filters: HistoryListFilters
  ): Promise<{ history: CrmEnrichmentHistory[]; totalCount: number }> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    // Build conditions
    const conditions = [
      eq(crmEnrichmentHistory.workspaceId, filters.workspaceId),
      eq(crmEnrichmentHistory.entityId, filters.entityId),
      eq(crmEnrichmentHistory.entityType, filters.entityType),
    ];

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmEnrichmentHistory)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    // Get paginated results (most recent first)
    const history = await db
      .select()
      .from(crmEnrichmentHistory)
      .where(and(...conditions))
      .orderBy(desc(crmEnrichmentHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      history,
      totalCount,
    };
  },

  /**
   * Get single history entry with full content
   */
  async getEntry(
    db: Database,
    id: string,
    workspaceId: string
  ): Promise<HistoryEntryWithContent | null> {
    const results = await db
      .select({
        history: crmEnrichmentHistory,
        content: crmEnrichmentContent,
      })
      .from(crmEnrichmentHistory)
      .leftJoin(
        crmEnrichmentContent,
        eq(crmEnrichmentHistory.enrichmentReportId, crmEnrichmentContent.id)
      )
      .where(
        and(
          eq(crmEnrichmentHistory.id, id),
          eq(crmEnrichmentHistory.workspaceId, workspaceId)
        )
      );

    if (results.length === 0) {
      return null;
    }

    const { history, content } = results[0];

    return {
      ...history,
      enrichmentReport: content?.enrichmentReport || null,
    };
  },

  /**
   * Create history entry with content deduplication
   */
  async createEntry(
    db: Database,
    data: CreateHistoryEntryData
  ): Promise<CrmEnrichmentHistory> {
    // Step 1: Get or create content (with deduplication)
    const contentId = await this.getOrCreateContent(
      db,
      data.workspaceId,
      data.enrichmentReport
    );

    // Step 2: Create history entry
    const historyData: NewCrmEnrichmentHistory = {
      workspaceId: data.workspaceId,
      entityId: data.entityId,
      entityType: data.entityType,
      enrichmentReportId: contentId,
      templateSnapshot: data.templateSnapshot,
      taskId: data.taskId || null,
      jobId: data.jobId || null,
      enrichmentSummary: data.enrichmentSummary || null,
      changesSinceLast: data.changesSinceLast || null,
      metadata: data.metadata || {},
    };

    const results = await db
      .insert(crmEnrichmentHistory)
      .values(historyData)
      .returning();

    return results[0];
  },

  /**
   * Get or create content with deduplication
   * Returns content ID
   */
  async getOrCreateContent(
    db: Database,
    workspaceId: string,
    content: string
  ): Promise<string> {
    // Compute SHA-256 hash
    const contentHash = computeContentHash(content);

    // Check if content already exists for this workspace
    const existing = await db
      .select()
      .from(crmEnrichmentContent)
      .where(
        and(
          eq(crmEnrichmentContent.workspaceId, workspaceId),
          eq(crmEnrichmentContent.contentHash, contentHash)
        )
      );

    if (existing.length > 0) {
      // Content exists - increment reference count
      const existingContent = existing[0];

      await db
        .update(crmEnrichmentContent)
        .set({
          referenceCount: sql`${crmEnrichmentContent.referenceCount} + 1`,
        })
        .where(eq(crmEnrichmentContent.id, existingContent.id));

      console.log(
        `[enrichment-history] Content deduplicated: ${contentHash.substring(0, 16)}... (ref count: ${existingContent.referenceCount + 1})`
      );

      return existingContent.id;
    }

    // Content doesn't exist - create new
    const contentData: NewCrmEnrichmentContent = {
      workspaceId,
      contentHash,
      enrichmentReport: content,
      compressed: false,
      referenceCount: 1,
    };

    const results = await db
      .insert(crmEnrichmentContent)
      .values(contentData)
      .returning();

    console.log(
      `[enrichment-history] New content created: ${contentHash.substring(0, 16)}...`
    );

    return results[0].id;
  },

  /**
   * Decrement reference count when history entry is deleted
   * Clean up content if reference count reaches 0
   */
  async decrementContentReference(db: Database, contentId: string): Promise<void> {
    // Decrement reference count
    await db
      .update(crmEnrichmentContent)
      .set({
        referenceCount: sql`${crmEnrichmentContent.referenceCount} - 1`,
      })
      .where(eq(crmEnrichmentContent.id, contentId));

    // Check if reference count is 0
    const [content] = await db
      .select()
      .from(crmEnrichmentContent)
      .where(eq(crmEnrichmentContent.id, contentId));

    if (content && content.referenceCount <= 0) {
      // Delete content (garbage collection)
      await db
        .delete(crmEnrichmentContent)
        .where(eq(crmEnrichmentContent.id, contentId));

      console.log(
        `[enrichment-history] Content garbage collected: ${content.contentHash.substring(0, 16)}...`
      );
    }
  },

  /**
   * Delete history entry (with reference counting cleanup)
   */
  async deleteEntry(db: Database, id: string, workspaceId: string): Promise<void> {
    // Get the history entry to find content ID
    const [entry] = await db
      .select()
      .from(crmEnrichmentHistory)
      .where(
        and(
          eq(crmEnrichmentHistory.id, id),
          eq(crmEnrichmentHistory.workspaceId, workspaceId)
        )
      );

    if (!entry) {
      throw new Error('History entry not found');
    }

    // Delete history entry
    await db
      .delete(crmEnrichmentHistory)
      .where(eq(crmEnrichmentHistory.id, id));

    // Decrement content reference count (and cleanup if needed)
    if (entry.enrichmentReportId) {
      await this.decrementContentReference(db, entry.enrichmentReportId);
    }
  },
};
