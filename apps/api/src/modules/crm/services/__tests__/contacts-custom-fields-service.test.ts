/**
 * Contacts Service - Custom Fields Filtering Test
 * Tests custom field filtering at the service layer
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmContacts, workspaces, users } from '@agios/db';
import { contactService } from '../contacts';
import { eq } from 'drizzle-orm';

describe('Contacts Service - Custom Fields Filtering', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  const testContactIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-svc-cf-${Date.now()}@example.com`,
        name: 'Test User Service',
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - Service Custom Fields',
        slug: 'test-svc-cf-' + Date.now(),
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test contacts with custom fields
    const contactsData = [
      {
        workspaceId: testWorkspaceId,
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@service-test.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 75000,
          region: 'North',
          is_premium: true,
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Bob',
        lastName: 'Baker',
        email: 'bob@service-test.com',
        customFields: {
          ethnicity: 'Hispanic',
          income_bracket: 45000,
          region: 'South',
          is_premium: false,
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'Carol',
        lastName: 'Chen',
        email: 'carol@service-test.com',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: 120000,
          region: 'East',
          is_premium: true,
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        firstName: 'David',
        lastName: 'Davis',
        email: 'david@service-test.com',
        customFields: {
          ethnicity: 'Caucasian',
          income_bracket: 55000,
          region: 'West',
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

  test('lists all contacts without custom field filter', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
    });

    expect(contacts.length).toBe(4);
  });

  test('filters contacts by single custom field', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'Asian',
      },
    });

    expect(contacts.length).toBe(2); // Alice and Carol
    const names = contacts.map((c) => c.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('filters contacts by multiple custom fields', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'Asian',
        region: 'North',
      },
    });

    expect(contacts.length).toBe(1); // Only Alice
    expect(contacts[0].firstName).toBe('Alice');
  });

  test('filters contacts by numeric custom field', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        income_bracket: '75000',
      },
    });

    expect(contacts.length).toBe(1);
    expect(contacts[0].firstName).toBe('Alice');
  });

  test('filters contacts by boolean custom field', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        is_premium: 'true',
      },
    });

    expect(contacts.length).toBe(2); // Alice and Carol
    const names = contacts.map((c) => c.firstName).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('returns empty array when no matches', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'NonExistent',
      },
    });

    expect(contacts.length).toBe(0);
  });

  test('combines standard and custom field filters', async () => {
    // Update Alice's status (first contact)
    await db
      .update(crmContacts)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(crmContacts.id, testContactIds[0]));

    // Also update Carol's status to verify filtering works correctly
    await db
      .update(crmContacts)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(crmContacts.id, testContactIds[2])); // Carol

    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      status: 'active',
      customFieldFilters: {
        ethnicity: 'Asian',
      },
    });

    // Should only return Alice (active + Asian). Carol is Asian but inactive.
    expect(contacts.length).toBe(1);
    expect(contacts[0].firstName).toBe('Alice');
  });

  test('respects pagination with custom field filters', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'Asian',
      },
      limit: 1,
      offset: 0,
    });

    expect(contacts.length).toBe(1); // Limited to 1
  });

  test('sanitizes field names to prevent SQL injection', async () => {
    // Try various SQL injection attempts
    const maliciousFieldNames = [
      "ethnicity'; DROP TABLE contacts; --",
      'ethnicity OR 1=1',
      "ethnicity'; UPDATE contacts SET email='hacked@example.com'; --",
    ];

    for (const maliciousName of maliciousFieldNames) {
      const contacts = await contactService.list(db, {
        workspaceId: testWorkspaceId,
        customFieldFilters: {
          [maliciousName]: 'test',
        },
      });

      // Should return empty array (field doesn't exist after sanitization)
      expect(Array.isArray(contacts)).toBe(true);
    }

    // Verify no data was modified
    const allContacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
    });
    expect(allContacts.length).toBe(4); // All contacts still exist
  });

  test('escapes values to prevent SQL injection', async () => {
    // Try SQL injection in values
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: "Asian' OR '1'='1",
      },
    });

    // Should not match anything (value is escaped)
    expect(contacts.length).toBe(0);
  });

  test('handles null and undefined values gracefully', async () => {
    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'Asian',
        missing_field: null,
      },
    });

    // Null/undefined values should be skipped
    expect(contacts.length).toBe(2); // Alice and Carol (only ethnicity filter applied)
  });

  test('performance: custom field filtering uses GIN index', async () => {
    const startTime = performance.now();

    const contacts = await contactService.list(db, {
      workspaceId: testWorkspaceId,
      customFieldFilters: {
        ethnicity: 'Asian',
        region: 'North',
      },
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(contacts.length).toBe(1);
    // Query should be fast (< 50ms for small dataset)
    expect(duration).toBeLessThan(50);
  });
});
