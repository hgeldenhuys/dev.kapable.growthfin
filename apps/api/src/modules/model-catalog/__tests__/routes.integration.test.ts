/**
 * Model Catalog API Integration Tests
 * Tests the GET /api/v1/model-catalog endpoint
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import path from 'path';

// Load .env configuration from project root
config({ path: path.resolve(__dirname, '../../../../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Model Catalog API', () => {
  it('GET /model-catalog returns models array', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('models');
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('returns models with correct structure', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const data = await response.json();

    const model = data.models[0];
    expect(model).toHaveProperty('id');
    expect(model).toHaveProperty('provider');
    expect(model).toHaveProperty('modelName');
    expect(model).toHaveProperty('displayName');
    expect(model).toHaveProperty('inputCostPer1MTokens');
    expect(model).toHaveProperty('outputCostPer1MTokens');
    expect(model).toHaveProperty('contextWindow');
    expect(model).toHaveProperty('isActive');
  });

  it('filters by provider correctly', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog?provider=openapi`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.models.length).toBeGreaterThan(0);

    for (const model of data.models) {
      expect(model.provider).toBe('openapi');
    }
  });

  it('returns 400 for invalid provider', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog?provider=invalid-provider`);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid provider');
  });

  it('includes cost data as strings', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const data = await response.json();

    const model = data.models[0];
    expect(typeof model.inputCostPer1MTokens).toBe('string');
    expect(typeof model.outputCostPer1MTokens).toBe('string');
  });

  it('returns only active models by default', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const data = await response.json();

    for (const model of data.models) {
      expect(model.isActive).toBe(true);
    }
  });

  it('response time is fast (< 100ms)', async () => {
    const start = Date.now();
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(100);
  });

  it('models are sorted by provider and display name', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const data = await response.json();

    // Check that models are sorted
    for (let i = 1; i < data.models.length; i++) {
      const prev = data.models[i - 1];
      const curr = data.models[i];

      // Should be sorted by provider first, then displayName
      if (prev.provider === curr.provider) {
        expect(prev.displayName <= curr.displayName).toBe(true);
      }
    }
  });
});

describe('Model Catalog CRUD Operations', () => {
  let createdModelId: string;

  it('POST /model-catalog creates new model successfully', async () => {
    const newModel = {
      provider: 'openapi',
      model_name: `test-model-${Date.now()}`,
      display_name: 'Test Model for Integration',
      input_cost_per_1m_tokens: 1.5,
      output_cost_per_1m_tokens: 2.5,
      context_window: 8000,
      is_active: true,
      metadata: { test: true },
    };

    const response = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newModel),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('model');
    expect(data.model.provider).toBe(newModel.provider);
    expect(data.model.modelName).toBe(newModel.model_name);
    expect(data.model.displayName).toBe(newModel.display_name);
    expect(data.model.contextWindow).toBe(newModel.context_window);
    expect(data.model.isActive).toBe(true);

    // Save ID for subsequent tests
    createdModelId = data.model.id;
  });

  it('POST /model-catalog returns 409 for duplicate model', async () => {
    // Create a model first
    const uniqueModel = {
      provider: 'openapi',
      model_name: `unique-test-${Date.now()}`,
      display_name: 'Unique Test Model',
      input_cost_per_1m_tokens: 1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const firstResponse = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uniqueModel),
    });
    expect(firstResponse.status).toBe(200);
    const firstData = await firstResponse.json();
    const duplicateModelId = firstData.model.id;

    // Try to create the same model again
    const duplicateResponse = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uniqueModel),
    });

    expect(duplicateResponse.status).toBe(409);
    const data = await duplicateResponse.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('already exists');

    // Cleanup: delete the model
    await fetch(`${API_URL}/api/v1/model-catalog/${duplicateModelId}`, {
      method: 'DELETE',
    });
  });

  it('POST /model-catalog returns 400 for invalid provider', async () => {
    const invalidModel = {
      provider: 'invalid-provider',
      model_name: 'test-model',
      display_name: 'Test Model',
      input_cost_per_1m_tokens: 1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const response = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidModel),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid provider');
  });

  it('PUT /model-catalog/:id updates model successfully', async () => {
    // First create a model to update
    const modelToUpdate = {
      provider: 'openapi',
      model_name: `update-test-${Date.now()}`,
      display_name: 'Update Test Model',
      input_cost_per_1m_tokens: 1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const createResponse = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelToUpdate),
    });
    const createData = await createResponse.json();
    const modelId = createData.model.id;

    // Update the model
    const updates = {
      display_name: 'Updated Display Name',
      input_cost_per_1m_tokens: 1.75,
      output_cost_per_1m_tokens: 2.75,
      context_window: 16000,
    };

    const updateResponse = await fetch(`${API_URL}/api/v1/model-catalog/${modelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    expect(updateResponse.status).toBe(200);
    const data = await updateResponse.json();
    expect(data.model.displayName).toBe(updates.display_name);
    expect(data.model.inputCostPer1MTokens).toBe('1.75');
    expect(data.model.outputCostPer1MTokens).toBe('2.75');
    expect(data.model.contextWindow).toBe(updates.context_window);

    // Cleanup
    await fetch(`${API_URL}/api/v1/model-catalog/${modelId}`, {
      method: 'DELETE',
    });
  });

  it('PUT /model-catalog/:id returns 404 for non-existent model', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const updates = {
      display_name: 'Updated Name',
    };

    const response = await fetch(`${API_URL}/api/v1/model-catalog/${fakeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Model not found');
  });

  it('PUT /model-catalog/:id returns 400 for invalid provider', async () => {
    // Create a model first
    const model = {
      provider: 'openapi',
      model_name: `invalid-provider-test-${Date.now()}`,
      display_name: 'Invalid Provider Test',
      input_cost_per_1m_tokens: 1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const createResponse = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    });
    const createData = await createResponse.json();
    const modelId = createData.model.id;

    // Try to update with invalid provider
    const updates = {
      provider: 'invalid-provider',
    };

    const updateResponse = await fetch(`${API_URL}/api/v1/model-catalog/${modelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    expect(updateResponse.status).toBe(400);
    const data = await updateResponse.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid provider');

    // Cleanup
    await fetch(`${API_URL}/api/v1/model-catalog/${modelId}`, {
      method: 'DELETE',
    });
  });

  it('DELETE /model-catalog/:id deletes model successfully', async () => {
    // Create a model to delete
    const modelToDelete = {
      provider: 'openapi',
      model_name: `delete-test-${Date.now()}`,
      display_name: 'Delete Test Model',
      input_cost_per_1m_tokens: 1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const createResponse = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelToDelete),
    });
    const createData = await createResponse.json();
    const modelId = createData.model.id;

    // Delete the model
    const deleteResponse = await fetch(`${API_URL}/api/v1/model-catalog/${modelId}`, {
      method: 'DELETE',
    });

    expect(deleteResponse.status).toBe(200);
    const data = await deleteResponse.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Model deleted successfully');

    // Verify deletion by trying to fetch
    const getResponse = await fetch(`${API_URL}/api/v1/model-catalog?is_active=false`);
    const getData = await getResponse.json();
    const deleted = getData.models.find((m: any) => m.id === modelId);
    expect(deleted).toBeUndefined();
  });

  it('DELETE /model-catalog/:id returns 404 for non-existent model', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await fetch(`${API_URL}/api/v1/model-catalog/${fakeId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Model not found');
  });

  it('validates required fields on POST', async () => {
    const invalidModel = {
      provider: 'openapi',
      // Missing required fields
    };

    const response = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidModel),
    });

    expect(response.status).toBe(400);
  });

  it('validates costs are positive numbers', async () => {
    const invalidModel = {
      provider: 'openapi',
      model_name: 'test-negative-cost',
      display_name: 'Test Negative Cost',
      input_cost_per_1m_tokens: -1.0,
      output_cost_per_1m_tokens: 2.0,
    };

    const response = await fetch(`${API_URL}/api/v1/model-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidModel),
    });

    expect(response.status).toBe(400);
  });
});

describe('Provider-based Selection (Two-tier)', () => {
  it('GET /model-catalog/providers returns list of providers', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('providers');
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.providers.length).toBeGreaterThan(0);
  });

  it('providers have correct structure', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    const data = await response.json();

    const provider = data.providers[0];
    expect(provider).toHaveProperty('name');
    expect(provider).toHaveProperty('displayName');
    expect(provider).toHaveProperty('modelCount');
    expect(typeof provider.name).toBe('string');
    expect(typeof provider.displayName).toBe('string');
    expect(typeof provider.modelCount).toBe('number');
    expect(provider.modelCount).toBeGreaterThan(0);
  });

  it('providers are sorted alphabetically by display name', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    const data = await response.json();

    // Check that providers are sorted
    for (let i = 1; i < data.providers.length; i++) {
      const prev = data.providers[i - 1];
      const curr = data.providers[i];
      expect(prev.displayName <= curr.displayName).toBe(true);
    }
  });

  it('provider display names are formatted correctly', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    const data = await response.json();

    const expectedMappings: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google': 'Google',
      'meta-llama': 'Meta',
      'mistralai': 'Mistral AI',
    };

    for (const provider of data.providers) {
      if (expectedMappings[provider.name]) {
        expect(provider.displayName).toBe(expectedMappings[provider.name]);
      }
    }
  });

  it('excludes test models from provider list', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    const data = await response.json();

    for (const provider of data.providers) {
      expect(provider.name).not.toMatch(/^test-/);
      expect(provider.name).not.toMatch(/^dup-/);
      expect(provider.name).not.toMatch(/^debug-/);
    }
  });

  it('GET /model-catalog/providers/:provider/models returns models for specific provider', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers/anthropic/models`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('provider');
    expect(data).toHaveProperty('displayName');
    expect(data).toHaveProperty('models');
    expect(data.provider).toBe('anthropic');
    expect(data.displayName).toBe('Anthropic');
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('models for provider all match provider prefix', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers/openai/models`);
    const data = await response.json();

    for (const model of data.models) {
      expect(model.modelName).toMatch(/^openai\//);
    }
  });

  it('models for provider are sorted by display name', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers/anthropic/models`);
    const data = await response.json();

    // Check that models are sorted
    for (let i = 1; i < data.models.length; i++) {
      const prev = data.models[i - 1];
      const curr = data.models[i];
      expect(prev.displayName <= curr.displayName).toBe(true);
    }
  });

  it('returns empty array for provider with no models', async () => {
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers/nonexistent/models`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.provider).toBe('nonexistent');
    expect(data.models).toEqual([]);
  });

  it('response time for providers endpoint is fast (< 50ms)', async () => {
    const start = Date.now();
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers`);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(50);
  });

  it('response time for provider models endpoint is fast (< 100ms)', async () => {
    const start = Date.now();
    const response = await fetch(`${API_URL}/api/v1/model-catalog/providers/openai/models`);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(100);
  });
});
