/**
 * Scoring Service - Public API
 * Export main scoring functions and types
 */

export { calculatePropensityScore, calculatePropensityScoresBulk } from './propensity-score';
export { scoreContactQuality } from './components/contact-quality';
export { scoreCompanyFit } from './components/company-fit';
export { scoreEngagement } from './components/engagement';
export { scoreTimingReadiness } from './components/timing';
export { getICPConfig, DEFAULT_ICP } from './icp-config';
export type { ScoreBreakdown, ComponentScore, ScoringData, ICPConfig } from './types';
