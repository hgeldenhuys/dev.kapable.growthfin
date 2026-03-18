/**
 * Lead Scoring Worker Tests
 * Tests for background job queue processing of lead scoring
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads, crmLeadScoreHistory, workspaces, users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { processLeadScoreJob } from '../calculate-lead-score';
import type PgBoss from 'pg-boss';
import type { CalculateLeadScoreJob } from '../../../lib/queue';

// Test data
let testWorkspaceId: string;
let testUserId: string;
let testLeadId: string;

describe('Lead Scoring Worker', () => {
  beforeAll(async () => {
    // Create test user first (needed for workspace owner)
    const [user] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
      })
      .returning();
    testUserId = user.id;

    // Create test workspace with owner
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace',
        slug: 'test-workspace-scoring',
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;
  });

  beforeEach(async () => {
    // Create test lead before each test
    const [lead] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        email: 'john@acme.com',
        phone: '+1234567890',
        source: 'website',
        status: 'new',
        ownerId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testLeadId = lead.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(crmLeadScoreHistory).where(eq(crmLeadScoreHistory.workspaceId, testWorkspaceId));
    await db.delete(crmLeads).where(eq(crmLeads.workspaceId, testWorkspaceId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
  });

  it('should process lead scoring job successfully', async () => {
    // Create mock job
    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-1',
      name: 'calculate-lead-score',
      data: {
        leadId: testLeadId,
        workspaceId: testWorkspaceId,
        trigger: 'created',
        triggerUserId: testUserId,
      },
      priority: 10,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    // Process the job
    await processLeadScoreJob(job);

    // Verify lead was updated
    const updatedLead = await db.query.crmLeads.findFirst({
      where: eq(crmLeads.id, testLeadId),
    });

    expect(updatedLead).toBeDefined();
    expect(updatedLead!.propensityScore).toBeGreaterThanOrEqual(0);
    expect(updatedLead!.propensityScore).toBeLessThanOrEqual(100);
    expect(updatedLead!.propensityScoreUpdatedAt).toBeDefined();
    expect(updatedLead!.scoreBreakdown).toBeDefined();

    // Verify score breakdown structure
    const breakdown = updatedLead!.scoreBreakdown as any;
    expect(breakdown.total).toBeDefined();
    expect(breakdown.components).toBeDefined();
    expect(breakdown.components.contactQuality).toBeDefined();
    expect(breakdown.components.companyFit).toBeDefined();
    expect(breakdown.components.engagement).toBeDefined();
    expect(breakdown.components.timing).toBeDefined();

    // Verify score history was created
    const history = await db.query.crmLeadScoreHistory.findFirst({
      where: eq(crmLeadScoreHistory.leadId, testLeadId),
    });

    expect(history).toBeDefined();
    expect(history!.workspaceId).toBe(testWorkspaceId);
    expect(history!.leadId).toBe(testLeadId);
    expect(history!.scoreAfter).toBe(updatedLead!.propensityScore);
    expect(history!.triggerType).toBe('created');
    expect(history!.triggerUserId).toBe(testUserId);
  });

  it('should handle lead update trigger', async () => {
    // Create initial score
    await db
      .update(crmLeads)
      .set({
        propensityScore: 50,
        propensityScoreUpdatedAt: new Date(),
        scoreBreakdown: { total: 50, components: {} },
      })
      .where(eq(crmLeads.id, testLeadId));

    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-2',
      name: 'calculate-lead-score',
      data: {
        leadId: testLeadId,
        workspaceId: testWorkspaceId,
        trigger: 'updated',
        triggerUserId: testUserId,
      },
      priority: 5,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    await processLeadScoreJob(job);

    // Verify history shows the before and after
    const histories = await db
      .select()
      .from(crmLeadScoreHistory)
      .where(eq(crmLeadScoreHistory.leadId, testLeadId));

    expect(histories.length).toBeGreaterThanOrEqual(1);
    const latestHistory = histories[histories.length - 1];
    expect(latestHistory.scoreBefore).toBe(50);
    expect(latestHistory.triggerType).toBe('updated');
  });

  it('should handle manual recalculation trigger', async () => {
    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-3',
      name: 'calculate-lead-score',
      data: {
        leadId: testLeadId,
        workspaceId: testWorkspaceId,
        trigger: 'manual',
        triggerUserId: testUserId,
        triggerReason: 'Testing manual recalculation',
      },
      priority: 7,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    await processLeadScoreJob(job);

    // Verify history includes reason
    const history = await db.query.crmLeadScoreHistory.findFirst({
      where: eq(crmLeadScoreHistory.leadId, testLeadId),
    });

    expect(history).toBeDefined();
    expect(history!.triggerType).toBe('manual');
    expect(history!.triggerReason).toBe('Testing manual recalculation');
  });

  it('should complete gracefully for non-existent lead (no retry)', async () => {
    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-4',
      name: 'calculate-lead-score',
      data: {
        leadId: '00000000-0000-0000-0000-000000000000',
        workspaceId: testWorkspaceId,
        trigger: 'created',
        triggerUserId: testUserId,
      },
      priority: 10,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    // Should complete without throwing (orphaned lead — no retry needed)
    await expect(processLeadScoreJob(job)).resolves.toBeUndefined();
  });

  it('should complete gracefully for workspace mismatch (no retry)', async () => {
    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-5',
      name: 'calculate-lead-score',
      data: {
        leadId: testLeadId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Wrong workspace
        trigger: 'created',
        triggerUserId: testUserId,
      },
      priority: 10,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    // Should complete without throwing (data inconsistency — no retry needed)
    await expect(processLeadScoreJob(job)).resolves.toBeUndefined();
  });

  it('should complete within performance target (<2s)', async () => {
    const job: PgBoss.Job<CalculateLeadScoreJob> = {
      id: 'test-job-6',
      name: 'calculate-lead-score',
      data: {
        leadId: testLeadId,
        workspaceId: testWorkspaceId,
        trigger: 'created',
        triggerUserId: testUserId,
      },
      priority: 10,
      state: 'active',
      retrylimit: 3,
      retrycount: 0,
      retrydelay: 0,
      retrybackoff: false,
      startafter: new Date(),
      startedon: new Date(),
      createdon: new Date(),
    };

    const start = Date.now();
    await processLeadScoreJob(job);
    const duration = Date.now() - start;

    // AC-010: Job processing <2s per lead (p95)
    expect(duration).toBeLessThan(2000);
  });
});
