/**
 * Custom Fields Performance Test
 * Verifies GIN index usage and query performance
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmContacts, workspaces, users } from '@agios/db';
import { evaluateSegmentCriteria, type Criteria } from '../segment-query-evaluator';
import { eq, and, sql } from 'drizzle-orm';

describe('Custom Fields Performance', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  const testContactIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-perf-${Date.now()}@example.com`,
        name: 'Test User Perf',
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - Performance',
        slug: 'test-perf-' + Date.now(),
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create a larger dataset for performance testing (100 contacts)
    const contactsData = [];
    const ethnicities = ['Asian', 'Hispanic', 'Caucasian', 'African American', 'Other'];
    const regions = ['North', 'South', 'East', 'West', 'Central'];

    for (let i = 0; i < 100; i++) {
      contactsData.push({
        workspaceId: testWorkspaceId,
        firstName: `Contact${i}`,
        lastName: `Lastname${i}`,
        email: `contact${i}@perf-test.com`,
        customFields: {
          ethnicity: ethnicities[i % ethnicities.length],
          income_bracket: 30000 + (i * 1000),
          age: 20 + (i % 50),
          region: regions[i % regions.length],
          score: Math.floor(Math.random() * 100),
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      });
    }

    // Batch insert for better performance
    const inserted = await db.insert(crmContacts).values(contactsData).returning();
    testContactIds.push(...inserted.map((c) => c.id));
  });

  afterAll(async () => {
    // Clean up
    if (testContactIds.length > 0) {
      // Delete in batches to avoid query size limits
      const batchSize = 50;
      for (let i = 0; i < testContactIds.length; i += batchSize) {
        const batch = testContactIds.slice(i, i + batchSize);
        for (const id of batch) {
          await db.delete(crmContacts).where(eq(crmContacts.id, id));
        }
      }
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testWorkspaceId) {
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    }
  });

  test('custom field query completes in < 500ms for 100 contacts', async () => {
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
        id: crmContacts.id,
        firstName: crmContacts.firstName,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(500); // Target: < 500ms
    console.log(`Query completed in ${duration.toFixed(2)}ms for ${results.length} results`);
  });

  test('complex nested query completes in < 500ms', async () => {
    const criteria: Criteria = {
      all: [
        {
          any: [
            { field: 'customFields.ethnicity', operator: '=', value: 'Asian' },
            { field: 'customFields.ethnicity', operator: '=', value: 'Hispanic' },
          ],
        },
        { field: 'customFields.income_bracket', operator: '>=', value: 60000 },
        { field: 'customFields.age', operator: 'between', value: [25, 40] },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);

    const startTime = performance.now();
    const results = await db
      .select({
        id: crmContacts.id,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(500);
    console.log(`Complex nested query completed in ${duration.toFixed(2)}ms`);
  });

  test('multiple custom field filters complete in < 500ms', async () => {
    const criteria: Criteria = {
      all: [
        { field: 'customFields.region', operator: 'in', value: ['North', 'South', 'East'] },
        { field: 'customFields.score', operator: '>', value: 50 },
        { field: 'customFields.income_bracket', operator: 'between', value: [40000, 80000] },
      ],
    };

    const whereClause = evaluateSegmentCriteria(criteria);

    const startTime = performance.now();
    const results = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, testWorkspaceId), sql`${whereClause}`));
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(duration).toBeLessThan(500);
    console.log(`Multiple filters query completed in ${duration.toFixed(2)}ms for ${results.length} results`);
  });

  test('verify GIN index exists on custom_fields column', async () => {
    // Check if GIN index exists using raw SQL
    const result = await db.execute(sql.raw(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'crm_contacts'
        AND indexdef LIKE '%gin%'
        AND indexdef LIKE '%custom_fields%';
    `));

    // Should have at least one GIN index on custom_fields
    const indexes = result as any;
    expect(Array.isArray(indexes)).toBe(true);
    expect(indexes.length).toBeGreaterThan(0);
    console.log('GIN indexes found:', indexes.map((r: any) => r.indexname || 'unknown'));

    // The index should be idx_crm_contacts_custom_fields_gin (created in migration)
    const indexNames = indexes.map((r: any) => r.indexname);
    expect(indexNames).toContain('idx_crm_contacts_custom_fields_gin');
  });
});
