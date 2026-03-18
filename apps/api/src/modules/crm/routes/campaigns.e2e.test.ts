import { config } from 'dotenv';
config();

/**
 * Campaign E2E Tests
 * Comprehensive end-to-end tests for Campaign Management system
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '@agios/db/client';
import {
  crmCampaigns,
  crmCampaignMessages,
  crmCampaignRecipients,
  crmContacts,
  crmTimelineEvents,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { campaignService, campaignMessageService } from '../services/campaigns';
import { timelineService } from '../services/timeline';

// Test data - using UUIDs for compatibility with database schema
const TEST_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const TEST_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CONTACT_ID_1 = '33333333-3333-3333-3333-333333333331';
const TEST_CONTACT_ID_2 = '33333333-3333-3333-3333-333333333332';
const TEST_CONTACT_ID_3 = '33333333-3333-3333-3333-333333333333';

describe('Campaign E2E Tests', () => {
  // Setup: Create test workspace and contacts
  beforeAll(async () => {
    // Create test user first (required for workspace foreign key)
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-campaigns@example.com',
        name: 'Test User Campaigns',
        emailVerified: false,
      })
      .onConflictDoNothing();

    // Create test workspace
    await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Campaigns',
        slug: 'test-campaigns-e2e',
        ownerId: TEST_USER_ID,
      })
      .onConflictDoNothing();

    // Create test contacts
    await db
      .insert(crmContacts)
      .values([
        {
          id: TEST_CONTACT_ID_1,
          workspaceId: TEST_WORKSPACE_ID,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          stage: 'lead',
          status: 'active',
          createdBy: TEST_USER_ID,
        },
        {
          id: TEST_CONTACT_ID_2,
          workspaceId: TEST_WORKSPACE_ID,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          stage: 'opportunity',
          status: 'active',
          createdBy: TEST_USER_ID,
        },
        {
          id: TEST_CONTACT_ID_3,
          workspaceId: TEST_WORKSPACE_ID,
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob.johnson@example.com',
          stage: 'customer',
          status: 'active',
          createdBy: TEST_USER_ID,
        },
      ])
      .onConflictDoNothing();
  });

  // Cleanup after each test
  beforeEach(async () => {
    // Delete test campaigns and related data
    const campaigns = await db
      .select()
      .from(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));

    for (const campaign of campaigns) {
      await db
        .delete(crmCampaignRecipients)
        .where(eq(crmCampaignRecipients.campaignId, campaign.id));
      await db
        .delete(crmCampaignMessages)
        .where(eq(crmCampaignMessages.campaignId, campaign.id));
    }

    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));

    await db
      .delete(crmTimelineEvents)
      .where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Delete all test data
    const campaigns = await db
      .select()
      .from(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));

    for (const campaign of campaigns) {
      await db
        .delete(crmCampaignRecipients)
        .where(eq(crmCampaignRecipients.campaignId, campaign.id));
      await db
        .delete(crmCampaignMessages)
        .where(eq(crmCampaignMessages.campaignId, campaign.id));
    }

    await db
      .delete(crmCampaigns)
      .where(eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmTimelineEvents)
      .where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmContacts)
      .where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  describe('Campaign Lifecycle', () => {
    test('should create campaign → add message → add recipients → verify in analytics', async () => {
      // Step 1: Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Welcome Campaign',
        description: 'Welcome new leads',
        objective: 'lead_generation',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      expect(campaign).toBeDefined();
      expect(campaign.id).toBeDefined();
      expect(campaign.status).toBe('draft');
      expect(campaign.name).toBe('Welcome Campaign');

      // Step 2: Add message
      const message = await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Welcome Email',
        channel: 'email',
        subject: 'Welcome to our platform!',
        bodyText: 'Hello {{firstName}}, welcome!',
        bodyHtml: '<p>Hello {{firstName}}, welcome!</p>',
        sendFromName: 'Test Team',
        sendFromEmail: 'test@example.com',
        mergeTags: ['firstName'],
        trackOpens: true,
        trackClicks: true,
      });

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.subject).toBe('Welcome to our platform!');
      expect(message.campaignId).toBe(campaign.id);

      // Step 3: Add recipients
      const recipients = await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1, TEST_CONTACT_ID_2],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      expect(recipients).toBeDefined();
      expect(recipients).toHaveLength(2);
      expect(recipients[0].status).toBe('pending');

      // Step 4: Verify campaign appears in list
      const campaigns = await campaignService.list(db, {
        workspaceId: TEST_WORKSPACE_ID,
      });

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].id).toBe(campaign.id);

      // Step 5: Verify timeline events created
      const timelineEvents = await db
        .select()
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID),
            eq(crmTimelineEvents.eventType, 'campaign.created')
          )
        );

      expect(timelineEvents).toHaveLength(1);
      expect(timelineEvents[0].summary).toContain('Welcome Campaign');
    });

    test('should update campaign status → verify status change reflected everywhere', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Status Test Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Add message and recipients (required for activation)
      await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Test Message',
        channel: 'email',
        subject: 'Test',
        bodyText: 'Test body',
        sendFromEmail: 'test@example.com',
      });

      await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      // Update to active status
      const updated = await campaignService.update(db, campaign.id, TEST_WORKSPACE_ID, {
        status: 'active',
        startedAt: new Date(),
        updatedBy: TEST_USER_ID,
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('active');

      // Verify status in list
      const campaigns = await campaignService.list(db, {
        workspaceId: TEST_WORKSPACE_ID,
        status: 'active',
      });

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].status).toBe('active');

      // Pause campaign
      const paused = await campaignService.update(db, campaign.id, TEST_WORKSPACE_ID, {
        status: 'paused',
        updatedBy: TEST_USER_ID,
      });

      expect(paused?.status).toBe('paused');

      // Verify paused status
      const pausedCampaigns = await campaignService.list(db, {
        workspaceId: TEST_WORKSPACE_ID,
        status: 'paused',
      });

      expect(pausedCampaigns).toHaveLength(1);
    });

    test('should soft delete campaign → verify not shown in lists', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Campaign to Delete',
        objective: 'retention',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Verify it appears in list
      let campaigns = await campaignService.list(db, {
        workspaceId: TEST_WORKSPACE_ID,
      });
      expect(campaigns).toHaveLength(1);

      // Soft delete
      const deleted = await campaignService.delete(db, campaign.id, TEST_WORKSPACE_ID);
      expect(deleted).toBeDefined();
      expect(deleted?.deletedAt).toBeDefined();

      // Verify it doesn't appear in list
      campaigns = await campaignService.list(db, {
        workspaceId: TEST_WORKSPACE_ID,
      });
      expect(campaigns).toHaveLength(0);

      // Verify it still exists in database with deletedAt
      const [dbCampaign] = await db
        .select()
        .from(crmCampaigns)
        .where(eq(crmCampaigns.id, campaign.id));

      expect(dbCampaign).toBeDefined();
      expect(dbCampaign.deletedAt).toBeDefined();
    });
  });

  describe('Campaign with Multiple Recipients', () => {
    test('should create campaign → add multiple recipients → verify delivery tracking', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Multi-Recipient Campaign',
        objective: 'nurture',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Add message
      await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Nurture Email',
        channel: 'email',
        subject: 'Stay in touch',
        bodyText: 'Hi {{firstName}}!',
        sendFromEmail: 'nurture@example.com',
      });

      // Add all three contacts as recipients
      const recipients = await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1, TEST_CONTACT_ID_2, TEST_CONTACT_ID_3],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      expect(recipients).toHaveLength(3);

      // Verify all recipients have pending status
      for (const recipient of recipients) {
        expect(recipient.status).toBe('pending');
        expect(recipient.campaignId).toBe(campaign.id);
      }

      // Get recipients list
      const recipientsList = await campaignService.getRecipients(
        db,
        campaign.id,
        TEST_WORKSPACE_ID
      );

      expect(recipientsList).toHaveLength(3);

      // Verify contact details included
      const contactEmails = recipientsList.map((r: any) => r.contact?.email);
      expect(contactEmails).toContain('john.doe@example.com');
      expect(contactEmails).toContain('jane.smith@example.com');
      expect(contactEmails).toContain('bob.johnson@example.com');
    });

    test('should simulate campaign execution → update recipient statuses → verify analytics', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Execution Test Campaign',
        objective: 'awareness',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Add message and recipients
      await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Awareness Email',
        channel: 'email',
        subject: 'Check this out',
        bodyText: 'Hello!',
        sendFromEmail: 'test@example.com',
      });

      const recipients = await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1, TEST_CONTACT_ID_2, TEST_CONTACT_ID_3],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      // Simulate sending
      await db
        .update(crmCampaignRecipients)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(crmCampaignRecipients.id, recipients[0].id));

      await db
        .update(crmCampaignRecipients)
        .set({
          status: 'delivered',
          sentAt: new Date(),
          deliveredAt: new Date(),
        })
        .where(eq(crmCampaignRecipients.id, recipients[1].id));

      // Simulate open
      await db
        .update(crmCampaignRecipients)
        .set({
          status: 'opened',
          sentAt: new Date(),
          deliveredAt: new Date(),
          firstOpenedAt: new Date(),
          opensCount: 1,
        })
        .where(eq(crmCampaignRecipients.id, recipients[2].id));

      // Update campaign stats
      await db
        .update(crmCampaigns)
        .set({
          totalRecipients: 3,
          totalSent: 3,
          totalDelivered: 2,
          totalOpened: 1,
        })
        .where(eq(crmCampaigns.id, campaign.id));

      // Verify updated campaign
      const updatedCampaign = await campaignService.getById(
        db,
        campaign.id,
        TEST_WORKSPACE_ID
      );

      expect(updatedCampaign?.totalRecipients).toBe(3);
      expect(updatedCampaign?.totalSent).toBe(3);
      expect(updatedCampaign?.totalDelivered).toBe(2);
      expect(updatedCampaign?.totalOpened).toBe(1);

      // Verify recipient statuses
      const recipientsList = await campaignService.getRecipients(
        db,
        campaign.id,
        TEST_WORKSPACE_ID
      );

      const statuses = recipientsList.map((r: any) => r.status);
      expect(statuses).toContain('sent');
      expect(statuses).toContain('delivered');
      expect(statuses).toContain('opened');
    });
  });

  describe('Campaign Messages', () => {
    test('should create and manage campaign messages', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Message Test Campaign',
        objective: 'sales',
        type: 'drip',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Create multiple messages
      const message1 = await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Day 1 Email',
        channel: 'email',
        subject: 'Welcome!',
        bodyText: 'Welcome to our platform',
        sendFromEmail: 'test@example.com',
        trackOpens: true,
      });

      const message2 = await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Day 3 Email',
        channel: 'email',
        subject: 'Tips for getting started',
        bodyText: 'Here are some tips',
        sendFromEmail: 'test@example.com',
        trackClicks: true,
      });

      // List messages
      const messages = await campaignMessageService.list(db, campaign.id, TEST_WORKSPACE_ID);
      expect(messages).toHaveLength(2);

      // Update message
      const updated = await campaignMessageService.update(
        db,
        message1.id,
        TEST_WORKSPACE_ID,
        {
          subject: 'Welcome to our amazing platform!',
        }
      );

      expect(updated?.subject).toBe('Welcome to our amazing platform!');

      // Delete message
      const deleted = await campaignMessageService.delete(
        db,
        message2.id,
        TEST_WORKSPACE_ID
      );

      expect(deleted).toBeDefined();

      // Verify deletion
      const remainingMessages = await campaignMessageService.list(
        db,
        campaign.id,
        TEST_WORKSPACE_ID
      );
      expect(remainingMessages).toHaveLength(1);
    });

    test('should preview message with merge tags', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Merge Tag Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Create message with merge tags
      const message = await campaignMessageService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        campaignId: campaign.id,
        name: 'Personalized Email',
        channel: 'email',
        subject: 'Hello {{firstName}}!',
        bodyText: 'Hi {{firstName}} {{lastName}}, your email is {{email}}',
        sendFromEmail: 'test@example.com',
        mergeTags: ['firstName', 'lastName', 'email'],
      });

      // Preview message for contact
      const preview = await campaignMessageService.previewMessage(
        db,
        message.id,
        TEST_CONTACT_ID_1,
        TEST_WORKSPACE_ID
      );

      expect(preview).toBeDefined();
      expect(preview?.subject).toBe('Hello John!');
      expect(preview?.bodyText).toBe('Hi John Doe, your email is john.doe@example.com');
    });
  });

  describe('Audience Management', () => {
    test('should calculate audience based on filters', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Audience Test Campaign',
        objective: 'lead_generation',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Calculate audience for all leads
      const audienceDefinition = {
        filters: [
          {
            field: 'stage',
            operator: 'equals',
            value: 'lead',
          },
        ],
      };

      const result = await campaignService.calculateAudience(
        db,
        TEST_WORKSPACE_ID,
        audienceDefinition
      );

      expect(result.count).toBe(1); // Only TEST_CONTACT_ID_1 is a lead
      expect(result.preview).toHaveLength(1);
      expect(result.preview[0].email).toBe('john.doe@example.com');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent campaign gracefully', async () => {
      const campaign = await campaignService.getById(
        db,
        'non-existent-id',
        TEST_WORKSPACE_ID
      );

      expect(campaign).toBeNull();
    });

    test('should prevent updating non-draft campaign content', async () => {
      // Create and activate campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Active Campaign',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      await campaignService.update(db, campaign.id, TEST_WORKSPACE_ID, {
        status: 'active',
        updatedBy: TEST_USER_ID,
      });

      // Try to update campaign content (should fail)
      try {
        await campaignService.update(db, campaign.id, TEST_WORKSPACE_ID, {
          name: 'New Name',
          updatedBy: TEST_USER_ID,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('draft status');
      }
    });

    test('should handle duplicate recipient addition gracefully', async () => {
      // Create campaign
      const campaign = await campaignService.create(db, {
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Duplicate Test',
        objective: 'sales',
        type: 'one_time',
        channels: ['email'],
        status: 'draft',
        createdBy: TEST_USER_ID,
      });

      // Add recipient
      await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      // Try to add same recipient again
      const result = await campaignService.addRecipients(
        db,
        campaign.id,
        [TEST_CONTACT_ID_1],
        TEST_WORKSPACE_ID,
        TEST_USER_ID
      );

      // Should handle gracefully (depends on implementation)
      expect(result).toBeDefined();
    });
  });
});
