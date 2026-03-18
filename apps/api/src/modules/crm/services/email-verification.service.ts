/**
 * Email Verification Service
 * Queries email verification attempts from crm_tool_calls table
 * Aggregates results by entity (lead/contact)
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-002
 */

import type { Database } from '@agios/db';
import { crmToolCalls, crmEnrichmentResults } from '@agios/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  parseEmailVerificationResult,
  type ParsedEmailAttempt,
  type EmailVerificationResult,
} from '../utils/email-verification-status';

export interface EmailVerificationFilters {
  workspaceId: string;
  entityId: string;
  entityType: 'contact' | 'lead';
  limit?: number;
  offset?: number;
}

export interface EmailVerificationListResponse {
  attempts: ParsedEmailAttempt[];
  totalCount: number;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    other: number;
  };
}

export interface RawEmailVerificationAttempt {
  id: string;
  email: string;
  status: string;
  subStatus: string;
  mxFound: boolean;
  mxRecord: string;
  smtpProvider: string;
  domain: string;
  processedAt: string;
  toolCallId: string;
  enrichmentResultId: string;
  createdAt: Date;
}

export const emailVerificationService = {
  /**
   * Get email verification attempts for a lead/contact
   * Queries crm_tool_calls where tool_name='verify_email' and joins with
   * crm_enrichment_results to filter by entity
   */
  async getVerificationAttempts(
    db: Database,
    filters: EmailVerificationFilters
  ): Promise<EmailVerificationListResponse> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    // Query tool calls for verify_email, joining with enrichment results
    // to get entity_id and filter by workspace
    const results = await db
      .select({
        id: crmToolCalls.id,
        result: crmToolCalls.result,
        createdAt: crmToolCalls.createdAt,
        enrichmentResultId: crmToolCalls.enrichmentResultId,
      })
      .from(crmToolCalls)
      .innerJoin(
        crmEnrichmentResults,
        eq(crmToolCalls.enrichmentResultId, crmEnrichmentResults.id)
      )
      .where(
        and(
          eq(crmToolCalls.workspaceId, filters.workspaceId),
          eq(crmToolCalls.toolName, 'verify_email'),
          eq(crmEnrichmentResults.entityId, filters.entityId),
          eq(crmEnrichmentResults.entityType, filters.entityType)
        )
      )
      .orderBy(desc(crmToolCalls.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmToolCalls)
      .innerJoin(
        crmEnrichmentResults,
        eq(crmToolCalls.enrichmentResultId, crmEnrichmentResults.id)
      )
      .where(
        and(
          eq(crmToolCalls.workspaceId, filters.workspaceId),
          eq(crmToolCalls.toolName, 'verify_email'),
          eq(crmEnrichmentResults.entityId, filters.entityId),
          eq(crmEnrichmentResults.entityType, filters.entityType)
        )
      );

    const totalCount = countResult?.count || 0;

    // Parse results
    const attempts: ParsedEmailAttempt[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let otherCount = 0;

    for (const row of results) {
      const resultData = row.result as EmailVerificationResult;

      if (!resultData || !resultData.email) {
        continue;
      }

      const parsed = parseEmailVerificationResult(row.id, resultData);
      attempts.push(parsed);

      // Count by status
      if (resultData.status === 'valid') {
        validCount++;
      } else if (resultData.status === 'invalid') {
        invalidCount++;
      } else {
        otherCount++;
      }
    }

    return {
      attempts,
      totalCount,
      summary: {
        total: totalCount,
        valid: validCount,
        invalid: invalidCount,
        other: otherCount,
      },
    };
  },

  /**
   * Get all verification attempts for an entity (no pagination)
   * Used for enrichment report generation
   */
  async getAllVerificationAttempts(
    db: Database,
    workspaceId: string,
    entityId: string,
    entityType: 'contact' | 'lead'
  ): Promise<ParsedEmailAttempt[]> {
    const results = await db
      .select({
        id: crmToolCalls.id,
        result: crmToolCalls.result,
        createdAt: crmToolCalls.createdAt,
      })
      .from(crmToolCalls)
      .innerJoin(
        crmEnrichmentResults,
        eq(crmToolCalls.enrichmentResultId, crmEnrichmentResults.id)
      )
      .where(
        and(
          eq(crmToolCalls.workspaceId, workspaceId),
          eq(crmToolCalls.toolName, 'verify_email'),
          eq(crmEnrichmentResults.entityId, entityId),
          eq(crmEnrichmentResults.entityType, entityType)
        )
      )
      .orderBy(desc(crmToolCalls.createdAt));

    const attempts: ParsedEmailAttempt[] = [];

    for (const row of results) {
      const resultData = row.result as EmailVerificationResult;

      if (!resultData || !resultData.email) {
        continue;
      }

      attempts.push(parseEmailVerificationResult(row.id, resultData));
    }

    return attempts;
  },

  /**
   * Get only failed/invalid verification attempts for an entity
   * Used for enrichment report "eliminated emails" section
   */
  async getFailedVerificationAttempts(
    db: Database,
    workspaceId: string,
    entityId: string,
    entityType: 'contact' | 'lead'
  ): Promise<ParsedEmailAttempt[]> {
    const allAttempts = await this.getAllVerificationAttempts(
      db,
      workspaceId,
      entityId,
      entityType
    );

    // Filter to only invalid/failed attempts
    return allAttempts.filter((attempt) => !attempt.isValid);
  },

  /**
   * Get verification attempts for a specific enrichment job
   * (All emails verified during a single enrichment run)
   */
  async getVerificationAttemptsByJobId(
    db: Database,
    workspaceId: string,
    jobId: string
  ): Promise<ParsedEmailAttempt[]> {
    const results = await db
      .select({
        id: crmToolCalls.id,
        result: crmToolCalls.result,
        createdAt: crmToolCalls.createdAt,
      })
      .from(crmToolCalls)
      .innerJoin(
        crmEnrichmentResults,
        eq(crmToolCalls.enrichmentResultId, crmEnrichmentResults.id)
      )
      .where(
        and(
          eq(crmToolCalls.workspaceId, workspaceId),
          eq(crmToolCalls.toolName, 'verify_email'),
          eq(crmEnrichmentResults.jobId, jobId)
        )
      )
      .orderBy(desc(crmToolCalls.createdAt));

    const attempts: ParsedEmailAttempt[] = [];

    for (const row of results) {
      const resultData = row.result as EmailVerificationResult;

      if (!resultData || !resultData.email) {
        continue;
      }

      attempts.push(parseEmailVerificationResult(row.id, resultData));
    }

    return attempts;
  },

  /**
   * Generate summary markdown for eliminated emails
   * Used in enrichment report generation
   */
  generateEliminatedEmailsSummary(attempts: ParsedEmailAttempt[]): string {
    const invalidAttempts = attempts.filter((a) => !a.isValid);

    if (invalidAttempts.length === 0) {
      return '';
    }

    const lines: string[] = [
      '## Email Verification Results',
      '',
      `**${invalidAttempts.length} email(s) failed verification:**`,
      '',
    ];

    for (const attempt of invalidAttempts) {
      lines.push(
        `- **${attempt.email}**: ${attempt.subStatusLabel}` +
          (attempt.suggestion ? ` (Did you mean: ${attempt.suggestion}?)` : '')
      );
    }

    lines.push('');

    // Add MX validation summary
    const noMxRecords = invalidAttempts.filter((a) => !a.mxFound);
    if (noMxRecords.length > 0) {
      lines.push(
        `*${noMxRecords.length} domain(s) had no MX records configured.*`
      );
    }

    return lines.join('\n');
  },
};
