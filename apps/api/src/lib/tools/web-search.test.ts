/**
 * Web Search Tool Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { WebSearchTool } from './web-search';
import { webSearchCache } from '../cache';
import { webSearchRateLimiter } from '../rate-limiter';

describe('WebSearchTool', () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool();
    webSearchCache.clear();
    webSearchRateLimiter.clear('web_search');
  });

  describe('search', () => {
    test('should return results from search', async () => {
      const result = await tool.search('test query', { count: 3 });

      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.cached).toBe(false);
      expect(typeof result.cost).toBe('number');
    });

    test('should cache results', async () => {
      const query = 'test caching';

      // First call - not cached
      const result1 = await tool.search(query);
      expect(result1.cached).toBe(false);
      expect(result1.cost).toBeGreaterThan(0);

      // Second call - should be cached
      const result2 = await tool.search(query);
      expect(result2.cached).toBe(true);
      expect(result2.cost).toBe(0);
      expect(result2.results).toEqual(result1.results);
    });

    test('should enforce rate limiting', async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await tool.search(`query ${i}`);
      }

      // 11th request should fail
      try {
        await tool.search('one too many');
        throw new Error('Should have thrown rate limit error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Rate limit exceeded');
      }
    }, 10000); // Increase timeout

    test('should respect search options', async () => {
      const result = await tool.search('test query', {
        count: 5,
        freshness: 'week',
      });

      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('formatForAI', () => {
    test('should format results for AI consumption', async () => {
      const results = [
        {
          title: 'Test Result',
          url: 'https://example.com',
          description: 'Test description',
          publishedDate: '2024-01-01',
        },
      ];

      const formatted = tool.formatForAI(results);

      expect(formatted).toContain('Test Result');
      expect(formatted).toContain('https://example.com');
      expect(formatted).toContain('Test description');
      expect(formatted).toContain('Published: 2024-01-01');
    });

    test('should handle empty results', () => {
      const formatted = tool.formatForAI([]);
      expect(formatted).toBe('No results found.');
    });

    test('should handle results without publishedDate', () => {
      const results = [
        {
          title: 'Test',
          url: 'https://example.com',
          description: 'Description',
        },
      ];

      const formatted = tool.formatForAI(results);
      expect(formatted).not.toContain('Published:');
    });
  });

  describe('getRateLimitStatus', () => {
    test('should return rate limit status', async () => {
      const status1 = tool.getRateLimitStatus();
      expect(status1.count).toBe(0);
      expect(status1.limit).toBe(10);

      await tool.search('test');

      const status2 = tool.getRateLimitStatus();
      expect(status2.count).toBe(1);
      expect(status2.limit).toBe(10);
    });
  });
});
