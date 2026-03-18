/**
 * List Operations Service Unit Tests
 * Direct service layer testing without HTTP
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import * as schema from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { union, subtract, intersect, split } from '../list-operations.service';

// Test data IDs
let workspaceId: string;
let userId: string;
let list1Id: string;
let list2Id: string;
let list3Id: string;
let leadIds: string[] = [];

// Setup test data
beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(schema.users)
    .values({
      email: `list-ops-service-test-${Date.now()}@example.com`,
      name: 'List Ops Service Test User',
    })
    .returning();
  userId = user.id;

  // Create test workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: 'List Operations Service Test Workspace',
      slug: `list-ops-service-test-${Date.now()}`,
      ownerId: userId,
    })
    .returning();
  workspaceId = workspace.id;

  // Create test leads with custom fields
  const leadData = [
    {
      firstName: 'Alice',
      lastName: 'Anderson',
      companyName: 'A Corp',
      source: 'web',
      customFields: { industry: 'A', priority: 'high' },
    },
    {
      firstName: 'Bob',
      lastName: 'Brown',
      companyName: 'B Corp',
      source: 'web',
      customFields: { industry: 'B', priority: 'low' },
    },
    {
      firstName: 'Charlie',
      lastName: 'Chen',
      companyName: 'C Corp',
      source: 'web',
      customFields: { industry: 'C', priority: 'high' },
    },
    {
      firstName: 'David',
      lastName: 'Davis',
      companyName: 'D Corp',
      source: 'web',
      customFields: { industry: 'D', priority: 'medium' },
    },
    {
      firstName: 'Eve',
      lastName: 'Evans',
      companyName: 'E Corp',
      source: 'web',
      customFields: { industry: 'E', priority: 'low' },
    },
  ];

  const leads = await db
    .insert(schema.crmLeads)
    .values(
      leadData.map((lead) => ({
        ...lead,
        workspaceId,
        createdBy: userId,
      }))
    )
    .returning();

  leadIds = leads.map((l) => l.id);

  // Create List 1: Alice, Bob, Charlie (ids 0, 1, 2)
  const [l1] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId,
      entityType: 'lead',
      name: 'List 1',
      type: 'manual',
      status: 'active',
      customFieldSchema: {},
      totalContacts: 3,
      activeContacts: 3,
      enrichedContacts: 0,
      createdBy: userId,
    })
    .returning();
  list1Id = l1.id;

  await db.insert(schema.crmContactListMemberships).values(
    [leadIds[0], leadIds[1], leadIds[2]].map((leadId) => ({
      workspaceId,
      listId: list1Id,
      entityType: 'lead' as const,
      entityId: leadId,
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    }))
  );

  // Create List 2: Charlie, David, Eve (ids 2, 3, 4)
  const [l2] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId,
      entityType: 'lead',
      name: 'List 2',
      type: 'manual',
      status: 'active',
      customFieldSchema: {},
      totalContacts: 3,
      activeContacts: 3,
      enrichedContacts: 0,
      createdBy: userId,
    })
    .returning();
  list2Id = l2.id;

  await db.insert(schema.crmContactListMemberships).values(
    [leadIds[2], leadIds[3], leadIds[4]].map((leadId) => ({
      workspaceId,
      listId: list2Id,
      entityType: 'lead' as const,
      entityId: leadId,
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    }))
  );

  // Create List 3: Bob, Charlie (ids 1, 2)
  const [l3] = await db
    .insert(schema.crmContactLists)
    .values({
      workspaceId,
      entityType: 'lead',
      name: 'List 3',
      type: 'manual',
      status: 'active',
      customFieldSchema: {},
      totalContacts: 2,
      activeContacts: 2,
      enrichedContacts: 0,
      createdBy: userId,
    })
    .returning();
  list3Id = l3.id;

  await db.insert(schema.crmContactListMemberships).values(
    [leadIds[1], leadIds[2]].map((leadId) => ({
      workspaceId,
      listId: list3Id,
      entityType: 'lead' as const,
      entityId: leadId,
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    }))
  );
});

// Cleanup test data
afterAll(async () => {
  if (workspaceId) {
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
  }
  if (userId) {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }
});

describe('union()', () => {
  test('creates union with deduplication', async () => {
    const result = await union(db, {
      workspaceId,
      sourceListIds: [list1Id, list2Id],
      name: 'Union Test',
      userId,
    });

    expect(result.name).toBe('Union Test');
    expect(result.entityType).toBe('lead');
    expect(result.type).toBe('derived');
    expect(result.memberCount).toBe(5); // All 5 unique leads
  });
});

describe('subtract()', () => {
  test('creates subtract list correctly', async () => {
    const result = await subtract(db, {
      workspaceId,
      sourceListId: list1Id,
      subtractListId: list3Id,
      name: 'Subtract Test',
      userId,
    });

    expect(result.name).toBe('Subtract Test');
    expect(result.memberCount).toBe(1); // Only Alice remains
  });
});

describe('intersect()', () => {
  test('creates intersect list correctly', async () => {
    const result = await intersect(db, {
      workspaceId,
      sourceListIds: [list1Id, list2Id],
      name: 'Intersect Test',
      userId,
    });

    expect(result.name).toBe('Intersect Test');
    expect(result.memberCount).toBe(1); // Only Charlie is in both
  });
});

describe('split()', () => {
  test('splits by custom field correctly', async () => {
    const results = await split(db, {
      workspaceId,
      sourceListId: list1Id,
      fieldName: 'priority',
      userId,
    });

    expect(results.length).toBeGreaterThan(0);

    // Verify segment names and counts
    const segmentMap = results.reduce((acc, list) => {
      const match = list.name.match(/priority=(\w+)/);
      if (match) {
        acc[match[1]] = list.memberCount;
      }
      return acc;
    }, {} as Record<string, number>);

    // List 1 has: Alice (high), Bob (low), Charlie (high)
    expect(segmentMap.high).toBe(2);
    expect(segmentMap.low).toBe(1);
  });

  test('handles missing custom field values', async () => {
    // Create lead without priority field
    const [leadWithoutField] = await db
      .insert(schema.crmLeads)
      .values({
        workspaceId,
        firstName: 'Frank',
        lastName: 'Foster',
        companyName: 'F Corp',
        source: 'web',
        createdBy: userId,
        customFields: {}, // No priority field
      })
      .returning();

    const [testList] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'lead',
        name: 'Test Split With Null',
        type: 'manual',
        status: 'active',
        customFieldSchema: {},
        totalContacts: 1,
        activeContacts: 1,
        enrichedContacts: 0,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.crmContactListMemberships).values({
      workspaceId,
      listId: testList.id,
      entityType: 'lead' as const,
      entityId: leadWithoutField.id,
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    });

    const results = await split(db, {
      workspaceId,
      sourceListId: testList.id,
      fieldName: 'priority',
      userId,
    });

    expect(results.length).toBe(1);
    expect(results[0].name).toContain('null');
    expect(results[0].memberCount).toBe(1);

    // Cleanup
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, testList.id));
    await db.delete(schema.crmLeads).where(eq(schema.crmLeads.id, leadWithoutField.id));
  });
});
