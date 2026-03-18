/**
 * Google Maps Business Lookup Tool
 * Integrates Google Maps Places API with rate limiting and caching for AI enrichment
 */

import { getGoogleMapsProvider, type GoogleMapsBusinessResult } from '../providers/google-maps';
import { googleMapsRateLimiter } from '../rate-limiter';
import { googleMapsCache, createCacheKey } from '../cache';

export interface GoogleMapsToolResult {
  results: GoogleMapsBusinessResult[];
  cached: boolean;
  cost: number; // Cost in USD
}

const GOOGLE_MAPS_COST_PER_REQUEST = 0.005; // $0.005 per lookup (Places API pricing)

export class GoogleMapsTool {
  private provider = getGoogleMapsProvider();

  /**
   * Look up a business with rate limiting and caching
   *
   * @param query - Business name or search query
   * @param location - Optional location (city, address, etc.)
   * @returns Business lookup results with metadata
   * @throws Error if rate limit exceeded
   */
  async lookupBusiness(
    query: string,
    location?: string
  ): Promise<GoogleMapsToolResult> {
    // Create cache key
    const cacheKey = createCacheKey('google_maps', { query, location });

    // Check cache first
    const cached = googleMapsCache.get<GoogleMapsBusinessResult[]>(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for business: "${query}"`);
      return {
        results: cached,
        cached: true,
        cost: 0, // No cost for cached results
      };
    }

    // Check rate limit
    const allowed = await googleMapsRateLimiter.check('google_maps');
    if (!allowed) {
      const resetTime = googleMapsRateLimiter.getResetTime('google_maps');
      const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;
      throw new Error(
        `Rate limit exceeded for Google Maps. Try again in ${resetSeconds} seconds.`
      );
    }

    // Perform lookup
    const results = await this.provider.searchBusiness(query, location);

    // Cache results (24 hour TTL - business data doesn't change often)
    googleMapsCache.set(cacheKey, results, 24 * 60 * 60 * 1000);

    console.log(
      `🗺️  Google Maps lookup completed: "${query}" (${results.length} results)`
    );

    return {
      results,
      cached: false,
      cost: GOOGLE_MAPS_COST_PER_REQUEST,
    };
  }

  /**
   * Get formatted results for AI consumption
   */
  formatForAI(results: GoogleMapsBusinessResult[]): string {
    if (results.length === 0) {
      return 'No businesses found.';
    }

    return results
      .map((result, index) => {
        let formatted = `${index + 1}. ${result.name}\n`;
        formatted += `   Address: ${result.address}\n`;

        if (result.phone) {
          formatted += `   Phone: ${result.phone}\n`;
        }

        if (result.website) {
          formatted += `   Website: ${result.website}\n`;
        }

        if (result.rating) {
          formatted += `   Rating: ${result.rating}/5 (${result.userRatingsTotal || 0} reviews)\n`;
        }

        if (result.businessStatus) {
          formatted += `   Status: ${result.businessStatus}\n`;
        }

        if (result.openingHours?.openNow !== undefined) {
          formatted += `   Currently: ${result.openingHours.openNow ? 'Open' : 'Closed'}\n`;
        }

        if (result.types && result.types.length > 0) {
          formatted += `   Categories: ${result.types.slice(0, 3).join(', ')}\n`;
        }

        if (result.verified) {
          formatted += `   ✓ Verified business\n`;
        }

        formatted += `   Place ID: ${result.placeId}\n`;

        return formatted;
      })
      .join('\n');
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { count: number; limit: number; resetMs: number | null } {
    const usage = googleMapsRateLimiter.getUsage('google_maps');
    const resetMs = googleMapsRateLimiter.getResetTime('google_maps');

    return {
      count: usage?.count || 0,
      limit: usage?.limit || 10,
      resetMs,
    };
  }
}

// Singleton instance
let googleMapsToolInstance: GoogleMapsTool | null = null;

/**
 * Get or create singleton Google Maps tool instance
 */
export function getGoogleMapsTool(): GoogleMapsTool {
  if (!googleMapsToolInstance) {
    googleMapsToolInstance = new GoogleMapsTool();
  }
  return googleMapsToolInstance;
}

/**
 * OpenRouter function definition for Google Maps business lookup tool
 */
export const googleMapsFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'lookup_business',
    description:
      'Look up a business on Google Maps to verify its existence, get contact information, and assess legitimacy. Returns business name, address, phone, website, ratings, operating status, and opening hours. Use this to validate company information or find business details.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The business name or search query (e.g., "Acme Corp", "Tesla Dealership")',
        },
        location: {
          type: 'string',
          description:
            'Optional location to narrow search (e.g., "Cape Town", "San Francisco, CA", "123 Main St")',
        },
      },
      required: ['query'],
    },
  },
};
