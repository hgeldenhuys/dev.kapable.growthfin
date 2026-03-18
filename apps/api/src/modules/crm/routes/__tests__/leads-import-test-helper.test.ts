/**
 * Example Test - Using Test-Friendly CSV Import Infrastructure
 *
 * This file demonstrates how to use the test fixtures and import service
 * for automated testing of Phase 2 functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@agios/db';
import * as schema from '@agios/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { leadsImportService } from '../../services/leads-import.service';

// Load environment variables
config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
// Use real UUIDs from database (these must exist for foreign key constraints)
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230'; // Real workspace ID
const TEST_USER_ID = 'bea5f24c-d154-466b-8920-a73596f1f7ab'; // Real user ID

// Path to test fixtures (from project root)
const PROJECT_ROOT = join(__dirname, '../../../../../../');
const FIXTURES_PATH = join(PROJECT_ROOT, 'test/fixtures');

// Cleanup helper
async function cleanup() {
  // Delete test leads
  await db
    .delete(schema.crmLeads)
    .where(eq(schema.crmLeads.workspaceId, TEST_WORKSPACE_ID));

  // Delete test list memberships
  await db
    .delete(schema.crmContactListMemberships)
    .where(eq(schema.crmContactListMemberships.workspaceId, TEST_WORKSPACE_ID));

  // Delete test lists
  await db
    .delete(schema.crmContactLists)
    .where(eq(schema.crmContactLists.workspaceId, TEST_WORKSPACE_ID));
}

describe('Test-Friendly CSV Import Infrastructure', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Method 1: Using Service Directly (Fastest)', () => {
    it('should import leads from CSV string using service', async () => {
      const csvContent = readFileSync(
        join(FIXTURES_PATH, 'test-leads-ethnicity.csv'),
        'utf-8'
      );

      const result = await leadsImportService.importLeadsFromCSVString(db, {
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'test-ethnicity.csv',
      });

      // Verify import results
      expect(result.leadsImported).toBeGreaterThan(0);
      expect(result.listId).toBeDefined();
      expect(result.listName).toContain('test-ethnicity.csv');

      // Verify custom fields detected
      expect(result.customFieldsDetected).toContain('ethnicity_classification');
      expect(result.customFieldsDetected).toContain('classification_confidence');

      // Verify schema inference
      expect(result.customFieldSchema.ethnicity_classification).toEqual({
        type: 'text',
        label: 'Ethnicity Classification',
      });
      expect(result.customFieldSchema.classification_confidence).toEqual({
        type: 'number',
        label: 'Classification Confidence',
      });

      // Verify in database
      const list = await db
        .select()
        .from(schema.crmContactLists)
        .where(
          and(
            eq(schema.crmContactLists.id, result.listId),
            eq(schema.crmContactLists.workspaceId, TEST_WORKSPACE_ID)
          )
        )
        .limit(1);

      expect(list[0]).toBeDefined();
      expect(list[0].entityType).toBe('lead');
      expect(list[0].type).toBe('import');

      // Verify list members
      const members = await db
        .select()
        .from(schema.crmContactListMemberships)
        .where(
          and(
            eq(schema.crmContactListMemberships.listId, result.listId),
            isNull(schema.crmContactListMemberships.deletedAt)
          )
        );

      expect(members.length).toBe(result.leadsImported);
    });

    it('should handle regions CSV with multiple types', async () => {
      const csvContent = readFileSync(
        join(FIXTURES_PATH, 'test-leads-regions.csv'),
        'utf-8'
      );

      const result = await leadsImportService.importLeadsFromCSVString(db, {
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'test-regions.csv',
      });

      // Verify custom fields with different types
      expect(result.customFieldSchema.region).toEqual({
        type: 'text',
        label: 'Region',
      });
      expect(result.customFieldSchema.revenue).toEqual({
        type: 'number',
        label: 'Revenue',
      });
      expect(result.customFieldSchema.active).toEqual({
        type: 'boolean',
        label: 'Active',
      });
    });
  });

  describe('Method 2: Using HTTP Endpoint (Integration Test)', () => {
    it('should import via test-only endpoint', async () => {
      const csvContent = `firstName,lastName,email,source,department,priority
Alice,Test,alice@example.com,web,Engineering,5
Bob,Test,bob@example.com,web,Sales,3`;

      const response = await fetch(`${API_URL}/api/v1/crm/leads/import-csv-string`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          filename: 'inline-test.csv',
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(2);
      expect(result.list).toBeDefined();
      expect(result.list.customFieldsDetected).toContain('department');
      expect(result.list.customFieldsDetected).toContain('priority');
    });
  });

  describe('Edge Cases', () => {
    it('should handle inline CSV without file', async () => {
      const csvContent = `firstName,lastName,email,source,custom_field
Test,User,test@example.com,import,value123`;

      const result = await leadsImportService.importLeadsFromCSVString(db, {
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        filename: 'inline.csv',
      });

      expect(result.leadsImported).toBe(1);
      expect(result.customFieldsDetected).toContain('custom_field');
    });

    it('should default source to "import" if not provided', async () => {
      const csvContent = `firstName,lastName,email,companyName
NoSource,Test,nosource@example.com,TestCo`;

      const result = await leadsImportService.importLeadsFromCSVString(db, {
        csvContent,
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
      });

      expect(result.leadsImported).toBe(1);

      // Verify lead has source = 'import'
      const leads = await db
        .select()
        .from(schema.crmLeads)
        .where(eq(schema.crmLeads.email, 'nosource@example.com'))
        .limit(1);

      expect(leads[0].source).toBe('import');
    });
  });
});
