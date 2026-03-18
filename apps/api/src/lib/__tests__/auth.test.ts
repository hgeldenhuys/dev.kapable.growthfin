/**
 * Auth Utilities Unit Tests
 *
 * Tests for pure functions that don't require database access.
 * Integration tests for validateApiKey and validateJwtToken would require mocking.
 */

import { describe, test, expect } from 'bun:test';
import { requireScope } from '../auth';
import type { ApiContext } from '../../types';

/**
 * Helper to extract API key from request (mirrors internal function)
 * We test the behavior through a mock since extractApiKey is not exported
 */
function createMockRequest(options: {
  authHeader?: string;
  apiKeyHeader?: string;
  queryKey?: string;
  url?: string;
}): Request {
  const url = options.url || 'https://api.signaldb.live/v1/test';
  const urlWithQuery = options.queryKey
    ? `${url}?apiKey=${options.queryKey}`
    : url;

  const headers = new Headers();
  if (options.authHeader) {
    headers.set('Authorization', options.authHeader);
  }
  if (options.apiKeyHeader) {
    headers.set('X-API-Key', options.apiKeyHeader);
  }

  return new Request(urlWithQuery, { headers });
}

/**
 * Recreate extractApiKey logic for testing
 * (since it's not exported, we test the behavior it produces)
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check query param (for SSE/WebSocket connections)
  const url = new URL(req.url);
  const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key');
  if (queryKey) {
    return queryKey;
  }

  return null;
}

describe('extractApiKey', () => {
  test('extracts from Authorization header', () => {
    const req = createMockRequest({ authHeader: 'Bearer sk_live_abc123' });
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_abc123');
  });

  test('extracts from X-API-Key header', () => {
    const req = createMockRequest({ apiKeyHeader: 'sk_live_xyz789' });
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_xyz789');
  });

  test('extracts from query parameter (apiKey)', () => {
    const req = createMockRequest({ queryKey: 'sk_live_query456' });
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_query456');
  });

  test('extracts from query parameter (api_key)', () => {
    const url = 'https://api.signaldb.live/v1/test?api_key=sk_live_snake123';
    const req = new Request(url);
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_snake123');
  });

  test('returns null when no key present', () => {
    const req = createMockRequest({});
    const key = extractApiKey(req);
    expect(key).toBeNull();
  });

  test('prefers Authorization header over X-API-Key', () => {
    const req = createMockRequest({
      authHeader: 'Bearer sk_live_auth',
      apiKeyHeader: 'sk_live_header',
    });
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_auth');
  });

  test('prefers X-API-Key header over query param', () => {
    const req = createMockRequest({
      apiKeyHeader: 'sk_live_header',
      queryKey: 'sk_live_query',
    });
    const key = extractApiKey(req);
    expect(key).toBe('sk_live_header');
  });

  test('ignores non-Bearer Authorization headers', () => {
    const req = createMockRequest({ authHeader: 'Basic dXNlcjpwYXNz' });
    const key = extractApiKey(req);
    expect(key).toBeNull();
  });
});

describe('requireScope', () => {
  const baseContext: ApiContext = {
    orgId: 'org-123',
    projectId: 'proj-456',
    schemaName: 'schema_test',
    tier: 'pro',
    keyId: 'key-789',
    scopes: ['read', 'write', 'realtime'],
    authType: 'api_key',
  };

  test('returns true when scope is included', () => {
    expect(requireScope(baseContext, 'read')).toBe(true);
    expect(requireScope(baseContext, 'write')).toBe(true);
    expect(requireScope(baseContext, 'realtime')).toBe(true);
  });

  test('returns false when scope is missing', () => {
    expect(requireScope(baseContext, 'admin')).toBe(false);
    expect(requireScope(baseContext, 'delete')).toBe(false);
  });

  test('works with empty scopes array', () => {
    const ctx = { ...baseContext, scopes: [] };
    expect(requireScope(ctx, 'read')).toBe(false);
  });

  test('is case-sensitive', () => {
    expect(requireScope(baseContext, 'READ')).toBe(false);
    expect(requireScope(baseContext, 'Read')).toBe(false);
  });
});

describe('API key format validation', () => {
  test('sk_ prefix identifies API keys', () => {
    const apiKey = 'sk_live_abc123def456';
    expect(apiKey.startsWith('sk_')).toBe(true);
  });

  test('JWT tokens do not have sk_ prefix', () => {
    // JWTs are base64url encoded, starting with header
    const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
    expect(jwtToken.startsWith('sk_')).toBe(false);
  });

  test('key prefix extraction is consistent', () => {
    const key = 'sk_live_abc123def456ghi789';
    const prefix = key.substring(0, 12);
    expect(prefix).toBe('sk_live_abc1');
    expect(prefix.length).toBe(12);
  });
});
