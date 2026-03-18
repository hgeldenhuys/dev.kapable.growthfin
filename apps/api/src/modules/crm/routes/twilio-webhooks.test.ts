/**
 * Twilio Webhooks Integration Tests
 * Test SMS webhook handlers for inbound messages and delivery status updates
 */

import { config } from 'dotenv';
config();

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads, crmContacts, crmActivities, crmTimelineEvents, workspaces, users } from '@agios/db';
import { eq, and, desc } from 'drizzle-orm';

// Test configuration
const TEST_WORKSPACE_ID = 'test-workspace-twilio-webhooks';
const TEST_USER_ID = 'test-user-twilio-webhooks';
const TEST_LEAD_ID = 'test-lead-twilio-webhooks';
const TEST_PHONE = '+12125551234';
const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('POST /api/v1/crm/webhooks/twilio/sms/inbound', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testLeadId: string;

  beforeAll(async () => {
    // Create test workspace
    const workspace = await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Twilio Webhooks',
        slug: 'test-twilio-webhooks',
        ownerId: TEST_USER_ID,
      })
      .returning();
    testWorkspaceId = workspace[0].id;

    // Create test user
    const user = await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-twilio@example.com',
        name: 'Test User',
        emailVerified: true,
      })
      .returning();
    testUserId = user[0].id;

    // Create test lead with phone number
    const lead = await db
      .insert(crmLeads)
      .values({
        id: TEST_LEAD_ID,
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'Lead',
        companyName: 'Test Company',
        phone: TEST_PHONE,
        email: 'testlead@example.com',
        source: 'test',
        status: 'new',
        ownerId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testLeadId = lead[0].id;
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(crmActivities).where(eq(crmActivities.workspaceId, testWorkspaceId));
    await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.workspaceId, testWorkspaceId));
    await db.delete(crmLeads).where(eq(crmLeads.id, testLeadId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
  });

  test('creates activity for inbound SMS', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: 'SM123test456',
        From: TEST_PHONE,
        To: '+15005550006',
        Body: 'Test inbound message',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');

    // Verify activity was created
    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.leadId, testLeadId),
          eq(crmActivities.channelMessageId, 'SM123test456')
        )
      );

    expect(activities.length).toBe(1);
    expect(activities[0].type).toBe('sms');
    expect(activities[0].direction).toBe('inbound');
    expect(activities[0].channel).toBe('sms');
    expect(activities[0].description).toBe('Test inbound message');
    expect(activities[0].channelStatus).toBe('received');
  });

  test('updates lead status to contacted', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: 'SM789test012',
        From: TEST_PHONE,
        To: '+15005550006',
        Body: 'Another test message',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify lead status was updated
    const leads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLeadId));

    expect(leads[0].status).toBe('contacted');
    expect(leads[0].lastContactDate).toBeTruthy();
  });

  test('creates timeline event', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: 'SM345test678',
        From: TEST_PHONE,
        To: '+15005550006',
        Body: 'Timeline test message',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify timeline event was created
    const events = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, testLeadId),
          eq(crmTimelineEvents.eventType, 'activity.sms_received')
        )
      )
      .orderBy(desc(crmTimelineEvents.createdAt))
      .limit(1);

    expect(events.length).toBe(1);
    expect(events[0].eventCategory).toBe('communication');
    expect(events[0].eventLabel).toBe('SMS Received');
    expect(events[0].summary).toContain('Timeline test message');
  });

  test('handles unknown phone number gracefully', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: 'SM999unknown',
        From: '+19999999999', // Unknown phone
        To: '+15005550006',
        Body: 'Message from unknown number',
        NumSegments: '1',
      }).toString(),
    });

    // Should return 200 with TwiML (don't fail webhook)
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');
  });
});

describe('POST /api/v1/crm/webhooks/twilio/sms/status', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testLeadId: string;
  let testActivityId: string;
  const testMessageSid = 'SM111status222';

  beforeAll(async () => {
    // Reuse workspace and user from previous tests or create new
    const workspaces_result = await db.select().from(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    if (workspaces_result.length > 0) {
      testWorkspaceId = workspaces_result[0].id;
    }

    const users_result = await db.select().from(users).where(eq(users.id, TEST_USER_ID));
    if (users_result.length > 0) {
      testUserId = users_result[0].id;
    }

    const leads_result = await db.select().from(crmLeads).where(eq(crmLeads.id, TEST_LEAD_ID));
    if (leads_result.length > 0) {
      testLeadId = leads_result[0].id;
    }

    // Create test activity with message SID
    const activity = await db
      .insert(crmActivities)
      .values({
        workspaceId: testWorkspaceId,
        leadId: testLeadId,
        assigneeId: testUserId,
        type: 'sms',
        direction: 'outbound',
        channel: 'sms',
        subject: 'Test SMS',
        description: 'Test message',
        status: 'planned',
        channelMessageId: testMessageSid,
        channelStatus: 'sent',
        channelMetadata: {
          provider: 'twilio',
        },
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testActivityId = activity[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(crmActivities).where(eq(crmActivities.id, testActivityId));
  });

  test('updates activity status to delivered', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: testMessageSid,
        MessageStatus: 'delivered',
        From: '+15005550006',
        To: TEST_PHONE,
        Price: '-0.00750',
        PriceUnit: 'USD',
      }).toString(),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received).toBe(true);
    expect(data.activityId).toBe(testActivityId);

    // Verify activity was updated
    const activities = await db.select().from(crmActivities).where(eq(crmActivities.id, testActivityId));

    expect(activities[0].channelStatus).toBe('delivered');
    expect(activities[0].channelMetadata.cost).toBeGreaterThan(0);
  });

  test('handles failed status with error code', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: testMessageSid,
        MessageStatus: 'failed',
        ErrorCode: '30007',
        ErrorMessage: 'Carrier violation',
        From: '+15005550006',
        To: TEST_PHONE,
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify activity was updated with error
    const activities = await db.select().from(crmActivities).where(eq(crmActivities.id, testActivityId));

    expect(activities[0].channelStatus).toBe('failed');
    expect(activities[0].channelErrorCode).toBe('30007');
    expect(activities[0].channelMetadata.errorMessage).toBe('Carrier violation');
  });

  test('handles unknown message SID gracefully', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: 'SM999unknownmessage',
        MessageStatus: 'delivered',
      }).toString(),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received).toBe(true);
    expect(data.warning).toBe('Activity not found');
  });
});

// =============================================================================
// Phase G.3: Contact Support Tests
// =============================================================================

describe('POST /api/v1/crm/webhooks/twilio/sms/inbound - Contact Support (Phase G.3)', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testContactId: string;
  let testContactSecondaryId: string;
  let testContactMobileId: string;
  const TEST_CONTACT_PHONE = '+14155551111';
  const TEST_CONTACT_SECONDARY_PHONE = '+14155552222';
  const TEST_CONTACT_MOBILE = '+14155553333';

  beforeAll(async () => {
    // Create test workspace
    const workspace = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - Contact Support',
        slug: `test-contact-support-${Date.now()}`,
        settings: {
          twilio: {
            defaultPhoneNumber: '+15005550006',
          },
        },
      })
      .returning();
    testWorkspaceId = workspace[0].id;

    // Create test user
    const user = await db
      .insert(users)
      .values({
        email: `test-contact-${Date.now()}@example.com`,
        name: 'Test User Contact',
        emailVerified: true,
        workspaceId: testWorkspaceId,
      })
      .returning();
    testUserId = user[0].id;

    // Create contact with primary phone
    const contact1 = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Primary',
        lastName: 'Phone',
        email: 'primary@example.com',
        phone: TEST_CONTACT_PHONE,
        status: 'active',
        lifecycleStage: 'raw',
        ownerId: testUserId,
      })
      .returning();
    testContactId = contact1[0].id;

    // Create contact with secondary phone
    const contact2 = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Secondary',
        lastName: 'Phone',
        email: 'secondary@example.com',
        phone: '+14155550000', // Different primary
        phoneSecondary: TEST_CONTACT_SECONDARY_PHONE,
        status: 'active',
        lifecycleStage: 'raw',
        ownerId: testUserId,
      })
      .returning();
    testContactSecondaryId = contact2[0].id;

    // Create contact with mobile phone
    const contact3 = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Mobile',
        lastName: 'Phone',
        email: 'mobile@example.com',
        phone: '+14155559999', // Different primary
        mobile: TEST_CONTACT_MOBILE,
        status: 'active',
        lifecycleStage: 'raw',
        ownerId: testUserId,
      })
      .returning();
    testContactMobileId = contact3[0].id;
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(crmActivities).where(eq(crmActivities.workspaceId, testWorkspaceId));
    await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.workspaceId, testWorkspaceId));
    await db.delete(crmContacts).where(eq(crmContacts.workspaceId, testWorkspaceId));
    await db.delete(users).where(eq(users.workspaceId, testWorkspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
  });

  test('creates activity for contact found by primary phone', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}primary`,
        From: TEST_CONTACT_PHONE,
        To: '+15005550006',
        Body: 'Hello from contact primary phone',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');

    // Verify activity was created with contactId
    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.contactId, testContactId),
          eq(crmActivities.direction, 'inbound')
        )
      )
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities.length).toBe(1);
    expect(activities[0].contactId).toBe(testContactId);
    expect(activities[0].leadId).toBeNull();
    expect(activities[0].type).toBe('sms');
    expect(activities[0].channel).toBe('sms');
    expect(activities[0].channelStatus).toBe('received');
  });

  test('creates activity for contact found by secondary phone', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}secondary`,
        From: TEST_CONTACT_SECONDARY_PHONE,
        To: '+15005550006',
        Body: 'Hello from contact secondary phone',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify activity was created with contactId
    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.contactId, testContactSecondaryId),
          eq(crmActivities.direction, 'inbound')
        )
      )
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities.length).toBe(1);
    expect(activities[0].contactId).toBe(testContactSecondaryId);
    expect(activities[0].leadId).toBeNull();
  });

  test('creates activity for contact found by mobile phone', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}mobile`,
        From: TEST_CONTACT_MOBILE,
        To: '+15005550006',
        Body: 'Hello from contact mobile phone',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify activity was created with contactId
    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.contactId, testContactMobileId),
          eq(crmActivities.direction, 'inbound')
        )
      )
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities.length).toBe(1);
    expect(activities[0].contactId).toBe(testContactMobileId);
    expect(activities[0].leadId).toBeNull();
  });

  test('creates timeline event with entityType contact', async () => {
    const msgSid = `SM${Date.now()}timeline`;
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: msgSid,
        From: TEST_CONTACT_PHONE,
        To: '+15005550006',
        Body: 'Timeline test for contact',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify timeline event was created with entityType 'contact'
    const events = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, testContactId),
          eq(crmTimelineEvents.entityType, 'contact'),
          eq(crmTimelineEvents.eventType, 'activity.sms_received')
        )
      )
      .orderBy(desc(crmTimelineEvents.createdAt))
      .limit(1);

    expect(events.length).toBe(1);
    expect(events[0].entityType).toBe('contact');
    expect(events[0].eventCategory).toBe('communication');
  });

  test('handles contact opt-out (STOP)', async () => {
    // First reset contact status to active
    await db.update(crmContacts).set({ status: 'active' }).where(eq(crmContacts.id, testContactId));

    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}stop`,
        From: TEST_CONTACT_PHONE,
        To: '+15005550006',
        Body: 'STOP',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify contact status updated to do_not_contact
    const contacts = await db.select().from(crmContacts).where(eq(crmContacts.id, testContactId));
    expect(contacts[0].status).toBe('do_not_contact');

    // Verify compliance timeline event created
    const events = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, testContactId),
          eq(crmTimelineEvents.eventType, 'compliance.sms_opt_out')
        )
      )
      .orderBy(desc(crmTimelineEvents.createdAt))
      .limit(1);

    expect(events.length).toBe(1);
    expect(events[0].eventCategory).toBe('compliance');
  });

  test('handles contact opt-in (START)', async () => {
    // Set contact status to do_not_contact first
    await db.update(crmContacts).set({ status: 'do_not_contact' }).where(eq(crmContacts.id, testContactId));

    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}start`,
        From: TEST_CONTACT_PHONE,
        To: '+15005550006',
        Body: 'START',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify contact status updated to active
    const contacts = await db.select().from(crmContacts).where(eq(crmContacts.id, testContactId));
    expect(contacts[0].status).toBe('active');

    // Verify compliance timeline event created
    const events = await db
      .select()
      .from(crmTimelineEvents)
      .where(
        and(
          eq(crmTimelineEvents.entityId, testContactId),
          eq(crmTimelineEvents.eventType, 'compliance.sms_opt_in')
        )
      )
      .orderBy(desc(crmTimelineEvents.createdAt))
      .limit(1);

    expect(events.length).toBe(1);
    expect(events[0].eventCategory).toBe('compliance');
  });

  test('lead takes precedence over contact when same phone', async () => {
    // Create a lead with the same phone as contact
    const leadWithSamePhone = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Lead',
        lastName: 'SamePhone',
        companyName: 'Test Company',
        phone: TEST_CONTACT_PHONE, // Same as testContactId
        email: 'lead-same@example.com',
        source: 'test',
        status: 'new',
        ownerId: testUserId,
      })
      .returning();

    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessageSid: `SM${Date.now()}precedence`,
        From: TEST_CONTACT_PHONE,
        To: '+15005550006',
        Body: 'Test precedence',
        NumSegments: '1',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Verify activity was created with leadId (not contactId)
    const activities = await db
      .select()
      .from(crmActivities)
      .where(eq(crmActivities.workspaceId, testWorkspaceId))
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities[0].leadId).toBe(leadWithSamePhone[0].id);

    // Cleanup the test lead
    await db.delete(crmLeads).where(eq(crmLeads.id, leadWithSamePhone[0].id));
  });
});
