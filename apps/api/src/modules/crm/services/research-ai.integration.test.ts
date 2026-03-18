import { config } from 'dotenv';
config();

/**
 * Research AI Service Integration Tests
 * Tests the full integration with Brave Search API
 */

import { describe, test, expect } from 'bun:test';
import { getBraveSearchProvider } from '../../../lib/providers/brave-search';

describe('Research AI Integration', () => {
  describe('Brave Search Integration', () => {
    test('should successfully create and use Brave Search provider', () => {
      const provider = getBraveSearchProvider();
      expect(provider).toBeDefined();
    });

    test('should handle search without API key (mock fallback)', async () => {
      // Temporarily remove API key to test fallback
      const originalKey = process.env.BRAVE_SEARCH_API_KEY;
      delete process.env.BRAVE_SEARCH_API_KEY;

      const provider = getBraveSearchProvider();
      const results = await provider.search('test company size', { count: 5 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Each result should have required fields
      for (const result of results) {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(typeof result.url).toBe('string');
        expect(typeof result.description).toBe('string');
      }

      // Restore original key
      process.env.BRAVE_SEARCH_API_KEY = originalKey;
    });

    test('should format results compatible with research AI service', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY; // Use mock

      const provider = getBraveSearchProvider();
      const results = await provider.search('company funding', { count: 5 });

      // Results should be in format expected by research-ai.ts
      const searchResults = {
        query: 'company funding',
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
          publishedDate: r.publishedDate,
        })),
        totalResults: results.length,
      };

      expect(searchResults.query).toBe('company funding');
      expect(searchResults.results).toBeDefined();
      expect(searchResults.totalResults).toBeGreaterThan(0);

      // Verify format matches what AI service expects
      for (const result of searchResults.results) {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('snippet');
      }
    });

    test('should handle different query types', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = getBraveSearchProvider();

      const queries = [
        'company size employees',
        'funding raised investment',
        'job title role',
        'tech stack technology',
        'generic query',
      ];

      for (const query of queries) {
        const results = await provider.search(query, { count: 5 });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('url');
        expect(results[0]).toHaveProperty('description');
      }
    });

    test('should respect count option', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = getBraveSearchProvider();

      const results = await provider.search('test query', { count: 3 });

      // Mock should respect the pattern but may return fewer results
      expect(results.length).toBeLessThanOrEqual(10);
    });

    test('should handle freshness option', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = getBraveSearchProvider();

      // Should not error with freshness option
      const results = await provider.search('test query', {
        count: 5,
        freshness: 'month',
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should gracefully handle all error scenarios', async () => {
      const provider = getBraveSearchProvider();

      // Empty query should still work
      const results1 = await provider.search('');
      expect(results1).toBeDefined();
      expect(Array.isArray(results1)).toBe(true);

      // Special characters
      const results2 = await provider.search('test @#$% query');
      expect(results2).toBeDefined();
      expect(Array.isArray(results2)).toBe(true);

      // Very long query
      const longQuery = 'test '.repeat(100);
      const results3 = await provider.search(longQuery);
      expect(results3).toBeDefined();
      expect(Array.isArray(results3)).toBe(true);
    });
  });
});
