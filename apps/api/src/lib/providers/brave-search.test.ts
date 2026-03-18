import { config } from 'dotenv';
config();

/**
 * Brave Search Provider Tests
 * Comprehensive test coverage for Brave Search API integration
 */

import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import { BraveSearchProvider } from './brave-search';

describe('BraveSearchProvider', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.BRAVE_SEARCH_API_KEY;
  });

  describe('constructor', () => {
    test('should use provided API key', () => {
      const provider = new BraveSearchProvider('test-key');
      expect(provider).toBeDefined();
    });

    test('should use env variable if no key provided', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'env-key';
      const provider = new BraveSearchProvider();
      expect(provider).toBeDefined();
      process.env.BRAVE_SEARCH_API_KEY = originalEnv;
    });

    test('should handle missing API key gracefully', () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = new BraveSearchProvider();
      expect(provider).toBeDefined();
      process.env.BRAVE_SEARCH_API_KEY = originalEnv;
    });
  });

  describe('search - with API key', () => {
    test('should make successful API call and return results', async () => {
      // Mock fetch
      const mockResponse = {
        web: {
          results: [
            {
              title: 'Test Result 1',
              url: 'https://example.com/1',
              description: 'Test description 1',
              page_age: '2024-01-15',
            },
            {
              title: 'Test Result 2',
              url: 'https://example.com/2',
              description: 'Test description 2',
            },
          ],
        },
      };

      const fetchMock = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-api-key');
      const results = await provider.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        title: 'Test Result 1',
        url: 'https://example.com/1',
        description: 'Test description 1',
        publishedDate: '2024-01-15',
      });
      expect(results[1]).toEqual({
        title: 'Test Result 2',
        url: 'https://example.com/2',
        description: 'Test description 2',
        publishedDate: undefined,
      });
    });

    test('should include search options in API call', async () => {
      let capturedUrl = '';

      const fetchMock = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({ web: { results: [] } }),
        };
      });

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      await provider.search('test query', {
        count: 5,
        freshness: 'month',
        safesearch: 'strict',
      });

      expect(capturedUrl).toContain('q=test+query');
      expect(capturedUrl).toContain('count=5');
      expect(capturedUrl).toContain('freshness=month');
      expect(capturedUrl).toContain('safesearch=strict');
    });

    test('should handle API error and fallback to mock', async () => {
      const fetchMock = mock(async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('company size');

      // Should fallback to mock results
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Company Overview');
    });

    test('should handle network error and fallback to mock', async () => {
      const fetchMock = mock(async () => {
        throw new Error('Network error');
      });

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock results
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle empty results from API', async () => {
      const fetchMock = mock(async () => ({
        ok: true,
        json: async () => ({ web: { results: [] } }),
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock when no results
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle malformed API response', async () => {
      const fetchMock = mock(async () => ({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('search - without API key', () => {
    test('should use mock results when no API key configured', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = new BraveSearchProvider();

      const results = await provider.search('company size');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Company Overview');
      process.env.BRAVE_SEARCH_API_KEY = originalEnv;
    });

    test('should not call API when no key configured', async () => {
      const fetchMock = mock(() => {
        throw new Error('Should not be called');
      });

      global.fetch = fetchMock as any;

      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = new BraveSearchProvider();
      const results = await provider.search('test query');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
      process.env.BRAVE_SEARCH_API_KEY = originalEnv;
    });
  });

  describe('mock results patterns', () => {
    let provider: BraveSearchProvider;

    beforeEach(() => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      provider = new BraveSearchProvider();
    });

    test('should return company size mock results for size queries', async () => {
      const results = await provider.search('company size employees');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes('LinkedIn'))).toBe(true);
      expect(results.some((r) => r.title.includes('Crunchbase'))).toBe(true);
    });

    test('should return funding mock results for funding queries', async () => {
      const results = await provider.search('company funding raised');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes('Funding'))).toBe(true);
      expect(results.some((r) => r.description.includes('Series'))).toBe(true);
    });

    test('should return job title mock results for role queries', async () => {
      const results = await provider.search('job title role');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes('LinkedIn Profile'))).toBe(true);
    });

    test('should return tech stack mock results for technology queries', async () => {
      const results = await provider.search('tech stack technology');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes('Tech Stack'))).toBe(true);
      expect(results.some((r) => r.description.includes('React'))).toBe(true);
    });

    test('should return generic mock results for unmatched queries', async () => {
      const results = await provider.search('random unmatched query');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('random unmatched query');
      expect(results[0].description).toContain('mock search result');
    });

    test('should handle case-insensitive pattern matching', async () => {
      const results1 = await provider.search('COMPANY SIZE');
      const results2 = await provider.search('company size');

      expect(results1.length).toBe(results2.length);
      expect(results1[0].title).toBe(results2[0].title);
    });
  });

  describe('result format', () => {
    test('should always return BraveSearchResult format', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = new BraveSearchProvider();

      const results = await provider.search('test query');

      for (const result of results) {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(typeof result.url).toBe('string');
        expect(typeof result.description).toBe('string');
      }
    });

    test('should handle optional publishedDate field', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const provider = new BraveSearchProvider();

      const results = await provider.search('funding raised');

      // Some results have publishedDate
      expect(results.some((r) => r.publishedDate !== undefined)).toBe(true);
      // Some don't
      expect(results.some((r) => r.publishedDate === undefined)).toBe(true);
    });
  });

  describe('error scenarios', () => {
    test('should handle 401 Unauthorized', async () => {
      const fetchMock = mock(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('invalid-key');
      const results = await provider.search('test query');

      // Should fallback to mock
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle 403 Forbidden', async () => {
      const fetchMock = mock(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle 500 Internal Server Error', async () => {
      const fetchMock = mock(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle JSON parse error', async () => {
      const fetchMock = mock(async () => ({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      }));

      global.fetch = fetchMock as any;

      const provider = new BraveSearchProvider('test-key');
      const results = await provider.search('test query');

      // Should fallback to mock
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('singleton pattern', () => {
    test('getBraveSearchProvider should return same instance', () => {
      const { getBraveSearchProvider } = require('./brave-search');
      const instance1 = getBraveSearchProvider();
      const instance2 = getBraveSearchProvider();

      expect(instance1).toBe(instance2);
    });
  });
});
