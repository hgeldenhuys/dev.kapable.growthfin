/**
 * Email Verification Tool
 * Integrates ZeroBounce API with rate limiting and caching for AI enrichment
 */

import { getZeroBounceProvider, type EmailVerificationResult } from '../providers/zerobounce';
import { emailVerificationRateLimiter } from '../rate-limiter';
import { emailVerificationCache, createCacheKey } from '../cache';

export interface EmailVerificationToolResult {
  result: EmailVerificationResult;
  cached: boolean;
  cost: number; // Cost in USD
}

const ZEROBOUNCE_COST_PER_VERIFICATION = 0.001; // $0.001 per verification (varies by plan)

export class EmailVerificationTool {
  private provider = getZeroBounceProvider();

  /**
   * Verify email address with rate limiting and caching
   *
   * @param email - Email address to verify
   * @param ipAddress - Optional IP address for additional validation
   * @returns Verification result with metadata
   * @throws Error if rate limit exceeded
   */
  async verify(
    email: string,
    ipAddress?: string
  ): Promise<EmailVerificationToolResult> {
    // Create cache key
    const cacheKey = createCacheKey('email_verify', { email, ipAddress });

    // Check cache first
    const cached = emailVerificationCache.get<EmailVerificationResult>(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for email: "${email}"`);
      return {
        result: cached,
        cached: true,
        cost: 0, // No cost for cached results
      };
    }

    // Check rate limit
    const allowed = await emailVerificationRateLimiter.check('email_verify');
    if (!allowed) {
      const resetTime = emailVerificationRateLimiter.getResetTime('email_verify');
      const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;
      throw new Error(
        `Rate limit exceeded for email verification. Try again in ${resetSeconds} seconds.`
      );
    }

    // Perform verification
    const result = await this.provider.validateEmail(email, ipAddress);

    // Cache results (24 hour TTL - emails don't change often)
    emailVerificationCache.set(cacheKey, result, 24 * 60 * 60 * 1000);

    console.log(`📧 Email verification completed: "${email}" → ${result.status}`);

    return {
      result,
      cached: false,
      cost: ZEROBOUNCE_COST_PER_VERIFICATION,
    };
  }

  /**
   * Get formatted result for AI consumption
   */
  formatForAI(result: EmailVerificationResult): string {
    let formatted = `Email: ${result.email}\n`;
    formatted += `Status: ${result.status}\n`;

    if (result.subStatus) {
      formatted += `Details: ${result.subStatus}\n`;
    }

    formatted += `Type: ${result.freeEmail ? 'Free email provider' : 'Corporate/paid email'}\n`;

    if (result.didYouMean) {
      formatted += `Suggestion: Did you mean "${result.didYouMean}"?\n`;
    }

    if (result.smtpProvider) {
      formatted += `SMTP Provider: ${result.smtpProvider}\n`;
    }

    if (result.domainAgeDays !== undefined) {
      formatted += `Domain age: ${result.domainAgeDays} days\n`;
    }

    formatted += `MX Record: ${result.mxFound ? 'Found' : 'Not found'}\n`;

    if (result.country) {
      formatted += `Location: ${[result.city, result.region, result.country].filter(Boolean).join(', ')}\n`;
    }

    return formatted;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { count: number; limit: number; resetMs: number | null } {
    const usage = emailVerificationRateLimiter.getUsage('email_verify');
    const resetMs = emailVerificationRateLimiter.getResetTime('email_verify');

    return {
      count: usage?.count || 0,
      limit: usage?.limit || 20,
      resetMs,
    };
  }

  /**
   * Get API credits remaining (if available)
   */
  async getCreditsRemaining(): Promise<number | null> {
    return this.provider.getCredits();
  }
}

// Singleton instance
let emailVerificationToolInstance: EmailVerificationTool | null = null;

/**
 * Get or create singleton email verification tool instance
 */
export function getEmailVerificationTool(): EmailVerificationTool {
  if (!emailVerificationToolInstance) {
    emailVerificationToolInstance = new EmailVerificationTool();
  }
  return emailVerificationToolInstance;
}

/**
 * OpenRouter function definition for email verification tool
 */
export const emailVerificationFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'verify_email',
    description:
      'Verify if an email address is valid, deliverable, and not a spam trap. Use this to validate contact email addresses and assess email quality. Returns detailed information about the email including whether it is a free email provider, catch-all, or corporate email.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description:
            'The email address to verify (e.g., "john.doe@acme.com")',
        },
        ip_address: {
          type: 'string',
          description:
            'Optional IP address of the user for additional validation (helps detect disposable emails)',
        },
      },
      required: ['email'],
    },
  },
};
