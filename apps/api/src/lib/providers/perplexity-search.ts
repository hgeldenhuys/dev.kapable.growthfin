/**
 * Perplexity Search API Provider
 * https://docs.perplexity.ai/reference/post_search
 *
 * Provides web search functionality using Perplexity's AI-powered search API.
 * Returns results in BraveSearchResult format for compatibility with existing code.
 */

import type { BraveSearchResult } from './brave-search';

interface PerplexitySearchRequest {
  query: string;
  max_results?: number;
  return_related_questions?: boolean;
  return_images?: boolean;
  search_recency_filter?: 'day' | 'week' | 'month' | 'year';
}

interface PerplexitySearchResponse {
  id: string;
  results?: Array<{
    title: string;
    url: string;
    snippet: string; // Maps to 'description' in BraveSearchResult
    date?: string;
    last_updated?: string;
  }>;
}

export interface PerplexitySearchOptions {
  count?: number;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

export class PerplexitySearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['PERPLEXITY_API_KEY'] || '';
  }

  /**
   * Perform web search using Perplexity Search API
   * @throws Error if API key not configured or API call fails
   */
  async search(
    query: string,
    options?: PerplexitySearchOptions
  ): Promise<BraveSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const startTime = Date.now();
    console.log(`🔮 Perplexity Search: "${query}" (${options?.count || 5} results)`);

    try {
      const requestBody: PerplexitySearchRequest = {
        query,
        max_results: options?.count || 5,
        return_related_questions: false,
        return_images: false,
        ...(options?.freshness && { search_recency_filter: options.freshness }),
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Perplexity Search API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: PerplexitySearchResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        console.warn('⚠️  Perplexity Search returned no results');
        return [];
      }

      // Map Perplexity results to BraveSearchResult format
      const results: BraveSearchResult[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.snippet, // Map snippet → description
        publishedDate: result.date || result.last_updated,
      }));

      const durationMs = Date.now() - startTime;
      console.log(
        `✅ Perplexity Search returned ${results.length} results (${durationMs}ms)`
      );

      return results;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error(
        `❌ Perplexity Search failed after ${durationMs}ms:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }
}

// Singleton instance
let perplexitySearchInstance: PerplexitySearchProvider | null = null;

/**
 * Get or create singleton Perplexity Search provider instance
 */
export function getPerplexitySearchProvider(): PerplexitySearchProvider {
  if (!perplexitySearchInstance) {
    perplexitySearchInstance = new PerplexitySearchProvider();
  }
  return perplexitySearchInstance;
}
