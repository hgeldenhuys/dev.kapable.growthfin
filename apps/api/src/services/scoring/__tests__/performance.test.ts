import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { calculatePropensityScore, calculatePropensityScoresBulk } from '../propensity-score';
import { db } from '@agios/db';
import { crmLeads, crmContacts, crmAccounts, crmActivities, workspaces, users } from '@agios/db/schema';
import { eq, inArray } from 'drizzle-orm';

describe('Scoring Performance', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testLeadIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `perf-test-${Date.now()}@example.com`,
        name: 'Performance Test User',
        emailVerified: true,
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Performance Test Workspace',
        slug: `perf-test-${Date.now()}`,
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test account
    const [account] = await db
      .insert(crmAccounts)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Perf Test Corp',
        industry: 'Software',
        employeeCount: 100,
        annualRevenue: '20000000',
        healthScore: 75,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    // Create test contact
    const [contact] = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'Contact',
        email: 'test@perftest.com',
        phone: '+27821234567',
        title: 'CEO',
        accountId: account.id,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    // Create 100 test leads
    const leadValues = [];
    for (let i = 0; i < 100; i++) {
      leadValues.push({
        workspaceId: testWorkspaceId,
        firstName: `Lead`,
        lastName: `${i}`,
        companyName: `Company ${i}`,
        email: `lead${i}@perftest.com`,
        phone: '+27821234567',
        source: 'performance-test',
        status: 'new' as const,
        convertedContactId: contact.id,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
    }

    const leads = await db.insert(crmLeads).values(leadValues).returning();
    testLeadIds = leads.map((l) => l.id);

    // Create a few activities for some leads
    const activityValues = [];
    for (let i = 0; i < 20; i++) {
      activityValues.push({
        workspaceId: testWorkspaceId,
        leadId: testLeadIds[i],
        type: 'call' as const,
        subject: `Activity ${i}`,
        status: 'completed' as const,
        disposition: 'connected',
        assigneeId: testUserId,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
    }

    await db.insert(crmActivities).values(activityValues);
  });

  afterAll(async () => {
    // Cleanup
    if (testLeadIds.length > 0) {
      await db.delete(crmActivities).where(inArray(crmActivities.leadId, testLeadIds));
      await db.delete(crmLeads).where(inArray(crmLeads.id, testLeadIds));
    }
    if (testWorkspaceId) {
      await db.delete(crmContacts).where(eq(crmContacts.workspaceId, testWorkspaceId));
      await db.delete(crmAccounts).where(eq(crmAccounts.workspaceId, testWorkspaceId));
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('scores 100 leads in <10 seconds', async () => {
    const startTime = Date.now();

    // Score all leads
    const results = await calculatePropensityScoresBulk(testLeadIds);

    const elapsed = Date.now() - startTime;

    console.log(`\n📊 Performance Results:`);
    console.log(`   Total leads scored: ${results.size}`);
    console.log(`   Time elapsed: ${elapsed}ms`);
    console.log(`   Average per lead: ${(elapsed / results.size).toFixed(2)}ms`);
    console.log(`   Throughput: ${((results.size / elapsed) * 1000).toFixed(2)} leads/sec`);

    // Should complete in under 10 seconds
    expect(elapsed).toBeLessThan(10000);
    expect(results.size).toBe(100);
  }, 15000); // 15s timeout for test

  it('individual lead scoring completes in <2 seconds (p95)', async () => {
    const times: number[] = [];

    // Score 20 random leads
    const sampleSize = 20;
    for (let i = 0; i < sampleSize; i++) {
      const leadId = testLeadIds[Math.floor(Math.random() * testLeadIds.length)];
      const start = Date.now();
      await calculatePropensityScore(leadId);
      times.push(Date.now() - start);
    }

    // Calculate p95
    times.sort((a, b) => a - b);
    const p95Index = Math.floor(times.length * 0.95);
    const p95Time = times[p95Index];

    console.log(`\n📊 Individual Scoring Performance:`);
    console.log(`   Samples: ${sampleSize}`);
    console.log(`   Min: ${Math.min(...times)}ms`);
    console.log(`   Max: ${Math.max(...times)}ms`);
    console.log(`   Average: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)}ms`);
    console.log(`   P95: ${p95Time}ms`);

    expect(p95Time).toBeLessThan(2000);
  }, 30000); // 30s timeout for test
});
