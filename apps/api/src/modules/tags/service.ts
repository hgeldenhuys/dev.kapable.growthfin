/**
 * Tags Service
 * Business logic for tag analytics
 */

import type { DrizzleDB } from '@agios/db';
import { sql } from 'drizzle-orm';

export interface TagHistoryEntry {
  tag_name: string;
  event_count: number;
  first_used: string;
  last_used: string;
}

export const tagsService = {
  /**
   * Get latest tags sorted by last_used_at
   * AC-003: Returns latest N tags with metadata
   * AC-007: Includes event_count, first_used_at, last_used_at
   */
  async getLatest(db: DrizzleDB, options: { limit: number; projectId?: string }): Promise<TagHistoryEntry[]> {
    let query: any;

    if (options.projectId) {
      query = sql<TagHistoryEntry>`
        SELECT
          unnest(tags) as tag_name,
          COUNT(*) as event_count,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM hook_events
        WHERE project_id = ${options.projectId} AND tags IS NOT NULL AND array_length(tags, 1) > 0
        GROUP BY tag_name
        ORDER BY last_used DESC
        LIMIT ${options.limit}
      `;
    } else {
      query = sql<TagHistoryEntry>`
        SELECT
          unnest(tags) as tag_name,
          COUNT(*) as event_count,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM hook_events
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
        GROUP BY tag_name
        ORDER BY last_used DESC
        LIMIT ${options.limit}
      `;
    }

    const result = await db.execute(query);

    return (result as any[]).map((row: any) => ({
      tag_name: String(row.tag_name),
      event_count: Number(row.event_count),
      first_used: row.first_used instanceof Date ? row.first_used.toISOString() : String(row.first_used),
      last_used: row.last_used instanceof Date ? row.last_used.toISOString() : String(row.last_used),
    }));
  },

  /**
   * Get tag usage history
   * Returns all tags with event counts and usage timestamps
   */
  async getHistory(db: DrizzleDB, projectId?: string): Promise<TagHistoryEntry[]> {
    // Build SQL query to aggregate tag usage
    // Uses unnest to expand the tags array and aggregate by tag name
    let query: any;

    if (projectId) {
      query = sql<TagHistoryEntry>`
        SELECT
          unnest(tags) as tag_name,
          COUNT(*) as event_count,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM hook_events
        WHERE project_id = ${projectId} AND tags IS NOT NULL AND array_length(tags, 1) > 0
        GROUP BY tag_name
        ORDER BY event_count DESC, tag_name ASC
      `;
    } else {
      query = sql<TagHistoryEntry>`
        SELECT
          unnest(tags) as tag_name,
          COUNT(*) as event_count,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM hook_events
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
        GROUP BY tag_name
        ORDER BY event_count DESC, tag_name ASC
      `;
    }

    const result = await db.execute(query);

    // Drizzle execute() returns array directly, not {rows: []}
    // Convert to plain objects with proper types
    return (result as any[]).map((row: any) => ({
      tag_name: String(row.tag_name),
      event_count: Number(row.event_count),
      first_used: row.first_used instanceof Date ? row.first_used.toISOString() : String(row.first_used),
      last_used: row.last_used instanceof Date ? row.last_used.toISOString() : String(row.last_used),
    }));
  },
};
