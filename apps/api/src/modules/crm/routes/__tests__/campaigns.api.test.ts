import { config } from 'dotenv';
config();

/**
 * Campaign API Contract Tests
 * Tests HTTP response format for GET /campaigns/:campaignId/recipients endpoint
 *
 * These tests validate the actual HTTP API contract, not just the service layer.
 * They ensure frontend TypeScript interfaces match backend responses.
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

// Test configuration from environment
// Bun automatically loads .env files
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1/crm`;

// Test data - using UUIDs for compatibility with database schema
const TEST_WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const TEST_USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const TEST_CONTACT_ID_1 = 'cccccccc-cccc-4ccc-cccc-ccccccccccc1';
const TEST_CONTACT_ID_2 = 'cccccccc-cccc-4ccc-cccc-ccccccccccc2';
const TEST_CAMPAIGN_ID = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

// Other workspace for isolation testing
const OTHER_WORKSPACE_ID = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
const OTHER_USER_ID = 'ffffffff-ffff-4fff-ffff-ffffffffffff';
const OTHER_CAMPAIGN_ID = 'aaaabbbb-cccc-4ddd-eeee-ffffffffffff';

describe('Campaign Recipients API Contract Tests', () => {
  // Setup test data
  beforeAll(async () => {
    // Clean up any existing test data
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
      .where(eq(users.id, TEST_USER_ID));

    // Clean up other workspace
    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.workspaceId, OTHER_WORKSPACE_ID));
    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, OTHER_WORKSPACE_ID));
    await db
      .delete(workspaces)
      .where(eq(workspaces.id, OTHER_WORKSPACE_ID));
    await db
      .delete(users)
      .where(eq(users.id, OTHER_USER_ID));

    // Create test users
    await db.insert(users).values([
      {
        id: TEST_USER_ID,
        email: 'test-api-contract@example.com',
        name: 'Test User API Contract',
        emailVerified: false,
      },
      {
        id: OTHER_USER_ID,
        email: 'other-workspace@example.com',
        name: 'Other Workspace User',
        emailVerified: false,
      },
    ]);

    // Create test workspaces
    await db.insert(workspaces).values([
      {
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - API Contract',
        slug: 'test-api-contract',
        ownerId: TEST_USER_ID,
      },
      {
        id: OTHER_WORKSPACE_ID,
        name: 'Other Workspace',
        slug: 'other-workspace',
        ownerId: OTHER_USER_ID,
      },
    ]);

    // Create test contacts
    await db.insert(crmContacts).values([
      {
        id: TEST_CONTACT_ID_1,
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        lifecycleStage: 'verified',
        createdBy: TEST_USER_ID,
      },
      {
        id: TEST_CONTACT_ID_2,
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        lifecycleStage: 'verified',
        createdBy: TEST_USER_ID,
      },
    ]);

    // Create test campaigns
    await db.insert(crmCampaigns).values([
      {
        id: TEST_CAMPAIGN_ID,
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Test Campaign - API Contract',
        objective: 'lead_generation',
        type: 'one_time',
        status: 'draft',
        channels: ['email'],
        createdBy: TEST_USER_ID,
      },
      {
        id: OTHER_CAMPAIGN_ID,
        workspaceId: OTHER_WORKSPACE_ID,
        name: 'Other Campaign',
        objective: 'sales',
        type: 'one_time',
        status: 'draft',
        channels: ['email'],
        createdBy: OTHER_USER_ID,
      },
    ]);

    // Add recipients to test campaign
    await db.insert(crmCampaignRecipients).values([
      {
        campaignId: TEST_CAMPAIGN_ID,
        contactId: TEST_CONTACT_ID_1,
        workspaceId: TEST_WORKSPACE_ID,
        status: 'pending',
        addedBy: TEST_USER_ID,
      },
      {
        campaignId: TEST_CAMPAIGN_ID,
        contactId: TEST_CONTACT_ID_2,
        workspaceId: TEST_WORKSPACE_ID,
        status: 'sent',
        addedBy: TEST_USER_ID,
        sentAt: new Date(),
      },
    ]);
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
      .where(eq(users.id, TEST_USER_ID));

    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.workspaceId, OTHER_WORKSPACE_ID));
    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, OTHER_WORKSPACE_ID));
    await db
      .delete(workspaces)
      .where(eq(workspaces.id, OTHER_WORKSPACE_ID));
    await db
      .delete(users)
      .where(eq(users.id, OTHER_USER_ID));
  });

  /**
   * AC-001: Test validates HTTP 200 response with correct content-type
   */
  test('should return HTTP 200 with application/json content-type', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    // HTTP 200 status
    expect(response.status).toBe(200);

    // Content-Type header
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  /**
   * AC-002: Test validates response has { recipients: [...] } wrapper
   */
  test('should return response with recipients array wrapper', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Validate wrapper structure
    expect(data).toHaveProperty('recipients');
    expect(Array.isArray(data.recipients)).toBe(true);
  });

  /**
   * AC-003: Test validates each recipient has firstName, lastName, email directly on object
   */
  test('should return recipients with firstName, lastName, email fields', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Should have recipients
    expect(data.recipients.length).toBeGreaterThan(0);

    // Validate each recipient has required fields
    for (const recipient of data.recipients) {
      // ID fields
      expect(recipient).toHaveProperty('id');
      expect(typeof recipient.id).toBe('string');
      expect(recipient).toHaveProperty('contactId');
      expect(typeof recipient.contactId).toBe('string');

      // Contact details (directly on object, not nested)
      expect(recipient).toHaveProperty('firstName');
      expect(typeof recipient.firstName).toBe('string');
      expect(recipient).toHaveProperty('lastName');
      expect(typeof recipient.lastName).toBe('string');
      expect(recipient).toHaveProperty('email');
      expect(typeof recipient.email).toBe('string');

      // Status field
      expect(recipient).toHaveProperty('status');
      expect(typeof recipient.status).toBe('string');

      // Optional engagement fields
      if (recipient.sentAt) {
        expect(typeof recipient.sentAt).toBe('string'); // ISO date string
      }
      if (recipient.openCount !== undefined) {
        expect(typeof recipient.openCount).toBe('number');
      }
      if (recipient.clickCount !== undefined) {
        expect(typeof recipient.clickCount).toBe('number');
      }
    }
  });

  /**
   * AC-003 Extended: Validate specific test data
   */
  test('should return correct data for test recipients', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Should have exactly 2 recipients
    expect(data.recipients.length).toBe(2);

    // Find John Doe
    const johnDoe = data.recipients.find((r: any) => r.email === 'john.doe@example.com');
    expect(johnDoe).toBeDefined();
    expect(johnDoe.firstName).toBe('John');
    expect(johnDoe.lastName).toBe('Doe');
    expect(johnDoe.status).toBe('pending');

    // Find Jane Smith
    const janeSmith = data.recipients.find((r: any) => r.email === 'jane.smith@example.com');
    expect(janeSmith).toBeDefined();
    expect(janeSmith.firstName).toBe('Jane');
    expect(janeSmith.lastName).toBe('Smith');
    expect(janeSmith.status).toBe('sent');
    expect(janeSmith.sentAt).toBeDefined();
  });

  /**
   * AC-004: Test validates workspace isolation (can only see own recipients)
   */
  test('should enforce workspace isolation', async () => {
    // Try to access test campaign with wrong workspace ID
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${OTHER_WORKSPACE_ID}`
    );

    // Should return 404 because campaign doesn't exist in other workspace
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Campaign not found');
  });

  /**
   * AC-004 Extended: Test cannot access other workspace's campaigns
   */
  test('should not allow cross-workspace access', async () => {
    // Try to access other workspace's campaign from test workspace
    const response = await fetch(
      `${API_BASE}/campaigns/${OTHER_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    // Should return 404
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  /**
   * HTTP 404: Non-existent campaign
   */
  test('should return 404 for non-existent campaign', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(
      `${API_BASE}/campaigns/${nonExistentId}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Campaign not found');
  });

  /**
   * HTTP 400: Missing workspaceId query parameter
   */
  test('should return 400 for missing workspaceId', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients`
    );

    // ElysiaJS validation will return 400 or 422 for missing required query params
    expect([400, 422]).toContain(response.status);
  });

  /**
   * Empty recipients list
   */
  test('should return empty array for campaign with no recipients', async () => {
    // Create campaign with no recipients
    const emptyCampaign = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Empty Campaign',
        objective: 'awareness',
        type: 'one_time',
        status: 'draft',
        channels: ['email'],
        createdBy: TEST_USER_ID,
      })
      .returning();

    const response = await fetch(
      `${API_BASE}/campaigns/${emptyCampaign[0].id}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('recipients');
    expect(data.recipients).toEqual([]);

    // Cleanup
    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.id, emptyCampaign[0].id));
  });

  /**
   * Response timing - should be reasonably fast
   */
  test('should respond within reasonable time', async () => {
    const startTime = Date.now();

    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status).toBe(200);

    // Should respond within 1 second for small dataset
    expect(duration).toBeLessThan(1000);
  });

  /**
   * JSON structure validation - no unexpected fields
   */
  test('should not include unexpected fields in response', async () => {
    const response = await fetch(
      `${API_BASE}/campaigns/${TEST_CAMPAIGN_ID}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Top-level should only have 'recipients'
    const topLevelKeys = Object.keys(data);
    expect(topLevelKeys).toEqual(['recipients']);

    // Recipient objects should have expected fields
    const expectedFields = [
      'id',
      'contactId',
      'status',
      'firstName',
      'lastName',
      'email',
      // Optional fields:
      'statusReason',
      'sentAt',
      'deliveredAt',
      'firstOpenedAt',
      'openCount',
      'firstClickedAt',
      'clickCount',
    ];

    for (const recipient of data.recipients) {
      const recipientKeys = Object.keys(recipient);

      // All keys should be in expected fields
      for (const key of recipientKeys) {
        expect(expectedFields).toContain(key);
      }
    }
  });
});
