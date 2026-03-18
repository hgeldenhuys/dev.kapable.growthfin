/**
 * Tests for custom field filtering in leads API
 */

import { describe, it, expect } from 'bun:test';

const WORKSPACE_ID = 'b5fc28d5-90e7-4205-9b25-1a1347dd7858';
const BASE_URL = 'http://localhost:3000';

describe('Leads Custom Field Filtering', () => {
  describe('Exact match filters', () => {
    it('should filter by ethnicity_classification', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=african`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads).toBeDefined();
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        ethnicity_classification: 'african',
      });

      // Verify all results match the filter
      for (const lead of data.leads) {
        expect(lead.customFields.ethnicity_classification.toLowerCase()).toBe('african');
      }
    });

    it('should filter by registered_address_province', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.registered_address_province=GAUTENG`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        registered_address_province: 'GAUTENG',
      });

      // Verify all results match the filter
      for (const lead of data.leads) {
        expect(lead.customFields.registered_address_province).toBe('GAUTENG');
      }
    });

    it('should be case insensitive', async () => {
      const response1 = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=african`
      );
      const data1 = await response1.json();

      const response2 = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=AFRICAN`
      );
      const data2 = await response2.json();

      // Should return same results
      expect(data1.leads.length).toBe(data2.leads.length);
    });
  });

  describe('Numeric range filters', () => {
    it('should filter by minimum value', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.classification_confidence.min=0.8`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        'classification_confidence.min': '0.8',
      });

      // Verify all results meet minimum
      for (const lead of data.leads) {
        expect(lead.customFields.classification_confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('should filter by maximum value', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.classification_confidence.max=0.85`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        'classification_confidence.max': '0.85',
      });

      // Verify all results meet maximum
      for (const lead of data.leads) {
        expect(lead.customFields.classification_confidence).toBeLessThanOrEqual(0.85);
      }
    });

    it('should filter by range (min and max)', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.classification_confidence.min=0.8&customField.classification_confidence.max=0.85`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appliedFilters).toEqual({
        'classification_confidence.min': '0.8',
        'classification_confidence.max': '0.85',
      });

      // Verify all results are in range
      for (const lead of data.leads) {
        const confidence = lead.customFields.classification_confidence;
        expect(confidence).toBeGreaterThanOrEqual(0.8);
        expect(confidence).toBeLessThanOrEqual(0.85);
      }
    });
  });

  describe('Contains filters', () => {
    it('should filter by partial string match', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.business_keyword.contains=MANUF`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        'business_keyword.contains': 'MANUF',
      });

      // Verify all results contain the substring
      for (const lead of data.leads) {
        expect(lead.customFields.business_keyword.toUpperCase()).toContain('MANUF');
      }
    });
  });

  describe('Combined filters', () => {
    it('should apply multiple filters together', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=african&customField.registered_address_province=GAUTENG&customField.classification_confidence.min=0.8`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toEqual({
        ethnicity_classification: 'african',
        registered_address_province: 'GAUTENG',
        'classification_confidence.min': '0.8',
      });

      // Verify all results match ALL filters
      for (const lead of data.leads) {
        expect(lead.customFields.ethnicity_classification.toLowerCase()).toBe('african');
        expect(lead.customFields.registered_address_province).toBe('GAUTENG');
        expect(lead.customFields.classification_confidence).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for non-existent field values', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=nonexistent_value`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads).toEqual([]);
      expect(data.appliedFilters).toEqual({
        ethnicity_classification: 'nonexistent_value',
      });
    });

    it('should return empty array for non-existent field names', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.nonexistent_field=value`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads).toEqual([]);
      expect(data.appliedFilters).toEqual({
        nonexistent_field: 'value',
      });
    });

    it('should work without filters (baseline)', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leads.length).toBeGreaterThan(0);
      expect(data.appliedFilters).toBeUndefined();
    });
  });

  describe('Security', () => {
    it('should prevent SQL injection via field values', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=${encodeURIComponent("african' OR '1'='1")}`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should not return all records (SQL injection attempt fails)
      expect(data.leads.length).toBe(0);
    });

    it('should prevent SQL injection via field names', async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.field${encodeURIComponent("'; DROP TABLE crm_leads; --")}=value`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should handle safely without executing injection
      expect(data.leads).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete complex queries in < 100ms', async () => {
      const start = Date.now();
      const response = await fetch(
        `${BASE_URL}/api/v1/crm/leads/recent?workspaceId=${WORKSPACE_ID}&seconds=86400000&customField.ethnicity_classification=african&customField.registered_address_province=GAUTENG&customField.classification_confidence.min=0.8`
      );
      await response.json();
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });
  });
});
