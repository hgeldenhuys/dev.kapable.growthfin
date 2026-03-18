/**
 * Contacts API - Custom Fields Filtering Test
 * Tests custom field filtering via API endpoints
 */

import { config } from 'dotenv';
config();

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import type { App } from '../../../../index';
import { db } from '@agios/db';
import { crmContacts, workspaces, users } from '@agios/db';
import { eq } from 'drizzle-orm';

// Create API client
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

describe('Contacts API - Custom Fields Filtering', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  const testContactIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-api-cf-${Date.now()}@example.com`,
        name: 'Test User API',
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - API Custom Fields',
        slug: 'test-api-cf-' + Date.now(),
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test contacts
    const contactsData = [
      {
        workspaceId: testWorkspaceId,
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@api-test.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 75000,
          region: 'North',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Bob',
        lastName: 'Baker',
        email: 'bob@api-test.com',
        customFields: {
          ethnicity: 'Hispanic',
          income_bracket: 45000,
          region: 'South',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Carol',
        lastName: 'Chen',
        email: 'carol@api-test.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 120000,
          region: 'East',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    ];

    for (const contactData of contactsData) {
      const [contact] = await db.insert(crmContacts).values(contactData).returning();
      testContactIds.push(contact.id);
    }
  });

  afterAll(async () => {
    // Clean up
    if (testContactIds.length > 0) {
      for (const contactId of testContactIds) {
        await db.delete(crmContacts).where(eq(crmContacts.id, contactId));
      }
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testWorkspaceId) {
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    }
  });

  test('filters contacts by single custom field', async () => {
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=Asian`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2); // Alice and Carol

    const names = data.map((c: any) => c.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('filters contacts by multiple custom fields', async () => {
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=Asian&customFields.region=North`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1); // Only Alice

    expect(data[0].firstName).toBe('Alice');
  });

  test('filters contacts by custom field with URL encoding', async () => {
    const ethnicity = encodeURIComponent('Asian');
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=${ethnicity}`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.length).toBe(2);
  });

  test('returns empty array when no contacts match custom field filter', async () => {
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=NonExistent`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  test('combines standard and custom field filters', async () => {
    // First update one contact's status
    await db
      .update(crmContacts)
      .set({ status: 'active' })
      .where(eq(crmContacts.id, testContactIds[0])); // Alice

    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&status=active&customFields.ethnicity=Asian`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1); // Only Alice (active + Asian)
    expect(data[0].firstName).toBe('Alice');
  });

  test('filters by custom field with numeric value', async () => {
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.income_bracket=75000`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.length).toBe(1);
    expect(data[0].firstName).toBe('Alice');
  });

  test('custom field filter with special characters is sanitized', async () => {
    // Try to inject SQL with special chars - should be sanitized
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.test-field=value`;

    const response = await fetch(url);
    // Should not crash, even if field doesn't match pattern
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('custom field filter respects workspace isolation', async () => {
    // Create another workspace with a contact
    const [otherUser] = await db
      .insert(users)
      .values({
        email: `other-user-${Date.now()}@example.com`,
        name: 'Other User',
      })
      .returning();

    const [otherWorkspace] = await db
      .insert(workspaces)
      .values({
        name: 'Other Workspace',
        slug: 'other-ws-' + Date.now(),
        ownerId: otherUser.id,
      })
      .returning();

    const [otherContact] = await db
      .insert(crmContacts)
      .values({
        workspaceId: otherWorkspace.id,
        firstName: 'Other',
        lastName: 'Contact',
        email: 'other@example.com',
        customFields: { ethnicity: 'Asian' },
        createdBy: otherUser.id,
        updatedBy: otherUser.id,
      })
      .returning();

    // Query first workspace - should not see other workspace's contact
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=Asian`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.length).toBe(2); // Only Alice and Carol from test workspace

    // Cleanup
    await db.delete(crmContacts).where(eq(crmContacts.id, otherContact.id));
    await db.delete(workspaces).where(eq(workspaces.id, otherWorkspace.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  test('pagination works with custom field filters', async () => {
    const url = `${API_URL}/api/v1/crm/contacts?workspaceId=${testWorkspaceId}&customFields.ethnicity=Asian&limit=1&offset=0`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.length).toBe(1); // Should return only 1 due to limit
  });
});
