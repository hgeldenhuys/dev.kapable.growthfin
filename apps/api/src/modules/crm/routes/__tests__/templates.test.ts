/**
 * Templates Routes Tests
 * Unit tests for enrichment template API endpoints
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
import { Database } from '@agios/db';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';
const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Templates API', () => {
  let db: Database;
  let testWorkspaceId: string;
  let testTemplateId: string;
  let testListId: string;

  beforeAll(async () => {
    // Connect to database
    const client = postgres(DATABASE_URL);
    db = drizzle(client) as Database;

    // Get test workspace ID (first workspace in database)
    const workspaces = await db.execute<{ id: string }>(
      `SELECT id FROM workspaces LIMIT 1`
    );
    testWorkspaceId = workspaces[0].id;

    // Get test list ID (first list in workspace)
    const lists = await db.execute<{ id: string }>(
      `SELECT id FROM crm_contact_lists WHERE workspace_id = $1 LIMIT 1`,
      [testWorkspaceId]
    );
    testListId = lists[0]?.id || '';
  });

  it('should create a new template', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/enrichment/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        name: 'Test Enrichment Template',
        description: 'A test template for unit testing',
        type: 'enrichment',
        model: 'openai/gpt-4o-mini',
        prompt: 'Analyze this contact: {contactName}',
        temperature: 0.7,
        maxTokens: 500,
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.template).toBeDefined();
    expect(data.template.name).toBe('Test Enrichment Template');
    expect(data.template.type).toBe('enrichment');

    // Save for later tests
    testTemplateId = data.template.id;
  });

  it('should list all templates for workspace', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates.length).toBeGreaterThan(0);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBeGreaterThan(0);
  });

  it('should filter templates by type', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates?workspaceId=${testWorkspaceId}&type=enrichment`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.templates)).toBe(true);

    // All returned templates should be enrichment type
    for (const template of data.templates) {
      expect(template.type).toBe('enrichment');
    }
  });

  it('should search templates by name', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates?workspaceId=${testWorkspaceId}&search=Test`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.templates)).toBe(true);

    // All returned templates should have "Test" in the name
    for (const template of data.templates) {
      expect(template.name.toLowerCase()).toContain('test');
    }
  });

  it('should get template by ID', async () => {
    if (!testTemplateId) {
      throw new Error('Test template ID not set - create test must run first');
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates/${testTemplateId}?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.template).toBeDefined();
    expect(data.template.id).toBe(testTemplateId);
    expect(data.template.name).toBe('Test Enrichment Template');
  });

  it('should update template', async () => {
    if (!testTemplateId) {
      throw new Error('Test template ID not set - create test must run first');
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates/${testTemplateId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          name: 'Updated Test Template',
          description: 'Updated description',
        }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.template.name).toBe('Updated Test Template');
    expect(data.template.description).toBe('Updated description');
  });

  it('should run dry-run on template', async () => {
    if (!testTemplateId || !testListId) {
      console.warn('Skipping dry-run test - no test template or list');
      return;
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates/${testTemplateId}/dry-run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          listId: testListId,
          sampleSize: 3,
        }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.totalCost).toBeDefined();
    expect(data.averageCostPerContact).toBeDefined();
  });

  it('should soft delete template', async () => {
    if (!testTemplateId) {
      throw new Error('Test template ID not set - create test must run first');
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates/${testTemplateId}?workspaceId=${testWorkspaceId}`,
      {
        method: 'DELETE',
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('deleted');
    expect(data.template.deletedAt).toBeDefined();
  });

  it('should not return deleted templates in list', async () => {
    if (!testTemplateId) {
      throw new Error('Test template ID not set');
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Deleted template should not be in the list
    const deletedTemplate = data.templates.find((t: any) => t.id === testTemplateId);
    expect(deletedTemplate).toBeUndefined();
  });

  it('should return 404 for deleted template get', async () => {
    if (!testTemplateId) {
      throw new Error('Test template ID not set');
    }

    const response = await fetch(
      `${API_URL}/api/v1/crm/enrichment/templates/${testTemplateId}?workspaceId=${testWorkspaceId}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });
});
