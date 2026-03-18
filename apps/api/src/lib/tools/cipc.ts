/**
 * CIPC Company Registry Lookup Tool
 * South African company verification with rate limiting and caching
 */

import { getCIPCProvider, type CIPCCompanyResult } from '../providers/cipc';
import { cipcRateLimiter } from '../rate-limiter';
import { cipcCache, createCacheKey } from '../cache';

export interface CIPCToolResult {
  company: CIPCCompanyResult | null;
  cached: boolean;
  cost: number; // Cost in USD (free for mock data)
}

const CIPC_COST_PER_LOOKUP = 0.0; // Free (mock data) - would be ~$0.01 with paid provider

export class CIPCTool {
  private provider = getCIPCProvider();

  /**
   * Look up a South African company with rate limiting and caching
   *
   * @param query - Company registration number or name
   * @returns Company information with metadata
   * @throws Error if rate limit exceeded
   */
  async lookupCompany(query: string): Promise<CIPCToolResult> {
    // Create cache key
    const cacheKey = createCacheKey('cipc', { query });

    // Check cache first
    const cached = cipcCache.get<CIPCCompanyResult>(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for CIPC: "${query}"`);
      return {
        company: cached,
        cached: true,
        cost: 0, // No cost for cached results
      };
    }

    // Check rate limit
    const allowed = await cipcRateLimiter.check('cipc');
    if (!allowed) {
      const resetTime = cipcRateLimiter.getResetTime('cipc');
      const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;
      throw new Error(
        `Rate limit exceeded for CIPC lookup. Try again in ${resetSeconds} seconds.`
      );
    }

    // Perform lookup
    const company = await this.provider.lookupCompany(query);

    if (company) {
      // Cache results (30 days TTL - company registry data doesn't change often)
      cipcCache.set(cacheKey, company, 30 * 24 * 60 * 60 * 1000);

      console.log(
        `🏢 CIPC lookup completed: "${company.companyName}" (${company.status})`
      );
    }

    return {
      company,
      cached: false,
      cost: CIPC_COST_PER_LOOKUP,
    };
  }

  /**
   * Get formatted result for AI consumption
   */
  formatForAI(company: CIPCCompanyResult | null): string {
    if (!company) {
      return 'No company found in CIPC registry.';
    }

    let formatted = `CIPC Company Registry:\n`;
    formatted += `Company Name: ${company.companyName}\n`;
    formatted += `Registration Number: ${company.registrationNumber}\n`;
    formatted += `Status: ${company.status}\n`;

    if (company.type) {
      formatted += `Type: ${company.type}\n`;
    }

    if (company.registrationDate) {
      formatted += `Registered: ${company.registrationDate}\n`;
    }

    if (company.physicalAddress) {
      formatted += `Physical Address: ${company.physicalAddress}\n`;
    }

    if (company.financialYearEnd) {
      formatted += `Financial Year End: ${company.financialYearEnd}\n`;
    }

    if (company.annualReturnDate) {
      formatted += `Annual Return Date: ${company.annualReturnDate}\n`;
    }

    if (company.directors && company.directors.length > 0) {
      formatted += `\nDirectors:\n`;
      company.directors.forEach((director, index) => {
        formatted += `${index + 1}. ${director.name}`;
        if (director.appointmentDate) {
          formatted += ` (Appointed: ${director.appointmentDate})`;
        }
        formatted += `\n`;
      });
    }

    if (!company.verified) {
      formatted += `\n⚠️  Note: This data is from demonstration/mock source. For production use, integrate with official CIPC data provider.\n`;
    }

    return formatted;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { count: number; limit: number; resetMs: number | null } {
    const usage = cipcRateLimiter.getUsage('cipc');
    const resetMs = cipcRateLimiter.getResetTime('cipc');

    return {
      count: usage?.count || 0,
      limit: usage?.limit || 10,
      resetMs,
    };
  }
}

// Singleton instance
let cipcToolInstance: CIPCTool | null = null;

/**
 * Get or create singleton CIPC tool instance
 */
export function getCIPCTool(): CIPCTool {
  if (!cipcToolInstance) {
    cipcToolInstance = new CIPCTool();
  }
  return cipcToolInstance;
}

/**
 * OpenRouter function definition for CIPC company lookup tool
 */
export const cipcFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'lookup_sa_company',
    description:
      'Look up a South African company in the CIPC (Companies and Intellectual Property Commission) registry. Returns company registration details, status, directors, and addresses. Use this to verify South African companies and validate business legitimacy. Accepts company registration number (e.g., "2015/123456/07") or company name.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Company registration number (e.g., "2015/123456/07") or company name (e.g., "Acme (Pty) Ltd")',
        },
      },
      required: ['query'],
    },
  },
};
