import { config } from 'dotenv';
config();

/**
 * Campaign API Route Tests
 * Tests the HTTP API endpoints to ensure correct response formats
 * This prevents issues like returning raw arrays instead of wrapped objects
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db/client';
import { crmCampaigns, crmCampaignRecipients, crmContacts, workspaces, users } from '@agios/db';
import { eq } from 'drizzle-orm';
import { campaignService } from '../services/campaigns';

// Test data
const TEST_WORKSPACE_ID = '99999999-9999-9999-9999-999999999999';
const TEST_USER_ID = '88888888-8888-8888-8888-888888888888';
const TEST_CONTACT_ID = '77777777-7777-7777-7777-777777777777';
const API_BASE_URL = 'http://localhost:3000/api/v1';

describe('Campaign API Routes - Response Format Tests', () => {
  let testCampaignId: string;

  beforeAll(async () => {
    // Create test user
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-api@example.com',
        name: 'Test User API',
        emailVerified: false,
      })
      .onConflictDoNothing();

    // Create test workspace
    await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - API',
        slug: 'test-api-routes',
        ownerId: TEST_USER_ID,
      })
      .onConflictDoNothing();

    // Create test contact
    await db
      .insert(crmContacts)
      .values({
        id: TEST_CONTACT_ID,
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'API',
        lastName: 'Test',
        email: 'api.test@example.com',
        stage: 'lead',
        status: 'active',
        createdBy: TEST_USER_ID,
      })
      .onConflictDoNothing();

    // Create test campaign with recipients
    const campaign = await campaignService.create(db, {
      workspaceId: TEST_WORKSPACE_ID,
      name: 'API Test Campaign',
      objective: 'sales',
      type: 'one_time',
      channels: ['email'],
      status: 'draft',
      createdBy: TEST_USER_ID,
    });
    testCampaignId = campaign.id;

    // Add recipients
    await campaignService.addRecipients(
      db,
      testCampaignId,
      [TEST_CONTACT_ID],
      TEST_WORKSPACE_ID,
      TEST_USER_ID
    );
  });

  afterAll(async () => {
    // Cleanup
    await db
      .delete(crmCampaignRecipients)
      .where(eq(crmCampaignRecipients.campaignId, testCampaignId));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, testCampaignId));
    await db.delete(crmContacts).where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  describe('GET /recipients - Response Format', () => {
    test('should return { recipients: [...] } not a raw array', async () => {
      // Make HTTP request to the actual API endpoint
      const response = await fetch(
        `${API_BASE_URL}/crm/campaigns/${testCampaignId}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // CRITICAL: Response must be an object with 'recipients' key
      expect(data).toBeInstanceOf(Object);
      expect(data).toHaveProperty('recipients');

      // recipients should be an array
      expect(Array.isArray(data.recipients)).toBe(true);

      // NOT a raw array at the top level
      expect(Array.isArray(data)).toBe(false);

      // Validate structure of first recipient
      if (data.recipients.length > 0) {
        const recipient = data.recipients[0];
        expect(recipient).toHaveProperty('id');
        expect(recipient).toHaveProperty('contactId');
        expect(recipient).toHaveProperty('status');
        expect(recipient).toHaveProperty('email');
        expect(recipient).toHaveProperty('firstName');
        expect(recipient).toHaveProperty('lastName');
      }
    });

    test('should return empty array wrapped in object when no recipients', async () => {
      // Create campaign without recipients
      const emptyCampaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Empty Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      const response = await fetch(
        `${API_BASE_URL}/crm/campaigns/${emptyCampaign.id}/recipients?workspaceId=${TEST_WORKSPACE_ID}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Must still return { recipients: [] } not []
      expect(data).toHaveProperty('recipients');
      expect(Array.isArray(data.recipients)).toBe(true);
      expect(data.recipients).toHaveLength(0);

      // Cleanup
      await db.delete(crmCampaigns).where(eq(crmCampaigns.id, emptyCampaign.id));
    });

    test('should return 404 for non-existent campaign', async () => {
      const response = await fetch(
        `${API_BASE_URL}/crm/campaigns/non-existent-id/recipients?workspaceId=${TEST_WORKSPACE_ID}`
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /campaigns - Response Format', () => {
    test('should return { campaigns: [...], total: number }', async () => {
      const response = await fetch(
        `${API_BASE_URL}/crm/campaigns?workspaceId=${TEST_WORKSPACE_ID}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Validate response structure
      expect(data).toHaveProperty('campaigns');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.campaigns)).toBe(true);
      expect(typeof data.total).toBe('number');
    });
  });

  describe('GET /campaigns/:id - Response Format', () => {
    test('should return campaign object directly', async () => {
      const response = await fetch(
        `${API_BASE_URL}/crm/campaigns/${testCampaignId}?workspaceId=${TEST_WORKSPACE_ID}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Should return campaign object directly
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('status');
      expect(data.id).toBe(testCampaignId);
    });
  });
});
