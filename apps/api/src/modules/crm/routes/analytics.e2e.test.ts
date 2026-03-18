import { config } from 'dotenv';
config();

/**
 * Analytics E2E Tests
 * Comprehensive end-to-end tests for Campaign & Research Analytics
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '@agios/db/client';
import {
  crmCampaigns,
  crmCampaignRecipients,
  crmCampaignMessages,
  crmResearchSessions,
  crmResearchFindings,
  crmContacts,
  crmTimelineEvents,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

// Test data - using UUIDs for compatibility with database schema
const TEST_WORKSPACE_ID = '77777777-7777-7777-7777-777777777777';
const TEST_USER_ID = '88888888-8888-8888-8888-888888888888';
const TEST_CONTACT_ID = '99999999-9999-9999-9999-999999999999';

describe('Analytics E2E Tests', () => {
  // Setup: Create test workspace and contact
  beforeAll(async () => {
    // Create test user first
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-analytics@example.com',
        name: 'Test User Analytics',
        emailVerified: false,
      })
      .onConflictDoNothing();

    // Create test workspace
    await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Analytics',
        slug: 'test-analytics-e2e',
        ownerId: TEST_USER_ID,
      })
      .onConflictDoNothing();

    // Create test contact
    await db
      .insert(crmContacts)
      .values({
        id: TEST_CONTACT_ID,
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'Test',
        lastName: 'Contact',
        email: 'test@example.com',
        stage: 'lead',
        status: 'active',
        createdBy: TEST_USER_ID,
      })
      .onConflictDoNothing();
  });

  // Cleanup after each test
  beforeEach(async () => {
    // Delete campaigns
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

    // Delete research sessions
    const sessions = await db
      .select()
      .from(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    for (const session of sessions) {
      await db
        .delete(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));
    }

    await db
      .delete(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    // Delete timeline events
    await db
      .delete(crmTimelineEvents)
      .where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
  });

  // Cleanup after all tests
  afterAll(async () => {
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

    const sessions = await db
      .select()
      .from(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    for (const session of sessions) {
      await db
        .delete(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));
    }

    await db
      .delete(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmTimelineEvents)
      .where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));
    await db
      .delete(crmContacts)
      .where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  describe('Campaign Analytics', () => {
    test('should create campaigns and executions → verify analytics counts match', async () => {
      // Create 3 campaigns with different statuses
      const [campaign1] = await db
        .insert(crmCampaigns)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Campaign 1',
          objective: 'lead_generation',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [campaign2] = await db
        .insert(crmCampaigns)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Campaign 2',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'active',
          totalRecipients: 100,
          totalSent: 100,
          totalDelivered: 95,
          totalOpened: 50,
          totalClicked: 10,
          startedAt: new Date(),
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [campaign3] = await db
        .insert(crmCampaigns)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Campaign 3',
          objective: 'nurture',
          type: 'one_time',
          channels: ['email'],
          status: 'completed',
          totalRecipients: 200,
          totalSent: 200,
          totalDelivered: 190,
          totalOpened: 100,
          totalClicked: 25,
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          endedAt: new Date(),
          completedAt: new Date(),
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Query analytics
      const campaigns = await db
        .select()
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
            isNull(crmCampaigns.deletedAt)
          )
        );

      // Calculate metrics
      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
      const completedCampaigns = campaigns.filter((c) => c.status === 'completed').length;
      const draftCampaigns = campaigns.filter((c) => c.status === 'draft').length;

      const totalSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
      const totalDelivered = campaigns.reduce((sum, c) => sum + (c.totalDelivered || 0), 0);
      const totalOpened = campaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);
      const totalClicked = campaigns.reduce((sum, c) => sum + (c.totalClicked || 0), 0);

      // Verify counts
      expect(totalCampaigns).toBe(3);
      expect(activeCampaigns).toBe(1);
      expect(completedCampaigns).toBe(1);
      expect(draftCampaigns).toBe(1);

      // Verify metrics
      expect(totalSent).toBe(300);
      expect(totalDelivered).toBe(285);
      expect(totalOpened).toBe(150);
      expect(totalClicked).toBe(35);

      // Verify rates
      const deliveryRate = (totalDelivered / totalSent) * 100;
      const openRate = (totalOpened / totalDelivered) * 100;
      const clickRate = (totalClicked / totalOpened) * 100;

      expect(deliveryRate).toBeCloseTo(95, 1);
      expect(openRate).toBeCloseTo(52.63, 1);
      expect(clickRate).toBeCloseTo(23.33, 1);
    });

    test('should calculate campaign metrics by objective', async () => {
      // Create campaigns with different objectives
      await db.insert(crmCampaigns).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Lead Gen 1',
          objective: 'lead_generation',
          type: 'one_time',
          channels: ['email'],
          status: 'completed',
          totalSent: 100,
          totalDelivered: 95,
          totalOpened: 60,
          totalClicked: 15,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Lead Gen 2',
          objective: 'lead_generation',
          type: 'one_time',
          channels: ['email'],
          status: 'completed',
          totalSent: 150,
          totalDelivered: 140,
          totalOpened: 80,
          totalClicked: 20,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Sales 1',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'completed',
          totalSent: 50,
          totalDelivered: 48,
          totalOpened: 30,
          totalClicked: 10,
          createdBy: TEST_USER_ID,
        },
      ]);

      // Query by objective
      const leadGenCampaigns = await db
        .select()
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
            eq(crmCampaigns.objective, 'lead_generation'),
            isNull(crmCampaigns.deletedAt)
          )
        );

      const salesCampaigns = await db
        .select()
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
            eq(crmCampaigns.objective, 'sales'),
            isNull(crmCampaigns.deletedAt)
          )
        );

      // Calculate objective metrics
      const leadGenSent = leadGenCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
      const leadGenOpened = leadGenCampaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);
      const leadGenDelivered = leadGenCampaigns.reduce(
        (sum, c) => sum + (c.totalDelivered || 0),
        0
      );

      const salesSent = salesCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
      const salesOpened = salesCampaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);
      const salesDelivered = salesCampaigns.reduce((sum, c) => sum + (c.totalDelivered || 0), 0);

      expect(leadGenCampaigns).toHaveLength(2);
      expect(salesCampaigns).toHaveLength(1);

      expect(leadGenSent).toBe(250);
      expect(salesSent).toBe(50);

      const leadGenOpenRate = (leadGenOpened / leadGenDelivered) * 100;
      const salesOpenRate = (salesOpened / salesDelivered) * 100;

      expect(leadGenOpenRate).toBeCloseTo(59.57, 1);
      expect(salesOpenRate).toBeCloseTo(62.5, 1);
    });
  });

  describe('Research Analytics', () => {
    test('should create research sessions → verify analytics metrics accurate', async () => {
      // Create research sessions with different statuses
      const [session1] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Enrich contact 1',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 8,
          totalFindings: 5,
          costCents: 80,
          completedAt: new Date(),
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [session2] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Enrich contact 2',
          scope: 'deep',
          status: 'completed',
          maxQueries: 30,
          totalQueries: 25,
          totalFindings: 12,
          costCents: 250,
          completedAt: new Date(),
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [session3] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Enrich contact 3',
          scope: 'basic',
          status: 'running',
          maxQueries: 10,
          totalQueries: 3,
          totalFindings: 2,
          costCents: 30,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create findings for sessions
      await db.insert(crmResearchFindings).values([
        // Session 1 findings
        {
          sessionId: session1.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Technology',
          confidence: 0.90,
          sources: ['source1'],
          reasoning: 'Clear evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
          applied: true,
          appliedAt: new Date(),
          appliedBy: TEST_USER_ID,
        },
        {
          sessionId: session1.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '50-100',
          confidence: 0.85,
          sources: ['source2'],
          reasoning: 'Strong evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        },
        {
          sessionId: session1.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'revenue',
          value: '$10M-$50M',
          confidence: 0.60,
          sources: ['source3'],
          reasoning: 'Weak evidence',
          status: 'rejected',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        },
        // Session 2 findings
        {
          sessionId: session2.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'funding',
          value: 'Series B',
          confidence: 0.95,
          sources: ['source4'],
          reasoning: 'Very strong evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
          applied: true,
          appliedAt: new Date(),
          appliedBy: TEST_USER_ID,
        },
      ]);

      // Query analytics
      const sessions = await db
        .select()
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID),
            isNull(crmResearchSessions.deletedAt)
          )
        );

      const findings = await db
        .select()
        .from(crmResearchFindings)
        .where(eq(crmResearchFindings.workspaceId, TEST_WORKSPACE_ID));

      // Verify session metrics
      expect(sessions).toHaveLength(3);
      const completedSessions = sessions.filter((s) => s.status === 'completed').length;
      const runningSessions = sessions.filter((s) => s.status === 'running').length;

      expect(completedSessions).toBe(2);
      expect(runningSessions).toBe(1);

      const totalQueries = sessions.reduce((sum, s) => sum + (s.totalQueries || 0), 0);
      const totalFindings = sessions.reduce((sum, s) => sum + (s.totalFindings || 0), 0);
      const totalCost = sessions.reduce((sum, s) => sum + (s.costCents || 0), 0);

      expect(totalQueries).toBe(36);
      expect(totalFindings).toBe(19);
      expect(totalCost).toBe(360);

      // Verify finding metrics
      expect(findings).toHaveLength(4);
      const approvedFindings = findings.filter((f) => f.status === 'approved').length;
      const rejectedFindings = findings.filter((f) => f.status === 'rejected').length;
      const appliedFindings = findings.filter((f) => f.applied === true).length;

      expect(approvedFindings).toBe(3);
      expect(rejectedFindings).toBe(1);
      expect(appliedFindings).toBe(2);

      // Calculate rates
      const approvalRate = (approvedFindings / findings.length) * 100;
      const applicationRate = (appliedFindings / approvedFindings) * 100;
      const completionRate = (completedSessions / sessions.length) * 100;

      expect(approvalRate).toBe(75);
      expect(applicationRate).toBeCloseTo(66.67, 1);
      expect(completionRate).toBeCloseTo(66.67, 1);
    });

    test('should calculate findings breakdown by field type', async () => {
      // Create session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Field breakdown test',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 10,
          totalFindings: 10,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create findings with different field types
      await db.insert(crmResearchFindings).values([
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Tech',
          confidence: 0.90,
          sources: ['s1'],
          reasoning: 'Evidence',
          status: 'approved',
        },
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'SaaS',
          confidence: 0.85,
          sources: ['s2'],
          reasoning: 'Evidence',
          status: 'approved',
        },
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '100-500',
          confidence: 0.80,
          sources: ['s3'],
          reasoning: 'Evidence',
          status: 'approved',
        },
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'website',
          value: 'https://example.com',
          confidence: 0.95,
          sources: ['s4'],
          reasoning: 'Evidence',
          status: 'approved',
        },
      ]);

      // Query findings by field
      const findings = await db
        .select()
        .from(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));

      // Group by field
      const fieldCounts = findings.reduce(
        (acc, f) => {
          acc[f.field] = (acc[f.field] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(fieldCounts['industry']).toBe(2);
      expect(fieldCounts['company_size']).toBe(1);
      expect(fieldCounts['website']).toBe(1);

      // Calculate average confidence by field
      const industryFindings = findings.filter((f) => f.field === 'industry');
      const avgIndustryConfidence =
        industryFindings.reduce((sum, f) => sum + f.confidence, 0) / industryFindings.length;

      expect(avgIndustryConfidence).toBeCloseTo(0.875, 2);
    });
  });

  describe('Date Range Filtering', () => {
    test('should filter campaigns by date range', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create campaigns with different creation dates
      await db.insert(crmCampaigns).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Recent Campaign',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: threeDaysAgo,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Old Campaign',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: sevenDaysAgo,
          createdBy: TEST_USER_ID,
        },
      ]);

      // Query last 5 days
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const recentCampaigns = await db.query.crmCampaigns.findMany({
        where: and(
          eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
          isNull(crmCampaigns.deletedAt)
        ),
      });

      const filteredRecent = recentCampaigns.filter(
        (c) => c.createdAt && c.createdAt >= fiveDaysAgo
      );

      expect(filteredRecent).toHaveLength(1);
      expect(filteredRecent[0].name).toBe('Recent Campaign');

      // Query all
      expect(recentCampaigns).toHaveLength(2);
    });

    test('should filter research sessions by date range', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Create sessions with different dates
      await db.insert(crmResearchSessions).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Recent research',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          createdAt: twoDaysAgo,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Old research',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          createdAt: tenDaysAgo,
          createdBy: TEST_USER_ID,
        },
      ]);

      // Query last 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const allSessions = await db.query.crmResearchSessions.findMany({
        where: and(
          eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID),
          isNull(crmResearchSessions.deletedAt)
        ),
      });

      const recentSessions = allSessions.filter(
        (s) => s.createdAt && s.createdAt >= sevenDaysAgo
      );

      expect(recentSessions).toHaveLength(1);
      expect(recentSessions[0].objective).toBe('Recent research');
    });
  });

  describe('Growth Metrics (WoW, MoM)', () => {
    test('should calculate week-over-week growth accurately', async () => {
      const now = new Date();
      const thisWeekStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create campaigns for this week
      await db.insert(crmCampaigns).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'This Week 1',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: thisWeekStart,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'This Week 2',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: new Date(thisWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000),
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'This Week 3',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: new Date(thisWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
          createdBy: TEST_USER_ID,
        },
      ]);

      // Create campaigns for last week
      await db.insert(crmCampaigns).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Last Week 1',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: lastWeekStart,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Last Week 2',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'draft',
          createdAt: new Date(lastWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000),
          createdBy: TEST_USER_ID,
        },
      ]);

      // Query campaigns
      const allCampaigns = await db.query.crmCampaigns.findMany({
        where: and(
          eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
          isNull(crmCampaigns.deletedAt)
        ),
      });

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const thisWeek = allCampaigns.filter(
        (c) => c.createdAt && c.createdAt >= sevenDaysAgo
      ).length;
      const lastWeek = allCampaigns.filter(
        (c) =>
          c.createdAt &&
          c.createdAt >= fourteenDaysAgo &&
          c.createdAt < sevenDaysAgo
      ).length;

      expect(thisWeek).toBe(3);
      expect(lastWeek).toBe(2);

      // Calculate WoW growth
      const weekOverWeekGrowth = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
      expect(weekOverWeekGrowth).toBe(50); // 50% growth
    });
  });

  describe('Empty Workspace Handling', () => {
    test('should handle empty workspace gracefully with zeros, not errors', async () => {
      const emptyWorkspaceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      // Create empty workspace
      await db
        .insert(workspaces)
        .values({
          id: emptyWorkspaceId,
          name: 'Empty Workspace',
          slug: 'empty-test',
          ownerId: TEST_USER_ID,
        })
        .onConflictDoNothing();

      try {
        // Query campaigns (should be empty)
        const campaigns = await db
          .select()
          .from(crmCampaigns)
          .where(
            and(
              eq(crmCampaigns.workspaceId, emptyWorkspaceId),
              isNull(crmCampaigns.deletedAt)
            )
          );

        expect(campaigns).toHaveLength(0);

        // Calculate metrics (should all be 0 or NaN handled gracefully)
        const totalCampaigns = campaigns.length;
        const totalSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
        const totalDelivered = campaigns.reduce((sum, c) => sum + (c.totalDelivered || 0), 0);
        const totalOpened = campaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);

        expect(totalCampaigns).toBe(0);
        expect(totalSent).toBe(0);
        expect(totalDelivered).toBe(0);
        expect(totalOpened).toBe(0);

        // Calculate rates (should handle division by zero)
        const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
        const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;

        expect(deliveryRate).toBe(0);
        expect(openRate).toBe(0);

        // Query research sessions (should be empty)
        const sessions = await db
          .select()
          .from(crmResearchSessions)
          .where(
            and(
              eq(crmResearchSessions.workspaceId, emptyWorkspaceId),
              isNull(crmResearchSessions.deletedAt)
            )
          );

        expect(sessions).toHaveLength(0);

        const totalSessions = sessions.length;
        const totalFindings = sessions.reduce((sum, s) => sum + (s.totalFindings || 0), 0);

        expect(totalSessions).toBe(0);
        expect(totalFindings).toBe(0);
      } finally {
        // Cleanup
        await db.delete(workspaces).where(eq(workspaces.id, emptyWorkspaceId));
      }
    });
  });

  describe('Dashboard Combined Metrics', () => {
    test('should provide accurate combined dashboard metrics', async () => {
      // Create campaigns
      await db.insert(crmCampaigns).values([
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Dashboard Campaign 1',
          objective: 'lead_generation',
          type: 'one_time',
          channels: ['email'],
          status: 'active',
          totalRecipients: 100,
          totalSent: 100,
          totalDelivered: 95,
          totalOpened: 50,
          createdBy: TEST_USER_ID,
        },
        {
          workspaceId: TEST_WORKSPACE_ID,
          name: 'Dashboard Campaign 2',
          objective: 'sales',
          type: 'one_time',
          channels: ['email'],
          status: 'completed',
          totalRecipients: 200,
          totalSent: 200,
          totalDelivered: 190,
          totalOpened: 100,
          createdBy: TEST_USER_ID,
        },
      ]);

      // Create research sessions
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Dashboard research',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 8,
          totalFindings: 5,
          completedAt: new Date(),
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create findings
      await db.insert(crmResearchFindings).values([
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Tech',
          confidence: 0.90,
          sources: ['source'],
          reasoning: 'Evidence',
          status: 'approved',
          applied: true,
        },
      ]);

      // Query dashboard metrics
      const campaigns = await db
        .select()
        .from(crmCampaigns)
        .where(
          and(
            eq(crmCampaigns.workspaceId, TEST_WORKSPACE_ID),
            isNull(crmCampaigns.deletedAt)
          )
        );

      const sessions = await db
        .select()
        .from(crmResearchSessions)
        .where(
          and(
            eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID),
            isNull(crmResearchSessions.deletedAt)
          )
        );

      // Campaign metrics
      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
      const totalSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
      const totalOpened = campaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);

      // Research metrics
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter((s) => s.status === 'completed').length;
      const totalFindings = sessions.reduce((sum, s) => sum + (s.totalFindings || 0), 0);

      // Verify dashboard metrics
      expect(totalCampaigns).toBe(2);
      expect(activeCampaigns).toBe(1);
      expect(totalSent).toBe(300);
      expect(totalOpened).toBe(150);

      expect(totalSessions).toBe(1);
      expect(completedSessions).toBe(1);
      expect(totalFindings).toBe(5);

      // Calculate KPIs
      const campaignActiveRate = (activeCampaigns / totalCampaigns) * 100;
      const researchCompletionRate = (completedSessions / totalSessions) * 100;
      const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

      expect(campaignActiveRate).toBe(50);
      expect(researchCompletionRate).toBe(100);
      expect(avgOpenRate).toBe(50);
    });
  });
});
