/**
 * LinkedIn Profile Enrichment Tool
 * Integrates RapidAPI LinkedIn with rate limiting and caching for AI enrichment
 */

import { getLinkedInProvider, type LinkedInProfileResult } from '../providers/linkedin';
import { linkedInRateLimiter } from '../rate-limiter';
import { linkedInCache, createCacheKey } from '../cache';

export interface LinkedInToolResult {
  profile: LinkedInProfileResult | null;
  cached: boolean;
  cost: number; // Cost in USD
}

const LINKEDIN_COST_PER_REQUEST = 0.10; // $0.10 per profile lookup (RapidAPI pricing)

export class LinkedInTool {
  private provider = getLinkedInProvider();

  /**
   * Enrich contact with LinkedIn profile data
   *
   * @param profileUrl - LinkedIn profile URL or username
   * @returns LinkedIn profile data with metadata
   * @throws Error if rate limit exceeded
   */
  async enrichProfile(profileUrl: string): Promise<LinkedInToolResult> {
    // Create cache key
    const cacheKey = createCacheKey('linkedin', { profileUrl });

    // Check cache first
    const cached = linkedInCache.get<LinkedInProfileResult>(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for LinkedIn: "${profileUrl}"`);
      return {
        profile: cached,
        cached: true,
        cost: 0, // No cost for cached results
      };
    }

    // Check rate limit
    const allowed = await linkedInRateLimiter.check('linkedin');
    if (!allowed) {
      const resetTime = linkedInRateLimiter.getResetTime('linkedin');
      const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;
      throw new Error(
        `Rate limit exceeded for LinkedIn enrichment. Try again in ${resetSeconds} seconds.`
      );
    }

    // Fetch profile
    const profile = await this.provider.getProfile(profileUrl);

    if (profile) {
      // Cache results (7 days TTL - LinkedIn profiles don't change often)
      linkedInCache.set(cacheKey, profile, 7 * 24 * 60 * 60 * 1000);

      console.log(
        `💼 LinkedIn enrichment completed: "${profile.firstName} ${profile.lastName}"`
      );
    }

    return {
      profile,
      cached: false,
      cost: LINKEDIN_COST_PER_REQUEST,
    };
  }

  /**
   * Get formatted result for AI consumption
   */
  formatForAI(profile: LinkedInProfileResult | null): string {
    if (!profile) {
      return 'No LinkedIn profile found.';
    }

    let formatted = `LinkedIn Profile:\n`;
    formatted += `Name: ${profile.firstName} ${profile.lastName}\n`;

    if (profile.headline) {
      formatted += `Headline: ${profile.headline}\n`;
    }

    if (profile.currentPosition && profile.currentCompany) {
      formatted += `Current Role: ${profile.currentPosition} at ${profile.currentCompany}\n`;
    }

    if (profile.location) {
      formatted += `Location: ${profile.location}${profile.country ? `, ${profile.country}` : ''}\n`;
    }

    if (profile.connections) {
      formatted += `Connections: ${profile.connections}+\n`;
    }

    if (profile.summary) {
      formatted += `\nSummary:\n${profile.summary}\n`;
    }

    if (profile.experience && profile.experience.length > 0) {
      formatted += `\nExperience:\n`;
      profile.experience.slice(0, 3).forEach((exp, index) => {
        formatted += `${index + 1}. ${exp.title} at ${exp.company}`;
        if (exp.current) {
          formatted += ` (Current)`;
        } else if (exp.startDate && exp.endDate) {
          formatted += ` (${exp.startDate} to ${exp.endDate})`;
        }
        formatted += `\n`;
      });
    }

    if (profile.education && profile.education.length > 0) {
      formatted += `\nEducation:\n`;
      profile.education.forEach((edu, index) => {
        formatted += `${index + 1}. ${edu.school}`;
        if (edu.degree) {
          formatted += ` - ${edu.degree}`;
          if (edu.field) {
            formatted += ` in ${edu.field}`;
          }
        }
        if (edu.startYear && edu.endYear) {
          formatted += ` (${edu.startYear}-${edu.endYear})`;
        }
        formatted += `\n`;
      });
    }

    if (profile.skills && profile.skills.length > 0) {
      formatted += `\nTop Skills: ${profile.skills.slice(0, 10).join(', ')}\n`;
    }

    if (profile.profileUrl) {
      formatted += `\nProfile URL: ${profile.profileUrl}\n`;
    }

    return formatted;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { count: number; limit: number; resetMs: number | null } {
    const usage = linkedInRateLimiter.getUsage('linkedin');
    const resetMs = linkedInRateLimiter.getResetTime('linkedin');

    return {
      count: usage?.count || 0,
      limit: usage?.limit || 5,
      resetMs,
    };
  }
}

// Singleton instance
let linkedInToolInstance: LinkedInTool | null = null;

/**
 * Get or create singleton LinkedIn tool instance
 */
export function getLinkedInTool(): LinkedInTool {
  if (!linkedInToolInstance) {
    linkedInToolInstance = new LinkedInTool();
  }
  return linkedInToolInstance;
}

/**
 * OpenRouter function definition for LinkedIn enrichment tool
 */
export const linkedInFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'enrich_linkedin',
    description:
      'Enrich a contact with their LinkedIn profile data including current position, company, headline, experience, education, and skills. Use this to get professional background and validate employment information. Requires a LinkedIn profile URL or username.',
    parameters: {
      type: 'object',
      properties: {
        profile_url: {
          type: 'string',
          description:
            'The LinkedIn profile URL (e.g., "https://linkedin.com/in/johndoe") or username (e.g., "johndoe")',
        },
      },
      required: ['profile_url'],
    },
  },
};
