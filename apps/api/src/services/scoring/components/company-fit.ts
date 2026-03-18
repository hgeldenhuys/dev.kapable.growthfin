/**
 * Company Fit Component (30 points)
 * Evaluates how well the company matches the Ideal Customer Profile (ICP)
 */

import type { CrmAccount } from '@agios/db/schema';
import type { ComponentScore } from '../types';
import { getICPConfig } from '../icp-config';

/**
 * Score company fit against ICP
 *
 * Scoring breakdown:
 * - Industry match: 10 points
 * - Company size in target range: 10 points
 * - Revenue in target range: 10 points
 *
 * @param account - CRM account (may be null)
 * @returns Component score with details
 */
export function scoreCompanyFit(account: CrmAccount | null): ComponentScore {
  const details: ComponentScore['details'] = {};
  let score = 0;

  const icp = getICPConfig();

  // Industry match (10 points)
  const industry = (account?.industry || '').toLowerCase();
  const industryMatches = icp.targetIndustries.some((targetIndustry) =>
    industry.includes(targetIndustry.toLowerCase())
  );

  if (industryMatches && industry) {
    score += 10;
    details.industry = {
      points: 10,
      maxPoints: 10,
      value: account?.industry,
      reason: 'Industry matches ICP target',
    };
  } else {
    details.industry = {
      points: 0,
      maxPoints: 10,
      value: account?.industry || null,
      reason: industry
        ? 'Industry does not match ICP'
        : 'No industry information',
    };
  }

  // Company size (employee count) (10 points)
  const employeeCount = account?.employeeCount;
  const sizeInRange =
    employeeCount !== null &&
    employeeCount !== undefined &&
    employeeCount >= icp.targetCompanySizeMin &&
    employeeCount <= icp.targetCompanySizeMax;

  if (sizeInRange) {
    score += 10;
    details.companySize = {
      points: 10,
      maxPoints: 10,
      value: employeeCount,
      reason: `Company size (${employeeCount} employees) within ICP range (${icp.targetCompanySizeMin}-${icp.targetCompanySizeMax})`,
    };
  } else {
    details.companySize = {
      points: 0,
      maxPoints: 10,
      value: employeeCount ?? null,
      reason: employeeCount
        ? `Company size (${employeeCount}) outside ICP range`
        : 'No employee count data',
    };
  }

  // Annual revenue (10 points)
  const annualRevenue = account?.annualRevenue
    ? parseFloat(account.annualRevenue.toString())
    : null;

  const revenueInRange =
    annualRevenue !== null &&
    annualRevenue >= icp.targetRevenueMin &&
    annualRevenue <= icp.targetRevenueMax;

  if (revenueInRange) {
    score += 10;
    details.revenue = {
      points: 10,
      maxPoints: 10,
      value: annualRevenue,
      reason: `Annual revenue (R${(annualRevenue! / 1_000_000).toFixed(1)}M) within ICP range`,
    };
  } else {
    details.revenue = {
      points: 0,
      maxPoints: 10,
      value: annualRevenue,
      reason: annualRevenue
        ? `Revenue (R${(annualRevenue / 1_000_000).toFixed(1)}M) outside ICP range`
        : 'No revenue data',
    };
  }

  return {
    score,
    max: 30,
    details,
  };
}
