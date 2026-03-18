import { config } from 'dotenv';
config();

/**
 * Campaign Recipients De-duplication Tests (US-TEST-007)
 * Tests POST /:id/recipients de-duplication logic
 *
 * AC-001: Test validates adding same contact twice doesn't create duplicates
 * AC-002: Test validates response indicates de-duplication occurred
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '@agios/db/client';
import {
  crmCampaigns,
  crmCampaignRecipients,
  crmContacts,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

// Test configuration from .env
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1/crm`;

// Fixed UUIDs for idempotent test runs
const TEST_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const TEST_OWNER_ID = '00000000-0000-0000-0000-000000000002';
const TEST_CAMPAIGN_ID = '00000000-0000-0000-0000-000000000020';
const TEST_CONTACT_1_ID = '00000000-0000-0000-0000-000000000021';
const TEST_CONTACT_2_ID = '00000000-0000-0000-0000-000000000022';
const TEST_CONTACT_3_ID = '00000000-0000-0000-0000-000000000023';

describe('POST /:id/recipients De-duplication Tests (US-TEST-007)', () => {
  // Setup test data
  beforeAll(async () => {
    // Clean up any existing test data (idempotency)
    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmContacts)
      .where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(workspaces)
      .where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db
      .delete(users)
      .where(eq(users.id, TEST_OWNER_ID));

    // Create test user
    await db.insert(users).values({
      id: TEST_OWNER_ID,
      name: 'Test Owner',
      email: `test-owner-${TEST_OWNER_ID}@test.com`,
      emailVerified: false,
    }).onConflictDoNothing();

    // Create test workspace
    await db.insert(workspaces).values({
      id: TEST_WORKSPACE_ID,
      name: 'Test Workspace - Dedup',
      slug: 'test-campaigns-dedup-007',
      ownerId: TEST_OWNER_ID,
    }).onConflictDoNothing();

    // Create test campaign
    await db.insert(crmCampaigns).values({
      id: TEST_CAMPAIGN_ID,
      workspaceId: TEST_WORKSPACE_ID,
      name: 'Test Campaign - Dedup',
      objective: 'lead_generation',
      type: 'one_time',
      status: 'draft',
      channels: ['email'],
      createdBy: TEST_OWNER_ID,
    }).onConflictDoNothing();

    // Create test contacts
    await db.insert(crmContacts).values([
      {
        id: TEST_CONTACT_1_ID,
        workspaceId: TEST_WORKSPACE_ID,
        email: 'contact1-dedup@test.com',
        firstName: 'Contact',
        lastName: 'One',
        lifecycleStage: 'verified',
      },
      {
        id: TEST_CONTACT_2_ID,
        workspaceId: TEST_WORKSPACE_ID,
        email: 'contact2-dedup@test.com',
        firstName: 'Contact',
        lastName: 'Two',
        lifecycleStage: 'verified',
      },
      {
        id: TEST_CONTACT_3_ID,
        workspaceId: TEST_WORKSPACE_ID,
        email: 'contact3-dedup@test.com',
        firstName: 'Contact',
        lastName: 'Three',
        lifecycleStage: 'verified',
      },
    ]).onConflictDoNothing();
  });

  // Clean before each test to ensure isolation
  beforeEach(async () => {
    // Remove all recipients from test campaign
    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.campaignId, TEST_CAMPAIGN_ID));

    // Reset campaign totalRecipients counter
    await db
      .update(crmCampaigns)
      .set({ totalRecipients: 0 })
      .where(eq(crmCampaigns.id, TEST_CAMPAIGN_ID));
  });

  // Cleanup after all tests
  afterAll(async () => {
    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmContacts)
      .where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(workspaces)
      .where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db
      .delete(users)
      .where(eq(users.id, TEST_OWNER_ID));
  });

  /**
   * AC-001: Single Contact De-duplication
   * Test validates adding same contact twice doesn't create duplicates
   */
  test('AC-001: adding same contact twice does not create duplicates', async () => {
    // First addition - should succeed
    const response1 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response1.status).toBe(200);
    const data1 = await response1.json();

    // Verify first addition succeeded
    expect(data1).toHaveProperty('success');
    expect(data1.success).toBe(true);
    expect(data1).toHaveProperty('added');
    expect(data1.added).toBe(1);

    // Second addition (same contact) - should NOT create duplicate
    const response2 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response2.status).toBe(200);
    const data2 = await response2.json();

    // AC-002: Response should indicate de-duplication
    expect(data2).toHaveProperty('success');
    expect(data2.success).toBe(true);
    expect(data2).toHaveProperty('added');
    expect(data2.added).toBe(0); // No new recipients added

    // Response should indicate contact already exists
    expect(
      data2.skipped === 1 ||
      data2.existing === 1 ||
      data2.duplicates === 1
    ).toBe(true);

    // HARD ASSERTION: Verify database has only 1 recipient
    const recipients = await db.select()
      .from(crmCampaignRecipients)
      .where(and(
        eq(crmCampaignRecipients.campaignId, TEST_CAMPAIGN_ID),
        eq(crmCampaignRecipients.contactId, TEST_CONTACT_1_ID),
        isNull(crmCampaignRecipients.deletedAt)
      ));

    expect(recipients.length).toBe(1); // Exactly 1 recipient, not 2
  });

  /**
   * AC-001 & AC-002: Multiple Contacts with One Duplicate
   * Test validates partial de-duplication
   */
  test('AC-001, AC-002: adding multiple contacts with one duplicate skips only the duplicate', async () => {
    // First: Add Contact 1
    const response1 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.added).toBe(1);

    // Second: Add Contact 1 (duplicate) and Contact 2 (new)
    const response2 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID, TEST_CONTACT_2_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response2.status).toBe(200);
    const data2 = await response2.json();

    // Should add only Contact 2 (new)
    expect(data2.added).toBe(1);

    // Should indicate 1 was skipped/existing
    expect(
      data2.skipped === 1 ||
      data2.existing === 1 ||
      data2.duplicates === 1
    ).toBe(true);

    // Verify database has exactly 2 recipients total
    const recipients = await db.select()
      .from(crmCampaignRecipients)
      .where(and(
        eq(crmCampaignRecipients.campaignId, TEST_CAMPAIGN_ID),
        isNull(crmCampaignRecipients.deletedAt)
      ));

    expect(recipients.length).toBe(2); // Contact 1 and Contact 2, no duplicates
  });

  /**
   * AC-001: Multiple Contacts, All Duplicates
   * Test validates response when all contacts already exist
   */
  test('AC-001, AC-002: adding all existing contacts returns zero added', async () => {
    // First: Add Contacts 1 and 2
    const response1 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID, TEST_CONTACT_2_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.added).toBe(2);

    // Second: Try to add the same contacts again
    const response2 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID, TEST_CONTACT_2_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response2.status).toBe(200);
    const data2 = await response2.json();

    // Should add 0 new recipients
    expect(data2.added).toBe(0);

    // Should indicate 2 were skipped/existing
    expect(
      data2.skipped === 2 ||
      data2.existing === 2 ||
      data2.duplicates === 2
    ).toBe(true);

    // Verify database still has only 2 recipients
    const recipients = await db.select()
      .from(crmCampaignRecipients)
      .where(and(
        eq(crmCampaignRecipients.campaignId, TEST_CAMPAIGN_ID),
        isNull(crmCampaignRecipients.deletedAt)
      ));

    expect(recipients.length).toBe(2); // Still only 2, no duplicates
  });

  /**
   * AC-002: Response Format Validation
   * Test validates response includes necessary de-duplication indicators
   */
  test('AC-002: response format includes de-duplication indicators', async () => {
    // Add contact first time
    await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    // Try to add same contact again
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    const data = await response.json();

    // Required fields
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('added');

    // De-duplication indicator (at least one should exist)
    const hasDedupIndicator =
      data.hasOwnProperty('skipped') ||
      data.hasOwnProperty('existing') ||
      data.hasOwnProperty('duplicates');

    expect(hasDedupIndicator).toBe(true);

    // If field exists, should be a number
    if (data.skipped !== undefined) {
      expect(typeof data.skipped).toBe('number');
    }
    if (data.existing !== undefined) {
      expect(typeof data.existing).toBe('number');
    }
    if (data.duplicates !== undefined) {
      expect(typeof data.duplicates).toBe('number');
    }
  });

  /**
   * API-level De-duplication Verification
   * Test validates API-level de-duplication works correctly
   * Note: Database-level constraint is recommended but not required
   */
  test('API layer prevents duplicates through de-duplication logic', async () => {
    // Add recipient via API (first time)
    const response1 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.added).toBe(1);

    // Add same recipient via API (second time)
    const response2 = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.added).toBe(0); // No duplicates added
    expect(data2.skipped).toBe(1); // Indicates de-duplication

    // Verify database has exactly 1 recipient
    const recipients = await db.select()
      .from(crmCampaignRecipients)
      .where(and(
        eq(crmCampaignRecipients.campaignId, TEST_CAMPAIGN_ID),
        eq(crmCampaignRecipients.contactId, TEST_CONTACT_1_ID),
        isNull(crmCampaignRecipients.deletedAt)
      ));

    expect(recipients.length).toBe(1); // API prevented duplicate
  });

  /**
   * Campaign Total Recipients Counter Accuracy
   * Test validates totalRecipients counter respects de-duplication
   */
  test('campaign totalRecipients counter accounts for de-duplication', async () => {
    // Add 2 unique contacts
    await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_1_ID, TEST_CONTACT_2_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    // Try to add 1 duplicate and 1 new
    await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: TEST_WORKSPACE_ID,
          contactIds: [TEST_CONTACT_2_ID, TEST_CONTACT_3_ID],
          addedBy: TEST_OWNER_ID,
        }),
      }
    );

    // Get campaign and verify totalRecipients
    const campaign = await db.select()
      .from(crmCampaigns)
      .where(eq(crmCampaigns.id, TEST_CAMPAIGN_ID))
      .limit(1);

    // Should be 3 total (not 4 due to duplicate)
    expect(campaign[0].totalRecipients).toBe(3);
  });
});
