/**
 * Enrich Lead Worker (US-LEAD-AI-009)
 * Processes individual lead enrichment jobs using AI + tool calling
 *
 * Uses the CRM enrichment service (OpenRouter + tools) for real enrichment:
 * - web_search (Brave/Perplexity)
 * - verify_email (ZeroBounce)
 * - lookup_business (Google Maps)
 * - enrich_linkedin (RapidAPI)
 * - lookup_sa_company (CIPC)
 * - update_contact (field updater)
 *
 * Tool calls are recorded in crmToolCalls for real-time progress tracking.
 */

import { jobQueue, type EnrichLeadJob } from '../lib/queue';
import { db } from '@agios/db';
import {
  leadEnrichments,
  crmEnrichmentResults,
  crmLeads,
} from '@agios/db';
import { and, eq, sql } from 'drizzle-orm';
import { enrichmentService } from '../modules/crm/services/enrichment';

// Default enrichment config for individual lead enrichment
const DEFAULT_ENRICHMENT_CONFIG = {
  model: 'openai/gpt-4o-mini',
  prompt: `You are a B2B lead enrichment specialist. Your job is to find accurate, up-to-date information about business contacts and their companies.

For each lead, use the available tools to:
1. Search the web for the person and their company
2. Look up LinkedIn profile if possible
3. Verify their email address
4. Look up the business on Google Maps for address/phone verification
5. For South African companies, check CIPC registration

After gathering data, use the update_contact tool to apply your findings.

Focus on finding:
- Verified email address
- Phone number (direct or company)
- Job title / role
- Company website
- Company size / employee count
- Industry
- Company address / location
- LinkedIn profile URL

Be thorough but efficient. Only report data you're confident about.`,
  temperature: '0.3',
  maxTokens: 2000,
  type: 'enhancement' as const,
};

/**
 * Register enrich-lead worker
 */
export async function registerEnrichLeadWorker() {
  console.log('[Enrich Lead Worker] Registering worker...');

  try {
    await jobQueue.work<EnrichLeadJob>(
      'enrich-lead',
      {
        teamSize: 5,
        teamConcurrency: 2,
      },
      async (job) => {
        const { leadId, workspaceId, sources, force = false } = job.data;

        console.log(`[Enrich Lead Worker] Processing lead ${leadId} (workspace: ${workspaceId})...`);
        console.log(`[Enrich Lead Worker] Sources: ${sources.join(', ')}, Force: ${force}`);

        try {
          // 1. Fetch the lead
          const [lead] = await db
            .select()
            .from(crmLeads)
            .where(
              and(
                eq(crmLeads.id, leadId),
                eq(crmLeads.workspaceId, workspaceId)
              )
            );

          if (!lead) {
            throw new Error(`Lead ${leadId} not found in workspace ${workspaceId}`);
          }

          // 2. Create enrichment result record (for tool call tracking)
          //    jobId is null for individual lead enrichments (no batch job)
          const [enrichmentResult] = await db
            .insert(crmEnrichmentResults)
            .values({
              workspaceId,
              entityId: leadId,
              entityType: 'lead',
              status: 'success', // Will be updated on failure
              enrichmentData: {},
            })
            .returning();

          console.log(`[Enrich Lead Worker] Created enrichment result: ${enrichmentResult.id}`);

          // 3. Create/update leadEnrichments record (upsert)
          await db
            .insert(leadEnrichments)
            .values({
              leadId,
              workspaceId,
              status: 'in_progress',
              source: 'manual',
              estimatedCost: '0.05',
            })
            .onConflictDoUpdate({
              target: [leadEnrichments.leadId, leadEnrichments.source],
              set: {
                status: 'in_progress',
                estimatedCost: '0.05',
                retryCount: 0,
                errorMessage: null,
              },
            });

          // 4. Run AI enrichment with tool calling
          const result = await enrichmentService.enrichContact(
            lead,
            DEFAULT_ENRICHMENT_CONFIG,
            db,
            enrichmentResult.id,
            job.id,
            workspaceId
          );

          // 5. Truncate enrichment data to prevent oversized JSONB parameters
          const sanitizedData = truncateEnrichmentData(result.enrichmentData);

          // 6. Update enrichment result with data
          await db
            .update(crmEnrichmentResults)
            .set({
              status: 'success',
              enrichmentData: sanitizedData,
              reasoning: result.reasoning,
              tokensUsed: result.tokensUsed,
              cost: result.cost ? String(result.cost) : null,
              durationMs: result.durationMs,
            })
            .where(eq(crmEnrichmentResults.id, enrichmentResult.id));

          // 7. Apply enrichment results to lead (standard fields + custom fields)
          await applyEnrichmentToLead(db, lead, result, enrichmentResult.id);

          // 8. Update leadEnrichments as completed
          await db
            .update(leadEnrichments)
            .set({
              status: 'completed',
              enrichedFields: sanitizedData,
              enrichedAt: new Date(),
              actualCost: String(result.cost || 0),
            })
            .where(
              and(
                eq(leadEnrichments.leadId, leadId),
                eq(leadEnrichments.workspaceId, workspaceId),
                eq(leadEnrichments.source, 'manual')
              )
            );

          console.log(`[Enrich Lead Worker] Completed: ${Object.keys(result.enrichmentData).length} fields enriched`);
          console.log(`[Enrich Lead Worker] Cost: $${(result.cost || 0).toFixed(4)}, ${result.toolCalls?.length || 0} tool calls`);

          return { success: true, cost: result.cost || 0 };
        } catch (error: any) {
          console.error(`[Enrich Lead Worker] Failed:`, error);

          // Update enrichment status to failed
          try {
            await db
              .update(leadEnrichments)
              .set({
                status: 'failed',
                errorMessage: JSON.stringify({
                  message: error.message || 'Unknown error',
                  timestamp: new Date().toISOString(),
                  stack: error.stack?.split('\n').slice(0, 5).join('\n'),
                }),
                retryCount: sql`retry_count + 1`,
              })
              .where(
                and(
                  eq(leadEnrichments.leadId, leadId),
                  eq(leadEnrichments.workspaceId, workspaceId)
                )
              );
          } catch (updateError) {
            console.error(`[Enrich Lead Worker] Failed to update enrichment status:`, updateError);
          }

          throw error;
        }
      }
    );

    console.log('✅ Enrich lead worker registered successfully');
  } catch (error) {
    console.error('❌ Failed to register enrich lead worker:', error);
    throw error;
  }
}

/**
 * Truncate enrichment data to prevent oversized JSONB parameters.
 * Web search results can be 200KB+ of raw markdown — cap them.
 */
function truncateEnrichmentData(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };

  // Truncate web_search_results (biggest offender)
  if (Array.isArray(sanitized.web_search_results)) {
    const truncated: any[] = [];
    for (const result of sanitized.web_search_results) {
      truncated.push({
        ...result,
        value: typeof result.value === 'string' && result.value.length > 2000
          ? result.value.substring(0, 2000) + '... [truncated]'
          : result.value,
      });
    }
    sanitized.web_search_results = truncated;
  }

  // Cap long string values at 10000 chars
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string' && value.length > 10000) {
      sanitized[key] = value.substring(0, 10000) + '... [truncated]';
    }
  }

  // Remove rawResponse if present (full AI response text, often huge)
  if (typeof sanitized.rawResponse === 'string' && sanitized.rawResponse.length > 5000) {
    sanitized.rawResponse = sanitized.rawResponse.substring(0, 5000) + '... [truncated]';
  }

  return sanitized;
}

/**
 * Apply enrichment results to lead record
 * Extracts standard fields and merges custom fields into JSONB
 */
async function applyEnrichmentToLead(
  db: any,
  lead: any,
  result: {
    enrichmentData: Record<string, any>;
    toolCalls?: Array<{
      toolName: string;
      arguments: any;
      result: any;
      cost: number;
      durationMs: number;
    }>;
  },
  enrichmentResultId: string
) {
  const data = result.enrichmentData;
  const updateData: any = { updatedAt: new Date() };
  const customFieldsData: Record<string, any> = {};

  // Map enrichment data to lead columns
  if (data.email && typeof data.email === 'string' && !lead.email) {
    updateData.email = data.email;
  }
  if (data.phone && typeof data.phone === 'string' && !lead.phone) {
    updateData.phone = data.phone;
  }
  if (data.mobile && typeof data.mobile === 'string' && !lead.phone) {
    updateData.phone = data.mobile;
  }
  // title and linkedinUrl don't exist as columns — store in customFields
  if (data.title && typeof data.title === 'string') {
    customFieldsData.title = data.title;
  }
  if (data.linkedinUrl && typeof data.linkedinUrl === 'string') {
    customFieldsData.linkedinUrl = data.linkedinUrl;
  }
  if (data.linkedin_url && typeof data.linkedin_url === 'string') {
    customFieldsData.linkedinUrl = data.linkedin_url;
  }
  if (data.companyName && typeof data.companyName === 'string' && !lead.companyName) {
    updateData.companyName = data.companyName;
  }
  if (data.website && typeof data.website === 'string') {
    customFieldsData.website = data.website;
  }

  // Check for country in enrichment data
  if (data.country && typeof data.country === 'string' && !lead.country) {
    updateData.country = data.country;
  }

  // Move remaining enrichment fields to customFields
  const standardKeys = ['email', 'phone', 'mobile', 'title', 'linkedinUrl', 'linkedin_url',
    'companyName', 'website', 'country', 'rawResponse', '_confidence', 'companyWebsite'];
  for (const [key, value] of Object.entries(data)) {
    if (!standardKeys.includes(key) && value !== null && value !== undefined) {
      customFieldsData[key] = value;
    }
  }

  // Also extract from rawResponse if present (AI sometimes returns JSON in text)
  if (typeof data.rawResponse === 'string') {
    try {
      const jsonMatch = data.rawResponse.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
                        data.rawResponse.match(/```\s*\n?([\s\S]*?)\n?```/) ||
                        data.rawResponse.match(/\{[\s\S]*"email"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.email && !updateData.email && !lead.email) updateData.email = parsed.email;
        if (parsed.phone && !updateData.phone && !lead.phone) updateData.phone = parsed.phone;
        if (parsed.title && !customFieldsData.title) customFieldsData.title = parsed.title;
        if (parsed.website && !customFieldsData.website) customFieldsData.website = parsed.website;
        if (parsed.linkedinUrl && !customFieldsData.linkedinUrl) customFieldsData.linkedinUrl = parsed.linkedinUrl;
        if (parsed.linkedin_url && !customFieldsData.linkedinUrl) customFieldsData.linkedinUrl = parsed.linkedin_url;
        if (parsed.country && !updateData.country && !lead.country) updateData.country = parsed.country;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Merge custom fields into JSONB
  if (Object.keys(customFieldsData).length > 0) {
    updateData.customFields = sql`COALESCE(${crmLeads.customFields}, '{}'::jsonb) || ${JSON.stringify(customFieldsData)}::jsonb`;
  }

  // Apply update
  const updateKeys = Object.keys(updateData);
  if (updateKeys.length > 1) { // More than just updatedAt
    console.log(`[Enrich Lead Worker] Applying ${updateKeys.length - 1} fields to lead: ${updateKeys.filter(k => k !== 'updatedAt').join(', ')}`);

    await db
      .update(crmLeads)
      .set(updateData)
      .where(eq(crmLeads.id, lead.id));
  }
}
