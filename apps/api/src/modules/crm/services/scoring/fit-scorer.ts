/**
 * Fit Score Calculator
 * Calculates how well a lead matches the Ideal Customer Profile (ICP)
 * Epic 5 - Sprint 2: US-LEAD-SCORE-005
 */

import type { CrmLead, CrmAccount, CrmContact } from '@agios/db';

export interface FitCriteria {
  companySize?: {
    min: number;
    max: number;
    weight: number; // 0-1 (percentage of total fit score)
  };
  industries?: string[];
  industryWeight?: number;
  revenue?: {
    min: number;
    max: number;
  };
  revenueWeight?: number;
  countries?: string[];
  geoWeight?: number;
  targetRoles?: string[];
  roleWeight?: number;
}

export interface FitScoreResult {
  score: number; // 0-100
  breakdown: Record<string, number>; // Points per criterion
  matchedCriteria: string[]; // Which criteria matched
  missedCriteria: string[]; // Which criteria didn't match
}

/**
 * Default fit criteria weights
 * Based on PRD specifications
 */
export const DEFAULT_FIT_WEIGHTS = {
  companySize: 0.3, // 30 points
  industry: 0.25, // 25 points
  revenue: 0.2, // 20 points
  geography: 0.1, // 10 points
  role: 0.15, // 15 points
};

/**
 * Parse a revenue string (e.g. "R1-5B", "$10M", "1000000") to a number.
 * Best-effort: extracts the lower-bound number, returns null on failure.
 */
export function parseRevenueString(value: string): number | null {
  if (!value || typeof value !== 'string') return null;

  // Strip currency symbols and whitespace
  let cleaned = value.replace(/[R$€£,\s]/g, '');

  // Handle range like "1-5B" — take lower bound
  const rangeParts = cleaned.split('-');
  cleaned = rangeParts[0];

  // Extract numeric part and multiplier suffix
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*(B|BN|BILLION|M|MN|MILLION|K|THOUSAND)?$/i);
  if (!match) {
    // Try plain number
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  let num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();

  if (suffix.startsWith('B')) num *= 1_000_000_000;
  else if (suffix.startsWith('M')) num *= 1_000_000;
  else if (suffix.startsWith('K') || suffix.startsWith('T')) num *= 1_000;

  return num;
}

/**
 * Extract a country name from a location/address string.
 * Checks for known country names at the end of comma-separated parts.
 */
function extractCountryFromString(value: string): string | null {
  if (!value || typeof value !== 'string') return null;

  const knownCountries = [
    'south africa', 'united states', 'united kingdom', 'canada', 'australia',
    'germany', 'france', 'india', 'brazil', 'nigeria', 'kenya', 'egypt',
    'netherlands', 'singapore', 'japan', 'china', 'ireland', 'new zealand',
    'united arab emirates', 'saudi arabia', 'israel', 'switzerland', 'sweden',
    'norway', 'denmark', 'finland', 'portugal', 'spain', 'italy', 'belgium',
  ];

  const lower = value.toLowerCase().trim();

  // Check if the whole string is a country
  for (const country of knownCountries) {
    if (lower === country) return value.trim();
  }

  // Check last comma-separated segment (common in "City, Country" format)
  const parts = value.split(',');
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim().toLowerCase();
    for (const country of knownCountries) {
      if (part === country) return parts[i].trim();
    }
  }

  // Check if any known country appears in the string
  for (const country of knownCountries) {
    if (lower.includes(country)) {
      // Return properly cased version
      return country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

/**
 * Calculate fit score based on lead, account, and contact data
 * @param lead - CRM lead record
 * @param account - CRM account record (optional)
 * @param contact - CRM contact record (optional)
 * @param criteria - Fit criteria configuration
 * @param customFields - Enrichment custom fields from lead (optional fallback)
 * @returns Fit score result with breakdown
 */
export function calculateFitScore(
  lead: CrmLead,
  account: CrmAccount | null,
  contact: CrmContact | null,
  criteria: FitCriteria,
  customFields?: Record<string, any>
): FitScoreResult {
  let totalScore = 0;
  const breakdown: Record<string, number> = {};
  const matchedCriteria: string[] = [];
  const missedCriteria: string[] = [];

  // 1. Company Size Match (0-30 points)
  let employeeCount = account?.employeeCount
    ?? (customFields?.employeeCount != null ? parseInt(String(customFields.employeeCount), 10) || null : null);

  // Also check companySize string like "51-200 employees" — extract lower bound
  if (employeeCount == null && customFields?.companySize) {
    const sizeStr = String(customFields.companySize);
    const match = sizeStr.match(/(\d+)/);
    if (match) employeeCount = parseInt(match[1], 10) || null;
  }

  if (criteria.companySize && employeeCount) {
    const { score: sizeScore, matched } = calculateSizeMatch(
      employeeCount,
      criteria.companySize.min,
      criteria.companySize.max
    );

    const points = Math.round(sizeScore * 30);
    breakdown.company_size_match = points;
    totalScore += points;

    if (matched) {
      matchedCriteria.push('company_size');
    } else {
      missedCriteria.push('company_size');
    }
  } else if (criteria.companySize) {
    missedCriteria.push('company_size');
  }

  // 2. Industry Match (0-25 points)
  const industry = account?.industry || (customFields?.industry as string) || null;

  if (criteria.industries && criteria.industries.length > 0 && industry) {
    const industryLower = industry.toLowerCase();
    const matched = criteria.industries.some((ind) => {
      const indLower = ind.toLowerCase();
      // Bidirectional match: "Banking and Financial Services" matches "Financial Services"
      // and "Finance" matches "Financial" via word-stem overlap
      return industryLower.includes(indLower) || indLower.includes(industryLower);
    });

    if (matched) {
      breakdown.industry_match = 25;
      totalScore += 25;
      matchedCriteria.push('industry');
    } else {
      missedCriteria.push('industry');
    }
  } else if (criteria.industries) {
    missedCriteria.push('industry');
  }

  // 3. Revenue Match (0-20 points)
  let annualRevenue: number | null = account?.annualRevenue ? parseFloat(String(account.annualRevenue)) : null;
  if ((annualRevenue == null || isNaN(annualRevenue)) && customFields?.annualRevenue != null) {
    const raw = customFields.annualRevenue;
    annualRevenue = typeof raw === 'number' ? raw : parseRevenueString(String(raw));
  }
  if (annualRevenue != null && isNaN(annualRevenue)) annualRevenue = null;

  if (criteria.revenue && annualRevenue) {
    const { score: revenueScore, matched } = calculateRevenueMatch(
      annualRevenue,
      criteria.revenue.min,
      criteria.revenue.max
    );

    const points = Math.round(revenueScore * 20);
    breakdown.revenue_match = points;
    totalScore += points;

    if (matched) {
      matchedCriteria.push('revenue');
    } else {
      missedCriteria.push('revenue');
    }
  } else if (criteria.revenue) {
    missedCriteria.push('revenue');
  }

  // 4. Geography Match (0-10 points)
  if (criteria.countries && criteria.countries.length > 0) {
    let country: string | null = account?.billingCountry || lead.country || null;

    // Fallback: extract country from customFields location/address data
    if (!country && customFields) {
      country = extractCountryFromString(customFields.location as string)
        || extractCountryFromString(customFields.address as string)
        || extractCountryFromString(customFields.companyAddress as string)
        || extractCountryFromString(customFields.country as string)
        || extractCountryFromString(customFields.headquarters as string)
        || null;
    }

    if (country) {
      const matched = criteria.countries.some((c) => c.toLowerCase() === country!.toLowerCase());

      if (matched) {
        breakdown.geo_match = 10;
        totalScore += 10;
        matchedCriteria.push('geography');
      } else {
        missedCriteria.push('geography');
      }
    } else {
      missedCriteria.push('geography');
    }
  }

  // 5. Job Title/Role Match (0-15 points)
  const title = contact?.title || lead.title || (customFields?.title as string) || null;

  if (criteria.targetRoles && criteria.targetRoles.length > 0 && title) {
    const matched = matchesTargetRole(title, criteria.targetRoles);

    if (matched) {
      breakdown.role_match = 15;
      totalScore += 15;
      matchedCriteria.push('role');
    } else {
      missedCriteria.push('role');
    }
  } else if (criteria.targetRoles) {
    missedCriteria.push('role');
  }

  // Cap at 100
  const finalScore = Math.min(totalScore, 100);

  return {
    score: finalScore,
    breakdown,
    matchedCriteria,
    missedCriteria,
  };
}

/**
 * Calculate company size match score
 * @param actual - Actual employee count
 * @param min - Minimum ideal size
 * @param max - Maximum ideal size
 * @param weight - Weight factor
 * @returns Score (0-1) and whether it matched
 */
function calculateSizeMatch(
  actual: number,
  min: number,
  max: number,
  weight: number = 1
): { score: number; matched: boolean } {
  // Perfect match if within range
  if (actual >= min && actual <= max) {
    return { score: 1.0 * weight, matched: true };
  }

  // Partial match based on distance from range
  let score = 0;
  if (actual < min) {
    // Below range - decay based on how far below
    score = Math.max(0, 1 - (min - actual) / min);
  } else if (actual > max) {
    // Above range - decay based on how far above
    score = Math.max(0, 1 - (actual - max) / max);
  }

  return {
    score: score * weight,
    matched: score > 0.7, // Consider matched if >70% score
  };
}

/**
 * Calculate revenue match score
 * @param actual - Actual annual revenue
 * @param min - Minimum ideal revenue
 * @param max - Maximum ideal revenue
 * @returns Score (0-1) and whether it matched
 */
function calculateRevenueMatch(
  actual: number,
  min: number,
  max: number
): { score: number; matched: boolean } {
  // Perfect match if within range
  if (actual >= min && actual <= max) {
    return { score: 1.0, matched: true };
  }

  // Partial match based on distance from range
  let score = 0;
  if (actual < min) {
    // Below range
    score = Math.max(0, 1 - (min - actual) / min);
  } else if (actual > max) {
    // Above range - less penalty than below (more revenue often better)
    score = Math.max(0, 1 - (actual - max) / (max * 2));
  }

  return {
    score,
    matched: score > 0.7,
  };
}

/**
 * Check if job title matches target roles
 * @param title - Job title from contact
 * @param targetRoles - List of target role keywords
 * @returns Whether title matches any target role
 */
function matchesTargetRole(title: string, targetRoles: string[]): boolean {
  const normalizedTitle = title.toLowerCase();

  return targetRoles.some((role) => {
    const normalizedRole = role.toLowerCase();
    return normalizedTitle.includes(normalizedRole);
  });
}

/**
 * Get fit score tier
 * @param score - Fit score (0-100)
 * @returns Tier label
 */
export function getFitTier(score: number): string {
  if (score >= 80) return 'Excellent Fit';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Moderate Fit';
  if (score >= 20) return 'Poor Fit';
  return 'No Fit';
}

/**
 * Generate improvement suggestions based on missed criteria
 * @param missedCriteria - List of criteria that didn't match
 * @returns Array of actionable suggestions
 */
export function generateFitSuggestions(missedCriteria: string[]): string[] {
  const suggestions: string[] = [];

  const suggestionMap: Record<string, string> = {
    company_size: 'Company size outside target range - consider adjusting ICP or qualifying lead',
    industry: 'Industry does not match target - verify if lead is in adjacent/relevant industry',
    revenue: 'Revenue outside target range - assess if lead has growth potential',
    geography: 'Located outside target regions - check if remote sales model applies',
    role: 'Contact role does not match target - identify and engage decision makers',
  };

  for (const criterion of missedCriteria) {
    if (suggestionMap[criterion]) {
      suggestions.push(suggestionMap[criterion]);
    }
  }

  return suggestions;
}
