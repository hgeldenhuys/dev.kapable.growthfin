#!/usr/bin/env bun
/**
 * Manual Webhook Test Script
 *
 * Tests webhook delivery using hooks.signaldb.live to verify webhooks are working.
 *
 * Usage:
 *   TEST_API_KEY=sk_live_xxx bun test/e2e/webhook-manual.ts
 */

import crypto from 'crypto';

const API_URL = process.env.TEST_API_URL || 'https://api.signaldb.live';
const API_KEY = process.env.TEST_API_KEY;

async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
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

async function getWebhookSiteToken(): Promise<{ token: string; url: string }> {
  const response = await fetch('https://hooks.signaldb.live/api/bins', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to create hooks bin: ${response.status}`);
  }
  const { token, url } = await response.json() as { token: string; url: string };
  return { token, url };
}

async function getWebhookSiteRequests(token: string): Promise<Array<{
  uuid: string;
  content: string;
  headers: Record<string, string>;
}>> {
  const response = await fetch(`https://hooks.signaldb.live/api/bins/${token}/requests`);
  if (!response.ok) {
    throw new Error('Failed to get hooks bin requests');
  }
  const data = await response.json() as { data: Array<{ id: string; body: string; headers: Record<string, string> }> };
  return (data.data || []).map(r => ({
    uuid: r.id,
    content: r.body || '',
    headers: r.headers,
  }));
}

async function waitForWebhookRequest(
  token: string,
  timeout: number = 15000
): Promise<{ content: string; headers: Record<string, string> } | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const requests = await getWebhookSiteRequests(token);
    if (requests.length > 0) {
      return requests[0];
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  return null;
}

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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SignalDB Webhook Manual Test                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!API_KEY) {
    console.error('❌ Error: TEST_API_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  TEST_API_KEY=sk_live_xxx bun test/e2e/webhook-manual.ts');
    process.exit(1);
  }

  console.log(`📡 API URL: ${API_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 12)}...`);
  console.log('');

  // Step 1: Get hooks.signaldb.live token
  console.log('1️⃣  Getting hooks.signaldb.live token...');
  let token: string, url: string;
  try {
    ({ token, url } = await getWebhookSiteToken());
    console.log(`   ✓ Token: ${token}`);
    console.log(`   ✓ URL: ${url}`);
    console.log(`   📋 View received webhooks: https://hooks.signaldb.live/api/bins/${token}/requests`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error}`);
    process.exit(1);
  }
  console.log('');

  // Step 2: Create webhook
  console.log('2️⃣  Creating webhook in SignalDB...');
  const createResponse = await apiRequest('POST', '/v1/webhooks', {
    url,
    events: ['insert', 'update', 'delete'],
  });

  if (createResponse.status !== 201) {
    const error = await createResponse.json();
    console.error(`   ❌ Failed (${createResponse.status}):`, error);
    process.exit(1);
  }

  const webhook = await createResponse.json() as { id: string; secret: string };
  console.log(`   ✓ Webhook ID: ${webhook.id}`);
  console.log(`   ✓ Secret: ${webhook.secret}`);
  console.log('');

  // Step 3: Send test webhook
  console.log('3️⃣  Sending test webhook...');
  const testResponse = await apiRequest('POST', `/v1/webhooks/${webhook.id}/test`);
  const testResult = await testResponse.json() as { success: boolean; status: number };

  if (testResult.success) {
    console.log(`   ✓ Test sent successfully (status: ${testResult.status})`);
  } else {
    console.log(`   ⚠️  Test may have failed:`, testResult);
  }
  console.log('');

  // Step 4: Wait for delivery
  console.log('4️⃣  Waiting for hooks.signaldb.live to receive request');
  process.stdout.write('   ');
  const received = await waitForWebhookRequest(token, 15000);
  console.log('');

  if (received) {
    console.log('   ✓ Webhook received!');

    // Parse and display content
    try {
      const payload = JSON.parse(received.content);
      console.log('   📦 Payload:', JSON.stringify(payload, null, 2).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n'));
    } catch {
      console.log(`   📦 Raw content: ${received.content.substring(0, 200)}`);
    }

    // Verify signature
    const sigHeader = received.headers['x-signaldb-signature'] ||
                      received.headers['X-SignalDB-Signature'] ||
                      received.headers['x-webhook-signature'] ||
                      received.headers['X-Webhook-Signature'];

    if (sigHeader) {
      console.log(`   🔐 Signature header: ${sigHeader}`);
      const isValid = verifySignature(sigHeader, received.content, webhook.secret);
      console.log(`   ${isValid ? '✓' : '❌'} Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
    } else {
      console.log('   ⚠️  No signature header found');
      console.log('   Available headers:', Object.keys(received.headers).join(', '));
    }
  } else {
    console.log('   ❌ Timeout - no webhook received');
  }
  console.log('');

  // Step 5: Cleanup
  console.log('5️⃣  Cleaning up...');
  await apiRequest('DELETE', `/v1/webhooks/${webhook.id}`);
  console.log('   ✓ Webhook deleted');
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(received ? '✅ Test PASSED - Webhook delivery working!' : '❌ Test FAILED - No webhook received');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
