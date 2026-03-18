/**
 * SignalDB Client Tests
 */

import { describe, it, expect, beforeAll, mock } from 'bun:test';
import { SignalDBClient } from '../src/client';
import { parseToken, isTokenExpired, getTokenTimeRemaining } from '../src/auth';

describe('SignalDBClient', () => {
  describe('constructor', () => {
    it('should throw if apiKey is not provided', () => {
      expect(() => new SignalDBClient({} as { apiKey: string })).toThrow('apiKey is required');
    });

    it('should create client with default options', () => {
      const client = new SignalDBClient({ apiKey: 'sk_live_test' });
      expect(client).toBeInstanceOf(SignalDBClient);
    });

    it('should accept custom baseUrl', () => {
      const client = new SignalDBClient({
        apiKey: 'sk_live_test',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeInstanceOf(SignalDBClient);
    });
  });

  describe('from()', () => {
    it('should return a Table instance', () => {
      const client = new SignalDBClient({ apiKey: 'sk_live_test' });
      const table = client.from('users');
      expect(table).toBeDefined();
    });
  });
});

describe('Table', () => {
  let client: SignalDBClient;
  let mockFetch: ReturnType<typeof mock>;

  beforeAll(() => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], total: 0, limit: 100, offset: 0 }),
      })
    );

    client = new SignalDBClient({
      apiKey: 'sk_live_test',
      baseUrl: 'https://api.test.com',
      fetch: mockFetch as unknown as typeof fetch,
    });
  });

  describe('chaining', () => {
    it('should support method chaining', () => {
      const table = client
        .from('users')
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .limit(10)
        .offset(20);

      expect(table).toBeDefined();
    });

    it('should support operator syntax', () => {
      const table = client
        .from('users')
        .where('value', 'gt', 1000)
        .where('status', 'in', 'active,pending');

      expect(table).toBeDefined();
    });
  });

  describe('select()', () => {
    it('should make GET request', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [{ id: '1', name: 'Test' }], total: 1, limit: 100, offset: 0 }),
        })
      );

      const users = await client.from('users').select();
      expect(users).toEqual([{ id: '1', name: 'Test' }]);
    });
  });
});

describe('Auth utilities', () => {
  // Create a test JWT (header.payload.signature)
  const createTestJwt = (payload: object, exp?: number): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadWithExp = { ...payload, exp: exp ?? Math.floor(Date.now() / 1000) + 3600 };
    const encodedPayload = btoa(JSON.stringify(payloadWithExp));
    const signature = btoa('test-signature');
    return `${header}.${encodedPayload}.${signature}`;
  };

  describe('parseToken()', () => {
    it('should parse a valid JWT', () => {
      const token = createTestJwt({ sub: 'user-123', pid: 'project-456' });
      const parsed = parseToken(token);

      expect(parsed).toBeDefined();
      expect(parsed?.payload.sub).toBe('user-123');
      expect(parsed?.payload.pid).toBe('project-456');
    });

    it('should return null for invalid token', () => {
      expect(parseToken('invalid')).toBeNull();
      expect(parseToken('a.b')).toBeNull();
      expect(parseToken('')).toBeNull();
    });
  });

  describe('isTokenExpired()', () => {
    it('should return false for valid token', () => {
      const token = createTestJwt({}, Math.floor(Date.now() / 1000) + 3600);
      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      const token = createTestJwt({}, Math.floor(Date.now() / 1000) - 100);
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid')).toBe(true);
    });
  });

  describe('getTokenTimeRemaining()', () => {
    it('should return remaining seconds', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = createTestJwt({}, exp);
      const remaining = getTokenTimeRemaining(token);

      expect(remaining).toBeGreaterThan(3500);
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired token', () => {
      const token = createTestJwt({}, Math.floor(Date.now() / 1000) - 100);
      expect(getTokenTimeRemaining(token)).toBe(0);
    });
  });
});
