/**
 * Unit tests for Confidence Score Utilities
 * US-CONF-001: AI Prompt Enhancement for Confidence Scoring
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateConfidence,
  applyAfricanMarketFloor,
  clampConfidence,
  validateConfidence,
  calculateOverallConfidence,
  extractConfidence,
  applyDefaultConfidence,
  getFieldConfidence,
  getOverallConfidence,
  calculateEffectiveLeadScore,
  AFRICAN_MARKET_FLOOR,
  DEFAULT_LEGACY_CONFIDENCE,
  MINIMUM_EFFECTIVE_SCORE,
  type ConfidenceFactors,
} from './confidence';

describe('Confidence Utilities', () => {
  describe('calculateConfidence', () => {
    test('should calculate confidence from perfect factors', () => {
      const factors: ConfidenceFactors = {
        matchQuality: 1.0,
        sourceAuthority: 1.0,
        verified: true,
        multiSourceConsensus: true,
        reasoning: 'Perfect match',
      };

      const result = calculateConfidence(factors);
      expect(result).toBeCloseTo(1.0, 2); // 0.4 + 0.3 + 0.2 + 0.1 = 1.0
    });

    test('should calculate confidence without verification', () => {
      const factors: ConfidenceFactors = {
        matchQuality: 0.9,
        sourceAuthority: 0.8,
        verified: false,
        multiSourceConsensus: false,
        reasoning: 'Good match, no verification',
      };

      const result = calculateConfidence(factors);
      // 0.9 * 0.4 + 0.8 * 0.3 = 0.36 + 0.24 = 0.6
      expect(result).toBeCloseTo(0.6, 2);
    });

    test('should calculate confidence with verification but no consensus', () => {
      const factors: ConfidenceFactors = {
        matchQuality: 0.85,
        sourceAuthority: 0.90,
        verified: true,
        multiSourceConsensus: false,
        reasoning: 'Verified email',
      };

      const result = calculateConfidence(factors);
      // 0.85 * 0.4 + 0.90 * 0.3 + 0.2 = 0.34 + 0.27 + 0.2 = 0.81
      expect(result).toBeCloseTo(0.81, 2);
    });

    test('should throw error for invalid matchQuality', () => {
      const factors: ConfidenceFactors = {
        matchQuality: 1.5, // Invalid
        sourceAuthority: 0.8,
        verified: false,
        reasoning: 'Invalid',
      };

      expect(() => calculateConfidence(factors)).toThrow();
    });

    test('should throw error for negative matchQuality', () => {
      const factors: ConfidenceFactors = {
        matchQuality: -0.1, // Invalid
        sourceAuthority: 0.8,
        verified: false,
        reasoning: 'Invalid',
      };

      expect(() => calculateConfidence(factors)).toThrow();
    });

    test('should throw error for invalid sourceAuthority', () => {
      const factors: ConfidenceFactors = {
        matchQuality: 0.8,
        sourceAuthority: 2.0, // Invalid
        verified: false,
        reasoning: 'Invalid',
      };

      expect(() => calculateConfidence(factors)).toThrow();
    });
  });

  describe('applyAfricanMarketFloor', () => {
    test('should apply floor to low confidence', () => {
      expect(applyAfricanMarketFloor(0.2)).toBe(AFRICAN_MARKET_FLOOR);
      expect(applyAfricanMarketFloor(0.3)).toBe(AFRICAN_MARKET_FLOOR);
      expect(applyAfricanMarketFloor(0.39)).toBe(AFRICAN_MARKET_FLOOR);
    });

    test('should not modify confidence above floor', () => {
      expect(applyAfricanMarketFloor(0.5)).toBe(0.5);
      expect(applyAfricanMarketFloor(0.75)).toBe(0.75);
      expect(applyAfricanMarketFloor(1.0)).toBe(1.0);
    });

    test('should handle exactly floor value', () => {
      expect(applyAfricanMarketFloor(AFRICAN_MARKET_FLOOR)).toBe(
        AFRICAN_MARKET_FLOOR
      );
    });
  });

  describe('clampConfidence', () => {
    test('should clamp values above 1.0', () => {
      expect(clampConfidence(1.5)).toBe(1.0);
      expect(clampConfidence(2.0)).toBe(1.0);
      expect(clampConfidence(100.0)).toBe(1.0);
    });

    test('should clamp negative values to 0.0', () => {
      expect(clampConfidence(-0.5)).toBe(0.0);
      expect(clampConfidence(-1.0)).toBe(0.0);
    });

    test('should not modify valid range values', () => {
      expect(clampConfidence(0.0)).toBe(0.0);
      expect(clampConfidence(0.5)).toBe(0.5);
      expect(clampConfidence(1.0)).toBe(1.0);
    });
  });

  describe('validateConfidence', () => {
    test('should clamp and apply floor to out-of-range values', () => {
      // Out of range high - clamp to 1.0
      expect(validateConfidence(1.5)).toBe(1.0);

      // Out of range low - clamp to 0.0, then apply floor
      expect(validateConfidence(-0.5)).toBe(AFRICAN_MARKET_FLOOR);

      // Below floor - apply floor
      expect(validateConfidence(0.2)).toBe(AFRICAN_MARKET_FLOOR);
    });

    test('should return valid values above floor unchanged', () => {
      expect(validateConfidence(0.5)).toBe(0.5);
      expect(validateConfidence(0.75)).toBe(0.75);
      expect(validateConfidence(1.0)).toBe(1.0);
    });
  });

  describe('calculateOverallConfidence', () => {
    test('should calculate average of multiple field scores', () => {
      const fieldScores = {
        email: 0.85,
        phone: 0.65,
        leadScore: 0.75,
      };

      const result = calculateOverallConfidence(fieldScores);
      // Average: (0.85 + 0.65 + 0.75) / 3 = 0.75
      expect(result).toBeCloseTo(0.75, 2);
    });

    test('should handle single field score', () => {
      const fieldScores = {
        email: 0.90,
      };

      const result = calculateOverallConfidence(fieldScores);
      expect(result).toBe(0.90);
    });

    test('should apply floor to low average', () => {
      const fieldScores = {
        email: 0.3,
        phone: 0.2,
      };

      const result = calculateOverallConfidence(fieldScores);
      // Average: (0.3 + 0.2) / 2 = 0.25, then floor applied
      expect(result).toBe(AFRICAN_MARKET_FLOOR);
    });

    test('should return default for empty scores', () => {
      const result = calculateOverallConfidence({});
      expect(result).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });

    test('should ignore non-numeric values', () => {
      const fieldScores = {
        email: 0.8,
        phone: 0.6,
        invalid: NaN,
        _overall: 0.9, // Should be ignored as non-field
      };

      const result = calculateOverallConfidence(fieldScores);
      // Only email and phone: (0.8 + 0.6 + NaN + 0.9) / 4
      // But NaN should be filtered: (0.8 + 0.6 + 0.9) / 3 = 0.766...
      expect(result).toBeCloseTo(0.76, 1);
    });
  });

  describe('extractConfidence', () => {
    test('should extract valid confidence object', () => {
      const enrichmentData = {
        email: 'test@example.com',
        phone: '+27123456789',
        _confidence: {
          email: 0.85,
          phone: 0.62,
          _overall: 0.79,
          _factors: {
            email: {
              matchQuality: 0.9,
              sourceAuthority: 0.85,
              verified: true,
              reasoning: 'Email verified',
            },
          },
        },
      };

      const result = extractConfidence(enrichmentData);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(0.85);
      expect(result!.phone).toBe(0.62);
      expect(result!._overall).toBe(0.79);
      expect(result!._factors.email).toBeDefined();
      expect(result!._factors.email.reasoning).toBe('Email verified');
    });

    test('should validate and clamp out-of-range scores', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 1.5, // Out of range - should be clamped to 1.0
          phone: -0.5, // Out of range - should be clamped to 0.0, then floor applied
          leadScore: 0.2, // Below floor - should be raised to 0.4
          _overall: 2.0, // Out of range - should be clamped to 1.0
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(1.0);
      expect(result!.phone).toBe(AFRICAN_MARKET_FLOOR);
      expect(result!.leadScore).toBe(AFRICAN_MARKET_FLOOR);
      expect(result!._overall).toBe(1.0);
    });

    test('should calculate _overall if missing', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.8,
          phone: 0.6,
          // _overall missing - should be calculated
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);

      expect(result).not.toBeNull();
      expect(result!._overall).toBeCloseTo(0.7, 2); // (0.8 + 0.6) / 2
    });

    test('should return null for missing confidence', () => {
      const enrichmentData = {
        email: 'test@example.com',
        phone: '+27123456789',
        // No _confidence
      };

      const result = extractConfidence(enrichmentData);
      expect(result).toBeNull();
    });

    test('should return null for invalid confidence type', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: 'invalid', // Not an object
      };

      const result = extractConfidence(enrichmentData);
      expect(result).toBeNull();
    });

    test('should preserve factors if present', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.85,
          _overall: 0.85,
          _factors: {
            email: {
              matchQuality: 0.9,
              sourceAuthority: 0.85,
              verified: true,
              multiSourceConsensus: false,
              reasoning: 'Test reasoning',
            },
          },
        },
      };

      const result = extractConfidence(enrichmentData);

      expect(result).not.toBeNull();
      expect(result!._factors.email).toBeDefined();
      expect(result!._factors.email.matchQuality).toBe(0.9);
      expect(result!._factors.email.reasoning).toBe('Test reasoning');
    });
  });

  describe('applyDefaultConfidence', () => {
    test('should not modify data with existing confidence', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.85,
          _overall: 0.85,
          _factors: {},
        },
      };

      const result = applyDefaultConfidence(enrichmentData);
      expect(result).toEqual(enrichmentData); // Unchanged
    });

    test('should apply default confidence to enriched fields', () => {
      const enrichmentData = {
        email: 'test@example.com',
        phone: '+27123456789',
        leadScore: 75,
        reasoning: 'Good lead', // Should be excluded
      };

      const result = applyDefaultConfidence(enrichmentData);

      expect(result._confidence).toBeDefined();
      expect(result._confidence.email).toBe(DEFAULT_LEGACY_CONFIDENCE);
      expect(result._confidence.phone).toBe(DEFAULT_LEGACY_CONFIDENCE);
      expect(result._confidence.leadScore).toBe(DEFAULT_LEGACY_CONFIDENCE);
      expect(result._confidence._overall).toBe(DEFAULT_LEGACY_CONFIDENCE);
      expect(result._confidence._factors.email).toBeDefined();
      expect(result._confidence._factors.email.reasoning).toContain('Legacy');
    });

    test('should exclude internal fields from default confidence', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _internal: 'should be ignored',
        __meta: 'should be ignored',
        reasoning: 'should be ignored',
      };

      const result = applyDefaultConfidence(enrichmentData);

      expect(result._confidence).toBeDefined();
      expect(result._confidence.email).toBe(DEFAULT_LEGACY_CONFIDENCE);
      expect(result._confidence._internal).toBeUndefined();
      expect(result._confidence.__meta).toBeUndefined();
      expect(result._confidence.reasoning).toBeUndefined();
    });

    test('should return unchanged if no enriched fields', () => {
      const enrichmentData = {
        reasoning: 'No data',
        _meta: 'No fields',
      };

      const result = applyDefaultConfidence(enrichmentData);

      // Should still have original data
      expect(result.reasoning).toBe('No data');
      expect(result._meta).toBe('No fields');
      // But no confidence added since no enriched fields
      expect(result._confidence).toBeUndefined();
    });

    test('should handle empty object', () => {
      const result = applyDefaultConfidence({});
      expect(result._confidence).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle confidence exactly at floor', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: AFRICAN_MARKET_FLOOR,
          _overall: AFRICAN_MARKET_FLOOR,
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);
      expect(result!.email).toBe(AFRICAN_MARKET_FLOOR);
      expect(result!._overall).toBe(AFRICAN_MARKET_FLOOR);
    });

    test('should handle very small numbers', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.0001,
          _overall: 0.0001,
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);
      expect(result!.email).toBe(AFRICAN_MARKET_FLOOR); // Floor applied
    });

    test('should handle zero confidence', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.0,
          _overall: 0.0,
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);
      expect(result!.email).toBe(AFRICAN_MARKET_FLOOR); // Floor applied
      expect(result!._overall).toBe(AFRICAN_MARKET_FLOOR);
    });

    test('should handle mixed valid and invalid scores', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.85, // Valid
          phone: 1.5, // Invalid - should clamp
          leadScore: -0.2, // Invalid - should clamp and floor
          _overall: 0.7,
          _factors: {},
        },
      };

      const result = extractConfidence(enrichmentData);
      expect(result!.email).toBe(0.85);
      expect(result!.phone).toBe(1.0);
      expect(result!.leadScore).toBe(AFRICAN_MARKET_FLOOR);
    });
  });

  // US-CONF-002: Confidence Storage Tests
  describe('getFieldConfidence', () => {
    test('should return field confidence when present', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.85,
          phone: 0.62,
          _overall: 0.79,
        },
      };

      const emailConfidence = getFieldConfidence(enrichmentData, 'email');
      const phoneConfidence = getFieldConfidence(enrichmentData, 'phone');

      expect(emailConfidence).toBe(0.85);
      expect(phoneConfidence).toBe(0.62);
    });

    test('should return default confidence for missing field', () => {
      const enrichmentData = {
        email: 'test@example.com',
        _confidence: {
          email: 0.85,
          _overall: 0.85,
        },
      };

      const phoneConfidence = getFieldConfidence(enrichmentData, 'phone');
      expect(phoneConfidence).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });

    test('should return default confidence for legacy data (no _confidence)', () => {
      const enrichmentData = {
        email: 'test@example.com',
        phone: '+27123456789',
      };

      const emailConfidence = getFieldConfidence(enrichmentData, 'email');
      expect(emailConfidence).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });

    test('should return default confidence for null enrichment data', () => {
      const confidence = getFieldConfidence(null, 'email');
      expect(confidence).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });

    test('should validate and clamp confidence scores', () => {
      const enrichmentData = {
        _confidence: {
          email: 1.5, // Invalid - should clamp to 1.0
          phone: -0.2, // Invalid - should clamp to 0.4 (floor)
        },
      };

      const emailConfidence = getFieldConfidence(enrichmentData, 'email');
      const phoneConfidence = getFieldConfidence(enrichmentData, 'phone');

      expect(emailConfidence).toBe(1.0);
      expect(phoneConfidence).toBe(AFRICAN_MARKET_FLOOR);
    });
  });

  describe('getOverallConfidence', () => {
    test('should return _overall when present', () => {
      const enrichmentData = {
        _confidence: {
          email: 0.85,
          phone: 0.62,
          _overall: 0.79,
        },
      };

      const overall = getOverallConfidence(enrichmentData);
      expect(overall).toBe(0.79);
    });

    test('should calculate overall from field scores when _overall missing', () => {
      const enrichmentData = {
        _confidence: {
          email: 0.80,
          phone: 0.60,
        },
      };

      const overall = getOverallConfidence(enrichmentData);
      expect(overall).toBeCloseTo(0.70, 2); // (0.80 + 0.60) / 2 = 0.70
    });

    test('should return default for legacy data', () => {
      const enrichmentData = {
        email: 'test@example.com',
      };

      const overall = getOverallConfidence(enrichmentData);
      expect(overall).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });

    test('should return default for null enrichment data', () => {
      const overall = getOverallConfidence(null);
      expect(overall).toBe(DEFAULT_LEGACY_CONFIDENCE);
    });
  });

  // US-CONF-003: Effective Lead Score Tests
  describe('calculateEffectiveLeadScore', () => {
    test('should calculate effective score: baseScore=75, confidence=0.80 → 60', () => {
      const effectiveScore = calculateEffectiveLeadScore(75, {
        email: 0.85,
        phone: 0.75,
        // Average: (0.85 + 0.75) / 2 = 0.80
      });

      expect(effectiveScore).toBe(60); // 75 * 0.80 = 60
    });

    test('should apply confidence floor: baseScore=75, confidence=0.30 → 30', () => {
      const effectiveScore = calculateEffectiveLeadScore(75, {
        email: 0.30,
        // Average: 0.30, but floor is 0.40
      });

      expect(effectiveScore).toBe(30); // 75 * 0.40 (floor) = 30
    });

    test('should enforce minimum effective score: baseScore=10, confidence=0.50 → 25', () => {
      const effectiveScore = calculateEffectiveLeadScore(10, {
        email: 0.50,
      });

      expect(effectiveScore).toBe(MINIMUM_EFFECTIVE_SCORE); // 10 * 0.50 = 5, but min is 25
    });

    test('should not adjust when no enrichment: baseScore=75, no confidence → 75', () => {
      const effectiveScore = calculateEffectiveLeadScore(75, {});

      expect(effectiveScore).toBe(75); // No adjustment when no confidence data
    });

    test('should ignore zero confidence scores in average', () => {
      const effectiveScore = calculateEffectiveLeadScore(80, {
        email: 0.90,
        phone: 0, // Should be filtered out
        website: 0.70,
      });

      // Average: (0.90 + 0.70) / 2 = 0.80
      expect(effectiveScore).toBe(64); // 80 * 0.80 = 64
    });

    test('should round to nearest integer', () => {
      const effectiveScore = calculateEffectiveLeadScore(77, {
        email: 0.77,
        // 77 * 0.77 = 59.29 → rounds to 59
      });

      expect(effectiveScore).toBe(59);
    });

    test('should handle multiple field confidences', () => {
      const effectiveScore = calculateEffectiveLeadScore(90, {
        email: 0.95,
        phone: 0.85,
        linkedin: 0.90,
        website: 0.80,
        // Average: (0.95 + 0.85 + 0.90 + 0.80) / 4 = 0.875
      });

      expect(effectiveScore).toBe(79); // 90 * 0.875 = 78.75 → rounds to 79
    });

    test('should apply floor even with single low confidence', () => {
      const effectiveScore = calculateEffectiveLeadScore(100, {
        email: 0.20, // Below floor
      });

      expect(effectiveScore).toBe(40); // 100 * 0.40 (floor) = 40
    });

    test('should filter out NaN and invalid scores', () => {
      const effectiveScore = calculateEffectiveLeadScore(75, {
        email: 0.80,
        phone: NaN,
        website: 0.70,
      });

      // Average: (0.80 + 0.70) / 2 = 0.75
      expect(effectiveScore).toBe(56); // 75 * 0.75 = 56.25 → rounds to 56
    });
  });
});
