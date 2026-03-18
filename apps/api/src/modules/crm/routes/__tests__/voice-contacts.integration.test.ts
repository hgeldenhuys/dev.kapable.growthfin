/**
 * Voice Contact Support Integration Tests (H.1)
 *
 * Tests for browser-initiated voice calls to CONTACTS (not just leads).
 * This is the Phase H.1 extension to support the polymorphic leadId OR contactId pattern.
 *
 * Key test scenarios:
 * 1. Create call activity with contactId
 * 2. Webhook updates activity with contactId
 * 3. Timeline events use entityType: 'contact'
 * 4. Lead calls still work (no regression)
 */

import { config } from 'dotenv';
config();

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import {
  crmContacts,
  crmLeads,
  crmActivities,
  crmTimelineEvents,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

// Test configuration - unique UUIDs to avoid collision
const TEST_WORKSPACE_ID = 'h1-voice-ws-e5f6-4a7b-8c9d-0e1f20a3b4c5';
const TEST_USER_ID = 'h1-voice-usr-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TEST_CONTACT_ID = 'h1-voice-con-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
const TEST_LEAD_ID = 'h1-voice-lead-b8c9-4d0e-1f2a-3b4c5d6e7f8a';
const TEST_PHONE = '+12125551234';
const API_URL = process.env['API_URL'] || 'http://localhost:3000';

describe('Voice Contact Support (H.1)', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testContactId: string;
  let testLeadId: string;

  beforeAll(async () => {
    // Clean up any existing test data first (in correct order for foreign keys)
    await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(crmActivities).where(eq(crmActivities.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(crmContacts).where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(crmLeads).where(eq(crmLeads.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));

    // Create test user FIRST (workspace depends on it)
    const user = await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-voice-contact@example.com',
        name: 'Test Voice Contact User',
        emailVerified: true,
      })
      .returning();
    testUserId = user[0].id;

    // Create test workspace
    const workspace = await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Voice Contacts H.1',
        slug: 'test-voice-contacts-h1',
        ownerId: TEST_USER_ID,
      })
      .returning();
    testWorkspaceId = workspace[0].id;

    // Create test contact with phone number
    const contact = await db
      .insert(crmContacts)
      .values({
        id: TEST_CONTACT_ID,
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'VoiceContact',
        phone: TEST_PHONE,
        email: 'testvoicecontact@example.com',
        source: 'test',
        status: 'active',
        ownerId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testContactId = contact[0].id;

    // Create test lead for regression testing
    const lead = await db
      .insert(crmLeads)
      .values({
        id: TEST_LEAD_ID,
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'VoiceLead',
        companyName: 'Test Company',
        phone: '+12125559876',
        email: 'testvoicelead@example.com',
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
    // Cleanup test data (in correct order for foreign keys)
    await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.workspaceId, testWorkspaceId));
    await db.delete(crmActivities).where(eq(crmActivities.workspaceId, testWorkspaceId));
    await db.delete(crmContacts).where(eq(crmContacts.workspaceId, testWorkspaceId));
    await db.delete(crmLeads).where(eq(crmLeads.workspaceId, testWorkspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('Voice Activity Service - Contact Support', () => {
    test('should create call activity with contactId (not leadId)', async () => {
      const testCallSid = 'CA_contact_call_001';

      // Create activity directly with contactId (simulating what CallWidget would trigger)
      await db.insert(crmActivities).values({
        workspaceId: testWorkspaceId,
        contactId: testContactId, // Using contactId, NOT leadId
        type: 'call',
        direction: 'outbound',
        channel: 'call',
        subject: `Outbound call to ${TEST_PHONE}`,
        description: 'Browser-initiated call via Twilio Voice SDK',
        status: 'planned',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
        channelMessageId: testCallSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid: testCallSid,
          phoneNumber: TEST_PHONE,
          provider: 'twilio',
          source: 'browser',
          entityType: 'contact', // H.1: Track entity type
          entityId: testContactId,
        },
      });

      // Verify activity was created with contactId
      const activities = await db
        .select()
        .from(crmActivities)
        .where(
          and(eq(crmActivities.channelMessageId, testCallSid), isNull(crmActivities.deletedAt))
        );

      expect(activities.length).toBe(1);
      expect(activities[0].contactId).toBe(testContactId);
      expect(activities[0].leadId).toBeNull(); // Should NOT have leadId
      expect(activities[0].status).toBe('planned');

      // Verify metadata has entityType: 'contact'
      const metadata = activities[0].channelMetadata as Record<string, unknown>;
      expect(metadata.entityType).toBe('contact');
      expect(metadata.entityId).toBe(testContactId);
    });

    test('webhook should update contact call activity on completion', async () => {
      const testCallSid = 'CA_contact_call_002';

      // Create activity for this call
      await db.insert(crmActivities).values({
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        type: 'call',
        direction: 'outbound',
        channel: 'call',
        subject: `Outbound call to ${TEST_PHONE}`,
        description: 'Browser-initiated call via Twilio Voice SDK',
        status: 'planned',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
        channelMessageId: testCallSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid: testCallSid,
          phoneNumber: TEST_PHONE,
          provider: 'twilio',
          source: 'browser',
          entityType: 'contact',
          entityId: testContactId,
        },
      });

      // Send completed webhook - NOTE: using contactId in query params
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&contactId=${testContactId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: testCallSid,
            CallStatus: 'completed',
            CallDuration: '90', // 90 seconds = 2 minutes rounded up
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);

      // Verify activity was updated
      const activities = await db
        .select()
        .from(crmActivities)
        .where(
          and(eq(crmActivities.channelMessageId, testCallSid), isNull(crmActivities.deletedAt))
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('completed');
      expect(activities[0].channelStatus).toBe('completed');
      expect(activities[0].duration).toBe(2); // 90 seconds = 2 minutes

      // Verify contact updatedAt was updated (contacts don't have lastContactDate)
      const contacts = await db.select().from(crmContacts).where(eq(crmContacts.id, testContactId));
      expect(contacts[0].updatedAt).toBeTruthy();
    });

    test('should create timeline event with entityType: contact', async () => {
      const testCallSid = 'CA_contact_timeline_001';

      // Create activity for this call
      await db.insert(crmActivities).values({
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        type: 'call',
        direction: 'outbound',
        channel: 'call',
        subject: `Outbound call to ${TEST_PHONE}`,
        description: 'Browser-initiated call via Twilio Voice SDK',
        status: 'planned',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
        channelMessageId: testCallSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid: testCallSid,
          phoneNumber: TEST_PHONE,
          provider: 'twilio',
          source: 'browser',
          entityType: 'contact',
          entityId: testContactId,
        },
      });

      // Send completed webhook
      await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&contactId=${testContactId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: testCallSid,
            CallStatus: 'completed',
            CallDuration: '60',
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      // Verify timeline event was created with entityType: 'contact'
      const events = await db
        .select()
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.entityId, testContactId),
            eq(crmTimelineEvents.entityType, 'contact'),
            eq(crmTimelineEvents.eventType, 'activity.call_completed')
          )
        );

      expect(events.length).toBeGreaterThan(0);
      const latestEvent = events[events.length - 1];
      expect(latestEvent.entityType).toBe('contact'); // H.1: entityType should be contact
      expect(latestEvent.eventCategory).toBe('communication');
      expect(latestEvent.eventLabel).toBe('Call Completed');
    });
  });

  describe('Regression: Lead Voice Calls Still Work', () => {
    test('should still create call activity with leadId', async () => {
      const testCallSid = 'CA_lead_regression_001';

      // Create activity with leadId (original behavior)
      await db.insert(crmActivities).values({
        workspaceId: testWorkspaceId,
        leadId: testLeadId, // Using leadId
        type: 'call',
        direction: 'outbound',
        channel: 'call',
        subject: 'Outbound call to +12125559876',
        description: 'Browser-initiated call via Twilio Voice SDK',
        status: 'planned',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
        channelMessageId: testCallSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid: testCallSid,
          phoneNumber: '+12125559876',
          provider: 'twilio',
          source: 'browser',
          entityType: 'lead',
          entityId: testLeadId,
        },
      });

      // Send completed webhook with leadId
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: testCallSid,
            CallStatus: 'completed',
            CallDuration: '30',
            From: '+15005550006',
            To: '+12125559876',
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      expect(response.status).toBe(200);

      // Verify activity was updated
      const activities = await db
        .select()
        .from(crmActivities)
        .where(
          and(eq(crmActivities.channelMessageId, testCallSid), isNull(crmActivities.deletedAt))
        );

      expect(activities.length).toBe(1);
      expect(activities[0].leadId).toBe(testLeadId);
      expect(activities[0].contactId).toBeNull();
      expect(activities[0].status).toBe('completed');

      // Verify lead lastContactDate was updated
      const leads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLeadId));
      expect(leads[0].lastContactDate).toBeTruthy();
    });

    test('timeline event should use entityType: lead for lead calls', async () => {
      const testCallSid = 'CA_lead_timeline_regression_001';

      // Create activity with leadId
      await db.insert(crmActivities).values({
        workspaceId: testWorkspaceId,
        leadId: testLeadId,
        type: 'call',
        direction: 'outbound',
        channel: 'call',
        subject: 'Outbound call to +12125559876',
        description: 'Browser-initiated call via Twilio Voice SDK',
        status: 'planned',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
        channelMessageId: testCallSid,
        channelStatus: 'initiated',
        channelMetadata: {
          callSid: testCallSid,
          phoneNumber: '+12125559876',
          provider: 'twilio',
          source: 'browser',
          entityType: 'lead',
          entityId: testLeadId,
        },
      });

      // Send completed webhook
      await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: testCallSid,
            CallStatus: 'completed',
            CallDuration: '45',
            From: '+15005550006',
            To: '+12125559876',
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      // Verify timeline event was created with entityType: 'lead'
      const events = await db
        .select()
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.entityId, testLeadId),
            eq(crmTimelineEvents.entityType, 'lead'),
            eq(crmTimelineEvents.eventType, 'activity.call_completed')
          )
        );

      expect(events.length).toBeGreaterThan(0);
      const latestEvent = events[events.length - 1];
      expect(latestEvent.entityType).toBe('lead'); // Should still be lead
    });
  });

  describe('TwiML Client Voice - Contact Support', () => {
    test('should accept contactId in TwiML request', async () => {
      // Test that the TwiML endpoint accepts contactId parameter
      const response = await fetch(`${API_URL}/api/v1/crm/twiml/client-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: TEST_PHONE,
          From: '+15005550006',
          CallSid: 'CA_twiml_contact_test_001',
          workspaceId: testWorkspaceId,
          contactId: testContactId, // H.1: Using contactId
          userId: testUserId,
        }).toString(),
      });

      expect(response.status).toBe(200);

      // TwiML should be valid XML with Dial element
      const twiml = await response.text();
      expect(twiml).toContain('<?xml');
      expect(twiml).toContain('<Dial');
      expect(twiml).toContain('<Number');
      expect(twiml).toContain(TEST_PHONE);

      // Status callback URL should include contactId
      expect(twiml).toContain('contactId=' + testContactId);
    });

    test('should handle both leadId and contactId in status callback URL', async () => {
      // This test verifies the TwiML generates correct status callback URLs
      // for both lead and contact scenarios

      // Test with leadId
      const leadResponse = await fetch(`${API_URL}/api/v1/crm/twiml/client-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: '+12125559876',
          From: '+15005550006',
          CallSid: 'CA_twiml_lead_test_001',
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
          userId: testUserId,
        }).toString(),
      });

      const leadTwiml = await leadResponse.text();
      expect(leadTwiml).toContain('leadId=' + testLeadId);
      expect(leadTwiml).not.toContain('contactId=');

      // Test with contactId
      const contactResponse = await fetch(`${API_URL}/api/v1/crm/twiml/client-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: TEST_PHONE,
          From: '+15005550006',
          CallSid: 'CA_twiml_contact_test_002',
          workspaceId: testWorkspaceId,
          contactId: testContactId,
          userId: testUserId,
        }).toString(),
      });

      const contactTwiml = await contactResponse.text();
      expect(contactTwiml).toContain('contactId=' + testContactId);
      expect(contactTwiml).not.toContain('leadId=');
    });
  });
});
