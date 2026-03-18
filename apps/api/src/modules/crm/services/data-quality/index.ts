/**
 * Data Quality Service - Orchestrator
 * Coordinates data validation and quality scoring
 * Epic 5 - Sprint 2: US-LEAD-QUALITY-006
 */

import {
  db,
  leadDataQuality,
  crmLeads,
  crmContacts,
  crmAccounts,
  type LeadDataQuality,
  type NewLeadDataQuality,
} from '@agios/db';
import { eq, and, desc, lt } from 'drizzle-orm';
import {
  calculateQualityScore,
  calculateWorkspaceQuality,
  type QualityScoreResult,
} from './quality-scorer';

export interface ValidateLeadsOptions {
  leadIds: string[];
  workspaceId: string;
  saveToDatabase?: boolean; // Default: true
}

export interface WorkspaceQualitySummary {
  workspaceId: string;
  avgQualityScore: number;
  leadsWithIssues: number;
  criticalIssues: number;
  leadsNeedingEnrichment: number;
  issuesByType: Record<string, number>;
  lastValidatedAt: Date;
}

/**
 * Validate data quality for multiple leads
 * Main entry point for quality validation
 * @param options - Validation options
 * @returns Array of quality results
 */
export async function validateLeadData(
  options: ValidateLeadsOptions
): Promise<QualityScoreResult[]> {
  const { leadIds, workspaceId, saveToDatabase = true } = options;

  const results: QualityScoreResult[] = [];

  for (const leadId of leadIds) {
    // Fetch lead data with related entities
    const leadData = await fetchLeadData(leadId, workspaceId);

    if (!leadData) {
      console.warn(`[validateLeadData] Lead ${leadId} not found`);
      continue;
    }

    // Calculate quality score
    const qualityResult = calculateQualityScore(
      leadData.lead,
      leadData.contact,
      leadData.account
    );

    results.push(qualityResult);

    // Save to database if requested
    if (saveToDatabase) {
      await saveLeadQuality(leadId, workspaceId, qualityResult);
    }
  }

  return results;
}

/**
 * Fetch lead data with all related entities
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @returns Lead data with relations
 */
async function fetchLeadData(leadId: string, workspaceId: string) {
  // Fetch lead
  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1);

  if (!lead) return null;

  // Fetch contact
  const contact = lead.contactId
    ? await db.select().from(crmContacts).where(eq(crmContacts.id, lead.contactId)).limit(1)
    : [];

  // Fetch account
  const account = lead.accountId
    ? await db.select().from(crmAccounts).where(eq(crmAccounts.id, lead.accountId)).limit(1)
    : [];

  return {
    lead,
    contact: contact[0] || null,
    account: account[0] || null,
  };
}

/**
 * Save or update lead quality in database
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @param qualityResult - Quality score result
 */
async function saveLeadQuality(
  leadId: string,
  workspaceId: string,
  qualityResult: QualityScoreResult
): Promise<void> {
  const { overallScore, completenessScore, validityScore, issueCount, criticalIssues, validationResults } =
    qualityResult;

  // Check if quality record already exists
  const [existingQuality] = await db
    .select()
    .from(leadDataQuality)
    .where(eq(leadDataQuality.leadId, leadId))
    .limit(1);

  if (existingQuality) {
    // Update existing record
    await db
      .update(leadDataQuality)
      .set({
        overallScore: overallScore.toString(),
        completenessScore: completenessScore?.toString() || null,
        validityScore: validityScore?.toString() || null,
        validationResults,
        issueCount,
        criticalIssues,
        lastValidatedAt: new Date(),
      })
      .where(eq(leadDataQuality.leadId, leadId));
  } else {
    // Insert new record
    await db.insert(leadDataQuality).values({
      workspaceId,
      leadId,
      overallScore: overallScore.toString(),
      completenessScore: completenessScore?.toString() || null,
      validityScore: validityScore?.toString() || null,
      validationResults,
      issueCount,
      criticalIssues,
      lastValidatedAt: new Date(),
    });
  }

  console.log(
    `[saveLeadQuality] Saved quality for lead ${leadId}: score=${overallScore}, issues=${issueCount}`
  );
}

/**
 * Get quality data for a single lead
 * @param leadId - Lead ID
 * @param workspaceId - Workspace ID
 * @returns Lead quality data or null
 */
export async function getLeadQuality(
  leadId: string,
  workspaceId: string
): Promise<LeadDataQuality | null> {
  const [quality] = await db
    .select()
    .from(leadDataQuality)
    .where(and(eq(leadDataQuality.leadId, leadId), eq(leadDataQuality.workspaceId, workspaceId)))
    .limit(1);

  return quality || null;
}

/**
 * Get workspace-level quality summary
 * @param workspaceId - Workspace ID
 * @returns Quality summary
 */
export async function getWorkspaceQualitySummary(
  workspaceId: string
): Promise<WorkspaceQualitySummary> {
  // Fetch all lead quality records for workspace
  const qualityRecords = await db
    .select()
    .from(leadDataQuality)
    .where(eq(leadDataQuality.workspaceId, workspaceId))
    .limit(10000); // Reasonable limit for performance

  if (qualityRecords.length === 0) {
    return {
      workspaceId,
      avgQualityScore: 0,
      leadsWithIssues: 0,
      criticalIssues: 0,
      leadsNeedingEnrichment: 0,
      issuesByType: {},
      lastValidatedAt: new Date(),
    };
  }

  // Convert to QualityScoreResult format
  const qualityResults: QualityScoreResult[] = qualityRecords.map((record) => ({
    overallScore: parseFloat(record.overallScore as any),
    completenessScore: record.completenessScore
      ? parseFloat(record.completenessScore as any)
      : 0,
    validityScore: record.validityScore ? parseFloat(record.validityScore as any) : 0,
    issueCount: record.issueCount,
    criticalIssues: record.criticalIssues || [],
    validationResults: (record.validationResults as any) || {},
  }));

  // Calculate workspace metrics
  const metrics = calculateWorkspaceQuality(qualityResults);

  // Count issues by type
  const issuesByType: Record<string, number> = {};
  for (const record of qualityRecords) {
    const validationResults = (record.validationResults as any) || {};
    for (const [field, result] of Object.entries(validationResults)) {
      if (!(result as any).valid) {
        issuesByType[field] = (issuesByType[field] || 0) + 1;
      }
    }
  }

  // Count leads needing enrichment (completeness < 70%)
  const leadsNeedingEnrichment = qualityResults.filter(
    (q) => q.completenessScore < 70
  ).length;

  // Get most recent validation timestamp
  const sortedRecords = [...qualityRecords].sort(
    (a, b) =>
      new Date(b.lastValidatedAt).getTime() - new Date(a.lastValidatedAt).getTime()
  );
  const lastValidatedAt = sortedRecords[0]?.lastValidatedAt || new Date();

  return {
    workspaceId,
    avgQualityScore: metrics.avgQualityScore,
    leadsWithIssues: metrics.leadsWithIssues,
    criticalIssues: metrics.criticalIssues,
    leadsNeedingEnrichment,
    issuesByType,
    lastValidatedAt,
  };
}

/**
 * Get leads with quality issues
 * @param workspaceId - Workspace ID
 * @param minScore - Minimum quality score to filter by (optional)
 * @param limit - Maximum number of leads to return
 * @returns Array of leads with quality data
 */
export async function getLeadsWithQualityIssues(
  workspaceId: string,
  minScore?: number,
  limit: number = 50
) {
  let query = db
    .select()
    .from(leadDataQuality)
    .where(eq(leadDataQuality.workspaceId, workspaceId));

  if (minScore !== undefined) {
    query = query.where(
      and(
        eq(leadDataQuality.workspaceId, workspaceId),
        lt(leadDataQuality.overallScore, minScore.toString())
      )
    );
  }

  return query.orderBy(leadDataQuality.overallScore).limit(limit);
}

// Export quality scoring functions for direct use
export * from './quality-scorer';
export * from './validators';
