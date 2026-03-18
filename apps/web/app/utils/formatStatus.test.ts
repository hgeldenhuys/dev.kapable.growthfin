/**
 * Example Utility Test
 * Demonstrates basic Bun testing without DOM
 */

import { describe, test, expect } from 'bun:test';
import { formatStatus, getStatusColor } from './formatStatus';

describe('formatStatus', () => {
  test('should capitalize first letter', () => {
    expect(formatStatus('pending')).toBe('Pending');
    expect(formatStatus('running')).toBe('Running');
  });

  test('should handle uppercase input', () => {
    expect(formatStatus('COMPLETED')).toBe('Completed');
  });

  test('should handle mixed case input', () => {
    expect(formatStatus('FaILeD')).toBe('Failed');
  });
});

describe('getStatusColor', () => {
  test('should return correct color for each status', () => {
    expect(getStatusColor('pending')).toBe('gray');
    expect(getStatusColor('running')).toBe('blue');
    expect(getStatusColor('completed')).toBe('green');
    expect(getStatusColor('failed')).toBe('red');
  });

  test('should default to gray for unknown status', () => {
    // @ts-expect-error Testing invalid status
    expect(getStatusColor('invalid')).toBe('gray');
  });
});
