/**
 * LLM Model Catalog Seed Data
 * Populates the catalog with common OpenRouter models and pricing
 * Pricing accurate as of October 2024
 */

import { db } from '../client';
import { llmModelCatalog } from '../schema/llm-model-catalog';

const SEED_MODELS = [
  {
    provider: 'openapi',
    modelName: 'anthropic/claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    inputCostPer1MTokens: '0.25',
    outputCostPer1MTokens: '1.25',
    contextWindow: 200000,
    isActive: true,
    metadata: { tier: 'fast', capabilities: ['chat', 'analysis'] },
  },
  {
    provider: 'openapi',
    modelName: 'anthropic/claude-3-5-sonnet-20241022',
    displayName: 'Claude Sonnet 3.5',
    inputCostPer1MTokens: '3.00',
    outputCostPer1MTokens: '15.00',
    contextWindow: 200000,
    isActive: true,
    metadata: { tier: 'balanced', capabilities: ['chat', 'analysis', 'coding'] },
  },
  {
    provider: 'openapi',
    modelName: 'anthropic/claude-3-opus-20240229',
    displayName: 'Claude Opus 3',
    inputCostPer1MTokens: '15.00',
    outputCostPer1MTokens: '75.00',
    contextWindow: 200000,
    isActive: true,
    metadata: { tier: 'powerful', capabilities: ['chat', 'analysis', 'coding', 'reasoning'] },
  },
  {
    provider: 'openapi',
    modelName: 'openai/gpt-4o',
    displayName: 'GPT-4 Optimized',
    inputCostPer1MTokens: '2.50',
    outputCostPer1MTokens: '10.00',
    contextWindow: 128000,
    isActive: true,
    metadata: { tier: 'balanced', capabilities: ['chat', 'analysis', 'vision'] },
  },
  {
    provider: 'openapi',
    modelName: 'openai/gpt-4o-mini',
    displayName: 'GPT-4 Mini',
    inputCostPer1MTokens: '0.15',
    outputCostPer1MTokens: '0.60',
    contextWindow: 128000,
    isActive: true,
    metadata: { tier: 'fast', capabilities: ['chat', 'analysis'] },
  },
  {
    provider: 'openapi',
    modelName: 'openai/gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    inputCostPer1MTokens: '10.00',
    outputCostPer1MTokens: '30.00',
    contextWindow: 128000,
    isActive: true,
    metadata: { tier: 'powerful', capabilities: ['chat', 'analysis', 'vision'] },
  },
  {
    provider: 'openapi',
    modelName: 'meta-llama/llama-3.1-405b-instruct',
    displayName: 'Llama 3.1 405B',
    inputCostPer1MTokens: '2.70',
    outputCostPer1MTokens: '2.70',
    contextWindow: 128000,
    isActive: true,
    metadata: { tier: 'powerful', capabilities: ['chat', 'analysis'], openSource: true },
  },
  {
    provider: 'openapi',
    modelName: 'meta-llama/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    inputCostPer1MTokens: '0.35',
    outputCostPer1MTokens: '0.40',
    contextWindow: 128000,
    isActive: true,
    metadata: { tier: 'fast', capabilities: ['chat', 'analysis'], openSource: true },
  },
  {
    provider: 'openapi',
    modelName: 'google/gemini-pro-1.5',
    displayName: 'Gemini Pro 1.5',
    inputCostPer1MTokens: '1.25',
    outputCostPer1MTokens: '5.00',
    contextWindow: 1000000,
    isActive: true,
    metadata: { tier: 'balanced', capabilities: ['chat', 'analysis', 'vision', 'long-context'] },
  },
  {
    provider: 'openapi',
    modelName: 'mistralai/mixtral-8x7b-instruct',
    displayName: 'Mixtral 8x7B',
    inputCostPer1MTokens: '0.24',
    outputCostPer1MTokens: '0.24',
    contextWindow: 32000,
    isActive: true,
    metadata: { tier: 'fast', capabilities: ['chat', 'analysis'], openSource: true },
  },
];

export async function seedLLMModelCatalog() {
  console.log('🌱 Seeding LLM model catalog...');

  try {
    // Insert seed data
    for (const model of SEED_MODELS) {
      await db
        .insert(llmModelCatalog)
        .values(model)
        .onConflictDoNothing({ target: [llmModelCatalog.provider, llmModelCatalog.modelName] });
    }

    console.log(`✅ Seeded ${SEED_MODELS.length} models`);
  } catch (error) {
    console.error('❌ Error seeding LLM model catalog:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  await seedLLMModelCatalog();
  process.exit(0);
}
