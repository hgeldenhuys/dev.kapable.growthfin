/**
 * Contact Update Tool Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { getContactUpdateTool } from './contact-updater';
import { db } from '@agios/db';
import { crmContacts, crmTimelineEvents, workspaces, users } from '@agios/db/schema';
import { eq, and, desc } from 'drizzle-orm';

function randomId() {
  return Math.random().toString(36).substring(2, 8);
}

describe('Contact Update Tool', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testContactId: string;
  const tool = getContactUpdateTool();

  beforeAll(async () => {
    // Create test user first (needed for workspace)
    const [user] = await db
      .insert(users)
      .values({
        email: `test-${randomId()}@example.com`,
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: `Test Workspace ${randomId()}`,
        slug: `test-${randomId()}`,
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test contact
    const [contact] = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        customFields: {},
      })
      .returning();
    testContactId = contact.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testContactId) {
      await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.entityId, testContactId));
      await db.delete(crmContacts).where(eq(crmContacts.id, testContactId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testWorkspaceId) {
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    }
  });

  it('should update contact fields successfully', async () => {
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        title: 'Chief Technology Officer',
        department: 'Engineering',
      },
      reason: 'LinkedIn profile shows current title as CTO',
      source: 'linkedin',
    });

    expect(result.success).toBe(true);
    expect(result.contactId).toBe(testContactId);
    expect(result.updatedFields).toContain('title');
    expect(result.updatedFields).toContain('department');
    expect(result.timelineEventId).toBeDefined();

    // Verify contact was updated
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, testContactId));
    expect(contact.title).toBe('Chief Technology Officer');
    expect(contact.department).toBe('Engineering');
  });

  it('should create timeline event with audit trail', async () => {
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        phone: '+27123456789',
      },
      reason: 'Web search found contact phone number',
      source: 'web_search',
    });

    expect(result.success).toBe(true);
    expect(result.timelineEventId).toBeDefined();

    // Verify timeline event was created
    const [event] = await db
      .select()
      .from(crmTimelineEvents)
      .where(eq(crmTimelineEvents.id, result.timelineEventId!))
      .limit(1);

    expect(event).toBeDefined();
    expect(event.entityType).toBe('contact');
    expect(event.entityId).toBe(testContactId);
    expect(event.eventType).toBe('contact.ai_enriched');
    expect(event.eventCategory).toBe('data');
    expect(event.actorType).toBe('system');
    expect(event.actorName).toBe('AI Enrichment');
    expect(event.dataChanges).toBeDefined();
    expect(event.metadata).toMatchObject({
      source: 'web_search',
      aiDriven: true,
    });
  });

  it('should update custom fields', async () => {
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        customFields: {
          linkedinUrl: 'https://linkedin.com/in/johndoe',
          companySize: '50-100',
        },
      },
      reason: 'LinkedIn enrichment provided profile URL and company info',
      source: 'linkedin',
    });

    expect(result.success).toBe(true);
    expect(result.updatedFields).toContain('customFields');

    // Verify custom fields were updated
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, testContactId));
    expect(contact.customFields).toMatchObject({
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      companySize: '50-100',
    });
  });

  it('should handle non-existent contact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const result = await tool.updateContact({
      contactId: fakeId,
      workspaceId: testWorkspaceId,
      updates: {
        title: 'CEO',
      },
      reason: 'Test',
      source: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Contact not found');
    expect(result.updatedFields).toEqual([]);
  });

  it('should handle workspace mismatch', async () => {
    const fakeWorkspaceId = '00000000-0000-0000-0000-000000000000';
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: fakeWorkspaceId,
      updates: {
        title: 'CEO',
      },
      reason: 'Test',
      source: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Contact does not belong to this workspace');
    expect(result.updatedFields).toEqual([]);
  });

  it('should return success with no updates if nothing changed', async () => {
    // Update with same values
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        firstName: 'John', // Same as original
      },
      reason: 'Test',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.updatedFields).toEqual([]);
    expect(result.timelineEventId).toBeUndefined();
  });

  it('should track data changes in timeline event', async () => {
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        leadScore: 85,
      },
      reason: 'AI calculated lead score based on engagement',
      source: 'ai_scoring',
    });

    expect(result.success).toBe(true);

    // Verify data changes are tracked
    const [event] = await db
      .select()
      .from(crmTimelineEvents)
      .where(eq(crmTimelineEvents.id, result.timelineEventId!));

    expect(event.dataChanges).toBeDefined();
    const dataChanges = event.dataChanges as any;
    expect(dataChanges.leadScore).toBeDefined();
    expect(dataChanges.leadScore.old).toBe(0); // Default value
    expect(dataChanges.leadScore.new).toBe(85);
  });

  it('should update multiple fields at once', async () => {
    const result = await tool.updateContact({
      contactId: testContactId,
      workspaceId: testWorkspaceId,
      updates: {
        mobile: '+27987654321',
        emailSecondary: 'john.doe.alt@example.com',
        tags: ['vip', 'enterprise'],
      },
      reason: 'Multiple sources provided additional contact information',
      source: 'multi_source',
    });

    expect(result.success).toBe(true);
    expect(result.updatedFields.length).toBeGreaterThanOrEqual(3);

    // Verify all fields were updated
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, testContactId));
    expect(contact.mobile).toBe('+27987654321');
    expect(contact.emailSecondary).toBe('john.doe.alt@example.com');
    expect(contact.tags).toEqual(['vip', 'enterprise']);
  });
});
