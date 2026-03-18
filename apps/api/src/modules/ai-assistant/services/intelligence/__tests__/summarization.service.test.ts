/**
 * Unit tests for Summarization Service
 */

import { config } from 'dotenv';
config(); // Load .env

import { describe, test, expect, beforeAll } from 'bun:test';
import { SummarizationService } from '../summarization.service';

describe('SummarizationService', () => {
  beforeAll(() => {
    // Verify API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, tests may fail');
    }
  });

  test('isConfigured returns true when API key is set', () => {
    expect(SummarizationService.isConfigured()).toBe(true);
  });

  test('getModelConfig returns correct configuration', () => {
    const config = SummarizationService.getModelConfig();
    expect(config.model).toBe('gpt-4o-mini');
    expect(config.inputCostPer1MTokens).toBe(0.15);
    expect(config.outputCostPer1MTokens).toBe(0.60);
  });

  test('summarizeCode returns concise summary', async () => {
    const code = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
    `.trim();

    const summary = await SummarizationService.summarizeCode(code, 200);

    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.toLowerCase()).toContain('calculate');
  }, 15000); // 15 second timeout

  test('summarizeCode throws on empty code', async () => {
    expect(async () => {
      await SummarizationService.summarizeCode('');
    }).toThrow('Code cannot be empty');
  });

  test('summarizeConversation returns structured summary', async () => {
    const messages = [
      { role: 'user' as const, content: 'I need to implement authentication for our API' },
      { role: 'assistant' as const, content: 'I recommend using JWT tokens with refresh tokens for better security' },
      { role: 'user' as const, content: 'Should we use Redis for token storage?' },
      { role: 'assistant' as const, content: 'Yes, Redis is a good choice for storing refresh tokens' },
    ];

    const result = await SummarizationService.summarizeConversation(messages, 500);

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('topics');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('decisions');

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeLessThanOrEqual(500);

    expect(Array.isArray(result.topics)).toBe(true);
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(Array.isArray(result.decisions)).toBe(true);

    // Should capture authentication-related topics/keywords
    const allText = [
      result.summary,
      ...result.topics,
      ...result.keywords,
      ...result.decisions
    ].join(' ').toLowerCase();

    expect(
      allText.includes('auth') ||
      allText.includes('jwt') ||
      allText.includes('token') ||
      allText.includes('security')
    ).toBe(true);
  }, 20000); // 20 second timeout

  test('summarizeConversation throws on empty messages', async () => {
    expect(async () => {
      await SummarizationService.summarizeConversation([]);
    }).toThrow('Messages cannot be empty');
  });

  test('extractKeywords returns relevant keywords', async () => {
    const text = `
We need to implement a RESTful API for user authentication using JWT tokens.
The API should support login, logout, and token refresh endpoints.
We'll use PostgreSQL for storing user credentials and Redis for session management.
    `.trim();

    const keywords = await SummarizationService.extractKeywords(text, 8);

    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(8);

    const keywordsLower = keywords.map(k => k.toLowerCase());

    // Should extract relevant technical keywords
    const hasRelevantKeywords = keywordsLower.some(k =>
      ['api', 'jwt', 'auth', 'token', 'postgres', 'redis', 'login', 'user'].some(term => k.includes(term))
    );

    expect(hasRelevantKeywords).toBe(true);
  }, 15000); // 15 second timeout

  test('extractKeywords throws on empty text', async () => {
    expect(async () => {
      await SummarizationService.extractKeywords('');
    }).toThrow('Text cannot be empty');
  });

  test('summarizeCode respects max character limit', async () => {
    const code = `
function complexFunction(data) {
  // Lots of complex logic here
  const processed = data.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date()
  }));
  return processed.filter(item => item.valid);
}
    `.trim();

    const summary = await SummarizationService.summarizeCode(code, 100);

    expect(summary.length).toBeLessThanOrEqual(100);
  }, 15000);
});
