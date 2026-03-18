/**
 * Email Verification Tool Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { getEmailVerificationTool } from './email-verification';
import { emailVerificationRateLimiter } from '../rate-limiter';
import { emailVerificationCache } from '../cache';

describe('EmailVerificationTool', () => {
  beforeEach(() => {
    // Clear cache and rate limits before each test
    emailVerificationCache.clear();
    emailVerificationRateLimiter.clear('email_verify');
  });

  it('should verify a valid email format', async () => {
    const tool = getEmailVerificationTool();
    const result = await tool.verify('john.doe@acme.com');

    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('cached');
    expect(result).toHaveProperty('cost');

    expect(result.result.email).toBe('john.doe@acme.com');
    expect(['valid', 'invalid', 'catch-all', 'unknown']).toContain(result.result.status);
    expect(typeof result.result.freeEmail).toBe('boolean');
    expect(result.cached).toBe(false); // First call not cached
  });

  it('should detect invalid email format', async () => {
    const tool = getEmailVerificationTool();
    const result = await tool.verify('not-an-email');

    expect(result.result.status).toBe('invalid');
    expect(result.result.subStatus).toBeDefined();
    // API returns "failed_syntax_check" or similar
    expect(result.result.subStatus).toBeTruthy();
  });

  it('should cache results for the same email', async () => {
    const tool = getEmailVerificationTool();
    const email = 'test@example.com';

    // First call
    const result1 = await tool.verify(email);
    expect(result1.cached).toBe(false);
    expect(result1.cost).toBeGreaterThan(0);

    // Second call (should be cached)
    const result2 = await tool.verify(email);
    expect(result2.cached).toBe(true);
    expect(result2.cost).toBe(0); // No cost for cached results

    // Results should be identical
    expect(result2.result).toEqual(result1.result);
  });

  it('should enforce rate limits', async () => {
    const tool = getEmailVerificationTool();

    // Make 20 requests (at the limit)
    for (let i = 0; i < 20; i++) {
      await tool.verify(`test${i}@example.com`);
    }

    // 21st request should fail
    await expect(tool.verify('test21@example.com')).rejects.toThrow(
      /Rate limit exceeded/
    );
  });

  it('should identify free email providers', async () => {
    const tool = getEmailVerificationTool();

    const freeEmails = [
      'user@gmail.com',
      'user@yahoo.com',
      'user@hotmail.com',
      'user@outlook.com',
    ];

    for (const email of freeEmails) {
      const result = await tool.verify(email);
      expect(result.result.freeEmail).toBe(true);
    }
  });

  it('should identify corporate emails', async () => {
    const tool = getEmailVerificationTool();
    const result = await tool.verify('john@acmecorp.com');

    // Corporate emails should not be free emails
    expect(result.result.freeEmail).toBe(false);
    expect(result.result.domain).toBe('acmecorp.com');
  });

  it('should format result for AI consumption', () => {
    const tool = getEmailVerificationTool();
    const mockResult = {
      email: 'test@example.com',
      status: 'valid' as const,
      subStatus: 'valid',
      freeEmail: false,
      mxFound: true,
      mxRecord: 'mail.example.com',
      processedAt: new Date().toISOString(),
    };

    const formatted = tool.formatForAI(mockResult);

    expect(formatted).toContain('test@example.com');
    expect(formatted).toContain('valid');
    expect(formatted).toContain('Corporate/paid email');
    expect(formatted).toContain('MX Record: Found');
  });

  it('should include suggestions in formatted output', () => {
    const tool = getEmailVerificationTool();
    const mockResult = {
      email: 'test@gmial.com', // typo
      status: 'invalid' as const,
      freeEmail: false,
      didYouMean: 'test@gmail.com',
      mxFound: false,
      processedAt: new Date().toISOString(),
    };

    const formatted = tool.formatForAI(mockResult);

    expect(formatted).toContain('Did you mean "test@gmail.com"?');
  });

  it('should provide rate limit status', () => {
    const tool = getEmailVerificationTool();
    const status = tool.getRateLimitStatus();

    expect(status).toHaveProperty('count');
    expect(status).toHaveProperty('limit');
    expect(status).toHaveProperty('resetMs');
    expect(status.limit).toBe(20); // 20 verifications per minute
  });
});
