import { describe, it, expect } from 'bun:test';
import { scoreEngagement } from '../components/engagement';
import type { CrmActivity } from '@agios/db/schema';

describe('Engagement Scoring', () => {
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

  it('scores perfect engagement (20 points)', () => {
    const now = new Date();
    const activities = [
      createActivity({ createdAt: now, status: 'completed' }),
      createActivity({
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: 'completed',
      }),
      createActivity({
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: 'completed',
      }),
    ];

    const result = scoreEngagement(activities);

    expect(result.score).toBe(20);
    expect(result.max).toBe(20);
    expect(result.details.recentActivity.points).toBe(10);
    expect(result.details.responseRate.points).toBe(10);
  });

  it('scores no engagement (0 points)', () => {
    const result = scoreEngagement([]);

    expect(result.score).toBe(0);
    expect(result.max).toBe(20);
    expect(result.details.recentActivity.points).toBe(0);
    expect(result.details.responseRate.points).toBe(0);
  });

  it('detects recent activity within 7 days', () => {
    const now = new Date();
    const activities = [
      createActivity({ createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) }),
      createActivity({ createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.recentActivity.points).toBe(10);
    expect(result.details.recentActivity.value).toBe(2);
  });

  it('does not score old activity (>7 days)', () => {
    const now = new Date();
    const activities = [
      createActivity({ createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }),
      createActivity({ createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.recentActivity.points).toBe(0);
    expect(result.details.recentActivity.reason).toContain('10 days ago');
  });

  it('scores excellent response rate (70%+) with 10 points', () => {
    const activities = [
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'cancelled' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.responseRate.points).toBe(10);
    expect(result.details.responseRate.value).toBe(70); // 7/10 = 70%
  });

  it('scores good response rate (50-69%) with 7 points', () => {
    const activities = [
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.responseRate.points).toBe(7);
    expect(result.details.responseRate.value).toBe(60); // 3/5 = 60%
  });

  it('scores fair response rate (30-49%) with 4 points', () => {
    const activities = [
      createActivity({ status: 'completed' }),
      createActivity({ status: 'completed' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.responseRate.points).toBe(4);
    expect(result.details.responseRate.value).toBe(40); // 2/5 = 40%
  });

  it('scores poor response rate (1-29%) with 2 points', () => {
    const activities = [
      createActivity({ status: 'completed' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
      createActivity({ status: 'planned' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.responseRate.points).toBe(2);
    expect(result.details.responseRate.value).toBe(20); // 1/5 = 20%
  });

  it('combines recent activity and response rate', () => {
    const now = new Date();
    const activities = [
      createActivity({
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: 'completed',
      }),
      createActivity({
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        status: 'completed',
      }),
      createActivity({
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        status: 'completed',
      }),
      createActivity({
        createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        status: 'planned',
      }),
    ];

    const result = scoreEngagement(activities);

    // Recent activity: 2 activities in last 7 days = 10 points
    expect(result.details.recentActivity.points).toBe(10);

    // Response rate: 3/4 = 75% = 10 points
    expect(result.details.responseRate.points).toBe(10);

    expect(result.score).toBe(20);
  });

  it('handles edge case: all activities cancelled', () => {
    const activities = [
      createActivity({ status: 'cancelled' }),
      createActivity({ status: 'cancelled' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.responseRate.points).toBe(0);
    expect(result.details.responseRate.value).toBe(0);
  });

  it('provides detailed reasons in output', () => {
    const now = new Date();
    const activities = [
      createActivity({ createdAt: now, status: 'completed' }),
      createActivity({ status: 'planned' }),
    ];

    const result = scoreEngagement(activities);

    expect(result.details.recentActivity.reason).toBeTruthy();
    expect(result.details.responseRate.reason).toBeTruthy();
  });
});
