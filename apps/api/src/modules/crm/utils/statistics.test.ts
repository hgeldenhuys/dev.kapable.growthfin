/**
 * Tests for Statistical Utilities
 */

import { describe, expect, test } from 'bun:test';
import {
  chiSquareTest,
  confidenceInterval,
  hasMinimumSampleSize,
  calculateLift,
} from './statistics';

describe('chiSquareTest', () => {
  test('detects significant difference between variants', () => {
    // Variant A: 50 opens out of 100 (50% open rate)
    // Variant B: 80 opens out of 100 (80% open rate)
    const observed = [50, 80];
    const totals = [100, 100];

    const result = chiSquareTest(observed, totals);

    expect(result.degreesOfFreedom).toBe(1);
    expect(result.chiSquare).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(0.05); // Should be significant
    expect(result.isSignificant).toBe(true);
  });

  test('does not detect significant difference when variants are similar', () => {
    // Variant A: 50 opens out of 100 (50% open rate)
    // Variant B: 51 opens out of 100 (51% open rate)
    const observed = [50, 51];
    const totals = [100, 100];

    const result = chiSquareTest(observed, totals);

    expect(result.pValue).toBeGreaterThan(0.05); // Should NOT be significant
    expect(result.isSignificant).toBe(false);
  });

  test('works with 3 variants', () => {
    // Variant A: 30/100 (30%)
    // Variant B: 50/100 (50%)
    // Variant C: 70/100 (70%)
    const observed = [30, 50, 70];
    const totals = [100, 100, 100];

    const result = chiSquareTest(observed, totals);

    expect(result.degreesOfFreedom).toBe(2);
    expect(result.chiSquare).toBeGreaterThan(0);
    expect(result.isSignificant).toBe(true); // Large difference should be significant
  });

  test('works with 4 variants', () => {
    // All similar rates (~50%)
    const observed = [50, 51, 49, 50];
    const totals = [100, 100, 100, 100];

    const result = chiSquareTest(observed, totals);

    expect(result.degreesOfFreedom).toBe(3);
    expect(result.isSignificant).toBe(false); // Similar rates should not be significant
  });

  test('throws error for mismatched array lengths', () => {
    expect(() => {
      chiSquareTest([50, 80], [100]);
    }).toThrow('observed and totals arrays must have same length');
  });

  test('throws error for single variant', () => {
    expect(() => {
      chiSquareTest([50], [100]);
    }).toThrow('Need at least 2 variants for chi-square test');
  });

  test('throws error for zero total samples', () => {
    expect(() => {
      chiSquareTest([0, 0], [0, 0]);
    }).toThrow('Total samples cannot be zero');
  });

  test('handles zero expected frequency gracefully', () => {
    // All successes in one variant
    const observed = [0, 100];
    const totals = [100, 100];

    const result = chiSquareTest(observed, totals);

    expect(result.chiSquare).toBeGreaterThan(0);
    expect(result.isSignificant).toBe(true);
  });
});

describe('confidenceInterval', () => {
  test('calculates 95% confidence interval correctly', () => {
    // 50 successes out of 100 trials = 50%
    const result = confidenceInterval(50, 100, 0.95);

    expect(result.lower).toBeGreaterThan(0);
    expect(result.upper).toBeLessThan(1);
    expect(result.lower).toBeLessThan(0.5); // Should be below 50%
    expect(result.upper).toBeGreaterThan(0.5); // Should be above 50%
    expect(result.margin).toBeGreaterThan(0);

    // Margin should be approximately 0.098 for 50/100 with 95% CI
    expect(result.margin).toBeCloseTo(0.098, 2);
  });

  test('calculates 99% confidence interval (wider than 95%)', () => {
    const ci95 = confidenceInterval(50, 100, 0.95);
    const ci99 = confidenceInterval(50, 100, 0.99);

    // 99% CI should be wider than 95% CI
    expect(ci99.margin).toBeGreaterThan(ci95.margin);
    expect(ci99.lower).toBeLessThan(ci95.lower);
    expect(ci99.upper).toBeGreaterThan(ci95.upper);
  });

  test('handles zero total gracefully', () => {
    const result = confidenceInterval(0, 0);

    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
    expect(result.margin).toBe(0);
  });

  test('confidence interval narrows with larger sample size', () => {
    const small = confidenceInterval(50, 100, 0.95);
    const large = confidenceInterval(500, 1000, 0.95);

    // Larger sample should have smaller margin
    expect(large.margin).toBeLessThan(small.margin);
  });

  test('bounds are clamped to [0, 1]', () => {
    // Very small sample with extreme result
    const result = confidenceInterval(10, 10, 0.95);

    expect(result.upper).toBeLessThanOrEqual(1);
    expect(result.lower).toBeGreaterThanOrEqual(0);
  });
});

describe('hasMinimumSampleSize', () => {
  test('validates sufficient sample sizes', () => {
    const result = hasMinimumSampleSize([100, 120, 110], 100);

    expect(result.isValid).toBe(true);
    expect(result.minRequired).toBe(100);
    expect(result.variants).toHaveLength(3);
    expect(result.variants[0].valid).toBe(true);
    expect(result.variants[1].valid).toBe(true);
    expect(result.variants[2].valid).toBe(true);
  });

  test('detects insufficient sample sizes', () => {
    const result = hasMinimumSampleSize([100, 50, 110], 100);

    expect(result.isValid).toBe(false);
    expect(result.variants[0].valid).toBe(true);
    expect(result.variants[1].valid).toBe(false);
    expect(result.variants[2].valid).toBe(true);
  });

  test('uses default minimum of 100', () => {
    const result = hasMinimumSampleSize([150, 200]);

    expect(result.isValid).toBe(true);
    expect(result.minRequired).toBe(100);
  });

  test('works with custom minimum', () => {
    const result = hasMinimumSampleSize([40, 50, 60], 50);

    expect(result.isValid).toBe(false);
    expect(result.minRequired).toBe(50);
    expect(result.variants[0].valid).toBe(false);
    expect(result.variants[1].valid).toBe(true);
    expect(result.variants[2].valid).toBe(true);
  });

  test('includes variant index and count in results', () => {
    const result = hasMinimumSampleSize([80, 120], 100);

    expect(result.variants[0]).toEqual({
      index: 0,
      count: 80,
      valid: false,
    });
    expect(result.variants[1]).toEqual({
      index: 1,
      count: 120,
      valid: true,
    });
  });
});

describe('calculateLift', () => {
  test('calculates positive lift', () => {
    const controlRate = 0.5; // 50%
    const variantRate = 0.6; // 60%

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBeCloseTo(20, 0); // 20% improvement
  });

  test('calculates negative lift', () => {
    const controlRate = 0.5; // 50%
    const variantRate = 0.4; // 40%

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBeCloseTo(-20, 0); // 20% decrease
  });

  test('calculates zero lift for identical rates', () => {
    const controlRate = 0.5;
    const variantRate = 0.5;

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBe(0);
  });

  test('handles zero control rate', () => {
    const controlRate = 0;
    const variantRate = 0.1;

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBe(Infinity);
  });

  test('returns 0 when both rates are zero', () => {
    const lift = calculateLift(0, 0);

    expect(lift).toBe(0);
  });

  test('calculates large lift correctly', () => {
    const controlRate = 0.1; // 10%
    const variantRate = 0.5; // 50%

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBe(400); // 400% improvement
  });

  test('calculates fractional lift correctly', () => {
    const controlRate = 0.50; // 50.0%
    const variantRate = 0.51; // 51.0%

    const lift = calculateLift(variantRate, controlRate);

    expect(lift).toBeCloseTo(2, 0); // ~2% improvement
  });
});

describe('Real-world A/B test scenarios', () => {
  test('Email campaign: Variant B significantly better', () => {
    // Variant A (Control): 500 opens out of 2000 emails (25% open rate)
    // Variant B: 700 opens out of 2000 emails (35% open rate)

    const observed = [500, 700];
    const totals = [2000, 2000];

    const chiSquare = chiSquareTest(observed, totals);
    const lift = calculateLift(700 / 2000, 500 / 2000);

    expect(chiSquare.isSignificant).toBe(true);
    expect(chiSquare.pValue).toBeLessThan(0.001); // Highly significant
    expect(lift).toBeCloseTo(40, 0); // 40% lift
  });

  test('Email campaign: No significant difference', () => {
    // Variant A: 250 opens out of 1000 emails (25% open rate)
    // Variant B: 255 opens out of 1000 emails (25.5% open rate)

    const observed = [250, 255];
    const totals = [1000, 1000];

    const chiSquare = chiSquareTest(observed, totals);

    expect(chiSquare.isSignificant).toBe(false);
    expect(chiSquare.pValue).toBeGreaterThan(0.05);
  });

  test('Multi-variant test: 4 subject lines', () => {
    // Subject A: 200/1000 (20%)
    // Subject B: 250/1000 (25%)
    // Subject C: 280/1000 (28%)
    // Subject D: 220/1000 (22%)

    const observed = [200, 250, 280, 220];
    const totals = [1000, 1000, 1000, 1000];

    const chiSquare = chiSquareTest(observed, totals);
    const sampleValidation = hasMinimumSampleSize(totals, 100);

    expect(sampleValidation.isValid).toBe(true);
    expect(chiSquare.isSignificant).toBe(true);
    expect(chiSquare.degreesOfFreedom).toBe(3);

    // Subject C has best rate
    const winnerRate = 280 / 1000;
    const controlRate = 200 / 1000;
    const lift = calculateLift(winnerRate, controlRate);

    expect(lift).toBeCloseTo(40, 0); // 40% lift over control
  });

  test('Insufficient sample size', () => {
    // Small test - not enough data
    const observed = [20, 30];
    const totals = [50, 50];

    const sampleValidation = hasMinimumSampleSize(totals, 100);

    expect(sampleValidation.isValid).toBe(false);
    expect(sampleValidation.variants[0].valid).toBe(false);
    expect(sampleValidation.variants[1].valid).toBe(false);
  });
});
