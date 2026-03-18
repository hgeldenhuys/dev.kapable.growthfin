/**
 * Custom Fields Segmentation Integration Test
 * Tests custom field querying end-to-end with database
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmContacts, workspaces, users } from '@agios/db';
import { evaluateSegmentCriteria, type Criteria } from '../segment-query-evaluator';
import { eq, and, sql } from 'drizzle-orm';

describe('Custom Fields Segmentation Integration', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  const testContactIds: string[] = [];

  beforeAll(async () => {
    // Create test user first (needed for workspace)
    const [user] = await db
      .insert(users)
      .values({
        email: `test-custom-fields-${Date.now()}@example.com`,
        name: 'Test User',
      })
      .returning();
    testUserId = user.id;

    // Create test workspace with owner
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - Custom Fields',
        slug: 'test-custom-fields-' + Date.now(),
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test contacts with various custom fields
    const contactsData = [
      {
        workspaceId: testWorkspaceId,
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 75000,
          age: 35,
          is_premium: true,
          region: 'North',
          notes: 'This is an important contact',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
        customFields: {
          ethnicity: 'Hispanic',
          income_bracket: 45000,
          age: 28,
          is_premium: false,
          region: 'South',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Carol',
        lastName: 'Williams',
        email: 'carol@example.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 120000,
          age: 42,
          is_premium: true,
          region: 'East',
          notes: 'VIP customer with important requirements',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'David',
        lastName: 'Brown',
        email: 'david@example.com',
        customFields: {
          ethnicity: 'Caucasian',
          income_bracket: 55000,
          age: 31,
          is_premium: false,
          region: 'West',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Eve',
        lastName: 'Davis',
        email: 'eve@example.com',
        customFields: {
          ethnicity: 'African American',
          age: 25,
          region: 'North',
          // No income_bracket or is_premium
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
    // Clean up test data
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

  test('queries contacts by custom field equality', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.ethnicity', operator: '=', value: 'Asian' }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice and Carol
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('queries contacts by custom field numeric comparison', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.income_bracket', operator: '>=', value: 50000 }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
        customFields: crmContacts.customFields,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(3); // Alice (75k), Carol (120k), David (55k)
    for (const result of results) {
      const incomeBracket = (result.customFields as any).income_bracket;
      expect(incomeBracket).toBeGreaterThanOrEqual(50000);
    }
  });

  test('queries contacts by custom field text search', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.notes', operator: 'contains', value: 'important' }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice and Carol
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('queries contacts by custom field IN operator', async () => {
    const criteria: Criteria = {
      all: [
        {
          field: 'customFields.region',
          operator: 'in',
          value: ['North', 'East'],
        },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(3); // Alice (North), Carol (East), Eve (North)
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol', 'Eve']);
  });

  test('queries contacts by custom field boolean', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.is_premium', operator: 'is_true', value: undefined }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice and Carol
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('queries contacts by custom field exists', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.income_bracket', operator: 'exists', value: undefined }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(4); // Alice, Bob, Carol, David (Eve doesn't have income_bracket)
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Carol', 'David']);
  });

  test('queries contacts by custom field not_exists', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.is_premium', operator: 'not_exists', value: undefined }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(1); // Only Eve doesn't have is_premium
    expect(results[0].firstName).toBe('Eve');
  });

  test('queries contacts with mixed standard and custom fields', async () => {
    const criteria: Criteria = {
      all: [
        { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
        { field: 'customFields.income_bracket', operator: '>=', value: 70000 },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
        email: crmContacts.email,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice (75k) and Carol (120k)
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('queries contacts with complex nested criteria', async () => {
    const criteria: Criteria = {
      all: [
        {
          any: [
            { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
            { field: 'customFields.ethnicity', operator: '=', value: 'Hispanic' },
          ],
        },
        { field: 'customFields.income_bracket', operator: '>=', value: 50000 },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice (Asian, 75k) and Carol (Asian, 120k)
    // Bob is Hispanic but only has 45k
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('queries contacts by custom field between', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.age', operator: 'between', value: [30, 40] }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(2); // Alice (35) and David (31)
    const names = results.map((r) => r.firstName).sort();
    expect(names).toEqual(['Alice', 'David']);
  });

  test('handles missing custom fields gracefully', async () => {
    const criteria: Criteria = {
      all: [{ field: 'customFields.nonexistent_field', operator: '=', value: 'test' }],
    };

    const whereClause = evaluateSegmentCriteria(criteria);
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));

    expect(results.length).toBe(0); // No contacts should match
  });

  test('performance: query with GIN index should be fast', async () => {
    const criteria: Criteria = {
      all: [
        { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
        { field: 'customFields.income_bracket', operator: '>=', value: 50000 },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);

    const startTime = performance.now();
    const results = await db
      .select({
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(results.length).toBe(2);
    // Query should complete in reasonable time (under 100ms for small dataset)
    expect(duration).toBeLessThan(100);
  });
});
