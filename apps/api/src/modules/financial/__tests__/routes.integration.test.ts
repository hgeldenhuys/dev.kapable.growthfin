/**
 * Financial Analysis API Integration Tests
 * Tests the POST /api/v1/financial/analyze-balance-sheet endpoint
 *
 * NOTE: These tests require the API server to be running.
 * LLM tests are skipped unless LLM_TEST_ENABLED=true.
 * Run with: API_URL=http://localhost:3000 bun test routes.integration.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { config } from 'dotenv';
import path from 'path';

// Load .env configuration from project root
config({ path: path.resolve(__dirname, '../../../../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Financial Analysis API', () => {
  describe('POST /api/v1/financial/analyze-balance-sheet', () => {
    describe('Input Validation', () => {
      it('returns 400 for empty text', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '' }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        // Elysia schema validation returns error in this format
        expect(data).toHaveProperty('error');
      });

      it('returns 400 for whitespace-only text', async () => {
        // Note: Single space passes schema minLength but fails our validation
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: ' ' }),  // Single space passes schema, hits our validation
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
        // Our custom validation returns this format
        expect(data.code).toBe('EMPTY_TEXT');
      });

      it('returns 400 for missing text field', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        // Elysia returns 400 for schema validation errors
        expect(response.status).toBe(400);
      });

      it('returns 400 for text exceeding 50,000 characters', async () => {
        const longText = 'a'.repeat(50001);
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: longText }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
        // Elysia schema validation catches this with maxLength
      });

      it('accepts text at exactly 50,000 characters (boundary test)', async () => {
        // Note: This test may call the LLM if credentials are configured
        // In CI without credentials, this may return 500
        const exactText = 'a'.repeat(50000);
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: exactText }),
        });

        // Should not be a validation error (400)
        expect(response.status).not.toBe(400);
      });

      it('validates custom validation returns proper error for whitespace', async () => {
        // Test with multiple whitespace chars that pass schema but fail custom validation
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '   \t\n   ' }),  // Whitespace > 1 char
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.code).toBe('EMPTY_TEXT');
        expect(data.message).toContain('empty');
      });
    });

    describe('Content-Type Handling', () => {
      it('rejects non-JSON content type', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: 'plain text balance sheet',
        });

        // Elysia should reject non-JSON content
        expect([400, 415]).toContain(response.status);
      });

      it('accepts application/json content type', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'Balance Sheet Test' }),
        });

        // Should not fail on content type
        expect(response.status).not.toBe(415);
      });
    });

    describe('HTTP Method Handling', () => {
      it('rejects GET requests', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'GET',
        });

        expect(response.status).toBe(404); // Route not found for GET
      });

      it('rejects PUT requests', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'test' }),
        });

        expect(response.status).toBe(404);
      });
    });

    describe('Response Structure (requires LLM credentials)', () => {
      // These tests only run if LLM_TEST_ENABLED is true
      const LLM_TESTS_ENABLED = process.env.LLM_TEST_ENABLED === 'true';

      it.skipIf(!LLM_TESTS_ENABLED)('returns valid analysis for balance sheet text', async () => {
        const balanceSheetText = `
          Balance Sheet - Acme Corporation
          As of December 31, 2024

          ASSETS
          Current Assets:
            Cash and Cash Equivalents: $500,000
            Accounts Receivable: $300,000
            Inventory: $200,000
          Total Current Assets: $1,000,000

          Non-Current Assets:
            Property, Plant & Equipment: $800,000
            Intangible Assets: $200,000
          Total Non-Current Assets: $1,000,000

          TOTAL ASSETS: $2,000,000

          LIABILITIES
          Current Liabilities:
            Accounts Payable: $150,000
            Short-term Debt: $100,000
          Total Current Liabilities: $250,000

          Non-Current Liabilities:
            Long-term Debt: $500,000
          Total Non-Current Liabilities: $500,000

          TOTAL LIABILITIES: $750,000

          EQUITY
          Common Stock: $750,000
          Retained Earnings: $500,000
          TOTAL EQUITY: $1,250,000

          TOTAL LIABILITIES AND EQUITY: $2,000,000
        `;

        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: balanceSheetText }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        // Verify response structure
        expect(data).toHaveProperty('liquidityRatios');
        expect(data).toHaveProperty('solvencyRatios');
        expect(data).toHaveProperty('overallHealthAssessment');
        expect(data).toHaveProperty('keyObservations');

        // Verify liquidity ratios
        expect(data.liquidityRatios).toHaveProperty('currentRatio');
        expect(data.liquidityRatios).toHaveProperty('quickRatio');

        // Verify solvency ratios
        expect(data.solvencyRatios).toHaveProperty('debtToEquity');
        expect(data.solvencyRatios).toHaveProperty('debtToAssets');

        // Verify health assessment
        expect(['healthy', 'warning', 'critical', 'unknown']).toContain(
          data.overallHealthAssessment.status
        );
        expect(data.overallHealthAssessment.score).toBeGreaterThanOrEqual(0);
        expect(data.overallHealthAssessment.score).toBeLessThanOrEqual(100);
        expect(typeof data.overallHealthAssessment.summary).toBe('string');

        // Verify key observations
        expect(Array.isArray(data.keyObservations)).toBe(true);
        expect(data.keyObservations.length).toBeGreaterThanOrEqual(1);
        expect(data.keyObservations.length).toBeLessThanOrEqual(10);
      });

      it.skipIf(!LLM_TESTS_ENABLED)('handles gibberish input gracefully', async () => {
        const response = await fetch(`${API_URL}/api/v1/financial/analyze-balance-sheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
          }),
        });

        // Should either return unknown status or 422 for unprocessable
        if (response.status === 200) {
          const data = await response.json();
          expect(data.overallHealthAssessment.status).toBe('unknown');
        } else {
          expect(response.status).toBe(422);
        }
      });
    });
  });
});
