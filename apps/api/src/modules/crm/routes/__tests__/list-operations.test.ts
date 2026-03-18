/**
 * List Operations Integration Tests
 * Tests for union, subtract, intersect, and split operations
 */

// Load environment variables FIRST
import { config } from 'dotenv';
config();

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import type { App } from '../../../../index';
import { db } from '@agios/db';
import * as schema from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data IDs
let workspaceId: string;
let userId: string;
let list1Id: string;
let list2Id: string;
let list3Id: string;
let leadIds: string[] = [];

// Setup test data
beforeAll(async () => {
  // Create test user first
  const [user] = await db
    .insert(schema.users)
    .values({
      email: `list-ops-test-${Date.now()}@example.com`,
      name: 'List Ops Test User',
    })
    .returning();
  userId = user.id;

  // Create test workspace with owner
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: 'List Operations Test Workspace',
      slug: `list-ops-test-${Date.now()}`,
      ownerId: userId,
    })
    .returning();
  workspaceId = workspace.id;

  // Create test leads
  const leadData = [
    { firstName: 'Alice', lastName: 'Anderson', companyName: 'A Corp', source: 'web' },
    { firstName: 'Bob', lastName: 'Brown', companyName: 'B Corp', source: 'web' },
    { firstName: 'Charlie', lastName: 'Chen', companyName: 'C Corp', source: 'web' },
    { firstName: 'David', lastName: 'Davis', companyName: 'D Corp', source: 'web' },
    { firstName: 'Eve', lastName: 'Evans', companyName: 'E Corp', source: 'web' },
  ];

  const leads = await db
    .insert(schema.crmLeads)
    .values(
      leadData.map((lead) => ({
        ...lead,
        workspaceId,
        createdBy: userId,
        customFields: { industry: lead.companyName.charAt(0), priority: Math.random() > 0.5 ? 'high' : 'low' },
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

// ============================================================================
// UNION Tests
// ============================================================================

describe('POST /crm/lists/operations/union', () => {
  test('creates union of two lists with deduplication', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/union?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, list2Id],
          name: 'Union List 1+2',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list).toBeDefined();
    expect(data.list.name).toBe('Union List 1+2');
    expect(data.list.entityType).toBe('lead');
    expect(data.list.type).toBe('derived');
    expect(data.list.parentListId).toBe(list1Id);

    // List 1: [0,1,2], List 2: [2,3,4] → Union: [0,1,2,3,4] = 5 unique
    expect(data.list.memberCount).toBe(5);

    // Verify members in database
    const members = await db
      .select()
      .from(schema.crmContactListMemberships)
      .where(eq(schema.crmContactListMemberships.listId, data.list.id));

    expect(members.length).toBe(5);
    expect(members.every((m) => m.source === 'operation')).toBe(true);
  });

  test('fails when lists have different entity types', async () => {
    // Create a contact list
    const [contactList] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'contact',
        name: 'Contact List',
        type: 'manual',
        status: 'active',
        customFieldSchema: {},
        totalContacts: 0,
        activeContacts: 0,
        enrichedContacts: 0,
        createdBy: userId,
      })
      .returning();

    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/union?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, contactList.id],
          name: 'Invalid Union',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200); // ElysiaJS returns 200 with error in body
    expect(data.error).toBeDefined();
    expect(data.message).toContain('same entity type');

    // Cleanup
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, contactList.id));
  });

  test('union of 3 lists works correctly', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/union?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, list2Id, list3Id],
          name: 'Union List 1+2+3',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list.memberCount).toBe(5); // Still 5 unique leads
  });
});

// ============================================================================
// SUBTRACT Tests
// ============================================================================

describe('POST /crm/lists/operations/subtract', () => {
  test('creates subtract list correctly', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/subtract?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListId: list1Id,
          subtractListId: list3Id,
          name: 'List 1 - List 3',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list).toBeDefined();
    expect(data.list.name).toBe('List 1 - List 3');
    expect(data.list.type).toBe('derived');

    // List 1: [0,1,2], List 3: [1,2] → Subtract: [0] = 1 member
    expect(data.list.memberCount).toBe(1);

    // Verify correct member (should be Alice - leadIds[0])
    const members = await db
      .select()
      .from(schema.crmContactListMemberships)
      .where(eq(schema.crmContactListMemberships.listId, data.list.id));

    expect(members.length).toBe(1);
    expect(members[0].entityId).toBe(leadIds[0]);
  });

  test('subtract with no common members returns all source members', async () => {
    // Create a new list with only Eve
    const [newList] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'lead',
        name: 'Only Eve',
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
      listId: newList.id,
      entityType: 'lead' as const,
      entityId: leadIds[4],
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    });

    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/subtract?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListId: list1Id,
          subtractListId: newList.id,
          name: 'List 1 - Eve',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list.memberCount).toBe(3); // All 3 members from list1

    // Cleanup
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, newList.id));
  });
});

// ============================================================================
// INTERSECT Tests
// ============================================================================

describe('POST /crm/lists/operations/intersect', () => {
  test('creates intersect list correctly', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/intersect?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, list2Id],
          name: 'Intersect List 1∩2',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list).toBeDefined();
    expect(data.list.name).toBe('Intersect List 1∩2');
    expect(data.list.type).toBe('derived');

    // List 1: [0,1,2], List 2: [2,3,4] → Intersect: [2] = 1 member (Charlie)
    expect(data.list.memberCount).toBe(1);

    // Verify correct member
    const members = await db
      .select()
      .from(schema.crmContactListMemberships)
      .where(eq(schema.crmContactListMemberships.listId, data.list.id));

    expect(members.length).toBe(1);
    expect(members[0].entityId).toBe(leadIds[2]); // Charlie
  });

  test('intersect of 3 lists works correctly', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/intersect?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, list2Id, list3Id],
          name: 'Intersect All 3',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    // List 1: [0,1,2], List 2: [2,3,4], List 3: [1,2] → Intersect: [2] = 1 member
    expect(data.list.memberCount).toBe(1);
  });

  test('intersect with no common members returns empty list', async () => {
    // Create non-overlapping lists
    const [listA] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'lead',
        name: 'List A',
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
      listId: listA.id,
      entityType: 'lead' as const,
      entityId: leadIds[0],
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    });

    const [listB] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'lead',
        name: 'List B',
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
      listId: listB.id,
      entityType: 'lead' as const,
      entityId: leadIds[4],
      source: 'manual' as const,
      addedBy: userId,
      isActive: true,
      enrichmentData: {},
      metadata: {},
      createdBy: userId,
    });

    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/intersect?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [listA.id, listB.id],
          name: 'Empty Intersect',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list.memberCount).toBe(0);

    // Cleanup
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, listA.id));
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, listB.id));
  });
});

// ============================================================================
// SPLIT Tests
// ============================================================================

describe('POST /crm/lists/operations/split', () => {
  test('splits list by custom field correctly', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/split?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListId: list1Id,
          fieldName: 'industry',
        }),
      }
    );

    const data = await response.json();

    // Debug logging
    if (!data.lists) {
      console.log('Split response:', JSON.stringify(data, null, 2));
    }

    expect(response.status).toBe(200);
    expect(data.error).toBeUndefined(); // Should not have error
    expect(data.lists).toBeDefined();
    expect(Array.isArray(data.lists)).toBe(true);
    expect(data.lists.length).toBeGreaterThan(0);

    // Each list should have type 'derived'
    for (const list of data.lists) {
      expect(list.type).toBe('derived');
      expect(list.parentListId).toBe(list1Id);
      expect(list.name).toContain('List 1 - industry=');
    }

    // Total members across all splits should equal source list
    const totalSplitMembers = data.lists.reduce((sum: number, l: any) => sum + l.memberCount, 0);
    expect(totalSplitMembers).toBe(3); // List 1 has 3 members
  });

  test('split by custom field with null values creates null segment', async () => {
    // Create a list with a lead that has no custom field value
    const [leadWithoutField] = await db
      .insert(schema.crmLeads)
      .values({
        workspaceId,
        firstName: 'Frank',
        lastName: 'Foster',
        companyName: 'F Corp',
        source: 'web',
        createdBy: userId,
        customFields: {}, // No custom fields
      })
      .returning();

    const [testList] = await db
      .insert(schema.crmContactLists)
      .values({
        workspaceId,
        entityType: 'lead',
        name: 'Test Split List',
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

    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/split?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListId: testList.id,
          fieldName: 'nonexistent_field',
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists.length).toBe(1);
    expect(data.lists[0].name).toContain('null');

    // Cleanup
    await db.delete(schema.crmContactLists).where(eq(schema.crmContactLists.id, testList.id));
    await db.delete(schema.crmLeads).where(eq(schema.crmLeads.id, leadWithoutField.id));
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Tests', () => {
  test('union operation completes in under 1 second for moderate lists', async () => {
    const startTime = Date.now();

    const response = await fetch(
      `${API_URL}/api/v1/crm/lists/operations/union?workspaceId=${workspaceId}&userId=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListIds: [list1Id, list2Id],
          name: 'Performance Test Union',
        }),
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000); // Less than 1 second

    console.log(`Union operation took ${duration}ms`);
  });
});
