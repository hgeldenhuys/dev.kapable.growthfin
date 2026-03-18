/**
 * Brave Search API Provider
 * https://brave.com/search/api/
 *
 * Provides web search functionality with graceful degradation to mock results
 * when API key is not configured or API calls fail.
 */

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  publishedDate?: string;
}

interface BraveAPIResult {
  title: string;
  url: string;
  description: string;
  page_age?: string;
  meta_url?: {
    hostname?: string;
  };
}

interface BraveSearchResponse {
  web?: {
    results: BraveAPIResult[];
  };
  query?: {
    original: string;
  };
}

export interface BraveSearchOptions {
  count?: number;
  freshness?: 'day' | 'week' | 'month' | 'year';
  safesearch?: 'off' | 'moderate' | 'strict';
}

export class BraveSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey?: string) {
    // Allow fallback to mock if no API key
    this.apiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY || '';
  }

  /**
   * Perform web search using Brave Search API
   * Falls back to mock results if API key not configured or on error
   */
  async search(
    query: string,
    options?: BraveSearchOptions
  ): Promise<BraveSearchResult[]> {
    // If no API key, return empty results with clear error
    if (!this.apiKey) {
      console.error('❌ BRAVE_SEARCH_API_KEY not configured — web search unavailable');
      return [{
        title: 'Web Search Unavailable',
        url: '',
        description: 'BRAVE_SEARCH_API_KEY is not configured. Web search cannot be performed. Please configure the API key to enable real web search results.',
      }];
    }

    try {
      console.log(`🔍 Brave Search: "${query}" (${options?.count || 10} results)`);

      const params = new URLSearchParams({
        q: query,
        count: String(options?.count || 10),
        ...(options?.freshness && { freshness: options.freshness }),
        ...(options?.safesearch && { safesearch: options.safesearch }),
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Brave Search API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: BraveSearchResponse = await response.json();

      if (!data.web?.results || data.web.results.length === 0) {
        console.warn('Brave Search returned no results for query:', query);
        return [];
      }

      const results = data.web.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description,
        publishedDate: result.page_age,
      }));

      console.log(`✅ Brave Search returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error('❌ Brave Search failed:', error instanceof Error ? error.message : error);
      return [{
        title: 'Web Search Error',
        url: '',
        description: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Results may be incomplete.`,
      }];
    }
  }

  /**
   * Fallback mock results when API unavailable
   * Maintains existing mock-web-search.ts logic for compatibility
   */
  private getMockResults(query: string): BraveSearchResult[] {
    const lowerQuery = query.toLowerCase();

    // Company size patterns
    if (lowerQuery.includes('company size') || lowerQuery.includes('employees')) {
      return [
        {
          title: 'Company Overview - LinkedIn',
          url: 'https://linkedin.com/company/example',
          description:
            'Acme Corp has 500-1000 employees globally across 15 offices. Founded in 2010, the company specializes in enterprise software.',
          publishedDate: '2024-01-15',
        },
        {
          title: 'Acme Corp - Crunchbase Profile',
          url: 'https://crunchbase.com/organization/acme',
          description:
            'Employee count: 750. Last updated: Q4 2023. The company has raised $50M in Series B funding.',
          publishedDate: '2023-12-01',
        },
        {
          title: 'About Us - Acme Corp',
          url: 'https://acme.com/about',
          description:
            'Our team of over 700 talented individuals works together to deliver innovative solutions to Fortune 500 companies.',
        },
      ];
    }

    // Funding patterns
    if (lowerQuery.includes('funding') || lowerQuery.includes('raised') || lowerQuery.includes('investment')) {
      return [
        {
          title: 'Acme Corp Raises $50M Series B - TechCrunch',
          url: 'https://techcrunch.com/acme-series-b',
          description:
            'Acme Corp announced a $50M Series B round led by Sequoia Capital. The company plans to use the funds for international expansion.',
          publishedDate: '2023-11-20',
        },
        {
          title: 'Funding Rounds - Crunchbase',
          url: 'https://crunchbase.com/organization/acme/funding',
          description:
            'Total funding: $75M across 3 rounds. Seed ($5M, 2018), Series A ($20M, 2020), Series B ($50M, 2023).',
        },
      ];
    }

    // Job title patterns
    if (lowerQuery.includes('job title') || lowerQuery.includes('role') || lowerQuery.includes('position')) {
      return [
        {
          title: 'John Doe - LinkedIn Profile',
          url: 'https://linkedin.com/in/johndoe',
          description:
            'Senior Vice President of Engineering at Acme Corp. Previously VP Engineering at Tech Co. 15+ years experience in enterprise software.',
          publishedDate: '2024-01-10',
        },
      ];
    }

    // Technology stack patterns
    if (lowerQuery.includes('tech stack') || lowerQuery.includes('technology') || lowerQuery.includes('uses')) {
      return [
        {
          title: 'Acme Corp Tech Stack - StackShare',
          url: 'https://stackshare.io/acme',
          description:
            'Acme uses React, Node.js, PostgreSQL, AWS, Docker, and Kubernetes in their technology stack.',
        },
        {
          title: 'Engineering Blog - Acme Corp',
          url: 'https://acme.com/blog/our-stack',
          description:
            'We built our platform on a modern stack: TypeScript, React, GraphQL, and PostgreSQL. All infrastructure runs on AWS EKS.',
          publishedDate: '2023-10-15',
        },
      ];
    }

    // Generic results
    return [
      {
        title: `${query} - Overview`,
        url: 'https://example.com/result1',
        description: `General information about ${query}. This is a mock search result for testing purposes.`,
      },
      {
        title: `${query} - Details`,
        url: 'https://example.com/result2',
        description: `Additional details and context about ${query}. Configure BRAVE_SEARCH_API_KEY for real results.`,
      },
    ];
  }
}

// Singleton instance
let braveSearchInstance: BraveSearchProvider | null = null;

/**
 * Get or create singleton Brave Search provider instance
 */
export function getBraveSearchProvider(): BraveSearchProvider {
  if (!braveSearchInstance) {
    braveSearchInstance = new BraveSearchProvider();
  }
  return braveSearchInstance;
}
