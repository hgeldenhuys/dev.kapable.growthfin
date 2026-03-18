import { describe, it, expect } from 'bun:test';
import { scoreCompanyFit } from '../components/company-fit';
import type { CrmAccount } from '@agios/db/schema';

describe('Company Fit Scoring', () => {
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

  it('scores perfect ICP match (30 points)', () => {
    const account = createAccount({
      industry: 'Software',
      employeeCount: 100,
      annualRevenue: '20000000', // R20M
    });

    const result = scoreCompanyFit(account);

    expect(result.score).toBe(30);
    expect(result.max).toBe(30);
    expect(result.details.industry.points).toBe(10);
    expect(result.details.companySize.points).toBe(10);
    expect(result.details.revenue.points).toBe(10);
  });

  it('scores account with no data (0 points)', () => {
    const result = scoreCompanyFit(null);

    expect(result.score).toBe(0);
    expect(result.max).toBe(30);
    expect(result.details.industry.points).toBe(0);
    expect(result.details.companySize.points).toBe(0);
    expect(result.details.revenue.points).toBe(0);
  });

  it('matches target industries (case-insensitive)', () => {
    const targetIndustries = [
      'Software',
      'SaaS',
      'TECHNOLOGY',
      'IT Services',
      'fintech',
    ];

    for (const industry of targetIndustries) {
      const account = createAccount({ industry });
      const result = scoreCompanyFit(account);
      expect(result.details.industry.points).toBe(10);
    }
  });

  it('does not match non-target industries', () => {
    const nonTargetIndustries = ['Retail', 'Manufacturing', 'Agriculture', 'Mining'];

    for (const industry of nonTargetIndustries) {
      const account = createAccount({ industry });
      const result = scoreCompanyFit(account);
      expect(result.details.industry.points).toBe(0);
    }
  });

  it('scores company size within ICP range', () => {
    // ICP range: 10-1000 employees
    const validSizes = [10, 50, 100, 500, 1000];

    for (const employeeCount of validSizes) {
      const account = createAccount({ employeeCount });
      const result = scoreCompanyFit(account);
      expect(result.details.companySize.points).toBe(10);
    }
  });

  it('does not score company size outside ICP range', () => {
    const invalidSizes = [5, 9, 1001, 5000];

    for (const employeeCount of invalidSizes) {
      const account = createAccount({ employeeCount });
      const result = scoreCompanyFit(account);
      expect(result.details.companySize.points).toBe(0);
    }
  });

  it('scores revenue within ICP range', () => {
    // ICP range: R5M - R100M
    const validRevenues = ['5000000', '10000000', '50000000', '100000000'];

    for (const annualRevenue of validRevenues) {
      const account = createAccount({ annualRevenue });
      const result = scoreCompanyFit(account);
      expect(result.details.revenue.points).toBe(10);
    }
  });

  it('does not score revenue outside ICP range', () => {
    const invalidRevenues = ['1000000', '4999999', '100000001', '500000000'];

    for (const annualRevenue of invalidRevenues) {
      const account = createAccount({ annualRevenue });
      const result = scoreCompanyFit(account);
      expect(result.details.revenue.points).toBe(0);
    }
  });

  it('handles partial matches (industry only)', () => {
    const account = createAccount({ industry: 'Software' });

    const result = scoreCompanyFit(account);

    expect(result.score).toBe(10);
    expect(result.details.industry.points).toBe(10);
    expect(result.details.companySize.points).toBe(0);
    expect(result.details.revenue.points).toBe(0);
  });

  it('handles partial matches (size and revenue, wrong industry)', () => {
    const account = createAccount({
      industry: 'Retail',
      employeeCount: 100,
      annualRevenue: '20000000',
    });

    const result = scoreCompanyFit(account);

    expect(result.score).toBe(20);
    expect(result.details.industry.points).toBe(0);
    expect(result.details.companySize.points).toBe(10);
    expect(result.details.revenue.points).toBe(10);
  });

  it('provides detailed reasons in output', () => {
    const account = createAccount({
      industry: 'Software',
      employeeCount: 100,
      annualRevenue: '20000000',
    });

    const result = scoreCompanyFit(account);

    expect(result.details.industry.reason).toContain('ICP');
    expect(result.details.companySize.reason).toContain('100 employees');
    expect(result.details.revenue.reason).toContain('R20');
  });

  it('handles edge case: company size exactly at boundaries', () => {
    const lowerBound = createAccount({ employeeCount: 10 });
    const upperBound = createAccount({ employeeCount: 1000 });

    expect(scoreCompanyFit(lowerBound).details.companySize.points).toBe(10);
    expect(scoreCompanyFit(upperBound).details.companySize.points).toBe(10);
  });

  it('handles edge case: revenue exactly at boundaries', () => {
    const lowerBound = createAccount({ annualRevenue: '5000000' });
    const upperBound = createAccount({ annualRevenue: '100000000' });

    expect(scoreCompanyFit(lowerBound).details.revenue.points).toBe(10);
    expect(scoreCompanyFit(upperBound).details.revenue.points).toBe(10);
  });

  it('handles missing data gracefully', () => {
    const account = createAccount({
      industry: null,
      employeeCount: null,
      annualRevenue: null,
    });

    const result = scoreCompanyFit(account);

    expect(result.score).toBe(0);
    expect(result.details.industry.reason).toContain('No industry');
    expect(result.details.companySize.reason).toContain('No employee count');
    expect(result.details.revenue.reason).toContain('No revenue');
  });
});
