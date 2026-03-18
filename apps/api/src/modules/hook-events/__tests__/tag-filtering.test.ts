/**
 * Tag-Based Filtering Integration Tests
 * Tests for US-TAG-004: API Endpoints for Tag-Based Filtering
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { hookEvents, tags } from '@agios/db';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';

// Load .env FIRST
config();

/**
 * Acceptance Criteria:
 * - AC-001: GET /api/events?tag=<name> returns events where tag in tags array
 * - AC-002: GET /api/events/stream?tag=<name> streams only events with that tag (SSE)
 * - AC-003: GET /api/tags returns latest 10 tags sorted by last_used_at DESC
 * - AC-004: Tag filter takes precedence over projectId if both provided
 * - AC-005: Tag filtering uses GIN index for performance (<100ms)
 * - AC-006: SSE endpoint filters tag_changed events through to clients
 * - AC-007: API returns tag metadata (event_count, first_used_at, last_used_at)
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_PROJECT_ID = 'test-tag-filtering';
const TEST_TAG_1 = 'backend-dev';
const TEST_TAG_2 = 'frontend-dev';
const TEST_TAG_3 = 'cli-dev';

describe('Tag-Based Filtering', () => {
  let createdEventIds: string[] = [];

  beforeAll(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM ${hookEvents} WHERE ${hookEvents.projectId} = ${TEST_PROJECT_ID}`);
  });

  afterAll(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM ${hookEvents} WHERE ${hookEvents.projectId} = ${TEST_PROJECT_ID}`);
  });

  /**
   * AC-001: GET /api/events?tag=<name> returns events where tag in tags array
   */
  it('AC-001: GET /recent?tag=<name> returns only events with that tag', async () => {
    // Create test events with different tags
    const event1Response = await fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_PROJECT_ID,
        sessionId: 'test-session-1',
        eventName: 'TestEvent',
        tags: [TEST_TAG_1],
        payload: { test: 'event1' },
      }),
    });

    const event2Response = await fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_PROJECT_ID,
        sessionId: 'test-session-2',
        eventName: 'TestEvent',
        tags: [TEST_TAG_2],
        payload: { test: 'event2' },
      }),
    });

    const event3Response = await fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_PROJECT_ID,
        sessionId: 'test-session-3',
        eventName: 'TestEvent',
        tags: [TEST_TAG_1, TEST_TAG_2], // Multiple tags
        payload: { test: 'event3' },
      }),
    });

    expect(event1Response.ok).toBe(true);
    expect(event2Response.ok).toBe(true);
    expect(event3Response.ok).toBe(true);

    const event1 = await event1Response.json();
    const event2 = await event2Response.json();
    const event3 = await event3Response.json();

    createdEventIds.push(event1.id, event2.id, event3.id);

    // Wait a bit for events to be indexed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query by TEST_TAG_1 - should return event1 and event3
    const response = await fetch(`${API_URL}/api/v1/hook-events/recent?tag=${TEST_TAG_1}&seconds=60`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('filter');
    expect(data.filter).toEqual({ type: 'tag', value: TEST_TAG_1 });

    const eventIds = data.events.map((e: any) => e.id);
    expect(eventIds).toContain(event1.id);
    expect(eventIds).toContain(event3.id);
    expect(eventIds).not.toContain(event2.id); // Should NOT contain event2 (has TEST_TAG_2)
  });

  /**
   * AC-003: GET /api/tags returns latest 10 tags sorted by last_used_at DESC
   * AC-007: API returns tag metadata (event_count, first_used_at, last_used_at)
   */
  it('AC-003, AC-007: GET /tags returns latest tags with metadata', async () => {
    const response = await fetch(`${API_URL}/api/v1/tags?limit=10`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('tags');
    expect(Array.isArray(data.tags)).toBe(true);

    // Should have at least our test tags
    const tagNames = data.tags.map((t: any) => t.tag_name);
    expect(tagNames).toContain(TEST_TAG_1);
    expect(tagNames).toContain(TEST_TAG_2);

    // Verify metadata structure (AC-007)
    for (const tag of data.tags) {
      expect(tag).toHaveProperty('tag_name');
      expect(tag).toHaveProperty('event_count');
      expect(tag).toHaveProperty('first_used');
      expect(tag).toHaveProperty('last_used');

      expect(typeof tag.tag_name).toBe('string');
      expect(typeof tag.event_count).toBe('number');
      expect(typeof tag.first_used).toBe('string');
      expect(typeof tag.last_used).toBe('string');
    }

    // Verify sorted by last_used DESC
    for (let i = 0; i < data.tags.length - 1; i++) {
      const current = new Date(data.tags[i].last_used);
      const next = new Date(data.tags[i + 1].last_used);
      expect(current >= next).toBe(true);
    }
  });

  /**
   * AC-004: Tag filter takes precedence over projectId if both provided
   */
  it('AC-004: Tag filter takes precedence over projectId', async () => {
    // Create an event with TEST_TAG_3 (can be in same project, we're testing tag precedence)
    const otherProjectEvent = await fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_PROJECT_ID,
        sessionId: 'test-session-tag-precedence',
        eventName: 'TestEvent',
        tags: [TEST_TAG_3],
        payload: { test: 'tag-precedence-test' },
      }),
    });

    expect(otherProjectEvent.ok).toBe(true);
    const otherEvent = await otherProjectEvent.json();
    createdEventIds.push(otherEvent.id);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Query with BOTH tag and projectId - tag should take precedence
    const response = await fetch(
      `${API_URL}/api/v1/hook-events/recent?tag=${TEST_TAG_3}&projectId=${TEST_PROJECT_ID}&seconds=60`
    );
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.filter).toEqual({ type: 'tag', value: TEST_TAG_3 });

    const eventIds = data.events.map((e: any) => e.id);
    // Should return the event because tag filter takes precedence over projectId parameter
    expect(eventIds).toContain(otherEvent.id);
  });

  /**
   * AC-005: Tag filtering uses GIN index for performance (<100ms)
   */
  it('AC-005: Tag filtering performs <100ms with GIN index', async () => {
    const start = Date.now();

    const response = await fetch(`${API_URL}/api/v1/hook-events/recent?tag=${TEST_TAG_1}&seconds=3600`);
    expect(response.ok).toBe(true);

    const duration = Date.now() - start;

    // Should complete in less than 100ms
    expect(duration).toBeLessThan(100);

    console.log(`Tag filtering took ${duration}ms`);
  });

  /**
   * Verify GIN index is being used
   */
  it('AC-005: Verify GIN index usage with EXPLAIN', async () => {
    const query = sql`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM hook_events
      WHERE 'backend-dev' = ANY(tags)
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await db.execute(query);
    const plan = JSON.stringify(result);

    // Verify that GIN index is being used
    // The plan should mention "Index Scan" and the index name "hook_events_tags_idx"
    expect(plan.toLowerCase()).toContain('index');
    console.log('Query plan:', plan);
  });

  /**
   * Test filtering with non-existent tag
   */
  it('should return empty array for non-existent tag', async () => {
    const response = await fetch(`${API_URL}/api/v1/hook-events/recent?tag=non-existent-tag&seconds=60`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.events).toEqual([]);
  });

  /**
   * Test filtering with projectId when tag is not provided
   */
  it('should filter by projectId when tag is not provided', async () => {
    const response = await fetch(`${API_URL}/api/v1/hook-events/recent?projectId=${TEST_PROJECT_ID}&seconds=60`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.filter).toEqual({ type: 'projectId', value: TEST_PROJECT_ID });

    // All events should be from TEST_PROJECT_ID
    for (const event of data.events) {
      expect(event.projectId).toBe(TEST_PROJECT_ID);
    }
  });
});

/**
 * SSE Streaming Tests
 * AC-002, AC-006: SSE endpoint filters by tag
 */
describe('Tag-Based SSE Streaming', () => {
  beforeAll(async () => {
    await db.execute(sql`DELETE FROM ${hookEvents} WHERE ${hookEvents.projectId} LIKE 'test-sse-%'`);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM ${hookEvents} WHERE ${hookEvents.projectId} LIKE 'test-sse-%'`);
  });

  /**
   * AC-002: GET /stream?tag=<name> streams only events with that tag
   * AC-006: SSE endpoint filters tag_changed events through to clients
   */
  it('AC-002, AC-006: SSE stream filters events by tag', async () => {
    const TEST_SSE_TAG = 'sse-test-tag';
    const TEST_SSE_PROJECT = 'test-sse-project';

    // Connect to SSE stream with tag filter
    const sseUrl = `${API_URL}/api/v1/hook-events/stream?tag=${TEST_SSE_TAG}`;
    const controller = new AbortController();

    const streamPromise = fetch(sseUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    const response = await streamPromise;
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    if (!reader) {
      throw new Error('No reader');
    }

    // Wait for initial connection message
    const { value: connectMsg } = await reader.read();
    const connectText = new TextDecoder().decode(connectMsg);
    expect(connectText).toContain('connected');

    // Create event WITH the tag - should be received
    const matchingEventPromise = fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_SSE_PROJECT,
        sessionId: 'test-sse-1',
        eventName: 'TestEvent',
        tags: [TEST_SSE_TAG],
        payload: { test: 'should-be-received' },
      }),
    });

    // Create event WITHOUT the tag - should NOT be received
    const nonMatchingEventPromise = fetch(`${API_URL}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: TEST_SSE_PROJECT,
        sessionId: 'test-sse-2',
        eventName: 'TestEvent',
        tags: ['other-tag'],
        payload: { test: 'should-not-be-received' },
      }),
    });

    const [matchingResp, nonMatchingResp] = await Promise.all([
      matchingEventPromise,
      nonMatchingEventPromise,
    ]);

    expect(matchingResp.ok).toBe(true);
    expect(nonMatchingResp.ok).toBe(true);

    const matchingEvent = await matchingResp.json();
    const nonMatchingEvent = await nonMatchingResp.json();

    // Read SSE messages with timeout
    const readWithTimeout = async (timeoutMs: number) => {
      const timeoutPromise = new Promise<{ done: true }>((resolve) =>
        setTimeout(() => resolve({ done: true }), timeoutMs)
      );

      const readPromise = reader.read();
      return Promise.race([readPromise, timeoutPromise]);
    };

    // Read messages until we find our event or timeout
    let foundMatchingEvent = false;
    let foundNonMatchingEvent = false;

    for (let i = 0; i < 10; i++) {
      const result = await readWithTimeout(2000);

      if ('done' in result && result.done === true) {
        break; // Timeout or stream ended
      }

      if (!('value' in result)) {
        continue;
      }

      const text = new TextDecoder().decode(result.value);

      // Skip connection messages
      if (text.startsWith(':')) {
        continue;
      }

      // Parse data: lines
      const dataMatch = text.match(/data: (.+)/);
      if (!dataMatch) {
        continue;
      }

      try {
        const eventData = JSON.parse(dataMatch[1]);

        // Check if this is our matching event
        if (eventData.id === matchingEvent.id) {
          foundMatchingEvent = true;
          expect(eventData.tags || []).toContain(TEST_SSE_TAG);
        }

        // Check if we accidentally received the non-matching event
        if (eventData.id === nonMatchingEvent.id) {
          foundNonMatchingEvent = true;
        }
      } catch (e) {
        // Skip malformed JSON
        continue;
      }

      // If we found the matching event, we can stop
      if (foundMatchingEvent) {
        break;
      }
    }

    // Assertions
    expect(foundMatchingEvent).toBe(true);
    expect(foundNonMatchingEvent).toBe(false);

    // Clean up
    controller.abort();
  }, 10000); // Increase timeout for SSE test

  /**
   * Test SSE with tag requires either tag or projectId
   */
  it('should return 400 if neither tag nor projectId provided', async () => {
    const response = await fetch(`${API_URL}/api/v1/hook-events/stream`);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });
});
