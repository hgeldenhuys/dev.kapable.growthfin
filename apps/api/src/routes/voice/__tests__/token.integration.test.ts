/**
 * Integration Tests: Voice Token Endpoint (VOICE-001)
 * Tests for GET /api/v1/voice/token - Twilio capability token generation
 *
 * This test suite validates:
 * - AC-001: Capability token endpoint returns valid token with 1-hour expiry
 *
 * Environment Requirements:
 * - TWILIO_ACCOUNT_SID: Twilio account identifier
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_TWIML_APP_SID: TwiML Application SID for browser calling
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { config } from 'dotenv';
// Load .env config for test environment
config();

// Import the voice token routes
import { voiceTokenRoutes } from '../index';

// Test configuration
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230';
const TEST_USER_ID = 'test-user-001';

// Check if required environment variables are present
function checkTwilioConfig(): { configured: boolean; missing: string[] } {
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_TWIML_APP_SID'];
  const missing = required.filter((key) => !process.env[key]);
  return {
    configured: missing.length === 0,
    missing,
  };
}

describe('Voice Token API (VOICE-001)', () => {
  let app: Elysia;
  const twilioConfig = checkTwilioConfig();

  beforeAll(() => {
    // Create Elysia app with voice routes mounted under /api/v1
    app = new Elysia().group('/api/v1', (app) => app.use(voiceTokenRoutes));

    if (!twilioConfig.configured) {
      console.log(
        `\n[SKIP] Twilio environment variables not configured. Missing: ${twilioConfig.missing.join(', ')}`
      );
      console.log('Set these in .env to run voice token integration tests:\n');
      console.log('  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      console.log('  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      console.log('  TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n');
    }
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('GET /api/v1/voice/token', () => {
    it('should return valid token with workspaceId', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const response = await app.handle(
        new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('identity');
      expect(data).toHaveProperty('expiresAt');

      // Verify types
      expect(typeof data.token).toBe('string');
      expect(typeof data.identity).toBe('string');
      expect(typeof data.expiresAt).toBe('string');

      // Token should be non-empty (JWT format)
      expect(data.token.length).toBeGreaterThan(0);
      expect(data.token.split('.').length).toBe(3); // JWT has 3 parts separated by dots
    });

    it('should return 400/422 for missing workspaceId', async () => {
      // This test doesn't require Twilio config - it tests Elysia validation
      const response = await app.handle(new Request('http://localhost/api/v1/voice/token'));

      // Elysia validation returns 422 for validation errors (Unprocessable Entity)
      // or 400 depending on Elysia version
      expect([400, 422]).toContain(response.status);
    });

    it('should have token expiry approximately 1 hour from now', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const beforeRequest = Date.now();

      const response = await app.handle(
        new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      const expiresAt = new Date(data.expiresAt).getTime();
      const afterRequest = Date.now();

      // Expected expiry: 1 hour (3600 seconds = 3,600,000 ms)
      const oneHourMs = 3600 * 1000;
      const toleranceMs = 5 * 60 * 1000; // 5 minute tolerance

      // Check that expiresAt is approximately 1 hour from now
      const minExpiry = beforeRequest + oneHourMs - toleranceMs;
      const maxExpiry = afterRequest + oneHourMs + toleranceMs;

      expect(expiresAt).toBeGreaterThanOrEqual(minExpiry);
      expect(expiresAt).toBeLessThanOrEqual(maxExpiry);

      // Log for debugging
      const actualDurationMinutes = (expiresAt - beforeRequest) / (60 * 1000);
      console.log(`Token expiry: ${actualDurationMinutes.toFixed(1)} minutes from request`);
    });

    it('should generate identity with correct format (agent_{workspaceId}_{timestamp})', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const response = await app.handle(
        new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Identity should start with "agent_" prefix
      expect(data.identity.startsWith('agent_')).toBe(true);

      // Identity should contain workspace ID (with dashes replaced by underscores)
      const normalizedWorkspaceId = TEST_WORKSPACE_ID.replace(/-/g, '_');
      expect(data.identity).toContain(normalizedWorkspaceId);

      // Identity format: agent_{workspaceId}_{userPart}
      const parts = data.identity.split('_');
      expect(parts[0]).toBe('agent');
      // workspaceId is a UUID which has 5 parts when split by underscore
      expect(parts.length).toBeGreaterThanOrEqual(7); // agent + 5 UUID parts + userPart
    });

    it('should include userId in identity when provided', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}&userId=${TEST_USER_ID}`
        )
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // When userId is provided, it should be included in the identity
      const normalizedUserId = TEST_USER_ID.replace(/-/g, '_');
      expect(data.identity).toContain(normalizedUserId);
    });

    it('should use anon_{timestamp} when userId is not provided', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const response = await app.handle(
        new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // When userId is not provided, identity should contain "anon_" pattern
      expect(data.identity).toContain('anon_');
    });

    it('should return 500 with helpful message when Twilio config is invalid', async () => {
      // This test verifies error handling when TWILIO_TWIML_APP_SID is missing
      // It only requires ACCOUNT_SID and AUTH_TOKEN to be configured (to test missing TWIML_APP_SID)

      const hasBasicConfig =
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;

      if (!hasBasicConfig) {
        console.log('[SKIP] Basic Twilio credentials not configured');
        return;
      }

      const originalTwimlAppSid = process.env.TWILIO_TWIML_APP_SID;

      // Create a fresh app instance to test with missing config
      const testApp = new Elysia().group('/api/v1', (app) => app.use(voiceTokenRoutes));

      // Temporarily remove the TwiML App SID
      delete process.env.TWILIO_TWIML_APP_SID;

      try {
        const response = await testApp.handle(
          new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
        );

        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('configuration');
      } finally {
        // Restore the original value
        if (originalTwimlAppSid) {
          process.env.TWILIO_TWIML_APP_SID = originalTwimlAppSid;
        }
      }
    });
  });

  describe('Token validation (structure check)', () => {
    it('should return a valid JWT token structure', async () => {
      if (!twilioConfig.configured) {
        console.log('[SKIP] Twilio not configured');
        return;
      }

      const response = await app.handle(
        new Request(`http://localhost/api/v1/voice/token?workspaceId=${TEST_WORKSPACE_ID}`)
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // JWT should have 3 parts: header.payload.signature
      const tokenParts = data.token.split('.');
      expect(tokenParts.length).toBe(3);

      // Each part should be base64url encoded (non-empty)
      for (const part of tokenParts) {
        expect(part.length).toBeGreaterThan(0);
      }

      // Decode header and payload (without verification)
      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());

      // Header should have typ: JWT and alg
      expect(header.typ).toBe('JWT');
      expect(header.alg).toBeDefined();

      // Payload should have standard JWT claims
      expect(payload.iss).toBeDefined(); // issuer (account SID)
      expect(payload.sub).toBeDefined(); // subject (account SID)
      expect(payload.exp).toBeDefined(); // expiration
      expect(payload.jti).toBeDefined(); // JWT ID

      // Payload should have Twilio-specific grants
      expect(payload.grants).toBeDefined();
      expect(payload.grants.identity).toBeDefined();
      expect(payload.grants.voice).toBeDefined();
      expect(payload.grants.voice.outgoing).toBeDefined();
    });
  });
});
