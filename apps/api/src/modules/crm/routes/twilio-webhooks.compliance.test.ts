/**
 * Epic 5: SMS Compliance & Opt-Out Tests
 * US-SMS-014, US-SMS-015, US-SMS-016
 *
 * Tests TCPA/GDPR compliance:
 * - STOP keyword detection and opt-out handling
 * - START keyword detection and opt-in handling
 * - Do-not-contact enforcement
 * - Timeline event creation for compliance actions
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads, crmActivities, crmTimelineEvents } from '@agios/db';
import { eq, and, desc } from 'drizzle-orm';
import { config } from 'dotenv';

config(); // Load .env

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

// Test data
let testWorkspaceId: string;
let testUserId: string;
let testLead: any;

beforeAll(async () => {
  // Get test workspace and user
  const workspaces = await db.query.workspaces.findMany({ limit: 1 });
  const users = await db.query.users.findMany({ limit: 1 });

  if (!workspaces[0] || !users[0]) {
    throw new Error('Need at least one workspace and user in database for tests');
  }

  testWorkspaceId = workspaces[0].id;
  testUserId = users[0].id;

  // Clean up old test leads with this phone number to avoid conflicts
  await db.delete(crmLeads).where(eq(crmLeads.phone, '+15142409999'));
  console.log('Cleaned up old test leads with phone +15142409999');

  // Create test lead
  const leads = await db.insert(crmLeads).values({
    workspaceId: testWorkspaceId,
    firstName: 'Compliance',
    lastName: 'Test',
    companyName: 'Test Corp',
    email: 'compliance@test.com',
    phone: '+15142409999', // Test phone number
    status: 'contacted',
    source: 'test',
    ownerId: testUserId,
  }).returning();

  testLead = leads[0];
  console.log(`Created test lead: ${testLead.id} with phone ${testLead.phone}`);
});

describe('SMS Compliance - Opt-Out (US-SMS-014, US-SMS-015)', () => {
  test('STOP keyword marks lead as do_not_contact', async () => {
    // NOTE: URLSearchParams automatically URL-encodes the values (including + in phone numbers)
    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_STOP_TEST_' + Date.now(),
        From: testLead.phone, // URLSearchParams will encode + as %2B
        To: TWILIO_PHONE_NUMBER,
        Body: 'STOP',
      }).toString(),
    });

    // Webhook should succeed
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    // Wait for processing (increased for reliability)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify lead status updated
    const updatedLeads = await db
      .select()
      .from(crmLeads)
      .where(eq(crmLeads.id, testLead.id))
      .limit(1);

    expect(updatedLeads[0].status).toBe('do_not_contact');
    console.log('✓ Lead status updated to do_not_contact');

    // Verify opt-out activity created
    const activities = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.leadId, testLead.id),
        eq(crmActivities.subject, 'SMS Opt-Out')
      ))
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities.length).toBe(1);
    expect(activities[0].channelStatus).toBe('opted_out');
    expect(activities[0].channelMetadata).toHaveProperty('optOut', true);
    expect(activities[0].channelMetadata).toHaveProperty('keyword', 'STOP');
    console.log('✓ Opt-out activity created');
  });

  test('Timeline event created for opt-out (US-SMS-016)', async () => {
    // Verify compliance timeline event
    const timelineEvents = await db
      .select()
      .from(crmTimelineEvents)
      .where(and(
        eq(crmTimelineEvents.entityId, testLead.id),
        eq(crmTimelineEvents.eventType, 'compliance.sms_opt_out')
      ))
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(1);

    expect(timelineEvents.length).toBe(1);
    expect(timelineEvents[0].eventCategory).toBe('compliance');
    expect(timelineEvents[0].eventLabel).toBe('SMS Opt-Out');
    expect(timelineEvents[0].summary).toContain('opted out');
    expect(timelineEvents[0].metadata).toHaveProperty('autoReplyInvoked', true);
    console.log('✓ Compliance timeline event created');
  });

  test('All opt-out keywords work (case-insensitive)', async () => {
    const keywords = ['STOPALL', 'unsubscribe', 'CaNcEl', 'END', 'QuIt'];

    for (const keyword of keywords) {
      // Reset lead to contacted status
      await db.update(crmLeads).set({ status: 'contacted' }).where(eq(crmLeads.id, testLead.id));

      const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          MessageSid: 'SM_OPTOUT_' + keyword + '_' + Date.now(),
          From: testLead.phone,
          To: TWILIO_PHONE_NUMBER,
          Body: keyword,
        }).toString(),
      });

      expect(response.status).toBe(200);

      // Wait for processing (reduced to avoid test timeout)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify status
      const updatedLeads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLead.id)).limit(1);
      expect(updatedLeads[0].status).toBe('do_not_contact');
      console.log(`✓ Keyword "${keyword}" triggered opt-out`);
    }
  }, 15000); // 15 second timeout for this test
});

describe('SMS Compliance - Opt-In (US-SMS-015)', () => {
  test('START keyword re-subscribes lead', async () => {
    // Ensure lead is opted out
    await db.update(crmLeads).set({ status: 'do_not_contact' }).where(eq(crmLeads.id, testLead.id));

    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_START_TEST_' + Date.now(),
        From: testLead.phone,
        To: TWILIO_PHONE_NUMBER,
        Body: 'START',
      }).toString(),
    });

    expect(response.status).toBe(200);

    // Wait for processing (increased for reliability)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify lead status updated to contacted
    const updatedLeads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLead.id)).limit(1);
    expect(updatedLeads[0].status).toBe('contacted');
    console.log('✓ Lead status updated to contacted after START');

    // Verify opt-in activity
    const activities = await db
      .select()
      .from(crmActivities)
      .where(and(
        eq(crmActivities.leadId, testLead.id),
        eq(crmActivities.subject, 'SMS Opt-In')
      ))
      .orderBy(desc(crmActivities.createdAt))
      .limit(1);

    expect(activities.length).toBe(1);
    expect(activities[0].channelStatus).toBe('opted_in');
    console.log('✓ Opt-in activity created');

    // Verify timeline event (US-SMS-016)
    const timelineEvents = await db
      .select()
      .from(crmTimelineEvents)
      .where(and(
        eq(crmTimelineEvents.entityId, testLead.id),
        eq(crmTimelineEvents.eventType, 'compliance.sms_opt_in')
      ))
      .orderBy(desc(crmTimelineEvents.occurredAt))
      .limit(1);

    expect(timelineEvents.length).toBe(1);
    expect(timelineEvents[0].eventCategory).toBe('compliance');
    console.log('✓ Opt-in timeline event created');
  });

  test('UNSTOP keyword also works for opt-in', async () => {
    // Opt out first
    await db.update(crmLeads).set({ status: 'do_not_contact' }).where(eq(crmLeads.id, testLead.id));

    const response = await fetch(`${API_URL}/api/v1/crm/webhooks/twilio/sms/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_UNSTOP_TEST_' + Date.now(),
        From: testLead.phone,
        To: TWILIO_PHONE_NUMBER,
        Body: 'UNSTOP',
      }).toString(),
    });

    expect(response.status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedLeads = await db.select().from(crmLeads).where(eq(crmLeads.id, testLead.id)).limit(1);
    expect(updatedLeads[0].status).toBe('contacted');
    console.log('✓ UNSTOP keyword triggered opt-in');
  });
});

describe('Do-Not-Contact Enforcement (US-SMS-015, US-SMS-016)', () => {
  test('Cannot send SMS to opted-out lead', async () => {
    // Ensure lead is opted out
    await db.update(crmLeads).set({ status: 'do_not_contact' }).where(eq(crmLeads.id, testLead.id));

    const response = await fetch(`${API_URL}/api/v1/crm/leads/${testLead.id}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        userId: testUserId,
        message: 'This should fail due to opt-out',
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('COMPLIANCE_001');
    expect(data.error.message).toContain('opted out');
    console.log('✓ Send SMS blocked for opted-out lead');
  });

  test('Can send SMS to active lead', async () => {
    // Ensure lead is active
    await db.update(crmLeads).set({ status: 'contacted' }).where(eq(crmLeads.id, testLead.id));

    const response = await fetch(`${API_URL}/api/v1/crm/leads/${testLead.id}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        userId: testUserId,
        message: 'Test message to active lead',
      }),
    });

    // NOTE: Test Twilio credentials will fail actual sends (500), but compliance check happens BEFORE send
    // If we got 403, that would mean compliance blocked it (wrong!)
    // If we got 500, that means compliance allowed it, but Twilio send failed (expected with test creds)
    // If we got 200, that means it worked (would need real Twilio creds)
    expect(response.status).not.toBe(403); // Compliance should NOT block active leads
    const data = await response.json();

    if (response.status === 500) {
      // Expected with test Twilio credentials - compliance check passed, send failed
      console.log('✓ Send SMS allowed for active lead (Twilio send failed with test credentials, as expected)');
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    } else {
      // Got 200 - actual send succeeded (would need real credentials)
      console.log('✓ Send SMS allowed and sent successfully');
      expect(data.success).toBe(true);
      expect(data.messageId).toBeDefined();
    }
  });
});

console.log('\n✅ All SMS compliance tests defined');
