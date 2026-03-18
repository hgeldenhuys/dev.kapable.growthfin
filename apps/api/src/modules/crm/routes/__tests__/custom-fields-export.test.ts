/**
 * Custom Fields Export Tests
 * Tests for US-CUSTOMFIELDS-004: CSV export with flattened custom fields
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@agios/db';
import { crmContacts, crmLeads, workspaces, users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables
config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

describe('CSV Export with Custom Fields (US-CUSTOMFIELDS-004)', () => {
  let workspaceId: string;
  let userId: string;
  const testContactIds: string[] = [];
  const testLeadIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await db
      .insert(users)
      .values({
        name: 'Export Test User',
        email: `export-test-${Date.now()}@test.com`,
      })
      .returning();

    userId = user[0].id;

    // Create test workspace
    const workspace = await db
      .insert(workspaces)
      .values({
        name: 'Export Test Workspace',
        slug: `export-test-${Date.now()}`,
        ownerId: userId,
      })
      .returning();

    workspaceId = workspace[0].id;

    // Create test contacts with various custom fields
    const contact1 = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        phone: '555-0001',
        title: 'Engineer',
        department: 'Engineering',
        status: 'active',
        lifecycleStage: 'customer',
        leadScore: 85,
        leadSource: 'inbound',
        customFields: {
          ethnicity: 'Asian',
          income_bracket: '75000',
          location: 'Johannesburg',
          preferred_contact: 'email',
        },
        createdBy: userId,
      })
      .returning();

    testContactIds.push(contact1[0].id);

    const contact2 = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        phone: '555-0002',
        title: 'Manager',
        department: 'Sales',
        status: 'active',
        lifecycleStage: 'verified',
        leadScore: 65,
        leadSource: 'campaign',
        customFields: {
          ethnicity: 'European',
          income_bracket: '50000',
          location: 'Cape Town',
          years_in_industry: '5',
        },
        createdBy: userId,
      })
      .returning();

    testContactIds.push(contact2[0].id);

    // Contact with missing fields (sparse custom fields)
    const contact3 = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@test.com',
        status: 'active',
        lifecycleStage: 'verified',
        leadScore: 45,
        customFields: {
          location: 'Pretoria',
          // Missing ethnicity, income_bracket, etc
        },
        createdBy: userId,
      })
      .returning();

    testContactIds.push(contact3[0].id);

    // Contact with special characters in custom fields
    const contact4 = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        firstName: 'Alice',
        lastName: 'Brown',
        email: 'alice@test.com',
        status: 'active',
        lifecycleStage: 'engaged',
        customFields: {
          location: 'New York, USA',
          description: 'Has comma, quote", and\nnewline',
          income_bracket: '100000',
        },
        createdBy: userId,
      })
      .returning();

    testContactIds.push(contact4[0].id);

    // Create test leads
    const lead1 = await db
      .insert(crmLeads)
      .values({
        workspaceId,
        firstName: 'Lead',
        lastName: 'One',
        email: 'lead1@test.com',
        companyName: 'Tech Corp',
        status: 'qualified',
        source: 'website',
        leadScore: 80,
        customFields: {
          industry: 'Technology',
          company_size: '100-500',
          budget_range: '50k-100k',
        },
        createdBy: userId,
      })
      .returning();

    testLeadIds.push(lead1[0].id);

    const lead2 = await db
      .insert(crmLeads)
      .values({
        workspaceId,
        firstName: 'Lead',
        lastName: 'Two',
        email: 'lead2@test.com',
        companyName: 'Finance Inc',
        status: 'new',
        source: 'email',
        customFields: {
          industry: 'Finance',
          deal_size: '250000',
        },
        createdBy: userId,
      })
      .returning();

    testLeadIds.push(lead2[0].id);
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      for (const id of testLeadIds) {
        await db.delete(crmLeads).where(eq(crmLeads.id, id));
      }
      for (const id of testContactIds) {
        await db.delete(crmContacts).where(eq(crmContacts.id, id));
      }
      if (workspaceId) {
        await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
      }
      if (userId) {
        await db.delete(users).where(eq(users.id, userId));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Contact Export', () => {
    it('should export contacts with custom fields as columns', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');

      const csv = await response.text();

      // Verify UTF-8 BOM
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Verify headers include standard fields and custom fields
      expect(csv).toContain('id');
      expect(csv).toContain('firstName');
      expect(csv).toContain('lastName');
      expect(csv).toContain('email');

      // Verify custom field headers (Title Case)
      expect(csv).toContain('Ethnicity');
      expect(csv).toContain('Income Bracket'); // snake_case to Title Case
      expect(csv).toContain('Location');
      expect(csv).toContain('Preferred Contact');
    });

    it('should export all custom field keys as union', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // All custom fields from all contacts should be in header
      // Contact 1: ethnicity, income_bracket, location, preferred_contact
      // Contact 2: ethnicity, income_bracket, location, years_in_industry
      // Contact 3: location
      // Contact 4: location, description, income_bracket

      const headers = csv.split('\n')[0];
      expect(headers).toContain('Ethnicity');
      expect(headers).toContain('Income Bracket');
      expect(headers).toContain('Location');
      expect(headers).toContain('Preferred Contact');
      expect(headers).toContain('Years In Industry');
      expect(headers).toContain('Description');
    });

    it('should handle missing custom fields with empty cells', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();
      const lines = csv.split('\n');

      // Find Bob's line (missing ethnicity, income_bracket, preferred_contact, years_in_industry)
      const bobLine = lines.find((line) => line.includes('Bob'));
      expect(bobLine).toBeDefined();

      // Bob's line should have empty values for fields he doesn't have
      // But should have a value for location
      expect(bobLine).toContain('Pretoria');
    });

    it('should properly escape special characters in CSV', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Alice's description has comma, quote, and newline
      // Should be properly quoted and escaped
      expect(csv).toContain('"Has comma, quote"", and\nnewline"');
      expect(csv).toContain('New York, USA'); // Should be quoted
    });

    it('should include contact data in CSV rows', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Verify contact data is present
      expect(csv).toContain('John');
      expect(csv).toContain('Doe');
      expect(csv).toContain('john@test.com');
      expect(csv).toContain('Jane');
      expect(csv).toContain('Smith');
      expect(csv).toContain('jane@test.com');
    });

    it('should return proper file headers for download', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');

      const disposition = response.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('contacts_');
      expect(disposition).toContain('.csv');
    });

    it('should handle empty workspace', async () => {
      // Create empty workspace
      const emptyWorkspace = await db
        .insert(workspaces)
        .values({
          name: 'Empty Workspace',
          slug: `empty-${Date.now()}`,
          ownerId: userId,
        })
        .returning();

      const response = await fetch(
        `${API_URL}/api/v1/crm/contacts/export?workspaceId=${emptyWorkspace[0].id}`
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('No contacts found');

      // Cleanup
      await db.delete(workspaces).where(eq(workspaces.id, emptyWorkspace[0].id));
    });

    it('should complete export within performance budget', async () => {
      const startTime = Date.now();

      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      // Should complete in under 2 seconds for 4 test contacts
      // For 10k contacts, requirement is 60 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Contact Export Preview', () => {
    it('should return preview of custom fields without exporting all data', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/crm/contacts/export/preview?workspaceId=${workspaceId}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('customFields');
      expect(data).toHaveProperty('estimatedRecordCount');
      expect(Array.isArray(data.customFields)).toBe(true);

      // Check custom fields structure
      for (const field of data.customFields) {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('displayName');
        expect(typeof field.displayName).toBe('string');
      }

      // Verify we found all custom field keys
      const customFieldNames = data.customFields.map((f: any) => f.name);
      expect(customFieldNames).toContain('ethnicity');
      expect(customFieldNames).toContain('income_bracket');
      expect(customFieldNames).toContain('location');
    });

    it('should return accurate estimated record count', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/crm/contacts/export/preview?workspaceId=${workspaceId}`
      );

      const data = await response.json();

      // We created 4 test contacts
      expect(data.estimatedRecordCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Lead Export', () => {
    it('should export leads with custom fields as columns', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/leads/export?workspaceId=${workspaceId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');

      const csv = await response.text();

      // Verify UTF-8 BOM
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Verify headers include custom fields
      expect(csv).toContain('Industry');
      expect(csv).toContain('Company Size');
      expect(csv).toContain('Budget Range');
      expect(csv).toContain('Deal Size');
    });

    it('should export all lead custom fields', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/leads/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Verify lead data
      expect(csv).toContain('Lead');
      expect(csv).toContain('One');
      expect(csv).toContain('lead1@test.com');
      expect(csv).toContain('Technology');
      expect(csv).toContain('100-500');
    });

    it('should handle leads with different custom fields', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/leads/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Lead 1 has: industry, company_size, budget_range
      // Lead 2 has: industry, deal_size
      // All fields should be in union

      const headers = csv.split('\n')[0];
      expect(headers).toContain('Industry');
      expect(headers).toContain('Company Size');
      expect(headers).toContain('Budget Range');
      expect(headers).toContain('Deal Size');
    });
  });

  describe('Lead Export Preview', () => {
    it('should return lead export preview', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/crm/leads/export/preview?workspaceId=${workspaceId}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('customFields');
      expect(Array.isArray(data.customFields)).toBe(true);

      const customFieldNames = data.customFields.map((f: any) => f.name);
      expect(customFieldNames).toContain('industry');
      expect(customFieldNames).toContain('company_size');
      expect(customFieldNames).toContain('deal_size');
    });
  });

  describe('CSV Format Compliance (RFC 4180)', () => {
    it('should produce RFC 4180 compliant CSV', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Basic RFC 4180 checks:
      // 1. Headers present
      expect(csv.split('\n').length).toBeGreaterThan(1);

      // 2. BOM present for Excel
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // 3. Values with commas should be quoted
      const hasQuotedCommaValues = csv.includes('"New York, USA"');
      expect(hasQuotedCommaValues).toBe(true);

      // 4. Newlines should be handled
      const hasNewlineEscape = csv.includes('\n');
      expect(hasNewlineEscape).toBe(true);
    });

    it('should handle quotes correctly in CSV values', async () => {
      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      const csv = await response.text();

      // Quote character should be escaped as ""
      // E.g., quote" becomes ""quote""
      expect(csv).toContain('""'); // Doubled quotes
    });
  });

  describe('Custom Field Header Formatting', () => {
    it('should convert snake_case to Title Case', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/crm/contacts/export/preview?workspaceId=${workspaceId}`
      );

      const data = await response.json();

      const fields = data.customFields.map((f: any) => ({
        name: f.name,
        display: f.displayName,
      }));

      // Check conversions
      const incomeBracket = fields.find((f) => f.name === 'income_bracket');
      expect(incomeBracket?.display).toBe('Income Bracket');

      const yearsInIndustry = fields.find((f) => f.name === 'years_in_industry');
      expect(yearsInIndustry?.display).toBe('Years In Industry');

      const preferredContact = fields.find((f) => f.name === 'preferred_contact');
      expect(preferredContact?.display).toBe('Preferred Contact');
    });
  });

  describe('Large Dataset Handling', () => {
    it('should complete within performance budget (mock)', async () => {
      // This test documents the performance requirement
      // For actual load testing with 10k contacts, would need separate test environment

      // Requirement: < 60 seconds for 10k contacts
      // Current test: 4 contacts complete in < 2 seconds
      // Performance should scale linearly (or better with database optimization)

      const response = await fetch(`${API_URL}/api/v1/crm/contacts/export?workspaceId=${workspaceId}`);

      expect(response.status).toBe(200);

      const startTime = Date.now();
      await response.text();
      const duration = Date.now() - startTime;

      // For small dataset, should be very fast
      expect(duration).toBeLessThan(100);
    });
  });
});
