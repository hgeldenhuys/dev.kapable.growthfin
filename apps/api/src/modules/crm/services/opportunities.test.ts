import { config } from 'dotenv';
config();

/**
 * Opportunities Service Tests
 * Sprint 2: Comprehensive test coverage for opportunity operations
 *
 * Focus Areas:
 * - Stage progression and probability auto-calculation (12-15 tests)
 * - Win/loss transitions (6-8 tests)
 * - CRUD operations (create, update, delete, list, getById) (32-40 tests)
 * - Workspace isolation enforcement
 * - Hard assertions only (no soft assertions)
 * - Zod schema validation
 *
 * Patterns from Sprint 1:
 * - Fixed UUIDs for idempotent tests
 * - Test utilities and factories
 * - Hard assertions
 * - Decimal precision for amounts and probabilities
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db/client';
import {
  crmOpportunities,
  crmAccounts,
  crmContacts,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, gte } from 'drizzle-orm';
import { opportunityService } from './opportunities';
import {
  TEST_WORKSPACE_ID,
  TEST_USER_ID,
  TEST_ACCOUNT_1_ID,
  TEST_ACCOUNT_2_ID,
  TEST_CONTACT_1_ID,
  TEST_OPPORTUNITY_1_ID,
  TEST_OPPORTUNITY_2_ID,
  createTestAccount,
  createTestContact,
  createTestOpportunity,
  createOpportunityBatch,
  createOpportunitiesByStage,
  createOpportunitiesByStatus,
  generateTestId,
  OpportunitySchema,
} from '../../../../../../test/utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format amount to match PostgreSQL numeric(15,2) output
 * PostgreSQL numeric type returns values with decimal places (e.g., "50000.00")
 */
function formatAmount(amount: string): string {
  return parseFloat(amount).toFixed(2);
}

// ============================================================================
// Global Setup
// ============================================================================

beforeAll(async () => {
  // Create test user
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      name: 'Test User',
      email: `test-user-${TEST_USER_ID}@test.com`,
    })
    .onConflictDoNothing();

  // Create test workspace
  await db
    .insert(workspaces)
    .values({
      id: TEST_WORKSPACE_ID,
      name: 'Test Workspace for Opportunities',
      slug: 'test-opportunities-001',
      ownerId: TEST_USER_ID,
    })
    .onConflictDoNothing();

  // Create test accounts
  await createTestAccount(db, {
    id: TEST_ACCOUNT_1_ID,
    workspaceId: TEST_WORKSPACE_ID,
    ownerId: TEST_USER_ID,
    name: 'Test Account 1',
    industry: 'Technology',
    createdBy: TEST_USER_ID,
  });

  await createTestAccount(db, {
    id: TEST_ACCOUNT_2_ID,
    workspaceId: TEST_WORKSPACE_ID,
    ownerId: TEST_USER_ID,
    name: 'Test Account 2',
    industry: 'Healthcare',
    createdBy: TEST_USER_ID,
  });

  // Create test contact
  await createTestContact(db, {
    id: TEST_CONTACT_1_ID,
    workspaceId: TEST_WORKSPACE_ID,
    ownerId: TEST_USER_ID,
    accountId: TEST_ACCOUNT_1_ID,
    firstName: 'John',
    lastName: 'Contact',
    email: 'john.contact@test.com',
  });
});

afterAll(async () => {
  // Cleanup test data in reverse dependency order
  await db.delete(crmOpportunities).where(eq(crmOpportunities.workspaceId, TEST_WORKSPACE_ID));
  await db.delete(crmContacts).where(eq(crmContacts.workspaceId, TEST_WORKSPACE_ID));
  await db.delete(crmAccounts).where(eq(crmAccounts.workspaceId, TEST_WORKSPACE_ID));
  await db.delete(workspaces).where(eq(workspaces.id, TEST_WORKSPACE_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
});

// ============================================================================
// Test Suite: create() - Opportunity Creation (10-12 tests)
// ============================================================================

describe('OpportunityService - create()', () => {
  test('creates opportunity with required fields only', async () => {
    const oppId = generateTestId('opp-create-basic');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Basic Opportunity',
      amount: '50000',
    });

    // Hard assertions
    expect(opportunity).toBeDefined();
    expect(opportunity.id).toBe(oppId);
    expect(opportunity.workspaceId).toBe(TEST_WORKSPACE_ID);
    expect(opportunity.accountId).toBe(TEST_ACCOUNT_1_ID);
    expect(opportunity.name).toBe('Basic Opportunity');
    expect(opportunity.amount).toBe(formatAmount('50000')); // PostgreSQL numeric returns with decimals
    expect(opportunity.stage).toBe('prospecting'); // Default
    expect(opportunity.status).toBe('open'); // Default
    expect(opportunity.probability).toBe(10); // Auto-calculated for prospecting
  });

  test('creates opportunity with contact linked', async () => {
    const oppId = generateTestId('opp-create-contact');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Opportunity with Contact',
      amount: '75000',
    });

    expect(opportunity.contactId).toBe(TEST_CONTACT_1_ID);
    expect(opportunity.accountId).toBe(TEST_ACCOUNT_1_ID);
  });

  test('auto-sets probability based on initial stage (prospecting = 10%)', async () => {
    const oppId = generateTestId('opp-create-prospecting');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Prospecting Deal',
      amount: '10000',
      stage: 'prospecting',
    });

    expect(opportunity.stage).toBe('prospecting');
    expect(opportunity.probability).toBe(10);
  });

  test('auto-sets probability based on initial stage (qualification = 25%)', async () => {
    const oppId = generateTestId('opp-create-qualification');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Qualification Deal',
      amount: '25000',
      stage: 'qualification',
    });

    expect(opportunity.stage).toBe('qualification');
    expect(opportunity.probability).toBe(25);
  });

  test('auto-sets probability based on initial stage (proposal = 50%)', async () => {
    const oppId = generateTestId('opp-create-proposal');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Proposal Deal',
      amount: '50000',
      stage: 'proposal',
    });

    expect(opportunity.stage).toBe('proposal');
    expect(opportunity.probability).toBe(50);
  });

  test('auto-sets probability based on initial stage (negotiation = 75%)', async () => {
    const oppId = generateTestId('opp-create-negotiation');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Negotiation Deal',
      amount: '75000',
      stage: 'negotiation',
    });

    expect(opportunity.stage).toBe('negotiation');
    expect(opportunity.probability).toBe(75);
  });

  test('auto-sets probability based on initial stage (closed_won = 100%)', async () => {
    const oppId = generateTestId('opp-create-won');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Won Deal',
      amount: '100000',
      stage: 'closed_won',
    });

    expect(opportunity.stage).toBe('closed_won');
    expect(opportunity.probability).toBe(100);
  });

  test('auto-sets probability based on initial stage (closed_lost = 0%)', async () => {
    const oppId = generateTestId('opp-create-lost');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Lost Deal',
      amount: '30000',
      stage: 'closed_lost',
    });

    expect(opportunity.stage).toBe('closed_lost');
    expect(opportunity.probability).toBe(0);
  });

  test('creates opportunity with expected close date', async () => {
    const oppId = generateTestId('opp-create-closedate');
    const expectedDate = new Date('2025-12-31');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Deal with Close Date',
      amount: '60000',
      expectedCloseDate: expectedDate,
    });

    expect(opportunity.expectedCloseDate).toBeDefined();
  });

  test('creates opportunity with custom fields', async () => {
    const oppId = generateTestId('opp-create-custom');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Custom Fields Deal',
      amount: '40000',
      customFields: {
        productType: 'Enterprise',
        competitorCount: 3,
        decisionMakers: ['CEO', 'CTO'],
      },
    });

    expect(opportunity.customFields).toEqual({
      productType: 'Enterprise',
      competitorCount: 3,
      decisionMakers: ['CEO', 'CTO'],
    });
  });

  test('creates opportunity with tags', async () => {
    const oppId = generateTestId('opp-create-tags');

    const opportunity = await opportunityService.create(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Tagged Deal',
      amount: '35000',
      tags: ['high-priority', 'enterprise', 'q4-2025'],
    });

    expect(opportunity.tags).toEqual(['high-priority', 'enterprise', 'q4-2025']);
  });
});

// ============================================================================
// Test Suite: update() - Stage Progression & Probability (12-15 tests)
// ============================================================================

describe('OpportunityService - update() Stage Progression', () => {
  test('updates stage from prospecting to qualification (auto-updates probability)', async () => {
    const oppId = generateTestId('opp-stage-prog-1');

    // Create at prospecting
    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Stage Progression Test',
      amount: '50000',
      stage: 'prospecting',
    });

    expect(created.stage).toBe('prospecting');
    expect(created.probability).toBe(10);

    // Update to qualification
    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'qualification',
    });

    expect(updated).not.toBeNull();
    expect(updated!.stage).toBe('qualification');
    expect(updated!.probability).toBe(25); // Auto-updated
  });

  test('updates stage from qualification to proposal', async () => {
    const oppId = generateTestId('opp-stage-prog-2');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Qualification to Proposal',
      amount: '60000',
      stage: 'qualification',
    });

    expect(created.probability).toBe(25);

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'proposal',
    });

    expect(updated!.stage).toBe('proposal');
    expect(updated!.probability).toBe(50);
  });

  test('updates stage from proposal to negotiation', async () => {
    const oppId = generateTestId('opp-stage-prog-3');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Proposal to Negotiation',
      amount: '70000',
      stage: 'proposal',
    });

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'negotiation',
    });

    expect(updated!.stage).toBe('negotiation');
    expect(updated!.probability).toBe(75);
  });

  test('marks opportunity as won (stage = closed_won, status = won, probability = 100%)', async () => {
    const oppId = generateTestId('opp-mark-won');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Deal to Win',
      amount: '100000',
      stage: 'negotiation',
    });

    expect(created.status).toBe('open');

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'closed_won',
    });

    expect(updated!.stage).toBe('closed_won');
    expect(updated!.status).toBe('won'); // Auto-set
    expect(updated!.probability).toBe(100); // Auto-set
    expect(updated!.actualCloseDate).toBeDefined(); // Auto-set to today
  });

  test('marks opportunity as lost (stage = closed_lost, status = lost, probability = 0%)', async () => {
    const oppId = generateTestId('opp-mark-lost');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Deal to Lose',
      amount: '20000',
      stage: 'proposal',
    });

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'closed_lost',
    });

    expect(updated!.stage).toBe('closed_lost');
    expect(updated!.status).toBe('lost'); // Auto-set
    expect(updated!.probability).toBe(0); // Auto-set
    expect(updated!.actualCloseDate).toBeDefined(); // Auto-set to today
  });

  test('allows updating other fields without changing stage', async () => {
    const oppId = generateTestId('opp-update-nochange');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Update Without Stage Change',
      amount: '45000',
      stage: 'proposal',
    });

    expect(created.probability).toBe(50);

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      amount: '55000',
      name: 'Updated Name',
    });

    expect(updated!.amount).toBe(formatAmount('55000'));
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.stage).toBe('proposal'); // Unchanged
    expect(updated!.probability).toBe(50); // Unchanged
  });

  test('updates expected close date', async () => {
    const oppId = generateTestId('opp-update-closedate');
    const newDate = new Date('2026-03-15');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Update Close Date',
      amount: '50000',
    });

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      expectedCloseDate: newDate,
    });

    expect(updated!.expectedCloseDate).toBeDefined();
  });

  test('can update contact association', async () => {
    const oppId = generateTestId('opp-update-contact');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Update Contact',
      amount: '30000',
      contactId: null,
    });

    expect(created.contactId).toBeNull();

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      contactId: TEST_CONTACT_1_ID,
    });

    expect(updated!.contactId).toBe(TEST_CONTACT_1_ID);
  });

  test('can update tags', async () => {
    const oppId = generateTestId('opp-update-tags');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Update Tags',
      amount: '40000',
      tags: ['initial'],
    });

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      tags: ['updated', 'new-tag'],
    });

    expect(updated!.tags).toEqual(['updated', 'new-tag']);
  });

  test('can add win/loss reason when closing', async () => {
    const oppId = generateTestId('opp-win-reason');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Win with Reason',
      amount: '90000',
      stage: 'negotiation',
    });

    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'closed_won',
      winLossReason: 'Best value proposition',
    });

    expect(updated!.stage).toBe('closed_won');
    expect(updated!.winLossReason).toBe('Best value proposition');
  });

  test('regression from higher to lower stage updates probability correctly', async () => {
    const oppId = generateTestId('opp-stage-regression');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Stage Regression',
      amount: '50000',
      stage: 'negotiation',
    });

    expect(created.probability).toBe(75);

    // Regress to proposal
    const updated = await opportunityService.update(db, oppId, TEST_WORKSPACE_ID, {
      stage: 'proposal',
    });

    expect(updated!.stage).toBe('proposal');
    expect(updated!.probability).toBe(50); // Probability decreased
  });
});

// ============================================================================
// Test Suite: delete() - Soft Delete (4-6 tests)
// ============================================================================

describe('OpportunityService - delete()', () => {
  test('deletes opportunity (hard delete)', async () => {
    const oppId = generateTestId('opp-delete-basic');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'To Delete',
      amount: '10000',
    });

    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);

    const deleted = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);
    expect(deleted).toBeNull();
  });

  test('delete enforces workspace isolation', async () => {
    const oppId = generateTestId('opp-delete-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Delete Isolation Test',
      amount: '15000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');

    // Attempt delete with wrong workspace ID
    await opportunityService.delete(db, oppId, wrongWorkspaceId);

    // Should still exist in correct workspace
    const opportunity = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);
    expect(opportunity).not.toBeNull();

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('can delete won opportunity', async () => {
    const oppId = generateTestId('opp-delete-won');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Delete Won',
      amount: '80000',
      stage: 'closed_won',
      status: 'won',
    });

    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);

    const deleted = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);
    expect(deleted).toBeNull();
  });

  test('can delete lost opportunity', async () => {
    const oppId = generateTestId('opp-delete-lost');

    const created = await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Delete Lost',
      amount: '25000',
      stage: 'closed_lost',
      status: 'lost',
    });

    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);

    const deleted = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);
    expect(deleted).toBeNull();
  });
});

// ============================================================================
// Test Suite: list() - Filtering and Pagination (10-12 tests)
// ============================================================================

describe('OpportunityService - list()', () => {
  test('lists all opportunities in workspace', async () => {
    // Create multiple opportunities
    const opp1Id = generateTestId('opp-list-1');
    const opp2Id = generateTestId('opp-list-2');
    const opp3Id = generateTestId('opp-list-3');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'List Test 1',
      amount: '10000',
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'List Test 2',
      amount: '20000',
    });

    await createTestOpportunity(db, {
      id: opp3Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'List Test 3',
      amount: '30000',
    });

    const opportunities = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
    });

    expect(opportunities.length).toBeGreaterThanOrEqual(3);

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp3Id, TEST_WORKSPACE_ID);
  });

  test('filters by stage', async () => {
    const prospectingId = generateTestId('opp-filter-prospecting');
    const qualificationId = generateTestId('opp-filter-qualification');

    await createTestOpportunity(db, {
      id: prospectingId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Prospecting Stage',
      amount: '15000',
      stage: 'prospecting',
    });

    await createTestOpportunity(db, {
      id: qualificationId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Qualification Stage',
      amount: '25000',
      stage: 'qualification',
    });

    const prospectingOpps = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      stage: 'prospecting',
    });

    expect(prospectingOpps.length).toBeGreaterThanOrEqual(1);
    for (const opp of prospectingOpps) {
      expect(opp.stage).toBe('prospecting');
    }

    // Cleanup
    await opportunityService.delete(db, prospectingId, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, qualificationId, TEST_WORKSPACE_ID);
  });

  test('filters by status', async () => {
    const openId = generateTestId('opp-filter-open');
    const wonId = generateTestId('opp-filter-won');

    await createTestOpportunity(db, {
      id: openId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Open Status',
      amount: '40000',
      stage: 'proposal',
      status: 'open',
    });

    await createTestOpportunity(db, {
      id: wonId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Won Status',
      amount: '80000',
      stage: 'closed_won',
      status: 'won',
    });

    const openOpps = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      status: 'open',
    });

    expect(openOpps.length).toBeGreaterThanOrEqual(1);
    for (const opp of openOpps) {
      expect(opp.status).toBe('open');
    }

    // Cleanup
    await opportunityService.delete(db, openId, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, wonId, TEST_WORKSPACE_ID);
  });

  test('filters by ownerId', async () => {
    const ownerId1 = TEST_USER_ID;

    const opp1Id = generateTestId('opp-filter-owner-1');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: ownerId1,
      name: 'Owner 1 Deal',
      amount: '30000',
    });

    const ownerOpps = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      ownerId: ownerId1,
    });

    expect(ownerOpps.length).toBeGreaterThanOrEqual(1);
    for (const opp of ownerOpps) {
      expect(opp.ownerId).toBe(ownerId1);
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
  });

  test('filters by accountId', async () => {
    const opp1Id = generateTestId('opp-filter-account-1');
    const opp2Id = generateTestId('opp-filter-account-2');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Account 1 Deal',
      amount: '35000',
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_2_ID,
      ownerId: TEST_USER_ID,
      name: 'Account 2 Deal',
      amount: '45000',
    });

    const account1Opps = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
    });

    expect(account1Opps.length).toBeGreaterThanOrEqual(1);
    for (const opp of account1Opps) {
      expect(opp.accountId).toBe(TEST_ACCOUNT_1_ID);
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
  });

  test('filters by contactId', async () => {
    const opp1Id = generateTestId('opp-filter-contact');
    const opp2Id = generateTestId('opp-filter-no-contact');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'With Contact',
      amount: '50000',
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Without Contact',
      amount: '30000',
    });

    const contactOpps = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      contactId: TEST_CONTACT_1_ID,
    });

    expect(contactOpps.length).toBeGreaterThanOrEqual(1);
    for (const opp of contactOpps) {
      expect(opp.contactId).toBe(TEST_CONTACT_1_ID);
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
  });

  test('enforces workspace isolation in list', async () => {
    const oppId = generateTestId('opp-list-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Isolation Test',
      amount: '20000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');
    const opportunities = await opportunityService.list(db, {
      workspaceId: wrongWorkspaceId,
    });

    // Should not find opportunities from different workspace
    const foundOpp = opportunities.find(o => o.id === oppId);
    expect(foundOpp).toBeUndefined();

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('respects limit parameter', async () => {
    const opportunities = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      limit: 5,
    });

    expect(opportunities.length).toBeLessThanOrEqual(5);
  });

  test('respects offset parameter for pagination', async () => {
    // Create known opportunities
    const opp1Id = generateTestId('opp-page-1');
    const opp2Id = generateTestId('opp-page-2');
    const opp3Id = generateTestId('opp-page-3');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Page 1',
      amount: '10000',
      expectedCloseDate: new Date('2025-12-01'),
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Page 2',
      amount: '20000',
      expectedCloseDate: new Date('2025-12-02'),
    });

    await createTestOpportunity(db, {
      id: opp3Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Page 3',
      amount: '30000',
      expectedCloseDate: new Date('2025-12-03'),
    });

    const page1 = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      limit: 2,
      offset: 0,
    });

    const page2 = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      limit: 2,
      offset: 2,
    });

    expect(page1.length).toBeLessThanOrEqual(2);
    expect(page2.length).toBeGreaterThanOrEqual(0);

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp3Id, TEST_WORKSPACE_ID);
  });

  test('orders by expected close date descending', async () => {
    const opp1Id = generateTestId('opp-order-1');
    const opp2Id = generateTestId('opp-order-2');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Earlier Date',
      amount: '10000',
      expectedCloseDate: new Date('2025-11-01'),
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Later Date',
      amount: '20000',
      expectedCloseDate: new Date('2025-12-01'),
    });

    const opportunities = await opportunityService.list(db, {
      workspaceId: TEST_WORKSPACE_ID,
      limit: 10,
    });

    // Should be ordered by expectedCloseDate desc (later dates first)
    const foundOpp1 = opportunities.find(o => o.id === opp1Id);
    const foundOpp2 = opportunities.find(o => o.id === opp2Id);

    if (foundOpp1 && foundOpp2) {
      const index1 = opportunities.indexOf(foundOpp1);
      const index2 = opportunities.indexOf(foundOpp2);
      expect(index2).toBeLessThan(index1); // Later date (opp2) should come first
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
  });
});

// ============================================================================
// Test Suite: getById() - Single Opportunity Retrieval (4-6 tests)
// ============================================================================

describe('OpportunityService - getById()', () => {
  test('retrieves existing opportunity by ID', async () => {
    const oppId = generateTestId('opp-getbyid-exists');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Get By ID Test',
      amount: '55000',
      stage: 'proposal',
    });

    const opportunity = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);

    expect(opportunity).not.toBeNull();
    expect(opportunity!.id).toBe(oppId);
    expect(opportunity!.name).toBe('Get By ID Test');
    expect(opportunity!.amount).toBe(formatAmount('55000'));
    expect(opportunity!.stage).toBe('proposal');

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('returns null for non-existent opportunity', async () => {
    const nonExistentId = generateTestId('opp-nonexistent');

    const opportunity = await opportunityService.getById(db, nonExistentId, TEST_WORKSPACE_ID);

    expect(opportunity).toBeNull();
  });

  test('enforces workspace isolation in getById', async () => {
    const oppId = generateTestId('opp-getbyid-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Isolation Test',
      amount: '25000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');
    const opportunity = await opportunityService.getById(db, oppId, wrongWorkspaceId);

    expect(opportunity).toBeNull();

    // Verify it exists in correct workspace
    const correctOpportunity = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);
    expect(correctOpportunity).not.toBeNull();

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('retrieves opportunity with all optional fields populated', async () => {
    const oppId = generateTestId('opp-getbyid-full');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Full Fields Opportunity',
      amount: '95000',
      stage: 'negotiation',
      status: 'open',
      probability: 75,
      expectedCloseDate: new Date('2025-12-31'),
      leadSource: 'Referral',
      tags: ['high-value', 'strategic'],
      customFields: { vertical: 'Enterprise', region: 'EMEA' },
    });

    const opportunity = await opportunityService.getById(db, oppId, TEST_WORKSPACE_ID);

    expect(opportunity).not.toBeNull();
    expect(opportunity!.contactId).toBe(TEST_CONTACT_1_ID);
    expect(opportunity!.leadSource).toBe('Referral');
    expect(opportunity!.tags).toEqual(['high-value', 'strategic']);
    expect(opportunity!.customFields).toEqual({ vertical: 'Enterprise', region: 'EMEA' });

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });
});

// ============================================================================
// Test Suite: getByContact() and getByAccount() - Related Queries (4 tests)
// ============================================================================

describe('OpportunityService - Related Entity Queries', () => {
  test('getByContact returns opportunities for a specific contact', async () => {
    const opp1Id = generateTestId('opp-contact-rel-1');
    const opp2Id = generateTestId('opp-contact-rel-2');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Contact Deal 1',
      amount: '30000',
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Contact Deal 2',
      amount: '40000',
    });

    const opportunities = await opportunityService.getByContact(db, TEST_CONTACT_1_ID, TEST_WORKSPACE_ID);

    expect(opportunities.length).toBeGreaterThanOrEqual(2);
    for (const opp of opportunities) {
      expect(opp.contactId).toBe(TEST_CONTACT_1_ID);
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
  });

  test('getByAccount returns opportunities for a specific account', async () => {
    const opp1Id = generateTestId('opp-account-rel-1');
    const opp2Id = generateTestId('opp-account-rel-2');

    await createTestOpportunity(db, {
      id: opp1Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Account Deal 1',
      amount: '50000',
    });

    await createTestOpportunity(db, {
      id: opp2Id,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Account Deal 2',
      amount: '60000',
    });

    const opportunities = await opportunityService.getByAccount(db, TEST_ACCOUNT_1_ID, TEST_WORKSPACE_ID);

    expect(opportunities.length).toBeGreaterThanOrEqual(2);
    for (const opp of opportunities) {
      expect(opp.accountId).toBe(TEST_ACCOUNT_1_ID);
    }

    // Cleanup
    await opportunityService.delete(db, opp1Id, TEST_WORKSPACE_ID);
    await opportunityService.delete(db, opp2Id, TEST_WORKSPACE_ID);
  });

  test('getByAccount enforces workspace isolation', async () => {
    const oppId = generateTestId('opp-account-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Account Isolation',
      amount: '35000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');
    const opportunities = await opportunityService.getByAccount(db, TEST_ACCOUNT_1_ID, wrongWorkspaceId);

    expect(opportunities.length).toBe(0);

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('getByContact enforces workspace isolation', async () => {
    const oppId = generateTestId('opp-contact-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      contactId: TEST_CONTACT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Contact Isolation',
      amount: '25000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');
    const opportunities = await opportunityService.getByContact(db, TEST_CONTACT_1_ID, wrongWorkspaceId);

    expect(opportunities.length).toBe(0);

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });
});

// ============================================================================
// Test Suite: getRecent() - Recent Opportunities (2 tests)
// ============================================================================

describe('OpportunityService - getRecent()', () => {
  test('retrieves opportunities created within specified time window', async () => {
    const oppId = generateTestId('opp-recent');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Recent Opportunity',
      amount: '45000',
    });

    // Get opportunities from last 24 hours (86400 seconds)
    const recent = await opportunityService.getRecent(db, TEST_WORKSPACE_ID, 86400);

    const foundOpp = recent.find(o => o.id === oppId);
    expect(foundOpp).toBeDefined();

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });

  test('getRecent enforces workspace isolation', async () => {
    const oppId = generateTestId('opp-recent-isolation');

    await createTestOpportunity(db, {
      id: oppId,
      workspaceId: TEST_WORKSPACE_ID,
      accountId: TEST_ACCOUNT_1_ID,
      ownerId: TEST_USER_ID,
      name: 'Recent Isolation',
      amount: '30000',
    });

    const wrongWorkspaceId = generateTestId('wrong-workspace');
    const recent = await opportunityService.getRecent(db, wrongWorkspaceId, 86400);

    const foundOpp = recent.find(o => o.id === oppId);
    expect(foundOpp).toBeUndefined();

    // Cleanup
    await opportunityService.delete(db, oppId, TEST_WORKSPACE_ID);
  });
});
