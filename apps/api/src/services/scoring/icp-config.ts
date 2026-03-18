/**
 * Ideal Customer Profile (ICP) Configuration
 * Define target customer characteristics for company fit scoring
 */

import type { ICPConfig } from './types';

/**
 * Default ICP configuration
 * Can be overridden per workspace in future enhancements
 */
export const DEFAULT_ICP: ICPConfig = {
  // Target industries (SaaS/Tech focused for MVP)
  targetIndustries: [
    'software',
    'saas',
    'technology',
    'it services',
    'internet',
    'fintech',
    'e-commerce',
    'telecommunications',
  ],

  // Target company size (employees)
  targetCompanySizeMin: 10,
  targetCompanySizeMax: 1000,

  // Target annual revenue (ZAR)
  targetRevenueMin: 5_000_000, // R5M
  targetRevenueMax: 100_000_000, // R100M
};

/**
 * Get ICP configuration for a workspace
 * @param workspaceId - Workspace ID (future enhancement: load from DB)
 * @returns ICP configuration
 */
export function getICPConfig(workspaceId?: string): ICPConfig {
  // TODO: In future, load custom ICP from database per workspace
  return DEFAULT_ICP;
}
