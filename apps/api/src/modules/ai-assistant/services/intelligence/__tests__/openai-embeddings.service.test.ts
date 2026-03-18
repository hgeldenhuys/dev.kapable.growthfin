/**
 * Unit tests for OpenAI Embeddings Service
 */

import { config } from 'dotenv';
config(); // Load .env

import { describe, test, expect, beforeAll } from 'bun:test';
import { OpenAIEmbeddingsService } from '../openai-embeddings.service';

describe('OpenAIEmbeddingsService', () => {
  beforeAll(() => {
    // Verify API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, tests may fail');
    }
  });

  test('isConfigured returns true when API key is set', () => {
    expect(OpenAIEmbeddingsService.isConfigured()).toBe(true);
  });

  test('getModelConfig returns correct configuration', () => {
    const config = OpenAIEmbeddingsService.getModelConfig();
    expect(config.model).toBe('text-embedding-3-small');
    expect(config.dimensions).toBe(1536);
    expect(config.maxTokens).toBe(8191);
  });

  test('generateEmbedding returns 1536-dimensional vector', async () => {
    const text = 'This is a test text for embedding generation';
    const embedding = await OpenAIEmbeddingsService.generateEmbedding(text);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536);
    expect(typeof embedding[0]).toBe('number');
  });

  test('generateEmbedding throws on empty text', async () => {
    expect(async () => {
      await OpenAIEmbeddingsService.generateEmbedding('');
    }).toThrow('Text cannot be empty');
  });

  test('generateEmbeddings returns multiple embeddings', async () => {
    const texts = [
      'First text about programming',
      'Second text about databases',
      'Third text about APIs'
    ];

    const embeddings = await OpenAIEmbeddingsService.generateEmbeddings(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(3);
    expect(embeddings[0].length).toBe(1536);
    expect(embeddings[1].length).toBe(1536);
    expect(embeddings[2].length).toBe(1536);
  });

  test('generateEmbeddings throws on empty array', async () => {
    expect(async () => {
      await OpenAIEmbeddingsService.generateEmbeddings([]);
    }).toThrow('Texts array cannot be empty');
  });

  test('getRateLimitStats returns valid stats', () => {
    const stats = OpenAIEmbeddingsService.getRateLimitStats();
    expect(stats).toHaveProperty('used');
    expect(stats).toHaveProperty('limit');
    expect(stats).toHaveProperty('resetsIn');
    expect(typeof stats.used).toBe('number');
    expect(typeof stats.limit).toBe('number');
    expect(typeof stats.resetsIn).toBe('number');
  });

  test('similar texts have similar embeddings', async () => {
    const text1 = 'The cat sat on the mat';
    const text2 = 'A cat is sitting on a mat';
    const text3 = 'Quantum physics is fascinating';

    const [emb1, emb2, emb3] = await OpenAIEmbeddingsService.generateEmbeddings([text1, text2, text3]);

    // Calculate cosine similarity
    const similarity12 = cosineSimilarity(emb1, emb2);
    const similarity13 = cosineSimilarity(emb1, emb3);

    // Similar texts should have higher similarity than dissimilar texts
    expect(similarity12).toBeGreaterThan(similarity13);
    expect(similarity12).toBeGreaterThan(0.8); // Similar texts should be very close
  });
});

// Helper: Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  return dotProduct / (magnitudeA * magnitudeB);
}
