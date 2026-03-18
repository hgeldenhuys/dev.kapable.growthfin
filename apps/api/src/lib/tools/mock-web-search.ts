/**
 * Mock Web Search Tool
 * @deprecated This has been replaced by Brave Search API integration (Phase 5)
 * @see /apps/api/src/lib/providers/brave-search.ts
 *
 * Legacy tool kept for reference. The new Brave Search provider includes
 * automatic fallback to mock results when API key is not configured.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults: number;
}

export class MockWebSearchTool {
  /**
   * Perform a mock web search
   * Returns realistic-looking results based on query keywords
   */
  async search(query: string): Promise<WebSearchResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 200));

    // Generate mock results based on query keywords
    const results = this.generateMockResults(query);

    return {
      query,
      results,
      totalResults: results.length * 10, // Simulate more results available
    };
  }

  private generateMockResults(query: string): WebSearchResult[] {
    const queryLower = query.toLowerCase();

    // Company size queries
    if (queryLower.includes('company size') || queryLower.includes('employees')) {
      return [
        {
          title: 'Company Overview - LinkedIn',
          url: 'https://linkedin.com/company/example',
          snippet:
            'Acme Corp has 500-1000 employees globally across 15 offices. Founded in 2010, the company specializes in enterprise software.',
          publishedDate: '2024-01-15',
        },
        {
          title: 'Acme Corp - Crunchbase Profile',
          url: 'https://crunchbase.com/organization/acme',
          snippet:
            'Employee count: 750. Last updated: Q4 2023. The company has raised $50M in Series B funding.',
          publishedDate: '2023-12-01',
        },
        {
          title: 'About Us - Acme Corp',
          url: 'https://acme.com/about',
          snippet:
            'Our team of over 700 talented individuals works together to deliver innovative solutions to Fortune 500 companies.',
        },
      ];
    }

    // Funding queries
    if (queryLower.includes('funding') || queryLower.includes('raised')) {
      return [
        {
          title: 'Acme Corp Raises $50M Series B',
          url: 'https://techcrunch.com/acme-series-b',
          snippet:
            'Acme Corp announced a $50M Series B round led by Sequoia Capital. The company plans to use the funds for international expansion.',
          publishedDate: '2023-11-20',
        },
        {
          title: 'Funding Rounds - Crunchbase',
          url: 'https://crunchbase.com/organization/acme/funding',
          snippet:
            'Total funding: $75M across 3 rounds. Seed ($5M, 2018), Series A ($20M, 2020), Series B ($50M, 2023).',
        },
      ];
    }

    // Job title queries
    if (queryLower.includes('job title') || queryLower.includes('role')) {
      return [
        {
          title: 'John Doe - LinkedIn Profile',
          url: 'https://linkedin.com/in/johndoe',
          snippet:
            'Senior Vice President of Engineering at Acme Corp. Previously VP Engineering at Tech Co. 15+ years experience in enterprise software.',
          publishedDate: '2024-01-10',
        },
      ];
    }

    // Technology stack queries
    if (queryLower.includes('tech stack') || queryLower.includes('technology')) {
      return [
        {
          title: 'Acme Corp Tech Stack - StackShare',
          url: 'https://stackshare.io/acme',
          snippet:
            'Acme uses React, Node.js, PostgreSQL, AWS, Docker, and Kubernetes in their technology stack.',
        },
        {
          title: 'Engineering Blog - Acme Corp',
          url: 'https://acme.com/blog/our-stack',
          snippet:
            'We built our platform on a modern stack: TypeScript, React, GraphQL, and PostgreSQL. All infrastructure runs on AWS EKS.',
          publishedDate: '2023-10-15',
        },
      ];
    }

    // Default generic results
    return [
      {
        title: `${query} - Overview`,
        url: 'https://example.com/result1',
        snippet: `General information about ${query}. This is a mock search result for testing purposes.`,
      },
      {
        title: `${query} - Details`,
        url: 'https://example.com/result2',
        snippet: `Additional details and context about ${query}. Mock data generated for AI research testing.`,
      },
    ];
  }
}
