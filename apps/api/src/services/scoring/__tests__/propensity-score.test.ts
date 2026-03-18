import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { calculatePropensityScore, calculatePropensityScoresBulk } from '../propensity-score';
import { db } from '@agios/db';
import { crmLeads, crmContacts, crmAccounts, crmActivities, workspaces, users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

describe('Propensity Score Calculator (Integration)', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testLeadId: string;
  let testContactId: string;
  let testAccountId: string;

  beforeAll(async () => {
    // Create test user first (needed for workspace owner)
    const [user] = await db
      .insert(users)
      .values({
        email: `test-scoring-${Date.now()}@example.com`,
        name: 'Test User',
        emailVerified: true,
      })
      .returning();
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: 'Test Workspace - Scoring',
        slug: `test-scoring-${Date.now()}`,
        ownerId: testUserId,
      })
      .returning();
    testWorkspaceId = workspace.id;

    // Create test account
    const [account] = await db
      .insert(crmAccounts)
      .values({
        workspaceId: testWorkspaceId,
        name: 'Acme Software Corp',
        industry: 'Software',
        employeeCount: 100,
        annualRevenue: '20000000',
        healthScore: 80,
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testAccountId = account.id;

    // Create test contact
    const [contact] = await db
      .insert(crmContacts)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Jane',
        lastName: 'CEO',
        email: 'jane.ceo@acme.com',
        phone: '+27821234567',
        title: 'CEO',
        accountId: testAccountId,
        customFields: { linkedinUrl: 'https://linkedin.com/in/janeceo' },
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testContactId = contact.id;

    // Create test lead
    const [lead] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Jane',
        lastName: 'CEO',
        companyName: 'Acme Software Corp',
        email: 'jane.ceo@acme.com',
        phone: '+27821234567',
        source: 'website',
        status: 'new',
        convertedContactId: testContactId,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testLeadId = lead.id;

    // Create test activities
    await db.insert(crmActivities).values([
      {
        workspaceId: testWorkspaceId,
        leadId: testLeadId,
        type: 'call',
        subject: 'Initial call',
        status: 'completed',
        disposition: 'connected',
        assigneeId: testUserId,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        workspaceId: testWorkspaceId,
        leadId: testLeadId,
        type: 'email',
        subject: 'Follow-up email',
        status: 'completed',
        assigneeId: testUserId,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testLeadId) {
      await db.delete(crmActivities).where(eq(crmActivities.leadId, testLeadId));
      await db.delete(crmLeads).where(eq(crmLeads.id, testLeadId));
    }
    if (testContactId) {
      await db.delete(crmContacts).where(eq(crmContacts.id, testContactId));
    }
    if (testAccountId) {
      await db.delete(crmAccounts).where(eq(crmAccounts.id, testAccountId));
    }
    if (testWorkspaceId) {
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('calculates full propensity score with all components', async () => {
    const result = await calculatePropensityScore(testLeadId);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown).toBeTruthy();
    expect(result.breakdown.total).toBe(result.score);
  });

  it('includes all 4 component scores', async () => {
    const result = await calculatePropensityScore(testLeadId);

    expect(result.breakdown.components.contactQuality).toBeTruthy();
    expect(result.breakdown.components.companyFit).toBeTruthy();
    expect(result.breakdown.components.engagement).toBeTruthy();
    expect(result.breakdown.components.timing).toBeTruthy();
  });

  it('contact quality component scores correctly', async () => {
    const result = await calculatePropensityScore(testLeadId);
    const contactQuality = result.breakdown.components.contactQuality;

    expect(contactQuality.score).toBeGreaterThan(0);
    expect(contactQuality.max).toBe(30);
    expect(contactQuality.details.email.points).toBe(10);
    expect(contactQuality.details.phone.points).toBe(10);
    expect(contactQuality.details.linkedin.points).toBe(5);
    expect(contactQuality.details.decisionMaker.points).toBe(5);
    expect(contactQuality.score).toBe(30); // Perfect contact
  });

  it('company fit component scores correctly', async () => {
    const result = await calculatePropensityScore(testLeadId);
    const companyFit = result.breakdown.components.companyFit;

    expect(companyFit.score).toBeGreaterThan(0);
    expect(companyFit.max).toBe(30);
    expect(companyFit.details.industry.points).toBe(10); // Software matches ICP
    expect(companyFit.details.companySize.points).toBe(10); // 100 employees in range
    expect(companyFit.details.revenue.points).toBe(10); // R20M in range
    expect(companyFit.score).toBe(30); // Perfect fit
  });

  it('engagement component scores correctly', async () => {
    const result = await calculatePropensityScore(testLeadId);
    const engagement = result.breakdown.components.engagement;

    expect(engagement.score).toBeGreaterThan(0);
    expect(engagement.max).toBe(20);
    expect(engagement.details.recentActivity.points).toBe(10); // 2 activities in last 7 days
    expect(engagement.details.responseRate.points).toBeGreaterThan(0); // 100% completion rate
  });

  it('timing component scores correctly', async () => {
    const result = await calculatePropensityScore(testLeadId);
    const timing = result.breakdown.components.timing;

    expect(timing.score).toBeGreaterThan(0);
    expect(timing.max).toBe(20);
    expect(timing.details.leadAge.points).toBe(10); // 5 days old = brand new
    expect(timing.details.priorEngagement.points).toBe(5); // Connected disposition
    expect(timing.details.accountHealth.points).toBeGreaterThan(0); // Health score 80
  });

  it('total score is sum of components', async () => {
    const result = await calculatePropensityScore(testLeadId);

    const sum =
      result.breakdown.components.contactQuality.score +
      result.breakdown.components.companyFit.score +
      result.breakdown.components.engagement.score +
      result.breakdown.components.timing.score;

    expect(result.score).toBe(sum);
    expect(result.breakdown.total).toBe(sum);
  });

  it('throws error for non-existent lead', async () => {
    expect(async () => {
      await calculatePropensityScore('non-existent-lead-id');
    }).toThrow();
  });

  it('handles lead with no contact data', async () => {
    // Create lead without converted contact
    const [leadNoContact] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'No Contact Corp',
        email: 'john@example.com',
        phone: null,
        source: 'manual',
        status: 'new',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    const result = await calculatePropensityScore(leadNoContact.id);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    // Cleanup
    await db.delete(crmLeads).where(eq(crmLeads.id, leadNoContact.id));
  });

  it('handles lead with no account data', async () => {
    // Create lead without account
    const [leadNoAccount] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Jane',
        lastName: 'Smith',
        companyName: 'No Account Corp',
        email: 'jane@example.com',
        source: 'manual',
        status: 'new',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    const result = await calculatePropensityScore(leadNoAccount.id);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.components.companyFit.score).toBe(0);

    // Cleanup
    await db.delete(crmLeads).where(eq(crmLeads.id, leadNoAccount.id));
  });

  it('handles lead with no activities', async () => {
    // Create lead without activities
    const [leadNoActivities] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Bob',
        lastName: 'Builder',
        companyName: 'Build Corp',
        email: 'bob@build.com',
        source: 'manual',
        status: 'new',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    const result = await calculatePropensityScore(leadNoActivities.id);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.components.engagement.score).toBe(0);

    // Cleanup
    await db.delete(crmLeads).where(eq(crmLeads.id, leadNoActivities.id));
  });

  it('bulk calculation processes multiple leads', async () => {
    // Create additional test leads
    const [lead2] = await db
      .insert(crmLeads)
      .values({
        workspaceId: testWorkspaceId,
        firstName: 'Test',
        lastName: 'Lead2',
        companyName: 'Test Corp 2',
        email: 'test2@example.com',
        source: 'manual',
        status: 'new',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();

    const results = await calculatePropensityScoresBulk([testLeadId, lead2.id]);

    expect(results.size).toBe(2);
    expect(results.get(testLeadId)).toBeTruthy();
    expect(results.get(lead2.id)).toBeTruthy();

    // Cleanup
    await db.delete(crmLeads).where(eq(crmLeads.id, lead2.id));
  });

  it('ensures score is between 0 and 100', async () => {
    const result = await calculatePropensityScore(testLeadId);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('includes detailed reasons for each component', async () => {
    const result = await calculatePropensityScore(testLeadId);

    // Check all components have detailed reasons
    const { contactQuality, companyFit, engagement, timing } = result.breakdown.components;

    for (const key in contactQuality.details) {
      expect(contactQuality.details[key].reason).toBeTruthy();
    }

    for (const key in companyFit.details) {
      expect(companyFit.details[key].reason).toBeTruthy();
    }

    for (const key in engagement.details) {
      expect(engagement.details[key].reason).toBeTruthy();
    }

    for (const key in timing.details) {
      expect(timing.details[key].reason).toBeTruthy();
    }
  });
});
