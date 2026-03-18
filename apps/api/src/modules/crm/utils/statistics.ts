/**
 * Statistical Utilities for A/B Testing
 * Implements chi-square test, p-value calculation, and confidence intervals
 */

/**
 * Chi-square test for A/B testing statistical significance
 *
 * Tests the null hypothesis that there's no difference between variants
 * Returns p-value (probability that observed difference is due to chance)
 *
 * Common interpretation:
 * - p < 0.05: Statistically significant (reject null hypothesis)
 * - p < 0.01: Highly significant
 * - p >= 0.05: Not significant (can't reject null hypothesis)
 *
 * @param observed - Array of observed successes per variant
 * @param totals - Array of total samples per variant
 * @returns Chi-square statistic and p-value
 */
export function chiSquareTest(observed: number[], totals: number[]): {
  chiSquare: number;
  pValue: number;
  degreesOfFreedom: number;
  isSignificant: boolean;
} {
  if (observed.length !== totals.length) {
    throw new Error('observed and totals arrays must have same length');
  }

  if (observed.length < 2) {
    throw new Error('Need at least 2 variants for chi-square test');
  }

  const k = observed.length; // Number of variants
  const totalObserved = observed.reduce((sum, val) => sum + val, 0);
  const totalSamples = totals.reduce((sum, val) => sum + val, 0);

  if (totalSamples === 0) {
    throw new Error('Total samples cannot be zero');
  }

  // Calculate expected frequencies under null hypothesis
  // Expected = total_samples_for_variant * (total_successes / total_samples)
  const overallRate = totalObserved / totalSamples;
  const expected = totals.map(total => total * overallRate);

  // Calculate chi-square statistic
  // χ² = Σ((observed - expected)² / expected)
  let chiSquare = 0;
  for (let i = 0; i < k; i++) {
    const obs = observed[i];
    const exp = expected[i];

    if (exp === 0) {
      // Skip if expected is 0 to avoid division by zero
      continue;
    }

    chiSquare += Math.pow(obs - exp, 2) / exp;
  }

  // Degrees of freedom = k - 1
  const df = k - 1;

  // Calculate p-value from chi-square distribution
  const pValue = chiSquareToPValue(chiSquare, df);

  return {
    chiSquare,
    pValue,
    degreesOfFreedom: df,
    isSignificant: pValue < 0.05,
  };
}

/**
 * Convert chi-square statistic to p-value
 * Uses incomplete gamma function approximation
 */
function chiSquareToPValue(chiSquare: number, df: number): number {
  // For df=1, we can use a simpler calculation
  if (df === 1) {
    // P(χ² > x) ≈ 1 - Φ(√x) where Φ is standard normal CDF
    const z = Math.sqrt(chiSquare);
    return 2 * (1 - normalCDF(z)); // Two-tailed test
  }

  // For df > 1, use incomplete gamma function approximation
  // P(χ² > x) = 1 - P(χ² <= x) = 1 - γ(df/2, x/2) / Γ(df/2)
  const k = df / 2;
  const x = chiSquare / 2;

  // Use regularized gamma function
  const pValue = 1 - regularizedGammaP(k, x);

  return Math.max(0, Math.min(1, pValue)); // Clamp to [0, 1]
}

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using error function
 */
function normalCDF(x: number): number {
  // Using approximation: Φ(x) = 0.5 * (1 + erf(x/√2))
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Error function (erf) approximation
 * Accurate to about 1.5e-7
 */
function erf(x: number): number {
  // Save the sign of x
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Abramowitz and Stegun formula
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Regularized incomplete gamma function P(a,x)
 * P(a,x) = γ(a,x) / Γ(a)
 *
 * Uses series expansion for x < a+1, continued fraction for x >= a+1
 */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) {
    throw new Error('Invalid arguments for gamma function');
  }

  if (x === 0) {
    return 0;
  }

  if (x < a + 1) {
    // Use series expansion
    return gammaSeriesExpansion(a, x);
  } else {
    // Use continued fraction
    return 1 - gammaContinuedFraction(a, x);
  }
}

/**
 * Incomplete gamma function using series expansion
 * Works well for x < a+1
 */
function gammaSeriesExpansion(a: number, x: number): number {
  const maxIterations = 1000;
  const epsilon = 1e-10;

  let sum = 1 / a;
  let term = 1 / a;

  for (let n = 1; n < maxIterations; n++) {
    term *= x / (a + n);
    sum += term;

    if (Math.abs(term) < epsilon) {
      break;
    }
  }

  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * Incomplete gamma function using continued fraction
 * Works well for x >= a+1
 */
function gammaContinuedFraction(a: number, x: number): number {
  const maxIterations = 1000;
  const epsilon = 1e-10;

  let b = x + 1 - a;
  let c = 1 / epsilon;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i < maxIterations; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;

    if (Math.abs(d) < epsilon) {
      d = epsilon;
    }

    c = b + an / c;

    if (Math.abs(c) < epsilon) {
      c = epsilon;
    }

    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) {
      break;
    }
  }

  return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * Natural logarithm of gamma function
 * Uses Lanczos approximation
 */
function logGamma(x: number): number {
  // Lanczos coefficients for g=7
  const coefficients = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    // Use reflection formula: Γ(1-x)Γ(x) = π/sin(πx)
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }

  x -= 1;
  let a = coefficients[0];
  const t = x + 7.5;

  for (let i = 1; i < 9; i++) {
    a += coefficients[i] / (x + i);
  }

  return Math.log(Math.sqrt(2 * Math.PI)) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Calculate confidence interval for a proportion
 *
 * @param successes - Number of successes
 * @param total - Total number of trials
 * @param confidence - Confidence level (default 0.95 for 95%)
 * @returns Lower and upper bounds of confidence interval
 */
export function confidenceInterval(
  successes: number,
  total: number,
  confidence: number = 0.95
): {
  lower: number;
  upper: number;
  margin: number;
} {
  if (total === 0) {
    return { lower: 0, upper: 0, margin: 0 };
  }

  const p = successes / total;

  // Z-score for confidence level (e.g., 1.96 for 95%)
  const zScore = getZScore(confidence);

  // Standard error = sqrt(p(1-p)/n)
  const standardError = Math.sqrt((p * (1 - p)) / total);

  // Margin of error = z * SE
  const margin = zScore * standardError;

  return {
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin),
    margin,
  };
}

/**
 * Get Z-score for given confidence level
 */
function getZScore(confidence: number): number {
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
    0.999: 3.291,
  };

  return zScores[confidence] || 1.96; // Default to 95%
}

/**
 * Validate minimum sample size for statistical power
 *
 * @param variantCounts - Array of sample sizes per variant
 * @param minPerVariant - Minimum samples required per variant (default 100)
 * @returns Whether sample size is sufficient
 */
export function hasMinimumSampleSize(
  variantCounts: number[],
  minPerVariant: number = 100
): {
  isValid: boolean;
  minRequired: number;
  variants: { index: number; count: number; valid: boolean }[];
} {
  const variants = variantCounts.map((count, index) => ({
    index,
    count,
    valid: count >= minPerVariant,
  }));

  const isValid = variants.every(v => v.valid);

  return {
    isValid,
    minRequired: minPerVariant,
    variants,
  };
}

/**
 * Calculate relative lift (percentage improvement) of variant over control
 *
 * @param variantRate - Conversion rate of variant
 * @param controlRate - Conversion rate of control
 * @returns Relative lift as percentage
 */
export function calculateLift(variantRate: number, controlRate: number): number {
  if (controlRate === 0) {
    return variantRate > 0 ? Infinity : 0;
  }

  return ((variantRate - controlRate) / controlRate) * 100;
}
