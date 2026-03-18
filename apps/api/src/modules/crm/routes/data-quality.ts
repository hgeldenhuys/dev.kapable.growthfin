/**
 * Data Quality API Routes
 * Epic 5 - Sprint 2: US-LEAD-QUALITY-006
 */

import { Elysia, t } from 'elysia';
import {
  validateLeadData,
  getLeadQuality,
  getWorkspaceQualitySummary,
  getLeadsWithQualityIssues,
} from '../services/data-quality';

export const dataQualityRoutes = new Elysia({ prefix: '/data-quality' })
  /**
   * GET /api/v1/workspaces/:workspaceId/crm/data-quality
   * Get workspace-level quality summary
   */
  .get(
    '/',
    async ({ query }) => {
      const { workspaceId } = query;

      const summary = await getWorkspaceQualitySummary(workspaceId);

      return {
        workspaceId: summary.workspaceId,
        summary: {
          avgQualityScore: summary.avgQualityScore,
          leadsWithIssues: summary.leadsWithIssues,
          criticalIssues: summary.criticalIssues,
          leadsNeedingEnrichment: summary.leadsNeedingEnrichment,
        },
        issuesByType: summary.issuesByType,
        lastValidatedAt: summary.lastValidatedAt,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Data Quality'],
        summary: 'Get workspace quality summary',
        description: 'Get workspace-level data quality metrics and issue summary',
      },
    }
  )

  /**
   * GET /api/v1/workspaces/:workspaceId/crm/leads/:leadId/data-quality
   * Get quality data for a specific lead
   */
  .get(
    '/leads/:leadId',
    async ({ params, query }) => {
      const { leadId } = params;
      const { workspaceId } = query;

      // Check if quality data exists
      let quality = await getLeadQuality(leadId, workspaceId);

      // If no quality data exists, validate now
      if (!quality) {
        console.log(`[GET /data-quality/leads/${leadId}] No quality data found, validating...`);
        const results = await validateLeadData({
          leadIds: [leadId],
          workspaceId,
          saveToDatabase: true,
        });

        if (results.length > 0) {
          // Fetch the newly saved quality data
          quality = await getLeadQuality(leadId, workspaceId);
        }
      }

      if (!quality) {
        return {
          error: 'Lead not found or quality could not be calculated',
          leadId,
        };
      }

      // Parse validation results to extract issues
      const validationResults = (quality.validationResults as any) || {};
      const issues = [];

      for (const [field, result] of Object.entries(validationResults)) {
        if (!(result as any).valid) {
          issues.push({
            field,
            severity: determineSeverity(field, quality.criticalIssues || []),
            issue: (result as any).reason || `Invalid ${field}`,
            suggestion: (result as any).suggestion || `Fix ${field} data`,
          });
        }
      }

      return {
        leadId: quality.leadId,
        overallScore: parseFloat(quality.overallScore as any),
        completenessScore: quality.completenessScore
          ? parseFloat(quality.completenessScore as any)
          : null,
        validityScore: quality.validityScore ? parseFloat(quality.validityScore as any) : null,
        issues,
        criticalIssues: quality.criticalIssues || [],
        lastValidatedAt: quality.lastValidatedAt,
      };
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Data Quality'],
        summary: 'Get lead quality data',
        description: 'Get data quality metrics and issues for a specific lead',
      },
    }
  )

  /**
   * POST /api/v1/workspaces/:workspaceId/crm/data-quality/validate
   * Trigger bulk validation for leads
   */
  .post(
    '/validate',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const { leadIds } = body;

      console.log(
        `[POST /data-quality/validate] Validating ${leadIds?.length || 'all'} leads...`
      );

      // TODO: If leadIds is empty, this should validate ALL leads in workspace
      // For now, require explicit leadIds to avoid performance issues
      if (!leadIds || leadIds.length === 0) {
        return {
          error: 'leadIds required',
          message: 'Provide array of lead IDs to validate',
        };
      }

      const results = await validateLeadData({
        leadIds,
        workspaceId,
        saveToDatabase: true,
      });

      // Aggregate results
      const summary = {
        totalValidated: results.length,
        avgQualityScore: Math.round(
          results.reduce((sum, r) => sum + r.overallScore, 0) / results.length
        ),
        leadsWithIssues: results.filter((r) => r.issueCount > 0).length,
        criticalIssues: results.reduce((sum, r) => sum + r.criticalIssues.length, 0),
      };

      return {
        summary,
        results: results.map((r) => ({
          leadId: (r as any).leadId, // TypeScript workaround
          overallScore: r.overallScore,
          issueCount: r.issueCount,
          criticalIssues: r.criticalIssues,
        })),
        message: 'Validation completed successfully',
      };
    },
    {
      body: t.Object({
        leadIds: t.Optional(t.Array(t.String())),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Data Quality'],
        summary: 'Bulk validate leads',
        description: 'Trigger data quality validation for multiple leads',
      },
    }
  )

  /**
   * GET /api/v1/workspaces/:workspaceId/crm/data-quality/issues
   * Get leads with quality issues
   */
  .get(
    '/issues',
    async ({ query }) => {
      const { workspaceId, minScore, limit } = query;

      const leadsWithIssues = await getLeadsWithQualityIssues(
        workspaceId,
        minScore ? parseInt(minScore, 10) : undefined,
        limit ? parseInt(limit, 10) : 50
      );

      return {
        leads: leadsWithIssues.map((lead) => ({
          leadId: lead.leadId,
          overallScore: parseFloat(lead.overallScore as any),
          issueCount: lead.issueCount,
          criticalIssues: lead.criticalIssues || [],
          lastValidatedAt: lead.lastValidatedAt,
        })),
        total: leadsWithIssues.length,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        minScore: t.Optional(t.String()), // Filter leads below this score
        limit: t.Optional(t.String()), // Max results
      }),
      detail: {
        tags: ['Data Quality'],
        summary: 'Get leads with quality issues',
        description: 'Get list of leads with data quality issues, sorted by severity',
      },
    }
  );

/**
 * Helper: Determine severity of an issue
 * @param field - Field name
 * @param criticalIssues - Array of critical issue descriptions
 * @returns Severity level
 */
function determineSeverity(field: string, criticalIssues: string[]): string {
  // Check if field is in critical issues
  const isCritical = criticalIssues.some((issue) =>
    issue.toLowerCase().includes(field.toLowerCase())
  );

  if (isCritical) return 'critical';

  // High severity for email/contact fields
  if (['email', 'phone'].includes(field)) return 'high';

  // Medium for enrichment fields
  if (['industry', 'employee_count', 'revenue'].includes(field)) return 'medium';

  return 'low';
}
