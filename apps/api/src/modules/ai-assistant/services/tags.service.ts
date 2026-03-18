/**
 * Tags Service
 * Manages the tags table (upsert tag_name, increment event_count, update last_used_at)
 */

import type { Database } from '@agios/db';
import { tags } from '@agios/db';
import { sql, eq } from 'drizzle-orm';

export const tagsService = {
  /**
   * Upsert tags (AC-008)
   * - If tag doesn't exist, create it with event_count=1
   * - If tag exists, increment event_count and update last_used_at
   *
   * @param db - Database connection
   * @param tagNames - Array of tag names to upsert
   */
  async upsertTags(db: Database, tagNames: string[]): Promise<void> {
    if (tagNames.length === 0) {
      return;
    }

    // Batch upsert all tags
    for (const tagName of tagNames) {
      try {
        await db
          .insert(tags)
          .values({
            tagName,
            firstUsedAt: new Date(),
            lastUsedAt: new Date(),
            eventCount: 1,
          })
          .onConflictDoUpdate({
            target: tags.tagName,
            set: {
              lastUsedAt: new Date(),
              eventCount: sql`${tags.eventCount} + 1`,
            },
          });
      } catch (error) {
        // Log but don't throw - tag tracking is non-critical
        console.error(`[TagsService] Failed to upsert tag "${tagName}":`, error);
      }
    }
  },

  /**
   * Get all tags ordered by last usage
   */
  async listTags(db: Database, options?: { limit?: number; offset?: number }) {
    const query = db
      .select()
      .from(tags)
      .orderBy(sql`${tags.lastUsedAt} DESC`);

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query;
  },

  /**
   * Get a single tag by name
   */
  async getTagByName(db: Database, tagName: string) {
    const results = await db
      .select()
      .from(tags)
      .where(eq(tags.tagName, tagName))
      .limit(1);

    return results.length > 0 ? results[0] : null;
  },
};
