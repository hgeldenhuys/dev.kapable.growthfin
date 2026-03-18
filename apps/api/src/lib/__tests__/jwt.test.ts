/**
 * JWT Utilities Unit Tests
 */

import { describe, test, expect } from 'bun:test';
import { generateJti, signToken, verifyToken, decodeToken, extractProjectId } from '../jwt';

describe('generateJti', () => {
  test('returns unique IDs with tok_ prefix', () => {
    const jti1 = generateJti();
    const jti2 = generateJti();

    expect(jti1).toStartWith('tok_');
    expect(jti2).toStartWith('tok_');
    expect(jti1).not.toBe(jti2);
    // tok_ + 24 chars from nanoid = 28 chars
    expect(jti1.length).toBe(28);
  });
});

describe('signToken', () => {
  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const secret = 'test-secret-key-at-least-32-chars-long';

  test('creates valid JWT with correct claims', async () => {
    const payload = {
      sub: 'user123',
      scopes: { role: 'admin' },
      expires_in: 3600,
    };

    const result = await signToken(projectId, secret, payload);

    expect(result.token).toBeString();
    expect(result.jti).toStartWith('tok_');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify the token can be decoded
    const decoded = decodeToken(result.token);
    expect(decoded).not.toBeNull();
    expect(decoded!.pid).toBe(projectId);
    expect(decoded!.sub).toBe('user123');
    expect(decoded!.scopes).toEqual({ role: 'admin' });
    expect(decoded!.iss).toBe('signaldb');
  });

  test('respects expiry limits (max 30 days)', async () => {
    const payload = {
      expires_in: 60 * 24 * 60 * 60, // 60 days in seconds
    };

    const result = await signToken(projectId, secret, payload);

    // Should cap at 30 days
    const maxExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry + 1000); // 1s tolerance
  });

  test('uses default expiry of 24 hours when not specified', async () => {
    const payload = {};

    const result = await signToken(projectId, secret, payload);

    const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
    // Allow 5 second tolerance
    expect(Math.abs(result.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
  });
});

describe('verifyToken', () => {
  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const secret = 'test-secret-key-at-least-32-chars-long';

  test('returns claims for valid tokens', async () => {
    const payload = { sub: 'user123', scopes: { role: 'user' } };
    const { token } = await signToken(projectId, secret, payload);

    const claims = await verifyToken(token, secret);

    expect(claims).not.toBeNull();
    expect(claims!.pid).toBe(projectId);
    expect(claims!.sub).toBe('user123');
    expect(claims!.scopes).toEqual({ role: 'user' });
    expect(claims!.iss).toBe('signaldb');
    expect(claims!.jti).toStartWith('tok_');
  });

  test('returns null for invalid signature', async () => {
    const payload = { sub: 'user123' };
    const { token } = await signToken(projectId, secret, payload);

    const claims = await verifyToken(token, 'wrong-secret-key-at-least-32-chars');

    expect(claims).toBeNull();
  });

  test('returns null for expired tokens', async () => {
    const payload = { expires_in: -1 }; // Already expired
    const { token } = await signToken(projectId, secret, payload);

    // Token is created with expiry in the past
    const claims = await verifyToken(token, secret);

    expect(claims).toBeNull();
  });

  test('returns null for wrong issuer', async () => {
    // Create a token manually with wrong issuer
    const { SignJWT } = await import('jose');
    const secretKey = new TextEncoder().encode(secret);

    const token = await new SignJWT({
      iss: 'wrong-issuer',
      pid: projectId,
      jti: 'tok_test123',
      scopes: {},
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    const claims = await verifyToken(token, secret);

    expect(claims).toBeNull();
  });

  test('returns null for malformed tokens', async () => {
    const claims = await verifyToken('not.a.valid.token', secret);
    expect(claims).toBeNull();
  });
});

describe('decodeToken', () => {
  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const secret = 'test-secret-key-at-least-32-chars-long';

  test('decodes token without verification', async () => {
    const payload = { sub: 'user123', scopes: { team: 'engineering' } };
    const { token } = await signToken(projectId, secret, payload);

    // Should decode even with wrong secret (no verification)
    const decoded = decodeToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.pid).toBe(projectId);
    expect(decoded!.sub).toBe('user123');
    expect(decoded!.scopes).toEqual({ team: 'engineering' });
  });

  test('returns null for malformed tokens', () => {
    const decoded = decodeToken('completely.invalid');
    expect(decoded).toBeNull();
  });

  test('returns null for non-JWT strings', () => {
    const decoded = decodeToken('not-a-jwt');
    expect(decoded).toBeNull();
  });
});

describe('extractProjectId', () => {
  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const secret = 'test-secret-key-at-least-32-chars-long';

  test('extracts pid from token', async () => {
    const { token } = await signToken(projectId, secret, {});

    const extractedPid = extractProjectId(token);

    expect(extractedPid).toBe(projectId);
  });

  test('returns null for tokens without pid', () => {
    // Manually encode a token without pid
    const fakePayload = { iss: 'signaldb', jti: 'test' };
    const encoded = btoa(JSON.stringify({ alg: 'HS256' })) + '.' +
      btoa(JSON.stringify(fakePayload)) + '.fakesig';

    const extractedPid = extractProjectId(encoded);

    expect(extractedPid).toBeNull();
  });

  test('returns null for malformed tokens', () => {
    const extractedPid = extractProjectId('invalid');
    expect(extractedPid).toBeNull();
  });
});
