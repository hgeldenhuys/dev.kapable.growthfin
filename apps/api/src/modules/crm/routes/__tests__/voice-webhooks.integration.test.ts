/**
 * Voice Webhooks Integration Tests (VOICE-001)
 * Test browser-initiated call status updates via webhooks
 */

import { config } from 'dotenv';
config();

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads, crmActivities, crmTimelineEvents, workspaces, users } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

// Test configuration - using proper UUIDs (8-4-4-4-12 format)
const TEST_WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f20a3b4c5';
const TEST_USER_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TEST_LEAD_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
const TEST_PHONE = '+12125559876';
const API_URL = process.env['API_URL'] || 'http://localhost:3000';

describe('Voice Webhook Handler (VOICE-001)', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testLeadId: string;

  beforeAll(async () => {
    // Clean up any existing test data first (in correct order for foreign keys)
    await db.delete(crmTimelineEvents).where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(crmActivities).where(eq(crmActivities.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(crmLeads).where(eq(crmLeads.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));

    // Create test user FIRST (workspace depends on it)
    const user = await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-voice@example.com',
        name: 'Test Voice User',
        emailVerified: true,
      })
      .returning();
    testUserId = user[0].id;

    // Create test workspace
    const workspace = await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Voice Webhooks',
        slug: 'test-voice-webhooks',
        ownerId: TEST_USER_ID,
      })
      .returning();
    testWorkspaceId = workspace[0].id;

    // Create test lead with phone number
    const lead = await db
      .insert(crmLeads)
      .values({
        id: TEST_LEAD_ID,
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'VoiceLead',
        companyName: 'Test Voice Company',
        phone: TEST_PHONE,
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
    await db.delete(crmLeads).where(eq(crmLeads.workspaceId, testWorkspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('POST /api/v1/crm/webhooks/twilio-voice', () => {
    const testCallSid = 'CA_test_browser_call_001';

    test('should accept initiated status webhook', async () => {
      // Create activity first (simulating what would happen when browser initiates call)
      await db
        .insert(crmActivities)
        .values({
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
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
          },
        });

      // Send initiated webhook
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: testCallSid,
            CallStatus: 'initiated',
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);

      // Activity should still be planned (not a completion event - status only changes on completion)
      const activities = await db
        .select()
        .from(crmActivities)
        .where(
          and(
            eq(crmActivities.channelMessageId, testCallSid),
            isNull(crmActivities.deletedAt)
          )
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('planned');
    });

    test('should update activity on completed status', async () => {
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
            CallDuration: '45', // 45 seconds
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
          and(
            eq(crmActivities.channelMessageId, testCallSid),
            isNull(crmActivities.deletedAt)
          )
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('completed');
      expect(activities[0].channelStatus).toBe('completed');
      // Duration should be in minutes (45 seconds = 1 minute rounded up)
      expect(activities[0].duration).toBe(1);
      // Check metadata has raw seconds
      const metadata = activities[0].channelMetadata as Record<string, unknown>;
      expect(metadata.durationSeconds).toBe(45);

      // Verify lead lastContactDate was updated
      const leads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLeadId));
      expect(leads[0].lastContactDate).toBeTruthy();
    });

    test('should update activity on no-answer status', async () => {
      const noAnswerCallSid = 'CA_test_no_answer_001';

      // Create activity for this call
      await db
        .insert(crmActivities)
        .values({
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
          type: 'call',
          direction: 'outbound',
          channel: 'call',
          subject: `Outbound call to ${TEST_PHONE}`,
          description: 'Browser-initiated call via Twilio Voice SDK',
          status: 'planned',
          assigneeId: testUserId,
          createdBy: testUserId,
          updatedBy: testUserId,
          channelMessageId: noAnswerCallSid,
          channelStatus: 'initiated',
          channelMetadata: {
            callSid: noAnswerCallSid,
            phoneNumber: TEST_PHONE,
            provider: 'twilio',
            source: 'browser',
          },
        });

      // Send no-answer webhook
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: noAnswerCallSid,
            CallStatus: 'no-answer',
            From: '+15005550006',
            To: TEST_PHONE,
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
          and(
            eq(crmActivities.channelMessageId, noAnswerCallSid),
            isNull(crmActivities.deletedAt)
          )
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('cancelled'); // no-answer maps to cancelled
      expect(activities[0].channelStatus).toBe('no-answer');
    });

    test('should update activity on busy status', async () => {
      const busyCallSid = 'CA_test_busy_001';

      // Create activity for this call
      await db
        .insert(crmActivities)
        .values({
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
          type: 'call',
          direction: 'outbound',
          channel: 'call',
          subject: `Outbound call to ${TEST_PHONE}`,
          description: 'Browser-initiated call via Twilio Voice SDK',
          status: 'planned',
          assigneeId: testUserId,
          createdBy: testUserId,
          updatedBy: testUserId,
          channelMessageId: busyCallSid,
          channelStatus: 'initiated',
          channelMetadata: {
            callSid: busyCallSid,
            phoneNumber: TEST_PHONE,
            provider: 'twilio',
            source: 'browser',
          },
        });

      // Send busy webhook
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: busyCallSid,
            CallStatus: 'busy',
            From: '+15005550006',
            To: TEST_PHONE,
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
          and(
            eq(crmActivities.channelMessageId, busyCallSid),
            isNull(crmActivities.deletedAt)
          )
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('cancelled'); // busy maps to cancelled
      expect(activities[0].channelStatus).toBe('busy');
    });

    test('should update activity on failed status with error info', async () => {
      const failedCallSid = 'CA_test_failed_001';

      // Create activity for this call
      await db
        .insert(crmActivities)
        .values({
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
          type: 'call',
          direction: 'outbound',
          channel: 'call',
          subject: `Outbound call to ${TEST_PHONE}`,
          description: 'Browser-initiated call via Twilio Voice SDK',
          status: 'planned',
          assigneeId: testUserId,
          createdBy: testUserId,
          updatedBy: testUserId,
          channelMessageId: failedCallSid,
          channelStatus: 'initiated',
          channelMetadata: {
            callSid: failedCallSid,
            phoneNumber: TEST_PHONE,
            provider: 'twilio',
            source: 'browser',
          },
        });

      // Send failed webhook with error
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: failedCallSid,
            CallStatus: 'failed',
            ErrorCode: '32003',
            ErrorMessage: 'Callee is unreachable',
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      expect(response.status).toBe(200);

      // Verify activity was updated with error info
      const activities = await db
        .select()
        .from(crmActivities)
        .where(
          and(
            eq(crmActivities.channelMessageId, failedCallSid),
            isNull(crmActivities.deletedAt)
          )
        );

      expect(activities.length).toBe(1);
      expect(activities[0].status).toBe('cancelled'); // failed maps to cancelled
      expect(activities[0].channelStatus).toBe('failed');
      expect(activities[0].channelErrorCode).toBe('32003');
      const metadata = activities[0].channelMetadata as Record<string, unknown>;
      expect(metadata.errorMessage).toBe('Callee is unreachable');
    });

    test('should handle webhook for unknown call gracefully', async () => {
      // Send webhook for a call that doesn't have an activity record
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: 'CA_unknown_call_999',
            CallStatus: 'completed',
            CallDuration: '30',
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      // Should still return 200 (don't fail webhook)
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);
    });

    test('should create timeline event on call completion', async () => {
      const timelineCallSid = 'CA_test_timeline_001';

      // Create activity for this call
      await db
        .insert(crmActivities)
        .values({
          workspaceId: testWorkspaceId,
          leadId: testLeadId,
          type: 'call',
          direction: 'outbound',
          channel: 'call',
          subject: `Outbound call to ${TEST_PHONE}`,
          description: 'Browser-initiated call via Twilio Voice SDK',
          status: 'planned',
          assigneeId: testUserId,
          createdBy: testUserId,
          updatedBy: testUserId,
          channelMessageId: timelineCallSid,
          channelStatus: 'initiated',
          channelMetadata: {
            callSid: timelineCallSid,
            phoneNumber: TEST_PHONE,
            provider: 'twilio',
            source: 'browser',
          },
        });

      // Send completed webhook
      const response = await fetch(
        `${API_URL}/api/v1/crm/webhooks/twilio-voice?workspaceId=${testWorkspaceId}&leadId=${testLeadId}&userId=${testUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            CallSid: timelineCallSid,
            CallStatus: 'completed',
            CallDuration: '120', // 2 minutes
            From: '+15005550006',
            To: TEST_PHONE,
            Direction: 'outbound-api',
          }).toString(),
        }
      );

      expect(response.status).toBe(200);

      // Verify timeline event was created
      // Note: The voiceActivityService creates timeline events when updating activities
      const events = await db
        .select()
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.entityId, testLeadId),
            eq(crmTimelineEvents.eventType, 'activity.call_completed')
          )
        );

      expect(events.length).toBeGreaterThan(0);
      const latestEvent = events[events.length - 1];
      expect(latestEvent.eventCategory).toBe('communication');
      expect(latestEvent.eventLabel).toBe('Call Completed');
    });
  });
});
