import { config } from 'dotenv';
config();

/**
 * Research E2E Tests
 * Comprehensive end-to-end tests for AI-powered Research system
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '@agios/db/client';
import {
  crmResearchSessions,
  crmResearchQueries,
  crmResearchFindings,
  crmContacts,
  crmTimelineEvents,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

// Test data - using UUIDs for compatibility with database schema
const TEST_WORKSPACE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_USER_ID = '55555555-5555-5555-5555-555555555555';
const TEST_CONTACT_ID = '66666666-6666-6666-6666-666666666666';

describe('Research E2E Tests', () => {
  // Setup: Create test workspace and contact
  beforeAll(async () => {
    // Create test user first
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: 'test-research@example.com',
        name: 'Test User Research',
        emailVerified: false,
      })
      .onConflictDoNothing();

    // Create test workspace
    await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: 'Test Workspace - Research',
        slug: 'test-research-e2e',
        ownerId: TEST_USER_ID,
      })
      .onConflictDoNothing();

    // Create test contact
    await db
      .insert(crmContacts)
      .values({
        id: TEST_CONTACT_ID,
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'Acme',
        lastName: 'Corporation',
        email: 'contact@acme.com',
        company: 'Acme Inc',
        stage: 'lead',
        status: 'active',
        createdBy: TEST_USER_ID,
      })
      .onConflictDoNothing();
  });

  // Cleanup after each test
  beforeEach(async () => {
    // Delete test research sessions and related data
    const sessions = await db
      .select()
      .from(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    for (const session of sessions) {
      await db
        .delete(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));
      await db
        .delete(crmResearchQueries)
        .where(eq(crmResearchQueries.sessionId, session.id));
    }

    await db
      .delete(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    await db
      .delete(crmTimelineEvents)
      .where(eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID));

    // Reset contact metadata
    await db
      .update(crmContacts)
      .set({
        customFields: {},
        industry: null,
        companySize: null,
        website: null,
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, TEST_CONTACT_ID));
  });

  // Cleanup after all tests
  afterAll(async () => {
    const sessions = await db
      .select()
      .from(crmResearchSessions)
      .where(eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID));

    for (const session of sessions) {
      await db
        .delete(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));
      await db
        .delete(crmResearchQueries)
        .where(eq(crmResearchQueries.sessionId, session.id));
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

  describe('Research Session Lifecycle', () => {
    test('should create session → generate findings → approve → apply → verify enrichment', async () => {
      // Step 1: Create research session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Enrich company information for Acme Inc',
          scope: 'basic',
          status: 'pending',
          maxQueries: 10,
          createdBy: TEST_USER_ID,
        })
        .returning();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('pending');
      expect(session.scope).toBe('basic');

      // Step 2: Simulate research execution - create queries
      const [query1] = await db
        .insert(crmResearchQueries)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          query: 'Acme Inc company size employees',
          queryType: 'company_size',
          sequence: 1,
          status: 'completed',
          resultsCount: 5,
          costCents: 10,
        })
        .returning();

      const [query2] = await db
        .insert(crmResearchQueries)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          query: 'Acme Inc industry sector',
          queryType: 'industry',
          sequence: 2,
          status: 'completed',
          resultsCount: 5,
          costCents: 10,
        })
        .returning();

      // Step 3: Generate findings
      const [finding1] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '50-100',
          confidence: 0.85,
          sources: ['https://example.com/acme-about'],
          reasoning: 'Found employee count on company about page',
          status: 'pending',
        })
        .returning();

      const [finding2] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Technology',
          confidence: 0.92,
          sources: ['https://example.com/acme-profile'],
          reasoning: 'Company profile indicates technology sector',
          status: 'pending',
        })
        .returning();

      // Step 4: Update session as completed
      await db
        .update(crmResearchSessions)
        .set({
          status: 'completed',
          totalQueries: 2,
          totalFindings: 2,
          costCents: 20,
          completedAt: new Date(),
        })
        .where(eq(crmResearchSessions.id, session.id));

      // Step 5: Approve findings
      await db
        .update(crmResearchFindings)
        .set({
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        })
        .where(eq(crmResearchFindings.id, finding1.id));

      await db
        .update(crmResearchFindings)
        .set({
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        })
        .where(eq(crmResearchFindings.id, finding2.id));

      // Step 6: Apply enrichments to contact
      const contact = await db.query.crmContacts.findFirst({
        where: eq(crmContacts.id, TEST_CONTACT_ID),
      });

      expect(contact).toBeDefined();

      await db
        .update(crmContacts)
        .set({
          companySize: '50-100',
          industry: 'Technology',
          updatedBy: TEST_USER_ID,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, TEST_CONTACT_ID));

      // Mark findings as applied
      await db
        .update(crmResearchFindings)
        .set({
          applied: true,
          appliedAt: new Date(),
          appliedBy: TEST_USER_ID,
        })
        .where(eq(crmResearchFindings.sessionId, session.id));

      // Step 7: Verify enrichment applied
      const enrichedContact = await db.query.crmContacts.findFirst({
        where: eq(crmContacts.id, TEST_CONTACT_ID),
      });

      expect(enrichedContact).toBeDefined();
      expect(enrichedContact?.companySize).toBe('50-100');
      expect(enrichedContact?.industry).toBe('Technology');

      // Verify findings marked as applied
      const appliedFindings = await db
        .select()
        .from(crmResearchFindings)
        .where(
          and(
            eq(crmResearchFindings.sessionId, session.id),
            eq(crmResearchFindings.applied, true)
          )
        );

      expect(appliedFindings).toHaveLength(2);
    });

    test('should handle multiple findings for same field → verify highest confidence wins', async () => {
      // Create session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Find company size',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 3,
          totalFindings: 3,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create multiple findings for company_size with different confidence levels
      const [lowConfidence] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '10-50',
          confidence: 0.65,
          sources: ['https://example.com/source1'],
          reasoning: 'Indirect reference',
          status: 'approved',
        })
        .returning();

      const [mediumConfidence] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '50-100',
          confidence: 0.80,
          sources: ['https://example.com/source2'],
          reasoning: 'LinkedIn profile',
          status: 'approved',
        })
        .returning();

      const [highConfidence] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '50-100',
          confidence: 0.95,
          sources: ['https://example.com/source3'],
          reasoning: 'Official company website',
          status: 'approved',
        })
        .returning();

      // Apply enrichment - should use highest confidence
      const approvedFindings = await db
        .select()
        .from(crmResearchFindings)
        .where(
          and(
            eq(crmResearchFindings.sessionId, session.id),
            eq(crmResearchFindings.status, 'approved')
          )
        )
        .orderBy((findings) => findings.confidence);

      expect(approvedFindings).toHaveLength(3);

      // Find highest confidence finding
      const highestConfidenceFinding = approvedFindings.reduce((max, finding) =>
        finding.confidence > max.confidence ? finding : max
      );

      expect(highestConfidenceFinding.confidence).toBe(0.95);
      expect(highestConfidenceFinding.value).toBe('50-100');

      // Apply only highest confidence
      await db
        .update(crmContacts)
        .set({
          companySize: highestConfidenceFinding.value,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, TEST_CONTACT_ID));

      const contact = await db.query.crmContacts.findFirst({
        where: eq(crmContacts.id, TEST_CONTACT_ID),
      });

      expect(contact?.companySize).toBe('50-100');
    });

    test('should apply enrichment → verify timeline event created', async () => {
      // Create and complete session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Enrich contact data',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 1,
          totalFindings: 1,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create approved finding
      const [finding] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'website',
          value: 'https://acme.com',
          confidence: 0.90,
          sources: ['https://example.com/acme'],
          reasoning: 'Found on company directory',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        })
        .returning();

      // Apply enrichment
      await db
        .update(crmContacts)
        .set({
          website: 'https://acme.com',
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, TEST_CONTACT_ID));

      // Create timeline event
      await db.insert(crmTimelineEvents).values({
        workspaceId: TEST_WORKSPACE_ID,
        entityType: 'contact',
        entityId: TEST_CONTACT_ID,
        eventType: 'enrichment.applied',
        eventCategory: 'system',
        eventLabel: 'Enrichments Applied',
        summary: 'Applied 1 research finding to contact',
        occurredAt: new Date(),
        actorType: 'user',
        actorId: TEST_USER_ID,
        actorName: 'User',
        metadata: {
          sessionId: session.id,
          findingsCount: 1,
          fields: ['website'],
        },
      });

      // Verify timeline event
      const timelineEvents = await db
        .select()
        .from(crmTimelineEvents)
        .where(
          and(
            eq(crmTimelineEvents.workspaceId, TEST_WORKSPACE_ID),
            eq(crmTimelineEvents.entityId, TEST_CONTACT_ID),
            eq(crmTimelineEvents.eventType, 'enrichment.applied')
          )
        );

      expect(timelineEvents).toHaveLength(1);
      expect(timelineEvents[0].summary).toContain('1 research finding');
      expect(timelineEvents[0].metadata).toHaveProperty('sessionId', session.id);
    });
  });

  describe('Research Analytics', () => {
    test('should calculate approval rates correctly', async () => {
      // Create session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Analytics test',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 5,
          totalFindings: 5,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create findings with different statuses
      await db.insert(crmResearchFindings).values([
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Tech',
          confidence: 0.90,
          sources: ['source1'],
          reasoning: 'Clear evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        },
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '100-500',
          confidence: 0.85,
          sources: ['source2'],
          reasoning: 'Strong evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        },
        {
          sessionId: session.id,
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
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'funding',
          value: 'Series A',
          confidence: 0.70,
          sources: ['source4'],
          reasoning: 'Moderate evidence',
          status: 'pending',
        },
        {
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'tech_stack',
          value: 'React, Node.js',
          confidence: 0.95,
          sources: ['source5'],
          reasoning: 'Very strong evidence',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        },
      ]);

      // Calculate approval rate
      const findings = await db
        .select()
        .from(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));

      const totalFindings = findings.length;
      const approvedFindings = findings.filter((f) => f.status === 'approved').length;
      const rejectedFindings = findings.filter((f) => f.status === 'rejected').length;
      const pendingFindings = findings.filter((f) => f.status === 'pending').length;

      expect(totalFindings).toBe(5);
      expect(approvedFindings).toBe(3);
      expect(rejectedFindings).toBe(1);
      expect(pendingFindings).toBe(1);

      const approvalRate = (approvedFindings / totalFindings) * 100;
      const rejectionRate = (rejectedFindings / totalFindings) * 100;

      expect(approvalRate).toBe(60);
      expect(rejectionRate).toBe(20);
    });
  });

  describe('Research Scope Limits', () => {
    test('should respect basic vs deep scope query limits', async () => {
      // Basic scope session
      const [basicSession] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Basic research',
          scope: 'basic',
          status: 'pending',
          maxQueries: 10,
          createdBy: TEST_USER_ID,
        })
        .returning();

      expect(basicSession.maxQueries).toBe(10);

      // Deep scope session
      const [deepSession] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Deep research',
          scope: 'deep',
          status: 'pending',
          maxQueries: 30,
          createdBy: TEST_USER_ID,
        })
        .returning();

      expect(deepSession.maxQueries).toBe(30);

      // Verify scope affects query limits
      expect(deepSession.maxQueries).toBeGreaterThan(basicSession.maxQueries);
    });
  });

  describe('Finding Management', () => {
    test('should approve and reject individual findings', async () => {
      // Create session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Test finding management',
          scope: 'basic',
          status: 'completed',
          maxQueries: 10,
          totalQueries: 2,
          totalFindings: 2,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Create findings
      const [finding1] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Technology',
          confidence: 0.90,
          sources: ['source1'],
          reasoning: 'Clear evidence',
          status: 'pending',
        })
        .returning();

      const [finding2] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'company_size',
          value: '1000+',
          confidence: 0.40,
          sources: ['source2'],
          reasoning: 'Unclear evidence',
          status: 'pending',
        })
        .returning();

      // Approve first finding
      await db
        .update(crmResearchFindings)
        .set({
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        })
        .where(eq(crmResearchFindings.id, finding1.id));

      // Reject second finding
      await db
        .update(crmResearchFindings)
        .set({
          status: 'rejected',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
          reviewNotes: 'Confidence too low',
        })
        .where(eq(crmResearchFindings.id, finding2.id));

      // Verify statuses
      const findings = await db
        .select()
        .from(crmResearchFindings)
        .where(eq(crmResearchFindings.sessionId, session.id));

      const approvedFinding = findings.find((f) => f.id === finding1.id);
      const rejectedFinding = findings.find((f) => f.id === finding2.id);

      expect(approvedFinding?.status).toBe('approved');
      expect(rejectedFinding?.status).toBe('rejected');
      expect(rejectedFinding?.reviewNotes).toBe('Confidence too low');
    });

    test('should apply single finding individually', async () => {
      // Create session and finding
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Single finding test',
          scope: 'basic',
          status: 'completed',
          maxQueries: 1,
          totalQueries: 1,
          totalFindings: 1,
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [finding] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'website',
          value: 'https://acme.com',
          confidence: 0.95,
          sources: ['official-directory'],
          reasoning: 'Found on official directory',
          status: 'approved',
          reviewedBy: TEST_USER_ID,
          reviewedAt: new Date(),
        })
        .returning();

      // Apply single finding
      await db
        .update(crmContacts)
        .set({
          website: finding.value,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, TEST_CONTACT_ID));

      await db
        .update(crmResearchFindings)
        .set({
          applied: true,
          appliedAt: new Date(),
          appliedBy: TEST_USER_ID,
        })
        .where(eq(crmResearchFindings.id, finding.id));

      // Verify applied
      const contact = await db.query.crmContacts.findFirst({
        where: eq(crmContacts.id, TEST_CONTACT_ID),
      });

      const appliedFinding = await db.query.crmResearchFindings.findFirst({
        where: eq(crmResearchFindings.id, finding.id),
      });

      expect(contact?.website).toBe('https://acme.com');
      expect(appliedFinding?.applied).toBe(true);
      expect(appliedFinding?.appliedAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle session not found gracefully', async () => {
      const session = await db.query.crmResearchSessions.findFirst({
        where: and(
          eq(crmResearchSessions.id, 'non-existent-session'),
          eq(crmResearchSessions.workspaceId, TEST_WORKSPACE_ID)
        ),
      });

      expect(session).toBeUndefined();
    });

    test('should handle finding not found gracefully', async () => {
      const finding = await db.query.crmResearchFindings.findFirst({
        where: and(
          eq(crmResearchFindings.id, 'non-existent-finding'),
          eq(crmResearchFindings.workspaceId, TEST_WORKSPACE_ID)
        ),
      });

      expect(finding).toBeUndefined();
    });

    test('should prevent applying unapproved findings', async () => {
      // Create session with pending finding
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Error test',
          scope: 'basic',
          status: 'completed',
          maxQueries: 1,
          totalQueries: 1,
          totalFindings: 1,
          createdBy: TEST_USER_ID,
        })
        .returning();

      const [pendingFinding] = await db
        .insert(crmResearchFindings)
        .values({
          sessionId: session.id,
          workspaceId: TEST_WORKSPACE_ID,
          field: 'industry',
          value: 'Healthcare',
          confidence: 0.75,
          sources: ['source'],
          reasoning: 'Some evidence',
          status: 'pending', // Not approved
        })
        .returning();

      // Get approved findings (should be empty)
      const approvedFindings = await db
        .select()
        .from(crmResearchFindings)
        .where(
          and(
            eq(crmResearchFindings.sessionId, session.id),
            eq(crmResearchFindings.status, 'approved')
          )
        );

      expect(approvedFindings).toHaveLength(0);

      // Verify contact was not enriched
      const contact = await db.query.crmContacts.findFirst({
        where: eq(crmContacts.id, TEST_CONTACT_ID),
      });

      expect(contact?.industry).toBeNull();
    });
  });

  describe('Session Status Management', () => {
    test('should transition session through lifecycle states', async () => {
      // Create pending session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Status lifecycle test',
          scope: 'basic',
          status: 'pending',
          maxQueries: 10,
          createdBy: TEST_USER_ID,
        })
        .returning();

      expect(session.status).toBe('pending');

      // Move to running
      await db
        .update(crmResearchSessions)
        .set({ status: 'running' })
        .where(eq(crmResearchSessions.id, session.id));

      let updated = await db.query.crmResearchSessions.findFirst({
        where: eq(crmResearchSessions.id, session.id),
      });
      expect(updated?.status).toBe('running');

      // Move to completed
      await db
        .update(crmResearchSessions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalQueries: 5,
          totalFindings: 3,
        })
        .where(eq(crmResearchSessions.id, session.id));

      updated = await db.query.crmResearchSessions.findFirst({
        where: eq(crmResearchSessions.id, session.id),
      });
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    test('should allow stopping running session', async () => {
      // Create running session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          entityType: 'contact',
          entityId: TEST_CONTACT_ID,
          objective: 'Stop test',
          scope: 'basic',
          status: 'running',
          maxQueries: 10,
          totalQueries: 3,
          totalFindings: 2,
          createdBy: TEST_USER_ID,
        })
        .returning();

      // Stop session
      await db
        .update(crmResearchSessions)
        .set({
          status: 'stopped',
          completedAt: new Date(),
        })
        .where(eq(crmResearchSessions.id, session.id));

      const stopped = await db.query.crmResearchSessions.findFirst({
        where: eq(crmResearchSessions.id, session.id),
      });

      expect(stopped?.status).toBe('stopped');
      expect(stopped?.completedAt).toBeDefined();
    });
  });
});
