import { describe, it, expect } from 'bun:test';
import { scoreTimingReadiness } from '../components/timing';
import type { CrmLead, CrmAccount, CrmActivity } from '@agios/db/schema';

describe('Timing & Readiness Scoring', () => {
  const createLead = (overrides: Partial<CrmLead> = {}): CrmLead => ({
    id: 'test-lead-id',
    workspaceId: 'test-workspace',
    firstName: 'Jane',
    lastName: 'Smith',
    companyName: 'Acme Corp',
    email: null,
    phone: null,
    status: 'new',
    source: 'website',
    leadScore: 0,
    estimatedValue: null,
    expectedCloseDate: null,
    callbackDate: null,
    lastContactDate: null,
    propensityScore: 0,
    propensityScoreUpdatedAt: null,
    scoreBreakdown: {},
    campaignId: null,
    ownerId: null,
    convertedContactId: null,
    convertedAt: null,
    tags: [],
    customFields: {},
    deletedAt: null,
    canBeRevived: true,
    revivalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  const createAccount = (overrides: Partial<CrmAccount> = {}): CrmAccount => ({
    id: 'test-account-id',
    workspaceId: 'test-workspace',
    name: 'Acme Corp',
    industry: null,
    employeeCount: null,
    annualRevenue: null,
    website: null,
    parentAccountId: null,
    ownerId: null,
    healthScore: 50,
    healthScoreUpdatedAt: null,
    tags: [],
    customFields: {},
    deletedAt: null,
    canBeRevived: true,
    revivalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  const createActivity = (overrides: Partial<CrmActivity> = {}): CrmActivity => ({
    id: 'test-activity-id',
    workspaceId: 'test-workspace',
    type: 'call',
    subject: 'Test Activity',
    description: null,
    status: 'planned',
    priority: 'medium',
    dueDate: null,
    completedDate: null,
    duration: null,
    contactId: null,
    accountId: null,
    opportunityId: null,
    leadId: 'test-lead-id',
    assigneeId: 'test-user-id',
    outcome: null,
    disposition: null,
    tags: [],
    metadata: {},
    deletedAt: null,
    canBeRevived: true,
    revivalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  it('scores perfect timing and readiness (20 points)', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
    });
    const account = createAccount({ healthScore: 100 });
    const activities = [
      createActivity({ disposition: 'connected' }),
      createActivity({ disposition: 'interested' }),
    ];

    const result = scoreTimingReadiness(lead, account, activities);

    expect(result.score).toBe(20);
    expect(result.max).toBe(20);
    expect(result.details.leadAge.points).toBe(10);
    expect(result.details.priorEngagement.points).toBe(5);
    expect(result.details.accountHealth.points).toBe(5);
  });

  it('scores brand new lead (≤7 days) with 10 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(10);
    expect(result.details.leadAge.reason).toContain('Brand new');
  });

  it('scores recent lead (8-14 days) with 8 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(8);
    expect(result.details.leadAge.reason).toContain('Recent');
  });

  it('scores moderately fresh lead (15-30 days) with 6 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(6);
    expect(result.details.leadAge.reason).toContain('Moderately fresh');
  });

  it('scores aging lead (31-60 days) with 4 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(4);
    expect(result.details.leadAge.reason).toContain('Aging');
  });

  it('scores old lead (61-90 days) with 2 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(2);
    expect(result.details.leadAge.reason).toContain('Old');
  });

  it('scores very old lead (>90 days) with 0 points', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    });

    const result = scoreTimingReadiness(lead, null, []);

    expect(result.details.leadAge.points).toBe(0);
    expect(result.details.leadAge.reason).toContain('Very old');
  });

  it('detects positive engagement dispositions', () => {
    const positiveDispositions = [
      'connected',
      'interested',
      'callback_requested',
      'meeting_scheduled',
    ];

    for (const disposition of positiveDispositions) {
      const activities = [createActivity({ disposition })];
      const result = scoreTimingReadiness(createLead(), null, activities);
      expect(result.details.priorEngagement.points).toBe(5);
    }
  });

  it('does not score negative dispositions', () => {
    const negativeDispositions = ['no_answer', 'voicemail', 'busy', 'not_interested'];

    for (const disposition of negativeDispositions) {
      const activities = [createActivity({ disposition })];
      const result = scoreTimingReadiness(createLead(), null, activities);
      expect(result.details.priorEngagement.points).toBe(0);
    }
  });

  it('scores multiple positive engagements', () => {
    const activities = [
      createActivity({ disposition: 'connected' }),
      createActivity({ disposition: 'interested' }),
      createActivity({ disposition: 'callback_requested' }),
    ];

    const result = scoreTimingReadiness(createLead(), null, activities);

    expect(result.details.priorEngagement.points).toBe(5);
    expect(result.details.priorEngagement.value).toBe(3);
  });

  it('maps account health score (100) to 5 points', () => {
    const account = createAccount({ healthScore: 100 });

    const result = scoreTimingReadiness(createLead(), account, []);

    expect(result.details.accountHealth.points).toBe(5);
    expect(result.details.accountHealth.value).toBe(100);
  });

  it('maps account health score (50) to 3 points', () => {
    const account = createAccount({ healthScore: 50 });

    const result = scoreTimingReadiness(createLead(), account, []);

    expect(result.details.accountHealth.points).toBe(3);
  });

  it('maps account health score (0) to 0 points', () => {
    const account = createAccount({ healthScore: 0 });

    const result = scoreTimingReadiness(createLead(), account, []);

    expect(result.details.accountHealth.points).toBe(0);
  });

  it('defaults to neutral score (2 points) when no account', () => {
    const result = scoreTimingReadiness(createLead(), null, []);

    expect(result.details.accountHealth.points).toBe(2);
    expect(result.details.accountHealth.reason).toContain('neutral');
  });

  it('combines all timing components', () => {
    const lead = createLead({
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    const account = createAccount({ healthScore: 80 });
    const activities = [createActivity({ disposition: 'connected' })];

    const result = scoreTimingReadiness(lead, account, activities);

    expect(result.details.leadAge.points).toBe(10);
    expect(result.details.priorEngagement.points).toBe(5);
    expect(result.details.accountHealth.points).toBe(4); // 80/100 * 5 = 4
    expect(result.score).toBe(19);
  });

  it('handles no activities gracefully', () => {
    const result = scoreTimingReadiness(createLead(), null, []);

    expect(result.details.priorEngagement.points).toBe(0);
    expect(result.details.priorEngagement.reason).toContain('No engagement history');
  });

  it('provides detailed reasons in output', () => {
    const lead = createLead();
    const account = createAccount({ healthScore: 75 });
    const activities = [createActivity({ disposition: 'interested' })];

    const result = scoreTimingReadiness(lead, account, activities);

    expect(result.details.leadAge.reason).toBeTruthy();
    expect(result.details.priorEngagement.reason).toBeTruthy();
    expect(result.details.accountHealth.reason).toBeTruthy();
  });
});
