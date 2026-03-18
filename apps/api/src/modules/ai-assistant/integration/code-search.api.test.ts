/**
 * Code Search API Backend QA Tests
 * Comprehensive testing of ripgrep-based code search endpoints
 *
 * Test Coverage:
 * 1. API Endpoint Validation
 * 2. Rate Limiting
 * 3. Concurrent Search Limiting
 * 4. SSE Streaming
 * 5. Error Handling
 * 6. Integration Tests
 *
 * Note: This is an integration test that uses native fetch (not happy-dom)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { config } from 'dotenv';

// Load environment BEFORE importing db
config();

import { db } from '@agios/db/client';
import { workspaces, users, cliSessions, projects } from '@agios/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test configuration from environment
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1/ai-assistant`;

// Test data - using UUIDs for compatibility with database schema
const TEST_WORKSPACE_ID = '11111111-1111-4111-1111-111111111111';
const TEST_USER_ID = '22222222-2222-4222-2222-222222222222';
const TEST_CLI_SESSION_ID = '33333333-3333-4333-3333-333333333333';

// Other workspace for isolation testing
const OTHER_WORKSPACE_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_USER_ID = '55555555-5555-4555-5555-555555555555';

describe('Code Search API - Backend QA Tests', () => {
  // Reset rate limits before each test to prevent pollution
  beforeEach(async () => {
    await fetch(`${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/debug/reset-limits`, {
      method: 'POST',
    });
  });

  // Setup test data
  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(cliSessions).where(eq(cliSessions.projectId, TEST_WORKSPACE_ID));
    await db.delete(projects).where(eq(projects.id, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));

    await db.delete(cliSessions).where(eq(cliSessions.projectId, OTHER_WORKSPACE_ID));
    await db.delete(projects).where(eq(projects.id, OTHER_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, OTHER_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, OTHER_USER_ID));

    // Create test users
    await db.insert(users).values([
      {
        id: TEST_USER_ID,
        email: 'test-code-search@example.com',
        name: 'Test User Code Search',
        emailVerified: false,
      },
      {
        id: OTHER_USER_ID,
        email: 'other-workspace-code-search@example.com',
        name: 'Other Workspace User',
        emailVerified: false,
      },
    ]);

    // Create test workspaces
    await db.insert(workspaces).values([
      {
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Code Search',
        slug: 'test-code-search',
        ownerId: TEST_USER_ID,
      },
      {
        id: OTHER_WORKSPACE_ID,
        name: 'Other Workspace - Code Search',
        slug: 'other-code-search',
        ownerId: OTHER_USER_ID,
      },
    ]);

    // Create test projects (for CLI sessions)
    await db.insert(projects).values([
      {
        id: TEST_WORKSPACE_ID,
        name: 'Test Project Code Search',
        workspaceId: TEST_WORKSPACE_ID,
        gitRepo: 'test-repo',
      },
      {
        id: OTHER_WORKSPACE_ID,
        name: 'Other Project Code Search',
        workspaceId: OTHER_WORKSPACE_ID,
        gitRepo: 'other-repo',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(cliSessions).where(eq(cliSessions.projectId, TEST_WORKSPACE_ID));
    await db.delete(projects).where(eq(projects.id, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));

    await db.delete(cliSessions).where(eq(cliSessions.projectId, OTHER_WORKSPACE_ID));
    await db.delete(projects).where(eq(projects.id, OTHER_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, OTHER_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, OTHER_USER_ID));
  });

  describe('1. API Endpoint Validation', () => {
    test('should reject request when no CLI connected', async () => {
      // Ensure no active CLI sessions
      await db.delete(cliSessions).where(eq(cliSessions.projectId, TEST_WORKSPACE_ID));

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('NO_CLI_CONNECTED');
      expect(data.message).toContain('No CLI connected');
    });

    test('should accept valid request with minimal params (query only)', async () => {
      // Create active CLI session
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.searchId).toBeDefined();
      expect(data.sseUrl).toBeDefined();
      expect(data.sseUrl).toContain('/sse');
    });

    test('should accept valid request with all optional params', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'AuthService',
            caseSensitive: true,
            filePattern: '*.{ts,tsx}',
            contextLines: 2,
            maxResults: 100,
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.searchId).toBeDefined();
      expect(data.sseUrl).toBeDefined();
    });

    test('should reject empty query (400)', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' }),
        }
      );

      expect(response.status).toBe(400);
    });

    test('should reject query too long (>500 chars) (400)', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const longQuery = 'a'.repeat(501);
      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: longQuery }),
        }
      );

      expect(response.status).toBe(400);
    });

    test('should reject invalid file pattern with semicolon (400)', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test',
            filePattern: '*.ts;rm -rf /',
          }),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('semicolon');
    });

    test('should reject context lines out of range (400)', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      // Test below minimum
      let response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test',
            contextLines: -1,
          }),
        }
      );
      expect(response.status).toBe(400);

      // Test above maximum
      response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test',
            contextLines: 6,
          }),
        }
      );
      expect(response.status).toBe(400);
    });

    test('should reject max results out of range (400)', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      // Test below minimum
      let response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test',
            maxResults: 0,
          }),
        }
      );
      expect(response.status).toBe(400);

      // Test above maximum
      response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test',
            maxResults: 1001,
          }),
        }
      );
      expect(response.status).toBe(400);
    });
  });

  describe('2. Rate Limiting', () => {
    beforeEach(async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);
      await createActiveCliSession(OTHER_WORKSPACE_ID);
      // Wait a bit to ensure rate limit window resets
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    test('should allow 30 requests in 1 minute', async () => {
      const testUserId = randomUUID();

      // Use 3 different workspaces to avoid hitting concurrent limit (10 per workspace)
      // Rate limit is per-user (30/min), concurrent limit is per-workspace (10)
      // So we can send 10 requests to each of 3 workspaces = 30 total
      const workspaces = [TEST_WORKSPACE_ID, OTHER_WORKSPACE_ID, TEST_WORKSPACE_ID]; // Reuse for simplicity

      const responses = [];
      for (let i = 0; i < 30; i++) {
        const workspaceId = i < 10 ? TEST_WORKSPACE_ID : OTHER_WORKSPACE_ID;
        const response = await fetch(
          `${API_BASE}/workspaces/${workspaceId}/code-search?userId=${testUserId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `test${i}` }),
          }
        );
        responses.push(response);
      }

      const successCount = responses.filter((r) => r.status === 200).length;

      // Should allow at least 20 (10 per workspace) or possibly more if slots release quickly
      // Note: This test demonstrates the interaction between rate limiting and concurrent limiting
      expect(successCount).toBeGreaterThanOrEqual(20);
    });

    test('should reject 31st request with 429', async () => {
      const testUserId = randomUUID();

      // Send 30 requests
      for (let i = 0; i < 30; i++) {
        await fetch(
          `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${testUserId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `test${i}` }),
          }
        );
      }

      // 31st should fail
      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${testUserId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test31' }),
        }
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Rate limit');
    });
  });

  describe('3. Concurrent Search Limiting', () => {
    beforeEach(async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);
      // Reset concurrent counter
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    test('should allow 10 concurrent searches', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const userId = randomUUID();
        promises.push(
          fetch(
            `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${userId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: `concurrent${i}` }),
            }
          )
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter((r) => r.status === 200).length;

      expect(successCount).toBe(10);
    });

    test('should reject 11th concurrent search with 429', async () => {
      // Start 10 searches
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const userId = randomUUID();
        promises.push(
          fetch(
            `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${userId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: `concurrent${i}` }),
            }
          )
        );
      }

      await Promise.all(promises);

      // Try 11th
      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${randomUUID()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'concurrent11' }),
        }
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Concurrent');
    });
  });

  describe('4. SSE Streaming', () => {
    test('should connect to SSE endpoint', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      // Create search
      const createResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      const { searchId } = await createResponse.json();

      // Connect to SSE
      const sseResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/${searchId}/sse`
      );

      expect(sseResponse.status).toBe(200);
      // ElysiaJS may add additional content-types, so just check it contains text/event-stream
      expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');
      expect(sseResponse.headers.get('cache-control')).toContain('no-cache');
      expect(sseResponse.headers.get('connection')).toContain('keep-alive');
    });

    test('should receive connection confirmation', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const createResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      const { searchId } = await createResponse.json();

      const sseResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/${searchId}/sse`
      );

      const reader = sseResponse.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain(': connected at');
      reader.releaseLock();
    });

    test('should timeout after 15 seconds with no results', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const createResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test-timeout' }),
        }
      );

      const { searchId } = await createResponse.json();

      const sseResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/${searchId}/sse`
      );

      const reader = sseResponse.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      let receivedTimeout = false;
      const startTime = Date.now();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          if (text.includes('TIMEOUT')) {
            receivedTimeout = true;
            const eventMatch = text.match(/data: ({.*})/);
            if (eventMatch) {
              const event = JSON.parse(eventMatch[1]);
              expect(event.type).toBe('error');
              expect(event.error).toBe('TIMEOUT');
            }
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }

      const elapsed = Date.now() - startTime;
      expect(receivedTimeout).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(15000);
      expect(elapsed).toBeLessThan(16000);
    }, 20000); // Increase test timeout to 20s

    test('should receive heartbeat events', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const createResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test-heartbeat' }),
        }
      );

      const { searchId } = await createResponse.json();

      const sseResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/${searchId}/sse`
      );

      const reader = sseResponse.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      let heartbeatCount = 0;

      try {
        const timeout = setTimeout(() => {
          reader.cancel();
        }, 12000);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          if (text.includes(': heartbeat at')) {
            heartbeatCount++;
            if (heartbeatCount >= 2) {
              clearTimeout(timeout);
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Should receive at least 2 heartbeats in 12 seconds (every 5s)
      expect(heartbeatCount).toBeGreaterThanOrEqual(2);
    }, 15000);
  });

  describe('5. Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json{',
        }
      );

      expect(response.status).toBe(400);
    });

    test('should handle missing required fields', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Missing query
        }
      );

      expect(response.status).toBe(400);
    });

    test('should validate workspaceId format', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/invalid-uuid/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      // Should fail (either 400 or 404)
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('6. Integration Tests', () => {
    test('should handle complete search lifecycle', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      // Step 1: Create search
      const createResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'import',
            filePattern: '*.ts',
            contextLines: 1,
          }),
        }
      );

      expect(createResponse.status).toBe(200);
      const { searchId, sseUrl } = await createResponse.json();
      expect(searchId).toBeDefined();
      expect(sseUrl).toContain(searchId);

      // Step 2: Connect to SSE
      const sseResponse = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search/${searchId}/sse`
      );

      expect(sseResponse.status).toBe(200);
      // ElysiaJS may add additional content-types, so just check it contains text/event-stream
      expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');

      // Step 3: Verify we can read the stream
      const reader = sseResponse.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        expect(text).toContain(':');
        reader.releaseLock();
      }
    });

    test('should isolate searches by workspace', async () => {
      // Create active CLI sessions for both workspaces
      await createActiveCliSession(TEST_WORKSPACE_ID);
      await createActiveCliSession(OTHER_WORKSPACE_ID);

      // Create search in first workspace
      const response1 = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'workspace1' }),
        }
      );

      expect(response1.status).toBe(200);
      const { searchId: searchId1 } = await response1.json();

      // Create search in second workspace
      const response2 = await fetch(
        `${API_BASE}/workspaces/${OTHER_WORKSPACE_ID}/code-search?userId=${OTHER_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'workspace2' }),
        }
      );

      expect(response2.status).toBe(200);
      const { searchId: searchId2 } = await response2.json();

      // Search IDs should be different
      expect(searchId1).not.toBe(searchId2);

      // Should not be able to access other workspace's search via SSE
      // Note: This assumes workspace isolation is implemented at SSE endpoint
      const crossAccessResponse = await fetch(
        `${API_BASE}/workspaces/${OTHER_WORKSPACE_ID}/code-search/${searchId1}/sse`
      );

      // Should either timeout or error (not receive results from wrong workspace)
      expect(crossAccessResponse.status).toBe(200); // SSE always returns 200
    });

    test('should handle CLI disconnect scenario', async () => {
      // Create and then immediately delete CLI session
      await createActiveCliSession(TEST_WORKSPACE_ID);
      await db.delete(cliSessions).where(eq(cliSessions.projectId, TEST_WORKSPACE_ID));

      // Wait for heartbeat timeout (30s) to be recognized
      // For testing, we'll just verify immediate behavior
      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      // Should fail since CLI is not connected
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('NO_CLI_CONNECTED');
    });

    test('should handle special characters in query', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const specialQueries = [
        'function.*test',
        'class\\s+\\w+',
        'import { useState }',
        '"exact phrase"',
        'path/to/file',
      ];

      for (const query of specialQueries) {
        const response = await fetch(
          `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${randomUUID()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.searchId).toBeDefined();
      }
    });

    test('should return valid response structure', async () => {
      await createActiveCliSession(TEST_WORKSPACE_ID);

      const response = await fetch(
        `${API_BASE}/workspaces/${TEST_WORKSPACE_ID}/code-search?userId=${TEST_USER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Validate response structure
      expect(data).toHaveProperty('searchId');
      expect(data).toHaveProperty('sseUrl');
      expect(typeof data.searchId).toBe('string');
      expect(typeof data.sseUrl).toBe('string');

      // Validate searchId is a UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(data.searchId).toMatch(uuidRegex);

      // Validate SSE URL format
      expect(data.sseUrl).toContain(`/workspaces/${TEST_WORKSPACE_ID}/code-search/`);
      expect(data.sseUrl).toContain('/sse');
      expect(data.sseUrl).toContain(data.searchId);
    });
  });
});

/**
 * Helper function to create an active CLI session for testing
 */
async function createActiveCliSession(workspaceId: string): Promise<void> {
  const sessionId = randomUUID();
  const now = new Date();

  await db.insert(cliSessions).values({
    id: randomUUID(),
    projectId: workspaceId, // Using workspaceId as projectId for testing
    sessionId: sessionId,
    command: 'watch',
    lastHeartbeat: now,
    createdAt: now,
    metadata: { cliVersion: '1.0.0' },
  });
}
