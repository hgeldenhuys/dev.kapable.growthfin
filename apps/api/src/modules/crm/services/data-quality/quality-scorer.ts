/**
 * Data Quality Score Calculator
 * Calculates overall quality score based on completeness and validity
 * Epic 5 - Sprint 2: US-LEAD-QUALITY-006
 */

import type { CrmLead, CrmAccount, CrmContact } from '@agios/db';
import {
  validateFields,
  validateNamePresence,
  CUSTOM_VALIDATIONS,
  REQUIRED_FIELDS,
  type ValidationResult,
} from './validators';

export interface QualityScoreResult {
  overallScore: number; // 0-100
  completenessScore: number; // 0-100
  validityScore: number; // 0-100
  issueCount: number;
  criticalIssues: string[];
  validationResults: Record<string, ValidationResult>;
}

export interface QualityIssue {
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

/**
 * Trackable fields for completeness calculation
 * Core fields that impact quality score
 */
const TRACKABLE_FIELDS = {
  lead: ['status', 'lifecycle_stage', 'source', 'country'],
  contact: ['first_name', 'last_name', 'email', 'phone', 'title', 'company'],
  account: ['name', 'industry', 'employee_count', 'annual_revenue', 'website', 'country'],
};

/**
 * Calculate data quality score for a lead
 * @param lead - CRM lead record
 * @param contact - CRM contact record (optional)
 * @param account - CRM account record (optional)
 * @returns Quality score result
 */
export function calculateQualityScore(
  lead: CrmLead,
  contact: CrmContact | null,
  account: CrmAccount | null
): QualityScoreResult {
  // Combine all data for validation
  const combinedData = {
    ...lead,
    ...contact,
    ...account,
  };

  // Run field validations
  const validationResults = validateFields(combinedData);

  // Validate name presence separately
  if (contact) {
    validationResults['name_presence'] = validateNamePresence({
      first_name: contact.firstName || undefined,
      last_name: contact.lastName || undefined,
    });
  }

  // Custom validations
  if (account?.employeeCount) {
    validationResults['employee_count'] = CUSTOM_VALIDATIONS.employee_count(account.employeeCount);
  }
  if (account?.annualRevenue) {
    validationResults['annual_revenue'] = CUSTOM_VALIDATIONS.annual_revenue(
      parseFloat(account.annualRevenue as any)
    );
  }

  // Calculate completeness score (50% weight)
  const completenessScore = calculateCompleteness(lead, contact, account);

  // Calculate validity score (50% weight)
  const validityScore = calculateValidity(validationResults);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(completenessScore * 0.5 + validityScore * 0.5);

  // Identify issues
  const { issues, criticalIssues } = categorizeIssues(validationResults, lead, contact, account);

  return {
    overallScore,
    completenessScore: Math.round(completenessScore),
    validityScore: Math.round(validityScore),
    issueCount: issues.length,
    criticalIssues,
    validationResults,
  };
}

/**
 * Calculate completeness score
 * Based on percentage of fields filled
 * @param lead - Lead record
 * @param contact - Contact record
 * @param account - Account record
 * @returns Completeness score (0-100)
 */
function calculateCompleteness(
  lead: CrmLead,
  contact: CrmContact | null,
  account: CrmAccount | null
): number {
  let totalWeight = 0;
  let filledWeight = 0;

  // Check lead fields (weight: 2 for required, 1 for optional)
  for (const field of TRACKABLE_FIELDS.lead) {
    const isRequired = REQUIRED_FIELDS.lead.includes(field);
    const weight = isRequired ? 2 : 1;
    totalWeight += weight;

    const value = (lead as any)[field];
    if (value !== null && value !== undefined && value !== '') {
      filledWeight += weight;
    }
  }

  // Check contact fields
  if (contact) {
    for (const field of TRACKABLE_FIELDS.contact) {
      const isRequired = REQUIRED_FIELDS.contact.includes(field);
      const weight = isRequired ? 2 : 1;
      totalWeight += weight;

      const value = (contact as any)[field];
      if (value !== null && value !== undefined && value !== '') {
        filledWeight += weight;
      }
    }
  }

  // Check account fields
  if (account) {
    for (const field of TRACKABLE_FIELDS.account) {
      const isRequired = REQUIRED_FIELDS.account.includes(field);
      const weight = isRequired ? 2 : 1;
      totalWeight += weight;

      const value = (account as any)[field];
      if (value !== null && value !== undefined && value !== '') {
        filledWeight += weight;
      }
    }
  }

  // Calculate percentage
  const completenessScore = totalWeight > 0 ? (filledWeight / totalWeight) * 100 : 0;

  return completenessScore;
}

/**
 * Calculate validity score
 * Based on percentage of fields with valid data
 * @param validationResults - Validation results for all fields
 * @returns Validity score (0-100)
 */
function calculateValidity(validationResults: Record<string, ValidationResult>): number {
  let totalChecks = 0;
  let validChecks = 0;

  for (const result of Object.values(validationResults)) {
    totalChecks++;
    if (result.valid) {
      validChecks++;
    }
  }

  if (totalChecks === 0) return 100; // No fields to validate

  const validityScore = (validChecks / totalChecks) * 100;
  return validityScore;
}

/**
 * Categorize issues by severity
 * @param validationResults - Validation results
 * @param lead - Lead record
 * @param contact - Contact record
 * @param account - Account record
 * @returns Categorized issues
 */
function categorizeIssues(
  validationResults: Record<string, ValidationResult>,
  lead: CrmLead,
  contact: CrmContact | null,
  account: CrmAccount | null
): {
  issues: QualityIssue[];
  criticalIssues: string[];
} {
  const issues: QualityIssue[] = [];
  const criticalIssues: string[] = [];

  // Check required fields first (critical)
  for (const field of REQUIRED_FIELDS.contact) {
    const result = validationResults[field];
    if (result && !result.valid) {
      const issue: QualityIssue = {
        field,
        severity: 'critical',
        issue: result.reason || `Missing required field: ${field}`,
        suggestion: result.suggestion || `Add ${field} to enable outreach`,
      };
      issues.push(issue);
      criticalIssues.push(issue.issue);
    }
  }

  // Check email validity (high severity)
  const emailResult = validationResults['email'];
  if (emailResult && !emailResult.valid) {
    const issue: QualityIssue = {
      field: 'email',
      severity: 'high',
      issue: emailResult.reason || 'Invalid email',
      suggestion: emailResult.suggestion || 'Update to valid email address',
    };
    issues.push(issue);
    if (emailResult.reason?.includes('disposable')) {
      criticalIssues.push(issue.issue);
    }
  }

  // Check phone validity (medium severity)
  const phoneResult = validationResults['phone'];
  if (phoneResult && !phoneResult.valid) {
    issues.push({
      field: 'phone',
      severity: 'medium',
      issue: phoneResult.reason || 'Invalid phone',
      suggestion: phoneResult.suggestion || 'Update to valid phone number',
    });
  }

  // Check missing enrichment data (medium severity)
  if (account) {
    if (!account.industry) {
      issues.push({
        field: 'industry',
        severity: 'medium',
        issue: 'Missing industry',
        suggestion: 'Enrich from company data or public sources',
      });
    }

    if (!account.employeeCount) {
      issues.push({
        field: 'employee_count',
        severity: 'medium',
        issue: 'Missing employee count',
        suggestion: 'Enrich from LinkedIn or company website',
      });
    }
  }

  // Check missing optional fields (low severity)
  if (contact && !contact.title) {
    issues.push({
      field: 'title',
      severity: 'low',
      issue: 'Missing job title',
      suggestion: 'Add title for better targeting',
    });
  }

  return { issues, criticalIssues };
}

/**
 * Get quality score tier
 * @param score - Quality score (0-100)
 * @returns Tier with color
 */
export function getQualityTier(
  score: number
): {
  tier: string;
  color: string; // Hex color for UI
  emoji: string;
} {
  if (score >= 80) {
    return { tier: 'Good', color: '#10b981', emoji: '🟢' }; // Green
  }
  if (score >= 50) {
    return { tier: 'Fair', color: '#f59e0b', emoji: '🟡' }; // Yellow
  }
  return { tier: 'Poor', color: '#ef4444', emoji: '🔴' }; // Red
}

/**
 * Generate quality improvement suggestions
 * @param qualityResult - Quality score result
 * @returns Array of actionable suggestions
 */
export function generateQualitySuggestions(qualityResult: QualityScoreResult): string[] {
  const suggestions: string[] = [];

  // Critical issues first
  if (qualityResult.criticalIssues.length > 0) {
    suggestions.push(`Address ${qualityResult.criticalIssues.length} critical issues immediately`);
  }

  // Completeness suggestions
  if (qualityResult.completenessScore < 50) {
    suggestions.push('Fill in missing fields to improve lead quality');
  }

  // Validity suggestions
  if (qualityResult.validityScore < 80) {
    suggestions.push('Correct invalid field values (email, phone, etc.)');
  }

  // Enrichment suggestions
  if (qualityResult.completenessScore < 70) {
    suggestions.push('Run data enrichment to fill missing company information');
  }

  // Overall improvement
  if (qualityResult.overallScore < 60) {
    suggestions.push('Consider re-qualifying this lead or marking as low priority');
  }

  return suggestions;
}

/**
 * Calculate workspace-level quality metrics
 * @param leadQualities - Array of quality results
 * @returns Workspace summary
 */
export function calculateWorkspaceQuality(leadQualities: QualityScoreResult[]) {
  if (leadQualities.length === 0) {
    return {
      avgQualityScore: 0,
      leadsWithIssues: 0,
      criticalIssues: 0,
      qualityDistribution: { good: 0, fair: 0, poor: 0 },
    };
  }

  const totalScore = leadQualities.reduce((sum, q) => sum + q.overallScore, 0);
  const avgQualityScore = Math.round(totalScore / leadQualities.length);

  const leadsWithIssues = leadQualities.filter((q) => q.issueCount > 0).length;
  const criticalIssues = leadQualities.reduce((sum, q) => sum + q.criticalIssues.length, 0);

  const qualityDistribution = {
    good: leadQualities.filter((q) => q.overallScore >= 80).length,
    fair: leadQualities.filter((q) => q.overallScore >= 50 && q.overallScore < 80).length,
    poor: leadQualities.filter((q) => q.overallScore < 50).length,
  };

  return {
    avgQualityScore,
    leadsWithIssues,
    criticalIssues,
    qualityDistribution,
  };
}
