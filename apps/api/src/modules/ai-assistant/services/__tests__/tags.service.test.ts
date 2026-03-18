/**
 * Tags Service Integration Tests
 * Tests for tags table management (upsert, increment, etc.)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { db } from '@agios/db';
import { tags } from '@agios/db';
import { eq, sql } from 'drizzle-orm';
import { tagsService } from '../tags.service';

describe('TagsService', () => {
  const TEST_TAG_PREFIX = 'test-tag-service-';

  // Clean up test tags before each test
  beforeEach(async () => {
    await db.execute(
      sql`DELETE FROM ${tags} WHERE ${tags.tagName} LIKE ${TEST_TAG_PREFIX + '%'}`
    );
  });

  describe('upsertTags', () => {
    // AC-008: Service updates tags table (creates new tag)
    it('should create new tag with event_count=1', async () => {
      const tagName = TEST_TAG_PREFIX + 'new-tag';

      await tagsService.upsertTags(db, [tagName]);

      const result = await db
        .select()
        .from(tags)
        .where(eq(tags.tagName, tagName))
        .limit(1);

      expect(result.length).toBe(1);
      expect(result[0].tagName).toBe(tagName);
      expect(result[0].eventCount).toBe(1);
      expect(result[0].firstUsedAt).toBeDefined();
      expect(result[0].lastUsedAt).toBeDefined();
    });

    // AC-008: Service updates tags table (increments existing tag)
    it('should increment event_count for existing tag', async () => {
      const tagName = TEST_TAG_PREFIX + 'existing-tag';

      // Create initial tag
      await tagsService.upsertTags(db, [tagName]);

      // Get initial state
      const initial = await db
        .select()
        .from(tags)
        .where(eq(tags.tagName, tagName))
        .limit(1);

      expect(initial[0].eventCount).toBe(1);

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Upsert again
      await tagsService.upsertTags(db, [tagName]);

      // Check updated state
      const updated = await db
        .select()
        .from(tags)
        .where(eq(tags.tagName, tagName))
        .limit(1);

      expect(updated[0].eventCount).toBe(2);
      expect(updated[0].firstUsedAt.getTime()).toBe(initial[0].firstUsedAt.getTime()); // Should not change
      expect(updated[0].lastUsedAt.getTime()).toBeGreaterThan(initial[0].lastUsedAt.getTime()); // Should update
    });

    // AC-008: Handle multiple tags
    it('should upsert multiple tags at once', async () => {
      const tagNames = [
        TEST_TAG_PREFIX + 'multi-1',
        TEST_TAG_PREFIX + 'multi-2',
        TEST_TAG_PREFIX + 'multi-3',
      ];

      await tagsService.upsertTags(db, tagNames);

      for (const tagName of tagNames) {
        const result = await db
          .select()
          .from(tags)
          .where(eq(tags.tagName, tagName))
          .limit(1);

        expect(result.length).toBe(1);
        expect(result[0].eventCount).toBe(1);
      }
    });

    // Handle empty array (no-op)
    it('should handle empty array without errors', async () => {
      await expect(tagsService.upsertTags(db, [])).resolves.toBeUndefined();
    });

    // Multiple increments
    it('should correctly increment count multiple times', async () => {
      const tagName = TEST_TAG_PREFIX + 'increment-test';

      // Upsert 5 times
      for (let i = 0; i < 5; i++) {
        await tagsService.upsertTags(db, [tagName]);
      }

      const result = await db
        .select()
        .from(tags)
        .where(eq(tags.tagName, tagName))
        .limit(1);

      expect(result[0].eventCount).toBe(5);
    });
  });

  describe('listTags', () => {
    it('should list tags ordered by last usage', async () => {
      const tag1 = TEST_TAG_PREFIX + 'list-1';
      const tag2 = TEST_TAG_PREFIX + 'list-2';
      const tag3 = TEST_TAG_PREFIX + 'list-3';

      // Create tags with delays to ensure different timestamps
      await tagsService.upsertTags(db, [tag1]);
      await new Promise(resolve => setTimeout(resolve, 10));
      await tagsService.upsertTags(db, [tag2]);
      await new Promise(resolve => setTimeout(resolve, 10));
      await tagsService.upsertTags(db, [tag3]);

      // Update tag1 (should move to top)
      await new Promise(resolve => setTimeout(resolve, 10));
      await tagsService.upsertTags(db, [tag1]);

      const allTags = await tagsService.listTags(db);
      const testTags = allTags.filter(t => t.tagName.startsWith(TEST_TAG_PREFIX));

      // tag1 should be first (most recently used)
      expect(testTags[0].tagName).toBe(tag1);
    });

    it('should respect limit and offset', async () => {
      const tag1 = TEST_TAG_PREFIX + 'limit-1';
      const tag2 = TEST_TAG_PREFIX + 'limit-2';
      const tag3 = TEST_TAG_PREFIX + 'limit-3';

      await tagsService.upsertTags(db, [tag1, tag2, tag3]);

      const limited = await tagsService.listTags(db, { limit: 2 });
      expect(limited.length).toBeLessThanOrEqual(2);

      const offset = await tagsService.listTags(db, { limit: 2, offset: 1 });
      expect(offset.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getTagByName', () => {
    it('should return tag if exists', async () => {
      const tagName = TEST_TAG_PREFIX + 'get-test';
      await tagsService.upsertTags(db, [tagName]);

      const result = await tagsService.getTagByName(db, tagName);
      expect(result).not.toBeNull();
      expect(result?.tagName).toBe(tagName);
    });

    it('should return null if tag does not exist', async () => {
      const result = await tagsService.getTagByName(db, 'non-existent-tag-xyz');
      expect(result).toBeNull();
    });
  });
});
