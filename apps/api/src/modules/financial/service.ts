/**
 * Financial Analysis Service
 * Handles balance sheet analysis using LLM
 */

import { llmService } from '../../lib/llm';
import type {
  BalanceSheetAnalysisResponse,
  LiquidityRatios,
  SolvencyRatios,
  HealthAssessment,
  KeyObservation,
} from './types';
import { BALANCE_SHEET_ANALYSIS_PROMPT } from './prompts';

/**
 * Validation error for malformed LLM responses
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Financial Analysis Service
 */
class FinancialAnalysisService {
  /**
   * Analyze balance sheet text using LLM
   *
   * @param text - Unstructured balance sheet text (max 50,000 chars)
   * @param projectId - Optional project ID for project-specific LLM config
   * @returns Structured analysis response
   * @throws ValidationError if LLM response is malformed
   */
  async analyzeBalanceSheet(text: string, projectId?: string): Promise<BalanceSheetAnalysisResponse> {
    console.log(`[FinancialAnalysisService] Analyzing balance sheet...`);
    console.log(`  Text length: ${text.length} chars`);
    console.log(`  Project ID: ${projectId || 'none (global config)'}`);

    try {
      // Call LLM with financial analysis prompt
      const response = await llmService.complete(
        'financial-balance-sheet-analyzer',
        [
          {
            role: 'system',
            content: BALANCE_SHEET_ANALYSIS_PROMPT,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        projectId
      );

      console.log(`  LLM response length: ${response.content.length} chars`);
      console.log(`  LLM model used: ${response.model}`);
      console.log(`  LLM provider: ${response.provider}`);

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(response.content);
      } catch (parseError) {
        console.error(`  Failed to parse LLM JSON response:`, parseError);
        console.error(`  Raw response: ${response.content.substring(0, 500)}...`);
        throw new ValidationError('LLM returned invalid JSON. Please try again with clearer balance sheet data.');
      }

      // Validate response structure
      const validatedResponse = this.validateAnalysisResponse(parsedResponse);

      console.log(`  Validation passed. Health status: ${validatedResponse.overallHealthAssessment.status}`);
      console.log(`  Key observations: ${validatedResponse.keyObservations.length} items`);

      return validatedResponse;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      console.error(`[FinancialAnalysisService] LLM error:`, error);
      throw new Error('Failed to analyze balance sheet. Please check the input text and try again.');
    }
  }

  /**
   * Validate LLM response matches expected schema
   *
   * @param response - Parsed JSON from LLM
   * @returns Validated response
   * @throws ValidationError if response is malformed
   */
  private validateAnalysisResponse(response: any): BalanceSheetAnalysisResponse {
    // Check top-level structure
    if (!response || typeof response !== 'object') {
      throw new ValidationError('Response is not a valid object');
    }

    // Validate liquidityRatios
    if (!response.liquidityRatios || typeof response.liquidityRatios !== 'object') {
      throw new ValidationError('Missing or invalid liquidityRatios');
    }
    this.validateLiquidityRatios(response.liquidityRatios);

    // Validate solvencyRatios
    if (!response.solvencyRatios || typeof response.solvencyRatios !== 'object') {
      throw new ValidationError('Missing or invalid solvencyRatios');
    }
    this.validateSolvencyRatios(response.solvencyRatios);

    // Validate overallHealthAssessment
    if (!response.overallHealthAssessment || typeof response.overallHealthAssessment !== 'object') {
      throw new ValidationError('Missing or invalid overallHealthAssessment');
    }
    this.validateHealthAssessment(response.overallHealthAssessment);

    // Validate keyObservations
    if (!Array.isArray(response.keyObservations)) {
      throw new ValidationError('keyObservations must be an array');
    }
    if (response.keyObservations.length < 1 || response.keyObservations.length > 10) {
      throw new ValidationError('keyObservations must have 1-10 items');
    }
    for (const observation of response.keyObservations) {
      this.validateKeyObservation(observation);
    }

    return response as BalanceSheetAnalysisResponse;
  }

  /**
   * Validate liquidity ratios
   */
  private validateLiquidityRatios(ratios: any): asserts ratios is LiquidityRatios {
    // currentRatio
    if (ratios.currentRatio !== null && typeof ratios.currentRatio !== 'number') {
      throw new ValidationError('currentRatio must be number or null');
    }
    if (ratios.currentRatio === null && !ratios.currentRatioExplanation) {
      throw new ValidationError('currentRatioExplanation required when currentRatio is null');
    }

    // quickRatio
    if (ratios.quickRatio !== null && typeof ratios.quickRatio !== 'number') {
      throw new ValidationError('quickRatio must be number or null');
    }
    if (ratios.quickRatio === null && !ratios.quickRatioExplanation) {
      throw new ValidationError('quickRatioExplanation required when quickRatio is null');
    }
  }

  /**
   * Validate solvency ratios
   */
  private validateSolvencyRatios(ratios: any): asserts ratios is SolvencyRatios {
    // debtToEquity
    if (ratios.debtToEquity !== null && typeof ratios.debtToEquity !== 'number') {
      throw new ValidationError('debtToEquity must be number or null');
    }
    if (ratios.debtToEquity === null && !ratios.debtToEquityExplanation) {
      throw new ValidationError('debtToEquityExplanation required when debtToEquity is null');
    }

    // debtToAssets
    if (ratios.debtToAssets !== null && typeof ratios.debtToAssets !== 'number') {
      throw new ValidationError('debtToAssets must be number or null');
    }
    if (ratios.debtToAssets === null && !ratios.debtToAssetsExplanation) {
      throw new ValidationError('debtToAssetsExplanation required when debtToAssets is null');
    }

    // interestCoverage (nullable, explanation optional since it's not always available)
    if (ratios.interestCoverage !== null && typeof ratios.interestCoverage !== 'number') {
      throw new ValidationError('interestCoverage must be number or null');
    }
  }

  /**
   * Validate health assessment
   */
  private validateHealthAssessment(assessment: any): asserts assessment is HealthAssessment {
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

  /**
   * Validate key observation
   */
  private validateKeyObservation(observation: any): asserts observation is KeyObservation {
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
}

export const financialAnalysisService = new FinancialAnalysisService();
