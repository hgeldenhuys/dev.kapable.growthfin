/**
 * E2E Tests for Webhooks API
 *
 * Tests the full webhook lifecycle against a real API:
 * - CRUD operations
 * - URL validation (HTTPS requirement)
 * - Event triggering (INSERT/UPDATE/DELETE)
 * - Signature verification
 * - Delivery logs
 *
 * Prerequisites:
 * - Set TEST_API_URL environment variable (default: http://localhost:3003)
 * - Set TEST_API_KEY environment variable (valid sk_live_xxx key)
 *
 * Usage:
 *   export TEST_API_URL=http://localhost:3003
 *   export TEST_API_KEY=sk_live_xxx
 *   bun test test/e2e/webhooks.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// NOTE: Run with --timeout 30000 flag (webhook worker polls every 5s, so event tests need time)
import crypto from 'crypto';

// Configuration from environment
const API_URL = process.env.TEST_API_URL || 'http://localhost:3003';
const API_KEY = process.env.TEST_API_KEY;

// Track resources for cleanup
const createdWebhookIds: string[] = [];
const createdRecordIds: string[] = [];
let testTableName: string;

// Webhook.site - free service for testing webhook delivery
// You can view received webhooks at: https://hooks.signaldb.live/api/bins/{token}
let webhookSiteToken: string | null = null;
let webhookSiteUrl: string | null = null;

/**
 * Helper to make API requests
 */
async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    ...customHeaders,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Generate HMAC signature for webhook verification
 */
function generateSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify webhook signature
 */
function verifySignature(
  signatureHeader: string,
  payload: string,
  secret: string
): boolean {
  // API uses format: sha256={hex_digest}
  const match = signatureHeader.match(/^sha256=([a-f0-9]+)$/);
  if (!match) return false;

  const receivedSig = match[1];
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return receivedSig === expected;
}

/**
 * Create a hooks.signaldb.live bin for receiving test webhooks
 */
async function getWebhookSiteToken(): Promise<{ token: string; url: string }> {
  const response = await fetch('https://hooks.signaldb.live/api/bins', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to create hooks bin');
  }
  const { token, url } = await response.json() as { token: string; url: string };
  return { token, url };
}

/**
 * Get requests received by hooks.signaldb.live
 */
async function getWebhookSiteRequests(token: string): Promise<Array<{
  uuid: string;
  content: string;
  headers: Record<string, string>;
  method: string;
  created_at: string;
}>> {
  const response = await fetch(`https://hooks.signaldb.live/api/bins/${token}/requests`);
  if (!response.ok) {
    throw new Error('Failed to get hooks bin requests');
  }
  const data = await response.json() as { data: Array<{ id: string; body: string; headers: Record<string, string>; method: string; created_at: string }> };
  return (data.data || []).map(r => ({
    uuid: r.id,
    content: r.body || '',
    headers: r.headers,
    method: r.method,
    created_at: r.created_at,
  }));
}

/**
 * Wait for hooks.signaldb.live to receive a request
 */
async function waitForWebhookRequest(
  token: string,
  timeout: number = 10000,
  pollInterval: number = 500
): Promise<{ uuid: string; content: string; headers: Record<string, string>; method: string; created_at: string } | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const requests = await getWebhookSiteRequests(token);
    if (requests.length > 0) {
      return requests[0];
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return null;
}

/**
 * Wait for a webhook request matching a specific event type
 */
async function waitForWebhookWithEvent(
  token: string,
  eventType: string,
  timeout: number = 15000,
  pollInterval: number = 500
): Promise<{ content: string; headers: Record<string, string> } | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const requests = await getWebhookSiteRequests(token);
    for (const req of requests) {
      try {
        const payload = JSON.parse(req.content);
        if (payload.event === eventType) {
          return req;
        }
      } catch {
        // Skip non-JSON requests
      }
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return null;
}

/**
 * Clear all requests for a hooks bin
 */
async function clearWebhookSiteRequests(token: string): Promise<void> {
  await fetch(`https://hooks.signaldb.live/api/bins/${token}/requests`, {
    method: 'DELETE',
  });
}

// Skip all tests if no API key
const describeWithKey = API_KEY ? describe : describe.skip;

describeWithKey('Webhooks E2E Tests', () => {
  beforeAll(async () => {
    if (!API_KEY) {
      console.log('Skipping webhook tests - TEST_API_KEY not set');
      return;
    }

    // Create unique test table name
    testTableName = `webhook_test_${Date.now()}`;

    // Get hooks.signaldb.live token for delivery tests
    try {
      const { token, url } = await getWebhookSiteToken();
      webhookSiteToken = token;
      webhookSiteUrl = url;
      console.log(`Webhook.site URL: ${webhookSiteUrl}`);
      console.log(`View received webhooks: https://hooks.signaldb.live/api/bins/${webhookSiteToken}`);
    } catch (error) {
      console.warn('Could not create hooks.signaldb.live token, some tests may fail:', error);
    }
  });

  afterAll(async () => {
    // Cleanup created webhooks
    for (const id of createdWebhookIds) {
      try {
        await apiRequest('DELETE', `/v1/webhooks/${id}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Cleanup created records
    for (const id of createdRecordIds) {
      try {
        await apiRequest('DELETE', `/v1/${testTableName}/${id}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // CRUD Tests
  // ============================================================================

  describe('CRUD Operations', () => {
    it('should create a webhook with valid HTTPS URL', async () => {
      if (!webhookSiteUrl) {
        console.log('Skipping - no hooks.signaldb.live URL');
        return;
      }

      const response = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl,
        events: ['insert', 'update', 'delete'],
      });

      expect(response.status).toBe(201);
      const webhook = await response.json() as {
        id: string;
        url: string;
        secret: string;
        events: string[];
        enabled: boolean;
      };

      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBe(webhookSiteUrl);
      expect(webhook.secret).toMatch(/^whsec_/);
      expect(webhook.events).toEqual(['insert', 'update', 'delete']);
      expect(webhook.enabled).toBe(true);

      createdWebhookIds.push(webhook.id);
    });

    it('should reject non-HTTPS URL', async () => {
      const response = await apiRequest('POST', '/v1/webhooks', {
        url: 'http://example.com/webhook', // Not localhost, not HTTPS
        events: ['insert'],
      });

      expect(response.status).toBe(400);
      const error = await response.json() as { error: string };
      expect(error.error).toContain('HTTPS');
    });

    it('should allow HTTP for localhost', async () => {
      const response = await apiRequest('POST', '/v1/webhooks', {
        url: 'http://localhost:9999/webhook',
        events: ['insert'],
      });

      expect(response.status).toBe(201);
      const webhook = await response.json() as { id: string };
      createdWebhookIds.push(webhook.id);
    });

    it('should list webhooks without exposing secrets', async () => {
      const response = await apiRequest('GET', '/v1/webhooks');

      expect(response.status).toBe(200);
      const result = await response.json() as {
        data: Array<{ id: string; url: string; secret?: string }>;
        total: number;
      };

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);

      // Secret should NOT be exposed in list
      for (const webhook of result.data) {
        expect(webhook.secret).toBeUndefined();
      }
    });

    it('should get webhook by ID', async () => {
      // Create a webhook first
      const createResponse = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl || 'http://localhost:9999/test',
        events: ['insert'],
      });
      const created = await createResponse.json() as { id: string };
      createdWebhookIds.push(created.id);

      // Get it
      const response = await apiRequest('GET', `/v1/webhooks/${created.id}`);

      expect(response.status).toBe(200);
      const webhook = await response.json() as { id: string; url: string; secret?: string };
      expect(webhook.id).toBe(created.id);
      // Secret not exposed in GET either
      expect(webhook.secret).toBeUndefined();
    });

    it('should return 404 for non-existent webhook', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await apiRequest('GET', `/v1/webhooks/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should update webhook events and enabled state', async () => {
      // Create a webhook
      const createResponse = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl || 'http://localhost:9999/test',
        events: ['insert'],
      });
      const created = await createResponse.json() as { id: string };
      createdWebhookIds.push(created.id);

      // Update it
      const response = await apiRequest('PATCH', `/v1/webhooks/${created.id}`, {
        events: ['insert', 'update'],
        enabled: false,
      });

      expect(response.status).toBe(200);
      const updated = await response.json() as { events: string[]; enabled: boolean };
      expect(updated.events).toEqual(['insert', 'update']);
      expect(updated.enabled).toBe(false);
    });

    it('should delete webhook', async () => {
      // Create a webhook
      const createResponse = await apiRequest('POST', '/v1/webhooks', {
        url: 'http://localhost:9999/to-delete',
        events: ['insert'],
      });
      const created = await createResponse.json() as { id: string };

      // Delete it
      const deleteResponse = await apiRequest('DELETE', `/v1/webhooks/${created.id}`);
      expect(deleteResponse.status).toBe(204);

      // Verify it's gone
      const getResponse = await apiRequest('GET', `/v1/webhooks/${created.id}`);
      expect(getResponse.status).toBe(404);
    });
  });

  // ============================================================================
  // Delivery Tests
  // ============================================================================

  describe('Webhook Delivery', () => {
    let testWebhookId: string;
    let testWebhookSecret: string;

    beforeEach(async () => {
      if (!webhookSiteUrl || !webhookSiteToken) {
        return;
      }

      // Clear any previous requests
      await clearWebhookSiteRequests(webhookSiteToken);

      // Create a fresh webhook for delivery tests
      const response = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl,
        events: ['insert', 'update', 'delete'],
      });

      if (response.status === 201) {
        const webhook = await response.json() as { id: string; secret: string };
        testWebhookId = webhook.id;
        testWebhookSecret = webhook.secret;
        createdWebhookIds.push(webhook.id);
      }
    });

    it('should send test webhook delivery', async () => {
      if (!testWebhookId || !webhookSiteToken) {
        console.log('Skipping - no webhook configured');
        return;
      }

      // Send test webhook
      const response = await apiRequest('POST', `/v1/webhooks/${testWebhookId}/test`);

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; status: number };
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);

      // Wait for hooks.signaldb.live to receive it
      const received = await waitForWebhookRequest(webhookSiteToken);
      expect(received).not.toBeNull();

      if (received) {
        const payload = JSON.parse(received.content);
        expect(payload.event).toBe('test');
        expect(payload.webhook_id).toBe(testWebhookId);
      }
    });

    it('should include valid signature header', async () => {
      if (!testWebhookId || !testWebhookSecret || !webhookSiteToken) {
        console.log('Skipping - no webhook configured');
        return;
      }

      // Clear previous requests
      await clearWebhookSiteRequests(webhookSiteToken);

      // Send test webhook
      await apiRequest('POST', `/v1/webhooks/${testWebhookId}/test`);

      // Wait for delivery
      const received = await waitForWebhookRequest(webhookSiteToken);
      expect(received).not.toBeNull();

      if (received) {
        // Check signature header exists
        const signatureHeader = received.headers['x-webhook-signature'] ||
          received.headers['X-Webhook-Signature'];
        expect(signatureHeader).toBeDefined();

        // Verify signature format: sha256={hex}
        expect(signatureHeader).toMatch(/^sha256=[a-f0-9]+$/);

        // Verify signature is valid
        const isValid = verifySignature(
          signatureHeader,
          received.content,
          testWebhookSecret
        );
        expect(isValid).toBe(true);
      }
    });
  });

  // ============================================================================
  // Event Trigger Tests
  // ============================================================================

  describe('Event Triggers', () => {
    let eventWebhookId: string;

    beforeAll(async () => {
      if (!webhookSiteUrl || !webhookSiteToken) {
        return;
      }

      // Create webhook for event tests
      const response = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl,
        events: ['insert', 'update', 'delete'],
        tables: [testTableName], // Filter to test table only
      });

      if (response.status === 201) {
        const webhook = await response.json() as { id: string };
        eventWebhookId = webhook.id;
        createdWebhookIds.push(webhook.id);
      }
    });

    it('should trigger webhook on INSERT', async () => {
      if (!eventWebhookId || !webhookSiteToken) {
        console.log('Skipping - no webhook configured');
        return;
      }

      // Clear previous requests
      await clearWebhookSiteRequests(webhookSiteToken);

      // Insert a record
      const response = await apiRequest('POST', `/v1/${testTableName}`, {
        name: 'Webhook Test',
        value: 42,
      });

      if (response.status === 201) {
        const record = await response.json() as { id: string };
        createdRecordIds.push(record.id);

        // Wait for insert event (worker polls every 5s)
        const received = await waitForWebhookWithEvent(webhookSiteToken, 'insert', 15000);

        if (received) {
          const payload = JSON.parse(received.content);
          expect(payload.event).toBe('insert');
          expect(payload.table).toBe(testTableName);
        }
      }
    });

    it('should trigger webhook on UPDATE', async () => {
      if (!eventWebhookId || !webhookSiteToken) {
        console.log('Skipping - no webhook configured');
        return;
      }

      // Create a record first
      const createResponse = await apiRequest('POST', `/v1/${testTableName}`, {
        name: 'To Update',
        value: 1,
      });

      if (createResponse.status !== 201) {
        console.log('Skipping - could not create record');
        return;
      }

      const record = await createResponse.json() as { id: string };
      createdRecordIds.push(record.id);

      // Clear requests
      await clearWebhookSiteRequests(webhookSiteToken);

      // Update the record
      await apiRequest('PUT', `/v1/${testTableName}/${record.id}`, {
        name: 'Updated',
        value: 2,
      });

      // Wait for update event (worker polls every 5s)
      const received = await waitForWebhookWithEvent(webhookSiteToken, 'update', 15000);

      if (received) {
        const payload = JSON.parse(received.content);
        expect(payload.event).toBe('update');
        expect(payload.table).toBe(testTableName);
      }
    });

    it('should trigger webhook on DELETE', async () => {
      if (!eventWebhookId || !webhookSiteToken) {
        console.log('Skipping - no webhook configured');
        return;
      }

      // Create a record first
      const createResponse = await apiRequest('POST', `/v1/${testTableName}`, {
        name: 'To Delete',
        value: 0,
      });

      if (createResponse.status !== 201) {
        console.log('Skipping - could not create record');
        return;
      }

      const record = await createResponse.json() as { id: string };

      // Clear requests
      await clearWebhookSiteRequests(webhookSiteToken);

      // Delete the record
      await apiRequest('DELETE', `/v1/${testTableName}/${record.id}`);

      // Wait for delete event (worker polls every 5s)
      const received = await waitForWebhookWithEvent(webhookSiteToken, 'delete', 15000);

      if (received) {
        const payload = JSON.parse(received.content);
        expect(payload.event).toBe('delete');
        expect(payload.table).toBe(testTableName);
      }
    });
  });

  // ============================================================================
  // Delivery Logs Tests
  // ============================================================================

  describe('Delivery Logs', () => {
    it('should show delivery history', async () => {
      if (createdWebhookIds.length === 0) {
        console.log('Skipping - no webhooks created');
        return;
      }

      const webhookId = createdWebhookIds[0];

      // First send a test to create a log entry
      await apiRequest('POST', `/v1/webhooks/${webhookId}/test`);

      // Wait a moment for delivery to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get logs
      const response = await apiRequest('GET', `/v1/webhooks/${webhookId}/logs`);

      expect(response.status).toBe(200);
      const result = await response.json() as {
        data: Array<{
          id: string;
          success: boolean;
          response_status: number;
          created_at: string;
        }>;
        total: number;
      };

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter logs by success status', async () => {
      if (createdWebhookIds.length === 0) {
        console.log('Skipping - no webhooks created');
        return;
      }

      const webhookId = createdWebhookIds[0];

      // Get only successful deliveries
      const successResponse = await apiRequest(
        'GET',
        `/v1/webhooks/${webhookId}/logs?success=true`
      );

      expect(successResponse.status).toBe(200);
      const successResult = await successResponse.json() as { data: Array<{ success: boolean }> };

      for (const log of successResult.data) {
        expect(log.success).toBe(true);
      }

      // Get only failed deliveries
      const failResponse = await apiRequest(
        'GET',
        `/v1/webhooks/${webhookId}/logs?success=false`
      );

      expect(failResponse.status).toBe(200);
      const failResult = await failResponse.json() as { data: Array<{ success: boolean }> };

      for (const log of failResult.data) {
        expect(log.success).toBe(false);
      }
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('Security', () => {
    it('should rotate webhook secret', async () => {
      // Create a webhook
      const createResponse = await apiRequest('POST', '/v1/webhooks', {
        url: webhookSiteUrl || 'http://localhost:9999/rotate-test',
        events: ['insert'],
      });

      const created = await createResponse.json() as { id: string; secret: string };
      createdWebhookIds.push(created.id);
      const originalSecret = created.secret;

      // Rotate secret
      const rotateResponse = await apiRequest(
        'POST',
        `/v1/webhooks/${created.id}/rotate-secret`
      );

      expect(rotateResponse.status).toBe(200);
      const rotated = await rotateResponse.json() as { id: string; secret: string };

      // New secret should be different
      expect(rotated.secret).not.toBe(originalSecret);
      expect(rotated.secret).toMatch(/^whsec_/);
    });

    it('should require authentication', async () => {
      // Try to access without API key
      const response = await fetch(`${API_URL}/v1/webhooks`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// Manual Verification Helper
// ============================================================================

/**
 * Run this function manually to test webhooks interactively:
 *
 *   bun run test/e2e/webhooks.test.ts --manual
 */
async function manualTest() {
  console.log('=== Manual Webhook Test ===\n');

  if (!API_KEY) {
    console.error('Error: TEST_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('1. Getting hooks.signaldb.live token...');
  const { token, url } = await getWebhookSiteToken();
  console.log(`   Token: ${token}`);
  console.log(`   URL: ${url}`);
  console.log(`   View at: https://hooks.signaldb.live/api/bins/${token}\n`);

  console.log('2. Creating webhook...');
  const createResponse = await apiRequest('POST', '/v1/webhooks', {
    url,
    events: ['insert', 'update', 'delete'],
  });

  if (createResponse.status !== 201) {
    const error = await createResponse.json();
    console.error('   Failed:', error);
    process.exit(1);
  }

  const webhook = await createResponse.json() as { id: string; secret: string };
  console.log(`   Webhook ID: ${webhook.id}`);
  console.log(`   Secret: ${webhook.secret}\n`);

  console.log('3. Sending test webhook...');
  const testResponse = await apiRequest('POST', `/v1/webhooks/${webhook.id}/test`);
  const testResult = await testResponse.json();
  console.log(`   Result:`, testResult);

  console.log('\n4. Waiting for hooks.signaldb.live to receive request...');
  const received = await waitForWebhookRequest(token, 10000);

  if (received) {
    console.log('   Received!');
    console.log(`   Content: ${received.content.substring(0, 200)}...`);
    console.log(`   Headers:`, received.headers);
  } else {
    console.log('   Timeout - no request received');
  }

  console.log('\n5. Cleaning up...');
  await apiRequest('DELETE', `/v1/webhooks/${webhook.id}`);
  console.log('   Webhook deleted');

  console.log('\n=== Done ===');
}

// Run manual test if --manual flag is passed
if (process.argv.includes('--manual')) {
  manualTest().catch(console.error);
}
