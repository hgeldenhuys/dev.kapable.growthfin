/**
 * Web Search Tool
 * Integrates Perplexity and Brave Search APIs with automatic fallback
 * Perplexity is tried first for better ContactOut results, falls back to Brave on failure
 */

import { getBraveSearchProvider, type BraveSearchResult } from '../providers/brave-search';
import { getPerplexitySearchProvider } from '../providers/perplexity-search';
import { webSearchRateLimiter, perplexitySearchRateLimiter } from '../rate-limiter';
import { webSearchCache, createCacheKey } from '../cache';

export interface WebSearchOptions {
  count?: number;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

export interface WebSearchToolResult {
  results: BraveSearchResult[];
  cached: boolean;
  cost: number; // Cost in USD
  provider: 'perplexity' | 'brave'; // Which provider was used
}

const BRAVE_SEARCH_COST_PER_REQUEST = 0.001; // $0.001 per search
const PERPLEXITY_SEARCH_COST_PER_REQUEST = 0.005; // $0.005 per search

export class WebSearchTool {
  private braveProvider = getBraveSearchProvider();
  private perplexityProvider = getPerplexitySearchProvider();

  /**
   * Perform a web search with rate limiting and caching
   * Tries Perplexity first, falls back to Brave on failure
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Search results with metadata
   * @throws Error if rate limit exceeded or both providers fail
   */
  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchToolResult> {
    // Create cache key
    const cacheKey = createCacheKey('web_search', { query, ...options });

    // Check cache first
    const cached = webSearchCache.get(cacheKey) as { results: BraveSearchResult[]; provider: 'perplexity' | 'brave' } | undefined;
    if (cached) {
      console.log(`🎯 Cache hit for query: "${query}" (provider: ${cached.provider})`);
      return {
        results: cached.results,
        cached: true,
        cost: 0, // No cost for cached results
        provider: cached.provider,
      };
    }

    let results: BraveSearchResult[] = [];
    let usedProvider: 'perplexity' | 'brave' = 'brave';
    let cost = BRAVE_SEARCH_COST_PER_REQUEST;

    // Try Perplexity first with exponential backoff for rate limits
    let perplexityAttempts = 0;
    const maxPerplexityRetries = 3;

    try {
      while (perplexityAttempts <= maxPerplexityRetries) {
        // Check Perplexity rate limit
        const perplexityAllowed = await perplexitySearchRateLimiter.check('perplexity_search');

        if (!perplexityAllowed) {
          const resetTime = perplexitySearchRateLimiter.getResetTime('perplexity_search');
          const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;

          if (perplexityAttempts >= maxPerplexityRetries) {
            console.warn(
              `⚠️  Perplexity rate limit still exceeded after ${maxPerplexityRetries} retries. Giving up.`
            );
            throw new Error('Rate limit exceeded');
          }

          // Wait with exponential backoff
          const waitTime = Math.min(resetSeconds * 1000, 60000); // Cap at 60 seconds
          console.log(
            `⏳ Perplexity rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)}s before retry (attempt ${perplexityAttempts + 1}/${maxPerplexityRetries})...`
          );

          await new Promise(resolve => setTimeout(resolve, waitTime));
          perplexityAttempts++;
          continue;
        }

        // Rate limit OK, try the search
        results = await this.perplexityProvider.search(query, {
          count: options.count || 5,
          freshness: options.freshness,
        });

        // If Perplexity returns empty results, try Brave
        if (results.length === 0) {
          console.warn('⚠️  Perplexity returned empty results, trying Brave');
          throw new Error('Empty results');
        }

        usedProvider = 'perplexity';
        cost = PERPLEXITY_SEARCH_COST_PER_REQUEST;
        console.log(`✅ Used Perplexity for search: "${query}"`);
        break; // Success, exit retry loop
      }
    } catch (perplexityError) {
      // Check if this is a rate limit error that we couldn't resolve with retries
      const isRateLimitError = perplexityError instanceof Error &&
        perplexityError.message.includes('rate limit');

      if (isRateLimitError) {
        // After retries, fall back to Brave
        console.log('🔄 Perplexity rate limit persists after retries, falling back to Brave');
      }

      // Fallback to Brave for other errors (API errors, empty results, etc)
      console.log(
        `🔄 Falling back to Brave Search (Perplexity failed: ${
          perplexityError instanceof Error ? perplexityError.message : 'unknown'
        })`
      );

      // Check Brave rate limit
      const braveAllowed = await webSearchRateLimiter.check('web_search');
      if (!braveAllowed) {
        const resetTime = webSearchRateLimiter.getResetTime('web_search');
        const resetSeconds = resetTime ? Math.ceil(resetTime / 1000) : 60;
        throw new Error(
          `Brave rate limit exceeded. Try again in ${resetSeconds} seconds.`
        );
      }

      try {
        results = await this.braveProvider.search(query, {
          count: options.count || 5,
          freshness: options.freshness,
        });
        usedProvider = 'brave';
        cost = BRAVE_SEARCH_COST_PER_REQUEST;
        console.log(`✅ Used Brave (fallback) for search: "${query}"`);
      } catch (braveError) {
        // Both providers failed
        console.error(
          `❌ Both search providers failed for query: "${query}"`,
          { perplexityError, braveError }
        );
        throw new Error(
          `Search failed: Perplexity - ${perplexityError instanceof Error ? perplexityError.message : 'unknown'}, Brave - ${braveError instanceof Error ? braveError.message : 'unknown'}`
        );
      }
    }

    // Cache results (1 hour TTL)
    webSearchCache.set(cacheKey, { results, provider: usedProvider });

    console.log(
      `🔍 Web search completed: "${query}" (${results.length} results, provider: ${usedProvider}, cost: $${cost})`
    );

    return {
      results,
      cached: false,
      cost,
      provider: usedProvider,
    };
  }

  /**
   * Get formatted results for AI consumption
   */
  formatForAI(results: BraveSearchResult[]): string {
    if (results.length === 0) {
      return 'No results found.';
    }

    return results
      .map((result, index) => {
        let formatted = `${index + 1}. ${result.title}\n`;
        formatted += `   URL: ${result.url}\n`;
        formatted += `   ${result.description}\n`;
        if (result.publishedDate) {
          formatted += `   Published: ${result.publishedDate}\n`;
        }
        return formatted;
      })
      .join('\n');
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { count: number; limit: number; resetMs: number | null } {
    const usage = webSearchRateLimiter.getUsage('web_search');
    const resetMs = webSearchRateLimiter.getResetTime('web_search');

    return {
      count: usage?.count || 0,
      limit: usage?.limit || 10,
      resetMs,
    };
  }
}

// Singleton instance
let webSearchToolInstance: WebSearchTool | null = null;

/**
 * Get or create singleton web search tool instance
 */
export function getWebSearchTool(): WebSearchTool {
  if (!webSearchToolInstance) {
    webSearchToolInstance = new WebSearchTool();
  }
  return webSearchToolInstance;
}

/**
 * OpenRouter function definition for web search tool
 */
export const webSearchFunctionDefinition = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for current information about companies, people, or topics. Use this to find recent news, company data, funding information, or verify facts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query (e.g., "Acme Corp funding news 2025", "John Doe CEO LinkedIn")',
        },
        count: {
          type: 'number',
          description: 'Number of results to return (default: 5, max: 10)',
          minimum: 1,
          maximum: 10,
        },
        freshness: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Filter by recency (optional)',
        },
      },
      required: ['query'],
    },
  },
};
