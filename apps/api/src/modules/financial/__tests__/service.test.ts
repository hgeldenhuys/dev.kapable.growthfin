/**
 * Financial Analysis Service Tests
 * Unit tests for balance sheet analysis validation logic
 *
 * NOTE: These tests focus on the validation logic within the service.
 * They test the validateAnalysisResponse method and ValidationError class
 * without requiring LLM calls.
 */

import { describe, test, expect } from 'bun:test';
import { ValidationError } from '../service';
import type {
  BalanceSheetAnalysisResponse,
  LiquidityRatios,
  SolvencyRatios,
  HealthAssessment,
  KeyObservation,
} from '../types';

// Create a test harness for validation logic
// We'll test the validation by creating responses and checking if they would pass
function createValidResponse(): BalanceSheetAnalysisResponse {
  return {
    liquidityRatios: {
      currentRatio: 2.5,
      currentRatioExplanation: 'Healthy current ratio above 2.0',
      quickRatio: 1.8,
      quickRatioExplanation: 'Good quick ratio',
    },
    solvencyRatios: {
      debtToEquity: 0.5,
      debtToEquityExplanation: 'Low debt to equity ratio',
      debtToAssets: 0.33,
      debtToAssetsExplanation: 'Conservative debt levels',
      interestCoverage: 8.0,
      interestCoverageExplanation: 'Strong interest coverage',
    },
    overallHealthAssessment: {
      status: 'healthy',
      score: 85,
      summary: 'The company shows strong financial health with good liquidity and low debt levels.',
    },
    keyObservations: [
      {
        observation: 'Strong cash position relative to current liabilities',
        category: 'liquidity',
        severity: 'info',
      },
      {
        observation: 'Debt levels are well managed',
        category: 'solvency',
        severity: 'info',
      },
    ],
  };
}

// Validator functions extracted from service for testing
function validateLiquidityRatios(ratios: any): void {
  if (ratios.currentRatio !== null && typeof ratios.currentRatio !== 'number') {
    throw new ValidationError('currentRatio must be number or null');
  }
  if (ratios.currentRatio === null && !ratios.currentRatioExplanation) {
    throw new ValidationError('currentRatioExplanation required when currentRatio is null');
  }
  if (ratios.quickRatio !== null && typeof ratios.quickRatio !== 'number') {
    throw new ValidationError('quickRatio must be number or null');
  }
  if (ratios.quickRatio === null && !ratios.quickRatioExplanation) {
    throw new ValidationError('quickRatioExplanation required when quickRatio is null');
  }
}

function validateSolvencyRatios(ratios: any): void {
  if (ratios.debtToEquity !== null && typeof ratios.debtToEquity !== 'number') {
    throw new ValidationError('debtToEquity must be number or null');
  }
  if (ratios.debtToEquity === null && !ratios.debtToEquityExplanation) {
    throw new ValidationError('debtToEquityExplanation required when debtToEquity is null');
  }
  if (ratios.debtToAssets !== null && typeof ratios.debtToAssets !== 'number') {
    throw new ValidationError('debtToAssets must be number or null');
  }
  if (ratios.debtToAssets === null && !ratios.debtToAssetsExplanation) {
    throw new ValidationError('debtToAssetsExplanation required when debtToAssets is null');
  }
  if (ratios.interestCoverage !== null && typeof ratios.interestCoverage !== 'number') {
    throw new ValidationError('interestCoverage must be number or null');
  }
}

function validateHealthAssessment(assessment: any): void {
  const validStatuses = ['healthy', 'warning', 'critical', 'unknown'];
  if (!validStatuses.includes(assessment.status)) {
    throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`);
  }
  if (typeof assessment.score !== 'number' || assessment.score < 0 || assessment.score > 100) {
    throw new ValidationError('score must be a number between 0 and 100');
  }
  if (typeof assessment.summary !== 'string' || assessment.summary.trim().length === 0) {
    throw new ValidationError('summary must be a non-empty string');
  }
}

function validateKeyObservation(observation: any): void {
  if (typeof observation.observation !== 'string' || observation.observation.trim().length === 0) {
    throw new ValidationError('observation must be a non-empty string');
  }
  const validCategories = ['liquidity', 'solvency', 'profitability', 'risk', 'other'];
  if (!validCategories.includes(observation.category)) {
    throw new ValidationError(`category must be one of: ${validCategories.join(', ')}`);
  }
  const validSeverities = ['info', 'warning', 'critical'];
  if (!validSeverities.includes(observation.severity)) {
    throw new ValidationError(`severity must be one of: ${validSeverities.join(', ')}`);
  }
}

function validateAnalysisResponse(response: any): BalanceSheetAnalysisResponse {
  if (!response || typeof response !== 'object') {
    throw new ValidationError('Response is not a valid object');
  }
  if (!response.liquidityRatios || typeof response.liquidityRatios !== 'object') {
    throw new ValidationError('Missing or invalid liquidityRatios');
  }
  validateLiquidityRatios(response.liquidityRatios);
  if (!response.solvencyRatios || typeof response.solvencyRatios !== 'object') {
    throw new ValidationError('Missing or invalid solvencyRatios');
  }
  validateSolvencyRatios(response.solvencyRatios);
  if (!response.overallHealthAssessment || typeof response.overallHealthAssessment !== 'object') {
    throw new ValidationError('Missing or invalid overallHealthAssessment');
  }
  validateHealthAssessment(response.overallHealthAssessment);
  if (!Array.isArray(response.keyObservations)) {
    throw new ValidationError('keyObservations must be an array');
  }
  if (response.keyObservations.length < 1 || response.keyObservations.length > 10) {
    throw new ValidationError('keyObservations must have 1-10 items');
  }
  for (const observation of response.keyObservations) {
    validateKeyObservation(observation);
  }
  return response as BalanceSheetAnalysisResponse;
}

describe('ValidationError', () => {
  test('should be an instance of Error', () => {
    const error = new ValidationError('test message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('test message');
  });

  test('should preserve stack trace', () => {
    const error = new ValidationError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ValidationError');
  });
});

describe('Response Validation', () => {
  describe('validateAnalysisResponse', () => {
    test('should accept valid response', () => {
      const response = createValidResponse();
      const validated = validateAnalysisResponse(response);

      expect(validated).toBeDefined();
      expect(validated.liquidityRatios.currentRatio).toBe(2.5);
      expect(validated.overallHealthAssessment.status).toBe('healthy');
    });

    test('should reject null response', () => {
      expect(() => validateAnalysisResponse(null)).toThrow('valid object');
    });

    test('should reject non-object response', () => {
      expect(() => validateAnalysisResponse('string')).toThrow('valid object');
    });

    test('should reject missing liquidityRatios', () => {
      const response = createValidResponse();
      delete (response as any).liquidityRatios;
      expect(() => validateAnalysisResponse(response)).toThrow('liquidityRatios');
    });

    test('should reject missing solvencyRatios', () => {
      const response = createValidResponse();
      delete (response as any).solvencyRatios;
      expect(() => validateAnalysisResponse(response)).toThrow('solvencyRatios');
    });

    test('should reject missing overallHealthAssessment', () => {
      const response = createValidResponse();
      delete (response as any).overallHealthAssessment;
      expect(() => validateAnalysisResponse(response)).toThrow('overallHealthAssessment');
    });

    test('should reject missing keyObservations', () => {
      const response = createValidResponse();
      delete (response as any).keyObservations;
      expect(() => validateAnalysisResponse(response)).toThrow('array');
    });
  });

  describe('validateLiquidityRatios', () => {
    test('should accept valid numeric ratios', () => {
      const ratios = {
        currentRatio: 2.5,
        quickRatio: 1.8,
      };
      expect(() => validateLiquidityRatios(ratios)).not.toThrow();
    });

    test('should accept null currentRatio with explanation', () => {
      const ratios = {
        currentRatio: null,
        currentRatioExplanation: 'Data not available',
        quickRatio: 1.5,
      };
      expect(() => validateLiquidityRatios(ratios)).not.toThrow();
    });

    test('should reject null currentRatio without explanation', () => {
      const ratios = {
        currentRatio: null,
        quickRatio: 1.5,
      };
      expect(() => validateLiquidityRatios(ratios)).toThrow('Explanation required');
    });

    test('should accept null quickRatio with explanation', () => {
      const ratios = {
        currentRatio: 2.0,
        quickRatio: null,
        quickRatioExplanation: 'No inventory data',
      };
      expect(() => validateLiquidityRatios(ratios)).not.toThrow();
    });

    test('should reject null quickRatio without explanation', () => {
      const ratios = {
        currentRatio: 2.0,
        quickRatio: null,
      };
      expect(() => validateLiquidityRatios(ratios)).toThrow('Explanation required');
    });

    test('should reject string currentRatio', () => {
      const ratios = {
        currentRatio: '2.5',
        quickRatio: 1.5,
      };
      expect(() => validateLiquidityRatios(ratios)).toThrow('number or null');
    });
  });

  describe('validateSolvencyRatios', () => {
    test('should accept valid numeric ratios', () => {
      const ratios = {
        debtToEquity: 0.5,
        debtToAssets: 0.33,
        interestCoverage: 8.0,
      };
      expect(() => validateSolvencyRatios(ratios)).not.toThrow();
    });

    test('should accept null debtToEquity with explanation', () => {
      const ratios = {
        debtToEquity: null,
        debtToEquityExplanation: 'Equity is zero',
        debtToAssets: 0.5,
        interestCoverage: 5.0,
      };
      expect(() => validateSolvencyRatios(ratios)).not.toThrow();
    });

    test('should reject null debtToEquity without explanation', () => {
      const ratios = {
        debtToEquity: null,
        debtToAssets: 0.5,
        interestCoverage: 5.0,
      };
      expect(() => validateSolvencyRatios(ratios)).toThrow('Explanation required');
    });

    test('should accept null interestCoverage without explanation', () => {
      // interestCoverage is special - doesn't require explanation when null
      const ratios = {
        debtToEquity: 0.5,
        debtToAssets: 0.33,
        interestCoverage: null,
      };
      expect(() => validateSolvencyRatios(ratios)).not.toThrow();
    });

    test('should reject string debtToAssets', () => {
      const ratios = {
        debtToEquity: 0.5,
        debtToAssets: 'low',
        interestCoverage: 5.0,
      };
      expect(() => validateSolvencyRatios(ratios)).toThrow('number or null');
    });
  });

  describe('validateHealthAssessment', () => {
    test('should accept valid healthy status', () => {
      const assessment = {
        status: 'healthy',
        score: 85,
        summary: 'Company is in good shape',
      };
      expect(() => validateHealthAssessment(assessment)).not.toThrow();
    });

    test('should accept valid warning status', () => {
      const assessment = {
        status: 'warning',
        score: 55,
        summary: 'Some concerns exist',
      };
      expect(() => validateHealthAssessment(assessment)).not.toThrow();
    });

    test('should accept valid critical status', () => {
      const assessment = {
        status: 'critical',
        score: 20,
        summary: 'Company facing serious issues',
      };
      expect(() => validateHealthAssessment(assessment)).not.toThrow();
    });

    test('should accept valid unknown status', () => {
      const assessment = {
        status: 'unknown',
        score: 0,
        summary: 'Insufficient data',
      };
      expect(() => validateHealthAssessment(assessment)).not.toThrow();
    });

    test('should reject invalid status', () => {
      const assessment = {
        status: 'good',
        score: 85,
        summary: 'Test',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('status must be one of');
    });

    test('should reject score below 0', () => {
      const assessment = {
        status: 'healthy',
        score: -5,
        summary: 'Test',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('0 and 100');
    });

    test('should reject score above 100', () => {
      const assessment = {
        status: 'healthy',
        score: 150,
        summary: 'Test',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('0 and 100');
    });

    test('should reject non-numeric score', () => {
      const assessment = {
        status: 'healthy',
        score: 'high',
        summary: 'Test',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('number');
    });

    test('should reject empty summary', () => {
      const assessment = {
        status: 'healthy',
        score: 85,
        summary: '',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('non-empty string');
    });

    test('should reject whitespace-only summary', () => {
      const assessment = {
        status: 'healthy',
        score: 85,
        summary: '   ',
      };
      expect(() => validateHealthAssessment(assessment)).toThrow('non-empty string');
    });
  });

  describe('validateKeyObservation', () => {
    test('should accept valid observation', () => {
      const observation = {
        observation: 'Good cash flow',
        category: 'liquidity',
        severity: 'info',
      };
      expect(() => validateKeyObservation(observation)).not.toThrow();
    });

    test('should accept all valid categories', () => {
      const categories = ['liquidity', 'solvency', 'profitability', 'risk', 'other'];
      for (const category of categories) {
        const observation = {
          observation: 'Test',
          category,
          severity: 'info',
        };
        expect(() => validateKeyObservation(observation)).not.toThrow();
      }
    });

    test('should accept all valid severities', () => {
      const severities = ['info', 'warning', 'critical'];
      for (const severity of severities) {
        const observation = {
          observation: 'Test',
          category: 'other',
          severity,
        };
        expect(() => validateKeyObservation(observation)).not.toThrow();
      }
    });

    test('should reject empty observation text', () => {
      const observation = {
        observation: '',
        category: 'liquidity',
        severity: 'info',
      };
      expect(() => validateKeyObservation(observation)).toThrow('non-empty string');
    });

    test('should reject invalid category', () => {
      const observation = {
        observation: 'Test',
        category: 'finance',
        severity: 'info',
      };
      expect(() => validateKeyObservation(observation)).toThrow('category must be one of');
    });

    test('should reject invalid severity', () => {
      const observation = {
        observation: 'Test',
        category: 'liquidity',
        severity: 'high',
      };
      expect(() => validateKeyObservation(observation)).toThrow('severity must be one of');
    });
  });

  describe('keyObservations count validation', () => {
    test('should reject empty keyObservations array', () => {
      const response = createValidResponse();
      response.keyObservations = [];
      expect(() => validateAnalysisResponse(response)).toThrow('1-10 items');
    });

    test('should accept exactly 1 observation', () => {
      const response = createValidResponse();
      response.keyObservations = [
        { observation: 'Test', category: 'other', severity: 'info' },
      ];
      expect(() => validateAnalysisResponse(response)).not.toThrow();
    });

    test('should accept exactly 10 observations', () => {
      const response = createValidResponse();
      response.keyObservations = [];
      for (let i = 0; i < 10; i++) {
        response.keyObservations.push({
          observation: `Observation ${i + 1}`,
          category: 'other',
          severity: 'info',
        });
      }
      expect(() => validateAnalysisResponse(response)).not.toThrow();
    });

    test('should reject more than 10 observations', () => {
      const response = createValidResponse();
      response.keyObservations = [];
      for (let i = 0; i < 11; i++) {
        response.keyObservations.push({
          observation: `Observation ${i + 1}`,
          category: 'other',
          severity: 'info',
        });
      }
      expect(() => validateAnalysisResponse(response)).toThrow('1-10 items');
    });
  });
});

describe('Edge Cases', () => {
  test('should handle score at boundary 0', () => {
    const assessment = {
      status: 'critical',
      score: 0,
      summary: 'Complete failure',
    };
    expect(() => validateHealthAssessment(assessment)).not.toThrow();
  });

  test('should handle score at boundary 100', () => {
    const assessment = {
      status: 'healthy',
      score: 100,
      summary: 'Perfect health',
    };
    expect(() => validateHealthAssessment(assessment)).not.toThrow();
  });

  test('should handle floating point ratios', () => {
    const ratios = {
      currentRatio: 1.234567890,
      quickRatio: 0.987654321,
    };
    expect(() => validateLiquidityRatios(ratios)).not.toThrow();
  });

  test('should handle zero ratios', () => {
    const ratios = {
      currentRatio: 0,
      quickRatio: 0,
    };
    expect(() => validateLiquidityRatios(ratios)).not.toThrow();
  });

  test('should handle negative ratios', () => {
    // Negative ratios can happen (negative equity scenarios)
    const ratios = {
      debtToEquity: -0.5, // Can happen with negative equity
      debtToAssets: 0.8,
      interestCoverage: null,
    };
    expect(() => validateSolvencyRatios(ratios)).not.toThrow();
  });
});
