/**
 * Campaign Metrics Service Tests
 * Story: US-ANALYTICS-001
 *
 * Test coverage:
 * - Correct metric calculations
 * - Edge case handling (zero recipients, zero opens, etc.)
 * - Performance requirements (<500ms)
 * - Workspace isolation
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmCampaigns, crmCampaignRecipients, crmContacts, workspaces, users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { getCampaignMetrics } from '../campaign-metrics';

// Test data IDs
let testWorkspaceId: string;
let testUserId: string;
let testCampaignId: string;
let testContactId: string;
let otherWorkspaceId: string;

beforeAll(async () => {
  // Create test user first (needed for workspace owner)
  const [user] = await db
    .insert(users)
    .values({
      email: `test-campaign-metrics-${Date.now()}@test.com`,
      name: 'Test User',
    })
    .returning();
  testUserId = user.id;

  // Create test workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: 'Test Workspace - Campaign Metrics',
      slug: `test-campaign-metrics-${Date.now()}`,
      ownerId: testUserId,
    })
    .returning();
  testWorkspaceId = workspace.id;

  // Create other workspace for isolation tests
  const [otherWorkspace] = await db
    .insert(workspaces)
    .values({
      name: 'Other Workspace',
      slug: `other-workspace-${Date.now()}`,
      ownerId: testUserId,
    })
    .returning();
  otherWorkspaceId = otherWorkspace.id;

  // Create test contact (required for recipients)
  const [contact] = await db
    .insert(crmContacts)
    .values({
      workspaceId: testWorkspaceId,
      firstName: 'Test',
      lastName: 'Contact',
      email: 'test-contact@test.com',
    })
    .returning();
  testContactId = contact.id;
});

afterAll(async () => {
  // Clean up test data
  if (testWorkspaceId) {
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
  }
  if (otherWorkspaceId) {
    await db.delete(workspaces).where(eq(workspaces.id, otherWorkspaceId));
  }
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
  }
});

describe('getCampaignMetrics', () => {
  test('returns null for non-existent campaign', async () => {
    const metrics = await getCampaignMetrics(
      db,
      testWorkspaceId,
      '00000000-0000-0000-0000-000000000000'
    );

    expect(metrics).toBeNull();
  });

  test('returns null for campaign in different workspace (workspace isolation)', async () => {
    // Create campaign in other workspace
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: otherWorkspaceId,
        name: 'Other Workspace Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // Try to access with wrong workspace
    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).toBeNull();

    // Cleanup
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('handles campaign with zero recipients gracefully', async () => {
    // Create campaign with no recipients
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Empty Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalRecipients).toBe(0);
    expect(metrics!.totalSent).toBe(0);
    expect(metrics!.totalDelivered).toBe(0);
    expect(metrics!.totalOpened).toBe(0);
    expect(metrics!.totalClicked).toBe(0);
    expect(metrics!.totalBounced).toBe(0);
    expect(metrics!.deliveryRate).toBe(0);
    expect(metrics!.openRate).toBe(0);
    expect(metrics!.clickRate).toBe(0);
    expect(metrics!.bounceRate).toBe(0);
    expect(metrics!.engagementScore).toBe(0);

    // Verify no NaN or Infinity values
    expect(Number.isNaN(metrics!.deliveryRate)).toBe(false);
    expect(Number.isNaN(metrics!.openRate)).toBe(false);
    expect(Number.isNaN(metrics!.clickRate)).toBe(false);
    expect(Number.isFinite(metrics!.engagementScore)).toBe(true);

    // Cleanup
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('calculates delivery rate correctly', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Delivery Rate Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // Create contacts in campaign schema (simplified for test)
    const recipientData = [
      { status: 'sent' as const },
      { status: 'sent' as const },
      { status: 'delivered' as const },
      { status: 'delivered' as const },
      { status: 'delivered' as const },
      { status: 'bounced' as const },
      { status: 'pending' as const },
    ];

    for (const data of recipientData) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: data.status,
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalRecipients).toBe(7);
    expect(metrics!.totalSent).toBe(6); // sent + delivered + bounced
    expect(metrics!.totalDelivered).toBe(3);
    expect(metrics!.deliveryRate).toBe(3 / 6); // 0.5 = 50%

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('calculates open rate correctly', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Open Rate Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // 10 delivered, 4 opened
    const recipientData = [
      { status: 'delivered' as const, openCount: 1 },
      { status: 'delivered' as const, openCount: 2 },
      { status: 'delivered' as const, openCount: 3 },
      { status: 'delivered' as const, openCount: 1 },
      { status: 'delivered' as const, openCount: 0 },
      { status: 'delivered' as const, openCount: 0 },
      { status: 'delivered' as const, openCount: 0 },
      { status: 'delivered' as const, openCount: 0 },
      { status: 'delivered' as const, openCount: 0 },
      { status: 'delivered' as const, openCount: 0 },
    ];

    for (const data of recipientData) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: data.status,
        openCount: data.openCount,
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalDelivered).toBe(10);
    expect(metrics!.totalOpened).toBe(4);
    expect(metrics!.openRate).toBe(4 / 10); // 0.4 = 40%

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('calculates click rate correctly', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Click Rate Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // 10 opened, 3 clicked
    const recipientData = [
      { openCount: 1, clickCount: 1 },
      { openCount: 2, clickCount: 2 },
      { openCount: 1, clickCount: 1 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
      { openCount: 1, clickCount: 0 },
    ];

    for (const data of recipientData) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: 'delivered',
        openCount: data.openCount,
        clickCount: data.clickCount,
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalOpened).toBe(10);
    expect(metrics!.totalClicked).toBe(3);
    expect(metrics!.clickRate).toBe(3 / 10); // 0.3 = 30%

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('calculates bounce rate correctly', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Bounce Rate Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // 100 sent, 5 bounced
    const statuses = [
      ...Array(90).fill('delivered'),
      ...Array(5).fill('bounced'),
      ...Array(5).fill('sent'),
    ];

    for (const status of statuses) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: status as 'delivered' | 'bounced' | 'sent',
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalSent).toBe(100);
    expect(metrics!.totalBounced).toBe(5);
    expect(metrics!.bounceRate).toBe(5 / 100); // 0.05 = 5%

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('calculates engagement score correctly (40% open + 60% click)', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Engagement Score Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // 100 delivered, 50 opened (50% open rate), 10 clicked (20% click rate of opened)
    const recipientData = [
      ...Array(10).fill({ openCount: 1, clickCount: 1 }), // Opened and clicked
      ...Array(40).fill({ openCount: 1, clickCount: 0 }), // Opened but not clicked
      ...Array(50).fill({ openCount: 0, clickCount: 0 }), // Not opened
    ];

    for (const data of recipientData) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: 'delivered',
        openCount: data.openCount,
        clickCount: data.clickCount,
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalDelivered).toBe(100);
    expect(metrics!.totalOpened).toBe(50);
    expect(metrics!.totalClicked).toBe(10);
    expect(metrics!.openRate).toBe(0.5); // 50%
    expect(metrics!.clickRate).toBe(10 / 50); // 0.2 = 20%

    // Engagement score = (0.5 * 0.4) + (0.2 * 0.6) = 0.2 + 0.12 = 0.32 * 100 = 32
    const expectedEngagementScore = (0.5 * 0.4 + 0.2 * 0.6) * 100;
    expect(metrics!.engagementScore).toBe(expectedEngagementScore);
    expect(metrics!.engagementScore).toBe(32);

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('handles zero opens without errors (no division by zero)', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Zero Opens Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // 100 delivered, 0 opens
    for (let i = 0; i < 100; i++) {
      await db.insert(crmCampaignRecipients).values({
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: 'delivered',
        openCount: 0,
        clickCount: 0,
      });
    }

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalDelivered).toBe(100);
    expect(metrics!.totalOpened).toBe(0);
    expect(metrics!.openRate).toBe(0);
    expect(metrics!.clickRate).toBe(0); // No division by zero
    expect(Number.isNaN(metrics!.clickRate)).toBe(false);

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('performance: executes in <500ms for 10,000+ recipients', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Performance Test Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // Insert 10,000 recipients in batches (Drizzle has batch insert limits)
    const batchSize = 500;
    const totalRecipients = 10000;

    console.log('Creating 10,000 test recipients (this may take a moment)...');

    for (let i = 0; i < totalRecipients; i += batchSize) {
      const batch = Array(Math.min(batchSize, totalRecipients - i))
        .fill(null)
        .map(() => ({
          campaignId: campaign.id,
          workspaceId: testWorkspaceId,
          contactId: testContactId,
          status: 'delivered' as const,
          openCount: Math.random() > 0.6 ? 1 : 0, // 40% open rate
          clickCount: Math.random() > 0.8 ? 1 : 0, // 20% click rate
        }));

      await db.insert(crmCampaignRecipients).values(batch);
    }

    console.log('Recipients created. Testing query performance...');

    // Measure query time
    const startTime = Date.now();
    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);
    const queryTime = Date.now() - startTime;

    console.log(`Query completed in ${queryTime}ms`);

    expect(metrics).not.toBeNull();
    expect(metrics!.totalRecipients).toBe(totalRecipients);
    expect(queryTime).toBeLessThan(500); // Performance requirement

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });

  test('returns correct structure matching API contract', async () => {
    // Create campaign
    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        workspaceId: testWorkspaceId,
        name: 'API Contract Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
      })
      .returning();

    // Add some recipients
    await db.insert(crmCampaignRecipients).values([
      {
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: 'delivered',
        openCount: 1,
        clickCount: 1,
      },
      {
        campaignId: campaign.id,
        workspaceId: testWorkspaceId,
        contactId: testContactId,
        status: 'delivered',
        openCount: 0,
        clickCount: 0,
      },
    ]);

    const metrics = await getCampaignMetrics(db, testWorkspaceId, campaign.id);

    expect(metrics).not.toBeNull();

    // Verify all required fields exist
    expect(metrics).toHaveProperty('campaignId');
    expect(metrics).toHaveProperty('campaignName');
    expect(metrics).toHaveProperty('totalRecipients');
    expect(metrics).toHaveProperty('totalSent');
    expect(metrics).toHaveProperty('totalDelivered');
    expect(metrics).toHaveProperty('totalOpened');
    expect(metrics).toHaveProperty('totalClicked');
    expect(metrics).toHaveProperty('totalBounced');
    expect(metrics).toHaveProperty('deliveryRate');
    expect(metrics).toHaveProperty('openRate');
    expect(metrics).toHaveProperty('clickRate');
    expect(metrics).toHaveProperty('bounceRate');
    expect(metrics).toHaveProperty('engagementScore');

    // Verify types
    expect(typeof metrics!.campaignId).toBe('string');
    expect(typeof metrics!.campaignName).toBe('string');
    expect(typeof metrics!.totalRecipients).toBe('number');
    expect(typeof metrics!.totalSent).toBe('number');
    expect(typeof metrics!.totalDelivered).toBe('number');
    expect(typeof metrics!.totalOpened).toBe('number');
    expect(typeof metrics!.totalClicked).toBe('number');
    expect(typeof metrics!.totalBounced).toBe('number');
    expect(typeof metrics!.deliveryRate).toBe('number');
    expect(typeof metrics!.openRate).toBe('number');
    expect(typeof metrics!.clickRate).toBe('number');
    expect(typeof metrics!.bounceRate).toBe('number');
    expect(typeof metrics!.engagementScore).toBe('number');

    // Verify rates are between 0 and 1 (decimals)
    expect(metrics!.deliveryRate).toBeGreaterThanOrEqual(0);
    expect(metrics!.deliveryRate).toBeLessThanOrEqual(1);
    expect(metrics!.openRate).toBeGreaterThanOrEqual(0);
    expect(metrics!.openRate).toBeLessThanOrEqual(1);
    expect(metrics!.clickRate).toBeGreaterThanOrEqual(0);
    expect(metrics!.clickRate).toBeLessThanOrEqual(1);
    expect(metrics!.bounceRate).toBeGreaterThanOrEqual(0);
    expect(metrics!.bounceRate).toBeLessThanOrEqual(1);

    // Verify engagement score is 0-100
    expect(metrics!.engagementScore).toBeGreaterThanOrEqual(0);
    expect(metrics!.engagementScore).toBeLessThanOrEqual(100);

    // Cleanup
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
    await db.delete(crmCampaigns).where(eq(crmCampaigns.id, campaign.id));
  });
});
