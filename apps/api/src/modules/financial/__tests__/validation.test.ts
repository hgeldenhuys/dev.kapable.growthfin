/**
 * Financial Analysis Validation Tests
 * Unit tests for balance sheet input validation
 */

import { describe, test, expect } from 'bun:test';
import { validateBalanceSheetInput } from '../validation';

describe('validateBalanceSheetInput', () => {
  describe('empty text validation', () => {
    test('should reject empty string', () => {
      const result = validateBalanceSheetInput('');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EMPTY_TEXT');
      expect(result.error?.message).toBe('Balance sheet text cannot be empty');
    });

    test('should reject whitespace-only string', () => {
      const result = validateBalanceSheetInput('   ');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('EMPTY_TEXT');
    });

    test('should reject tabs and newlines only', () => {
      const result = validateBalanceSheetInput('\t\n\r  \n\t');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('EMPTY_TEXT');
    });

    test('should reject null-like undefined input', () => {
      // TypeScript won't allow null, but runtime might pass undefined
      const result = validateBalanceSheetInput(undefined as unknown as string);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('EMPTY_TEXT');
    });
  });

  describe('text length validation', () => {
    test('should accept text at exactly 50,000 characters', () => {
      const text = 'a'.repeat(50000);
      const result = validateBalanceSheetInput(text);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject text at 50,001 characters', () => {
      const text = 'a'.repeat(50001);
      const result = validateBalanceSheetInput(text);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('TEXT_TOO_LONG');
      expect(result.error?.message).toContain('50,000');
      expect(result.error?.message).toContain('50001');
    });

    test('should reject very long text', () => {
      const text = 'a'.repeat(100000);
      const result = validateBalanceSheetInput(text);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('TEXT_TOO_LONG');
    });
  });

  describe('valid input', () => {
    test('should accept minimal valid text', () => {
      const result = validateBalanceSheetInput('a');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should accept typical balance sheet text', () => {
      const text = `
        Balance Sheet - ABC Company
        As of December 31, 2024

        Assets:
        Current Assets:
          Cash and Equivalents: $500,000
          Accounts Receivable: $300,000
          Inventory: $200,000
        Total Current Assets: $1,000,000

        Liabilities:
        Current Liabilities:
          Accounts Payable: $150,000
          Short-term Debt: $100,000
        Total Current Liabilities: $250,000

        Equity:
          Common Stock: $500,000
          Retained Earnings: $250,000
        Total Equity: $750,000
      `;
      const result = validateBalanceSheetInput(text);

      expect(result.valid).toBe(true);
    });

    test('should accept text with leading/trailing whitespace but non-empty content', () => {
      const result = validateBalanceSheetInput('  valid content  ');

      expect(result.valid).toBe(true);
    });

    test('should accept text with special characters', () => {
      const result = validateBalanceSheetInput('Assets: $1,000,000 (USD) — 日本語 €500');

      expect(result.valid).toBe(true);
    });
  });
});
