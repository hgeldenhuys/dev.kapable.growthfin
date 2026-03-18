/**
 * Scoring Types
 * TypeScript interfaces for propensity scoring system
 */

import type { CrmLead, CrmContact, CrmAccount, CrmActivity } from '@agios/db/schema';

/**
 * Component score with detailed breakdown
 */
export interface ComponentScore {
  score: number;
  max: number;
  details: {
    [key: string]: {
      points: number;
      maxPoints: number;
      value?: any;
      reason: string;
    };
  };
}

/**
 * Full score breakdown with all components
 */
export interface ScoreBreakdown {
  total: number;
  components: {
    contactQuality: ComponentScore;
    companyFit: ComponentScore;
    engagement: ComponentScore;
    timing: ComponentScore;
  };
}

/**
 * Data required for scoring a lead
 */
export interface ScoringData {
  lead: CrmLead | null;
  contact: CrmContact | null;
  account: CrmAccount | null;
  activities: CrmActivity[];
}

/**
 * Ideal Customer Profile configuration
 */
export interface ICPConfig {
  targetIndustries: string[];
  targetCompanySizeMin: number;
  targetCompanySizeMax: number;
  targetRevenueMin: number; // in ZAR
  targetRevenueMax: number; // in ZAR
}
