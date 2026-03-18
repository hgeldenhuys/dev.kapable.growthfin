/**
 * Integration Test: Three-Tier Credential-Based Model Selection
 * Tests the credential → provider → model selection API
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { db } from '@agios/db/client';
import { llmCredentials, llmConfigs, llmModelCatalog } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { AssistantService } from '../service';

describe('Three-Tier Model Selection API', () => {
  let testCredentialId: string;

  beforeAll(async () => {
    // Get an active credential for testing
    const credentials = await db
      .select()
      .from(llmCredentials)
      .where(eq(llmCredentials.isActive, true))
      .limit(1);

    if (credentials.length === 0) {
      throw new Error('No active credentials found. Please set up at least one credential.');
    }

    testCredentialId = credentials[0].id;
    console.log(`Using credential: ${credentials[0].name} (${credentials[0].id})`);
  });

  describe('GET /credentials', () => {
    it('should return list of active credentials with model counts', async () => {
      const credentials = await AssistantService.getAvailableCredentials();

      // Verify structure
      expect(Array.isArray(credentials)).toBe(true);
      expect(credentials.length).toBeGreaterThan(0);

      // Verify each credential has required fields
      for (const cred of credentials) {
        expect(cred).toHaveProperty('id');
        expect(cred).toHaveProperty('name');
        expect(cred).toHaveProperty('provider');
        expect(cred).toHaveProperty('isActive');
        expect(cred).toHaveProperty('modelCount');

        expect(typeof cred.id).toBe('string');
        expect(typeof cred.name).toBe('string');
        expect(typeof cred.provider).toBe('string');
        expect(cred.isActive).toBe(true);
        expect(typeof cred.modelCount).toBe('number');
        expect(cred.modelCount).toBeGreaterThanOrEqual(0);
      }

      console.log(`✅ Found ${credentials.length} active credentials`);
      console.log(`   Example: ${credentials[0].name} (${credentials[0].modelCount} models)`);
    });

    it('should only return active credentials', async () => {
      const credentials = await AssistantService.getAvailableCredentials();

      for (const cred of credentials) {
        expect(cred.isActive).toBe(true);
      }

      console.log(`✅ All returned credentials are active`);
    });
  });

  describe('GET /credentials/:credentialId/providers', () => {
    it('should return list of providers for a credential', async () => {
      const providers = await AssistantService.getProvidersByCredential(testCredentialId);

      // Verify structure
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);

      // Verify each provider has required fields
      for (const provider of providers) {
        expect(provider).toHaveProperty('provider');
        expect(provider).toHaveProperty('modelCount');

        expect(typeof provider.provider).toBe('string');
        expect(provider.provider.length).toBeGreaterThan(0);
        expect(typeof provider.modelCount).toBe('number');
        expect(provider.modelCount).toBeGreaterThan(0);
      }

      console.log(`✅ Found ${providers.length} providers for credential`);
      console.log(`   Providers: ${providers.map(p => `${p.provider} (${p.modelCount})`).join(', ')}`);
    });

    it('should throw error for non-existent credential', async () => {
      const fakeCredentialId = '00000000-0000-0000-0000-000000000000';

      try {
        await AssistantService.getProvidersByCredential(fakeCredentialId);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('not found');
        console.log(`✅ Correctly throws error for non-existent credential`);
      }
    });

    it('should extract provider from model names correctly', async () => {
      const providers = await AssistantService.getProvidersByCredential(testCredentialId);

      // Common provider names we expect to see
      const commonProviders = ['openai', 'anthropic', 'google', 'meta', 'mistralai'];

      for (const provider of providers) {
        // Provider should not contain slashes (should be extracted part before /)
        expect(provider.provider).not.toContain('/');

        // Should be lowercase
        expect(provider.provider).toBe(provider.provider.toLowerCase());
      }

      console.log(`✅ Provider extraction working correctly`);
    });
  });

  describe('GET /credentials/:credentialId/providers/:provider/models', () => {
    let testProvider: string;

    beforeAll(async () => {
      // Get a provider for testing
      const providers = await AssistantService.getProvidersByCredential(testCredentialId);
      if (providers.length === 0) {
        throw new Error('No providers found for test credential');
      }
      testProvider = providers[0].provider;
      console.log(`Using provider: ${testProvider}`);
    });

    it('should return list of models for credential + provider', async () => {
      const models = await AssistantService.getModelsByCredentialAndProvider(
        testCredentialId,
        testProvider
      );

      // Verify structure
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Verify each model has required fields
      for (const model of models) {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('modelName');
        expect(model).toHaveProperty('displayName');
        expect(model).toHaveProperty('inputCostPer1MTokens');
        expect(model).toHaveProperty('outputCostPer1MTokens');
        expect(model).toHaveProperty('contextWindow');
        expect(model).toHaveProperty('isActive');

        expect(typeof model.id).toBe('string');
        expect(typeof model.provider).toBe('string');
        expect(typeof model.modelName).toBe('string');
        expect(typeof model.displayName).toBe('string');
        expect(model.isActive).toBe(true);

        // Model name should start with provider
        expect(model.modelName).toContain('/');
        const extractedProvider = model.modelName.split('/')[0];
        expect(extractedProvider).toBe(testProvider);
      }

      console.log(`✅ Found ${models.length} models for ${testProvider}`);
      console.log(`   Example: ${models[0].displayName} (${models[0].modelName})`);
      console.log(`   Pricing: $${models[0].inputCostPer1MTokens}/1M input, $${models[0].outputCostPer1MTokens}/1M output`);
    });

    it('should only return active models', async () => {
      const models = await AssistantService.getModelsByCredentialAndProvider(
        testCredentialId,
        testProvider
      );

      for (const model of models) {
        expect(model.isActive).toBe(true);
      }

      console.log(`✅ All returned models are active`);
    });

    it('should throw error for non-existent credential', async () => {
      const fakeCredentialId = '00000000-0000-0000-0000-000000000000';

      try {
        await AssistantService.getModelsByCredentialAndProvider(fakeCredentialId, testProvider);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('not found');
        console.log(`✅ Correctly throws error for non-existent credential`);
      }
    });

    it('should return empty array for non-existent provider', async () => {
      const fakeProvider = 'nonexistent-provider-xyz';

      const models = await AssistantService.getModelsByCredentialAndProvider(
        testCredentialId,
        fakeProvider
      );

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);

      console.log(`✅ Returns empty array for non-existent provider`);
    });

    it('should include pricing information', async () => {
      const models = await AssistantService.getModelsByCredentialAndProvider(
        testCredentialId,
        testProvider
      );

      for (const model of models) {
        // Pricing should be numeric strings or numbers
        expect(model.inputCostPer1MTokens).toBeDefined();
        expect(model.outputCostPer1MTokens).toBeDefined();

        // Convert to number and verify it's valid
        const inputCost = Number(model.inputCostPer1MTokens);
        const outputCost = Number(model.outputCostPer1MTokens);

        expect(isNaN(inputCost)).toBe(false);
        expect(isNaN(outputCost)).toBe(false);
        expect(inputCost).toBeGreaterThanOrEqual(0);
        expect(outputCost).toBeGreaterThanOrEqual(0);
      }

      console.log(`✅ All models have valid pricing information`);
    });

    it('should include context window information', async () => {
      const models = await AssistantService.getModelsByCredentialAndProvider(
        testCredentialId,
        testProvider
      );

      for (const model of models) {
        if (model.contextWindow !== null) {
          expect(typeof model.contextWindow).toBe('number');
          expect(model.contextWindow).toBeGreaterThan(0);
        }
      }

      console.log(`✅ Context window information available where applicable`);
    });
  });

  describe('End-to-End Three-Tier Flow', () => {
    it('should complete full selection flow: credential → provider → model', async () => {
      // Step 1: Get credentials
      const credentials = await AssistantService.getAvailableCredentials();
      expect(credentials.length).toBeGreaterThan(0);

      const credential = credentials[0];
      console.log(`\n🔹 Step 1: Selected credential: ${credential.name}`);

      // Step 2: Get providers for that credential
      const providers = await AssistantService.getProvidersByCredential(credential.id);
      expect(providers.length).toBeGreaterThan(0);

      const provider = providers[0];
      console.log(`🔹 Step 2: Selected provider: ${provider.provider} (${provider.modelCount} models)`);

      // Step 3: Get models for that credential + provider
      const models = await AssistantService.getModelsByCredentialAndProvider(
        credential.id,
        provider.provider
      );
      expect(models.length).toBeGreaterThan(0);
      expect(models.length).toBe(provider.modelCount);

      const model = models[0];
      console.log(`🔹 Step 3: Selected model: ${model.displayName}`);
      console.log(`   Model name: ${model.modelName}`);
      console.log(`   Input: $${model.inputCostPer1MTokens}/1M tokens`);
      console.log(`   Output: $${model.outputCostPer1MTokens}/1M tokens`);
      console.log(`   Context: ${model.contextWindow || 'N/A'} tokens`);

      console.log(`\n✅ Full three-tier selection flow completed successfully`);
    });

    it('should verify provider counts match actual models', async () => {
      const credentials = await AssistantService.getAvailableCredentials();

      for (const credential of credentials) {
        const providers = await AssistantService.getProvidersByCredential(credential.id);

        for (const provider of providers) {
          const models = await AssistantService.getModelsByCredentialAndProvider(
            credential.id,
            provider.provider
          );

          expect(models.length).toBe(provider.modelCount);
        }
      }

      console.log(`✅ Provider model counts are accurate`);
    });
  });
});
