/**
 * Integration Tests - Auto-Create Lists on CSV Import with Type Inference
 * Tests for US-LISTS-005 and US-LISTS-007
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { config } from 'dotenv';
import { db } from '@agios/db';
import * as schema from '@agios/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Load environment variables
config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
// Use real UUIDs from database (these must exist for foreign key constraints)
// Query: SELECT id FROM workspaces LIMIT 1; SELECT id FROM users LIMIT 1;
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230'; // Real workspace ID
const TEST_USER_ID = 'bea5f24c-d154-466b-8920-a73596f1f7ab'; // Real user ID

// Cleanup helper
async function cleanup() {
  // Delete test leads
  await db
    .delete(schema.crmLeads)
    .where(eq(schema.crmLeads.workspaceId, TEST_WORKSPACE_ID));

  // Delete test list memberships
  await db
    .delete(schema.crmContactListMemberships)
    .where(eq(schema.crmContactListMemberships.workspaceId, TEST_WORKSPACE_ID));

  // Delete test lists
  await db
    .delete(schema.crmContactLists)
    .where(eq(schema.crmContactLists.workspaceId, TEST_WORKSPACE_ID));
}

describe('Auto-Create Lists on CSV Import with Type Inference', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('US-LISTS-005 AC-001: CSV import detects custom columns', async () => {
    const csvContent = `firstName,lastName,email,source,ethnicity_classification,classification_confidence
John,Doe,john@example.com,website,african,0.95
Jane,Smith,jane@example.com,referral,asian,0.88`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'test-custom-fields.csv',
      }),
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.success).toBe(2);
    expect(result.list).toBeDefined();
    expect(result.list.customFieldsDetected).toContain('ethnicity_classification');
    expect(result.list.customFieldsDetected).toContain('classification_confidence');
  });

  it('US-LISTS-005 AC-002: Creates list with entity_type="lead" and type="import"', async () => {
    const csvContent = `firstName,lastName,email,source,custom_field
Alice,Johnson,alice@example.com,campaign,test_value`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'entity-type-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list).toBeDefined();

    // Verify in database
    const list = await db
      .select()
      .from(schema.crmContactLists)
      .where(
        and(
          eq(schema.crmContactLists.id, result.list.id),
          eq(schema.crmContactLists.workspaceId, TEST_WORKSPACE_ID)
        )
      )
      .limit(1);

    expect(list[0]).toBeDefined();
    expect(list[0].entityType).toBe('lead');
    expect(list[0].type).toBe('import');
  });

  it('US-LISTS-005 AC-003: Stores inferred custom_field_schema', async () => {
    const csvContent = `firstName,lastName,email,source,age,is_active,join_date
Bob,Brown,bob@example.com,event,35,true,2024-01-15`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'schema-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list).toBeDefined();
    expect(result.list.customFieldSchema).toBeDefined();
    expect(result.list.customFieldSchema.age).toEqual({ type: 'number', label: 'Age' });
    expect(result.list.customFieldSchema.is_active).toEqual({ type: 'boolean', label: 'Is Active' });
    expect(result.list.customFieldSchema.join_date).toEqual({ type: 'date', label: 'Join Date' });
  });

  it('US-LISTS-005 AC-004: Adds all imported leads to list', async () => {
    const csvContent = `firstName,lastName,email,source,department
Carol,White,carol@example.com,ad,sales
David,Green,david@example.com,social,marketing
Eve,Black,eve@example.com,email,engineering`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'members-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(3);
    expect(result.list.totalMembers).toBe(3);

    // Verify memberships in database
    const memberships = await db
      .select()
      .from(schema.crmContactListMemberships)
      .where(
        and(
          eq(schema.crmContactListMemberships.listId, result.list.id),
          isNull(schema.crmContactListMemberships.deletedAt)
        )
      );

    expect(memberships.length).toBe(3);
    expect(memberships.every((m) => m.entityType === 'lead')).toBe(true);
    expect(memberships.every((m) => m.source === 'import')).toBe(true);
  });

  it('US-LISTS-005 AC-005: List name includes filename + date', async () => {
    const csvContent = `firstName,lastName,email,source
Test,User,test@example.com,import`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'my-leads.csv',
      }),
    });

    const result = await response.json();
    expect(result.list).toBeDefined();
    expect(result.list.name).toContain('my-leads.csv');
    expect(result.list.name).toMatch(/\d{4}-\d{2}-\d{2}/); // Contains date
  });

  it('US-LISTS-005 AC-006: Handles duplicate names with timestamp', async () => {
    const csvContent = `firstName,lastName,email,source
First,Import,first@example.com,web`;

    // First import
    const response1 = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'duplicate-test.csv',
      }),
    });

    const result1 = await response1.json();
    expect(result1.list).toBeDefined();

    // Wait 1 second to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Second import with same filename
    const response2 = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'duplicate-test.csv',
      }),
    });

    const result2 = await response2.json();
    expect(result2.list).toBeDefined();

    // Lists should have different names (timestamp difference)
    expect(result1.list.name).not.toBe(result2.list.name);
    expect(result1.list.id).not.toBe(result2.list.id);
  });

  it('US-LISTS-007 AC-002: ≥90% numeric → type="number"', async () => {
    const csvContent = `firstName,lastName,email,source,score
User1,Test,user1@example.com,web,95
User2,Test,user2@example.com,web,87
User3,Test,user3@example.com,web,92
User4,Test,user4@example.com,web,78
User5,Test,user5@example.com,web,85
User6,Test,user6@example.com,web,90
User7,Test,user7@example.com,web,88
User8,Test,user8@example.com,web,93
User9,Test,user9@example.com,web,79
User10,Test,user10@example.com,web,91`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'numeric-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list.customFieldSchema.score.type).toBe('number');
  });

  it('US-LISTS-007 AC-003: ≥90% boolean → type="boolean"', async () => {
    const csvContent = `firstName,lastName,email,source,verified
User1,Test,user1@example.com,web,true
User2,Test,user2@example.com,web,false
User3,Test,user3@example.com,web,yes
User4,Test,user4@example.com,web,no
User5,Test,user5@example.com,web,1
User6,Test,user6@example.com,web,0
User7,Test,user7@example.com,web,true
User8,Test,user8@example.com,web,false
User9,Test,user9@example.com,web,yes
User10,Test,user10@example.com,web,no`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'boolean-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list.customFieldSchema.verified.type).toBe('boolean');
  });

  it('US-LISTS-007 AC-004: ≥90% date → type="date"', async () => {
    const csvContent = `firstName,lastName,email,source,created_date
User1,Test,user1@example.com,web,2024-01-15
User2,Test,user2@example.com,web,2024-02-20
User3,Test,user3@example.com,web,2024-03-10
User4,Test,user4@example.com,web,2024-04-05
User5,Test,user5@example.com,web,2024-05-12
User6,Test,user6@example.com,web,2024-06-18
User7,Test,user7@example.com,web,2024-07-22
User8,Test,user8@example.com,web,2024-08-30
User9,Test,user9@example.com,web,2024-09-14
User10,Test,user10@example.com,web,2024-10-25`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'date-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list.customFieldSchema.created_date.type).toBe('date');
  });

  it('US-LISTS-007 AC-005: Default to "text" for mixed data', async () => {
    const csvContent = `firstName,lastName,email,source,mixed_field
User1,Test,user1@example.com,web,100
User2,Test,user2@example.com,web,text_value
User3,Test,user3@example.com,web,2024-01-15
User4,Test,user4@example.com,web,true
User5,Test,user5@example.com,web,another_text
User6,Test,user6@example.com,web,999
User7,Test,user7@example.com,web,mixed_data
User8,Test,user8@example.com,web,false
User9,Test,user9@example.com,web,some_value
User10,Test,user10@example.com,web,12345`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'mixed-test.csv',
      }),
    });

    const result = await response.json();
    expect(result.list.customFieldSchema.mixed_field.type).toBe('text');
  });

  it('US-LISTS-007 AC-006: Stores type in schema in database', async () => {
    const csvContent = `firstName,lastName,email,source,priority,active,due_date,notes
User,Test,user@example.com,web,5,yes,2024-12-31,Some notes here`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'schema-storage-test.csv',
      }),
    });

    const result = await response.json();

    // Verify schema is stored in database
    const list = await db
      .select()
      .from(schema.crmContactLists)
      .where(eq(schema.crmContactLists.id, result.list.id))
      .limit(1);

    const storedSchema = list[0].customFieldSchema as any;
    expect(storedSchema.priority).toEqual({ type: 'number', label: 'Priority' });
    expect(storedSchema.active).toEqual({ type: 'boolean', label: 'Active' });
    expect(storedSchema.due_date).toEqual({ type: 'date', label: 'Due Date' });
    expect(storedSchema.notes).toEqual({ type: 'text', label: 'Notes' });
  });

  it('Complete workflow: Import with custom fields, verify list filtering', async () => {
    const csvContent = `firstName,lastName,email,source,age,department,active
Sarah,Connor,sarah@example.com,web,35,Engineering,true
John,Connor,john@example.com,web,28,Sales,true
Kyle,Reese,kyle@example.com,web,42,Marketing,false`;

    const response = await fetch(`${API_URL}/api/v1/crm/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'workflow-test.csv',
      }),
    });

    const result = await response.json();

    // Verify import success
    expect(result.success).toBe(3);
    expect(result.list).toBeDefined();

    // Verify schema inference
    expect(result.list.customFieldSchema.age.type).toBe('number');
    expect(result.list.customFieldSchema.department.type).toBe('text');
    expect(result.list.customFieldSchema.active.type).toBe('boolean');

    // Verify list was created with correct metadata
    const list = await db
      .select()
      .from(schema.crmContactLists)
      .where(eq(schema.crmContactLists.id, result.list.id))
      .limit(1);

    expect(list[0].tags).toContain('csv-import');
    expect(list[0].tags).toContain('auto-created');
    expect((list[0].metadata as any).importSource).toBe('csv');

    // Verify all leads were added to list
    const members = await db
      .select()
      .from(schema.crmContactListMemberships)
      .where(
        and(
          eq(schema.crmContactListMemberships.listId, result.list.id),
          isNull(schema.crmContactListMemberships.deletedAt)
        )
      );

    expect(members.length).toBe(3);
  });
});
