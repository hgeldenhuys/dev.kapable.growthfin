/**
 * Financial Analysis Types
 * Types for balance sheet analysis request and response
 */

/**
 * Balance sheet analysis request
 */
export interface BalanceSheetAnalysisRequest {
  text: string;
  projectId?: string;
}

/**
 * Health status enum
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * Observation category enum
 */
export type ObservationCategory = 'liquidity' | 'solvency' | 'profitability' | 'risk' | 'other';

/**
 * Observation severity enum
 */
export type ObservationSeverity = 'info' | 'warning' | 'critical';

/**
 * Liquidity ratios (measures short-term financial health)
 */
export interface LiquidityRatios {
  currentRatio: number | null;
  currentRatioExplanation?: string;
  quickRatio: number | null;
  quickRatioExplanation?: string;
}

/**
 * Solvency ratios (measures long-term financial health)
 */
export interface SolvencyRatios {
  debtToEquity: number | null;
  debtToEquityExplanation?: string;
  debtToAssets: number | null;
  debtToAssetsExplanation?: string;
  interestCoverage: number | null;
  interestCoverageExplanation?: string;
}

/**
 * Overall health assessment
 */
export interface HealthAssessment {
  status: HealthStatus;
  score: number; // 0-100
  summary: string;
}

/**
 * Key observation about the balance sheet
 */
export interface KeyObservation {
  observation: string;
  category: ObservationCategory;
  severity: ObservationSeverity;
}

/**
 * Complete balance sheet analysis response
 */
export interface BalanceSheetAnalysisResponse {
  liquidityRatios: LiquidityRatios;
  solvencyRatios: SolvencyRatios;
  overallHealthAssessment: HealthAssessment;
  keyObservations: KeyObservation[];
}
