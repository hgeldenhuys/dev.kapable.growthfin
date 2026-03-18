/**
 * Integration Test: Email Verifications Routes
 * Tests CRM-005 - Email Verification Audit Trail
 *
 * Story: CRM-005
 * Task: T-009
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import {
  crmLeads,
  crmContacts,
  crmToolCalls,
  crmEnrichmentResults,
  crmEnrichmentJobs,
  crmContactLists,
} from '@agios/db';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables
config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230'; // Use existing workspace

describe('CRM-005: Email Verification Audit Trail', () => {
  let testLeadId: string;
  let testContactId: string;
  let testJobId: string;
  let testEnrichmentResultId: string;
  let testToolCallIds: string[] = [];
  let testListId: string;

  beforeAll(async () => {
    console.log('\n Setting up test data...');

    // 1. Create a test list (required for enrichment jobs)
    const [list] = await db
      .insert(crmContactLists)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        name: `Test List for Email Verification ${Date.now()}`,
        type: 'manual',
      })
      .returning();
    testListId = list.id;
    console.log(`Created test list: ${testListId}`);

    // 2. Create test lead
    const [lead] = await db
      .insert(crmLeads)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'Email',
        lastName: 'VerificationTest',
        email: 'test.verification@example.com',
        status: 'new',
        source: 'manual',
        score: 50,
      })
      .returning();
    testLeadId = lead.id;
    console.log(`Created test lead: ${testLeadId}`);

    // 3. Create test contact
    const [contact] = await db
      .insert(crmContacts)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        firstName: 'Contact',
        lastName: 'VerificationTest',
        email: 'contact.verification@example.com',
        lifecycleStage: 'subscriber',
      })
      .returning();
    testContactId = contact.id;
    console.log(`Created test contact: ${testContactId}`);

    // 4. Create test enrichment job
    const [job] = await db
      .insert(crmEnrichmentJobs)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Test Enrichment Job for Email Verification',
        sourceListId: testListId,
        prompt: 'Test prompt',
        type: 'scoring',
        mode: 'sample',
        status: 'completed',
      })
      .returning();
    testJobId = job.id;
    console.log(`Created test job: ${testJobId}`);

    // 5. Create test enrichment result for lead
    const [result] = await db
      .insert(crmEnrichmentResults)
      .values({
        workspaceId: TEST_WORKSPACE_ID,
        jobId: testJobId,
        entityId: testLeadId,
        entityType: 'lead',
        status: 'success',
        enrichmentData: { test: true },
      })
      .returning();
    testEnrichmentResultId = result.id;
    console.log(`Created test enrichment result: ${testEnrichmentResultId}`);

    // 6. Create test tool calls (verify_email)
    const toolCallsData = [
      {
        workspaceId: TEST_WORKSPACE_ID,
        enrichmentResultId: testEnrichmentResultId,
        toolName: 'verify_email',
        arguments: { email: 'valid@example.com' },
        result: {
          email: 'valid@example.com',
          status: 'valid',
          subStatus: '',
          mxFound: true,
          mxRecord: 'mail.example.com',
          smtpProvider: 'google',
          domain: 'example.com',
          processedAt: new Date().toISOString(),
        },
        status: 'success',
        cost: '0.0010',
        durationMs: 150,
      },
      {
        workspaceId: TEST_WORKSPACE_ID,
        enrichmentResultId: testEnrichmentResultId,
        toolName: 'verify_email',
        arguments: { email: 'invalid@badomain.xyz' },
        result: {
          email: 'invalid@badomain.xyz',
          status: 'invalid',
          subStatus: 'mailbox_not_found',
          mxFound: true,
          mxRecord: 'mail.badomain.xyz',
          smtpProvider: '',
          domain: 'badomain.xyz',
          processedAt: new Date().toISOString(),
        },
        status: 'success',
        cost: '0.0010',
        durationMs: 200,
      },
      {
        workspaceId: TEST_WORKSPACE_ID,
        enrichmentResultId: testEnrichmentResultId,
        toolName: 'verify_email',
        arguments: { email: 'nomx@nodomain.test' },
        result: {
          email: 'nomx@nodomain.test',
          status: 'invalid',
          subStatus: 'no_dns_entries',
          mxFound: false,
          mxRecord: '',
          smtpProvider: '',
          domain: 'nodomain.test',
          processedAt: new Date().toISOString(),
        },
        status: 'success',
        cost: '0.0010',
        durationMs: 100,
      },
    ];

    const insertedToolCalls = await db
      .insert(crmToolCalls)
      .values(toolCallsData)
      .returning();

    testToolCallIds = insertedToolCalls.map((tc) => tc.id);
    console.log(`Created ${testToolCallIds.length} test tool calls`);
  });

  afterAll(async () => {
    console.log('\nCleaning up test data...');

    // Delete test data in reverse order of dependencies
    for (const id of testToolCallIds) {
      await db.delete(crmToolCalls).where(eq(crmToolCalls.id, id));
    }
    console.log('Deleted test tool calls');

    if (testEnrichmentResultId) {
      await db
        .delete(crmEnrichmentResults)
        .where(eq(crmEnrichmentResults.id, testEnrichmentResultId));
      console.log('Deleted test enrichment result');
    }

    if (testJobId) {
      await db.delete(crmEnrichmentJobs).where(eq(crmEnrichmentJobs.id, testJobId));
      console.log('Deleted test job');
    }

    if (testLeadId) {
      await db.delete(crmLeads).where(eq(crmLeads.id, testLeadId));
      console.log('Deleted test lead');
    }

    if (testContactId) {
      await db.delete(crmContacts).where(eq(crmContacts.id, testContactId));
      console.log('Deleted test contact');
    }

    if (testListId) {
      await db.delete(crmContactLists).where(eq(crmContactLists.id, testListId));
      console.log('Deleted test list');
    }
  });

  describe('GET /email-verifications', () => {
    it('AC-001: Should return email verification attempts for a lead', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      console.log('\nLead Email Verifications:', JSON.stringify(data, null, 2));

      expect(response.ok).toBe(true);
      expect(data.attempts).toBeDefined();
      expect(Array.isArray(data.attempts)).toBe(true);
      expect(data.attempts.length).toBe(3);

      // Verify response structure
      const attempt = data.attempts[0];
      expect(attempt.email).toBeDefined();
      expect(attempt.status).toBeDefined();
      expect(attempt.statusLabel).toBeDefined();
      expect(attempt.statusVariant).toBeDefined();
      expect(attempt.subStatus).toBeDefined();
      expect(attempt.subStatusLabel).toBeDefined();
      expect(attempt.mxFound).toBeDefined();
      expect(attempt.isValid).toBeDefined();
    });

    it('Should return summary statistics', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      expect(data.summary).toBeDefined();
      expect(data.summary.total).toBe(3);
      expect(data.summary.valid).toBe(1);
      expect(data.summary.invalid).toBe(2);
    });

    it('Should return pagination info', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
        page: '1',
        limit: '10',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('Should return empty array for entity with no verifications', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testContactId, // Contact has no verifications
        entityType: 'contact',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.attempts).toEqual([]);
      expect(data.summary.total).toBe(0);
    });

    it('Should respect workspace isolation', async () => {
      const params = new URLSearchParams({
        workspaceId: '00000000-0000-0000-0000-000000000000', // Non-existent workspace
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      // Should return empty, not error (workspace middleware handles access)
      expect(data.attempts).toEqual([]);
    });
  });

  describe('GET /email-verifications/failed', () => {
    it('Should return only failed/invalid verification attempts', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(
        `${API_URL}/api/v1/crm/email-verifications/failed?${params}`
      );
      const data = await response.json();

      console.log('\nFailed Email Verifications:', JSON.stringify(data, null, 2));

      expect(response.ok).toBe(true);
      expect(data.attempts.length).toBe(2); // 2 invalid emails
      expect(data.totalCount).toBe(2);

      // All returned should be invalid
      for (const attempt of data.attempts) {
        expect(attempt.isValid).toBe(false);
      }
    });
  });

  describe('GET /email-verifications/summary/:entityId', () => {
    it('Should return lightweight summary without attempt details', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityType: 'lead',
      });

      const response = await fetch(
        `${API_URL}/api/v1/crm/email-verifications/summary/${testLeadId}?${params}`
      );
      const data = await response.json();

      console.log('\nEmail Verification Summary:', JSON.stringify(data, null, 2));

      expect(response.ok).toBe(true);
      expect(data.entityId).toBe(testLeadId);
      expect(data.entityType).toBe('lead');
      expect(data.summary).toBeDefined();
      expect(data.summary.total).toBe(3);
      expect(data.summary.valid).toBeGreaterThanOrEqual(0);
      expect(data.summary.invalid).toBeGreaterThanOrEqual(0);

      // Should NOT include attempts array (lightweight endpoint)
      expect(data.attempts).toBeUndefined();
    });
  });

  describe('GET /email-verifications/by-job/:jobId', () => {
    it('Should return all verifications for a specific enrichment job', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/crm/email-verifications/by-job/${testJobId}?workspaceId=${TEST_WORKSPACE_ID}`
      );
      const data = await response.json();

      console.log('\nJob Email Verifications:', JSON.stringify(data, null, 2));

      expect(response.ok).toBe(true);
      expect(data.attempts.length).toBe(3);
      expect(data.totalCount).toBe(3);
      expect(data.summary.valid).toBe(1);
      expect(data.summary.invalid).toBe(2);
    });
  });

  describe('AC-004: Human-readable rejection reasons', () => {
    it('Should map technical subStatus codes to human-readable labels', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      // Find the mailbox_not_found attempt
      const mailboxNotFound = data.attempts.find(
        (a: any) => a.subStatus === 'mailbox_not_found'
      );
      expect(mailboxNotFound).toBeDefined();
      expect(mailboxNotFound.subStatusLabel).toBe('Mailbox does not exist');

      // Find the no_dns_entries attempt
      const noDns = data.attempts.find((a: any) => a.subStatus === 'no_dns_entries');
      expect(noDns).toBeDefined();
      expect(noDns.subStatusLabel).toBe('No DNS records found for domain');
    });
  });

  describe('AC-005: MX validation info display', () => {
    it('Should include MX validation details in response', async () => {
      const params = new URLSearchParams({
        workspaceId: TEST_WORKSPACE_ID,
        entityId: testLeadId,
        entityType: 'lead',
      });

      const response = await fetch(`${API_URL}/api/v1/crm/email-verifications?${params}`);
      const data = await response.json();

      // Check valid email has MX info
      const validEmail = data.attempts.find((a: any) => a.status === 'valid');
      expect(validEmail).toBeDefined();
      expect(validEmail.mxFound).toBe(true);
      expect(validEmail.mxRecord).toBe('mail.example.com');
      expect(validEmail.smtpProvider).toBe('google');
      expect(validEmail.mxInfo).toContain('MX records found');

      // Check no MX email
      const noMxEmail = data.attempts.find((a: any) => a.subStatus === 'no_dns_entries');
      expect(noMxEmail).toBeDefined();
      expect(noMxEmail.mxFound).toBe(false);
      expect(noMxEmail.mxInfo).toContain('No MX records found');
    });
  });
});
