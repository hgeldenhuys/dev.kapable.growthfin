/**
 * Enrichment Service
 * Business logic for AI-powered contact enrichment
 */

import type { Database } from '@agios/db';
import {
  crmEnrichmentJobs,
  crmEnrichmentResults,
  crmToolCalls,
  crmContactListMemberships,
  crmContacts,
  crmLeads,
  crmContactLists,
  crmScoringModels,
  crmEnrichmentAbTests,
  type NewCrmEnrichmentJob,
  type NewCrmEnrichmentResult,
  type NewCrmToolCall,
  type NewCrmScoringModel,
  type NewCrmEnrichmentAbTest,
  type CrmContact,
  type CrmLead,
  type CrmContactList,
} from '@agios/db';
import { eq, and, or, isNull, sql, inArray, sum, gte, lte } from 'drizzle-orm';
import { getWebSearchTool, webSearchFunctionDefinition } from '../../../lib/tools/web-search';
import {
  getEmailVerificationTool,
  emailVerificationFunctionDefinition,
} from '../../../lib/tools/email-verification';
import {
  getGoogleMapsTool,
  googleMapsFunctionDefinition,
} from '../../../lib/tools/google-maps';
import {
  getLinkedInTool,
  linkedInFunctionDefinition,
} from '../../../lib/tools/linkedin';
import {
  getCIPCTool,
  cipcFunctionDefinition,
} from '../../../lib/tools/cipc';
import {
  getContactUpdateTool,
  contactUpdateFunctionDefinition,
} from '../../../lib/tools/contact-updater';
import { jobQueue } from '../../../lib/queue';
import {
  extractConfidence,
  applyDefaultConfidence,
  buildConfidenceInstructions,
  calculateEffectiveLeadScore,
  getOverallConfidence,
  type EnrichmentConfidence,
} from '../utils/confidence';
import { jobLoggingService } from '../../../services/job-logging.service';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.warn('[enrichment] OPENROUTER_API_KEY not set — AI enrichment will fail');
}

// Maximum duration for a single entity enrichment (2 minutes)
const ENRICHMENT_TIMEOUT_MS = 120_000;
// Threshold after which enrichments are considered stale and cleaned up (5 minutes)
const STALE_ENRICHMENT_THRESHOLD_MS = 300_000;

// Model pricing (per 1M tokens) in USD
const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-3-5-sonnet': { input: 3.0, output: 15.0 },
};

// Union type for entities that can be enriched
type EnrichableEntity = CrmContact | CrmLead;

// Helper to determine if entity is a lead (has companyName field)
function isLead(entity: EnrichableEntity): entity is CrmLead {
  return 'source' in entity;
}

/**
 * Extract country from enrichment data.
 * Checks multiple fields that enrichment providers may populate.
 */
function extractCountryFromEnrichment(enrichmentData: Record<string, any>): string | null {
  // 1. Direct country field
  if (enrichmentData.country && typeof enrichmentData.country === 'string') {
    return enrichmentData.country;
  }

  // Known country names for matching
  const knownCountries = [
    'South Africa', 'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'India', 'Brazil', 'Nigeria', 'Kenya', 'Egypt',
    'Netherlands', 'Singapore', 'Japan', 'China', 'Ireland', 'New Zealand',
    'United Arab Emirates', 'Saudi Arabia', 'Israel', 'Switzerland', 'Sweden',
    'Norway', 'Denmark', 'Finland', 'Portugal', 'Spain', 'Italy', 'Belgium',
  ];

  // 2. Check location / companyAddress / headquarters fields
  const locationFields = ['location', 'companyAddress', 'headquarters', 'address', 'registeredAddress'];
  for (const field of locationFields) {
    const value = enrichmentData[field];
    if (value && typeof value === 'string') {
      for (const country of knownCountries) {
        if (value.toLowerCase().includes(country.toLowerCase())) {
          return country;
        }
      }
    }
  }

  // 3. Check Google Maps structured data (tool result may contain address_components)
  if (enrichmentData.googleMaps && typeof enrichmentData.googleMaps === 'object') {
    const gm = enrichmentData.googleMaps;
    if (gm.country && typeof gm.country === 'string') return gm.country;
    if (gm.formattedAddress && typeof gm.formattedAddress === 'string') {
      for (const country of knownCountries) {
        if (gm.formattedAddress.toLowerCase().includes(country.toLowerCase())) {
          return country;
        }
      }
    }
  }

  // 4. Check rawResponse for country mentions (last resort)
  if (enrichmentData.rawResponse && typeof enrichmentData.rawResponse === 'string') {
    const raw = enrichmentData.rawResponse;
    // Only match if "South Africa" appears (high-value for this CRM)
    if (raw.includes('South Africa')) return 'South Africa';
    // Check others
    for (const country of knownCountries) {
      // Only match if country appears as a standalone phrase (not as part of another word)
      const regex = new RegExp(`\\b${country}\\b`, 'i');
      if (regex.test(raw)) return country;
    }
  }

  return null;
}

/**
 * Field with source attribution (US-012 AC-004)
 */
interface ExtractedField {
  value: string | number;
  source: string; // 'verify_email', 'enrich_linkedin', 'lookup_business', 'ai_text_parse'
  confidence?: number;
}

/**
 * Extract fields from tool call results (US-012: Tool-Based Field Extraction).
 *
 * Extracts structured data from verify_email, enrich_linkedin, and lookup_business
 * tool results. Tool-extracted fields take precedence over AI text parsing because
 * they contain verified, structured data.
 *
 * (US-012 AC-004: Each extracted field includes source attribution)
 *
 * @param db - Database instance
 * @param enrichmentResultId - ID of the enrichment result to get tool calls for
 * @returns Object with extracted fields and their source attribution
 */
async function extractFieldsFromToolCalls(
  db: Database,
  enrichmentResultId: string
): Promise<{
  fields: {
    email?: string;
    phone?: string;
    title?: string;
    linkedinUrl?: string;
    companyName?: string;
    website?: string;
  };
  sources: {
    email?: ExtractedField;
    phone?: ExtractedField;
    title?: ExtractedField;
    linkedinUrl?: ExtractedField;
    companyName?: ExtractedField;
    website?: ExtractedField;
  };
}> {
  const extractedFields: {
    email?: string;
    phone?: string;
    title?: string;
    linkedinUrl?: string;
    companyName?: string;
    website?: string;
  } = {};

  // US-012 AC-004: Track source attribution for each field
  const fieldSources: {
    email?: ExtractedField;
    phone?: ExtractedField;
    title?: ExtractedField;
    linkedinUrl?: ExtractedField;
    companyName?: ExtractedField;
    website?: ExtractedField;
  } = {};

  try {
    // Query all tool calls for this enrichment result
    const toolCalls = await db
      .select()
      .from(crmToolCalls)
      .where(
        and(
          eq(crmToolCalls.enrichmentResultId, enrichmentResultId),
          eq(crmToolCalls.status, 'success')
        )
      );

    if (!toolCalls || toolCalls.length === 0) {
      return { fields: extractedFields, sources: fieldSources };
    }

    console.log(`[US-012] Processing ${toolCalls.length} tool call(s) for field extraction`);

    // Process each tool call based on tool name
    for (const toolCall of toolCalls) {
      try {
        const result = toolCall.result as any;

        switch (toolCall.toolName) {
          case 'verify_email': {
            // AC-001: Extract email if mxFound=true OR status in ['valid', 'catch-all']
            if (
              result &&
              result.email &&
              (result.mxFound === true ||
                result.status === 'valid' ||
                result.status === 'catch-all')
            ) {
              extractedFields.email = result.email;
              // AC-004: Track source attribution
              fieldSources.email = {
                value: result.email,
                source: 'verify_email',
                confidence: result.status === 'valid' ? 1.0 : 0.9, // High confidence for verified emails
              };
              console.log(`[US-012] Extracted email from verify_email: ${result.email.substring(0, 3)}***`);
            }
            break;
          }

          case 'enrich_linkedin': {
            // AC-002: Extract title/position data
            if (result && result.title) {
              extractedFields.title = result.title;
              // AC-004: Track source attribution
              fieldSources.title = {
                value: result.title,
                source: 'enrich_linkedin',
                confidence: 0.9, // LinkedIn data is usually accurate
              };
              console.log(`[US-012] Extracted title from enrich_linkedin: ${result.title}`);
            }
            if (result && result.company && !extractedFields.companyName) {
              extractedFields.companyName = result.company;
              // AC-004: Track source attribution
              fieldSources.companyName = {
                value: result.company,
                source: 'enrich_linkedin',
                confidence: 0.9,
              };
              console.log(`[US-012] Extracted company from enrich_linkedin: ${result.company}`);
            }
            // Also extract LinkedIn URL if present in result
            if (result && result.linkedinUrl) {
              extractedFields.linkedinUrl = result.linkedinUrl;
              // AC-004: Track source attribution
              fieldSources.linkedinUrl = {
                value: result.linkedinUrl,
                source: 'enrich_linkedin',
                confidence: 1.0, // Direct from LinkedIn, highest confidence
              };
              console.log(`[US-012] Extracted LinkedIn URL from enrich_linkedin`);
            }
            break;
          }

          case 'lookup_business': {
            // Extract phone and website from business lookup
            if (result && result.phone && !extractedFields.phone) {
              extractedFields.phone = result.phone;
              // AC-004: Track source attribution
              fieldSources.phone = {
                value: result.phone,
                source: 'lookup_business',
                confidence: 1.0, // Business directories are reliable
              };
              console.log(`[US-012] Extracted phone from lookup_business: ${result.phone.substring(0, 5)}***`);
            }
            if (result && result.website) {
              extractedFields.website = result.website;
              // AC-004: Track source attribution
              fieldSources.website = {
                value: result.website,
                source: 'lookup_business',
                confidence: 1.0,
              };
              console.log(`[US-012] Extracted website from lookup_business: ${result.website}`);
            }
            break;
          }

          default:
            // Ignore other tools (web_search, etc.)
            break;
        }
      } catch (toolError) {
        console.error(`[US-012] Error parsing tool call result for ${toolCall.toolName}:`, toolError);
        // Continue processing other tool calls
      }
    }

    const extractedCount = Object.keys(extractedFields).length;
    if (extractedCount > 0) {
      console.log(`[US-012] Extracted ${extractedCount} field(s) from tool calls:`, Object.keys(extractedFields));
      console.log(`[US-012 AC-004] Field sources tracked:`, Object.keys(fieldSources));
    }

    return { fields: extractedFields, sources: fieldSources };
  } catch (error) {
    console.error('[US-012] Error in extractFieldsFromToolCalls:', error);
    return { fields: extractedFields, sources: fieldSources }; // Return empty objects on error
  }
}

interface EnrichmentResponse {
  score?: number;
  classification?: string;
  enrichmentData: Record<string, any>;
  reasoning: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  currentSpend?: number;
  budgetLimit?: number;
}

export const enrichmentService = {
  /**
   * Create a new enrichment job
   */
  async createJob(db: Database, data: NewCrmEnrichmentJob) {
    const results = await db.insert(crmEnrichmentJobs).values(data).returning();
    return results[0];
  },

  /**
   * Get job by ID
   */
  async getJob(db: Database, jobId: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmEnrichmentJobs)
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      );
    return results[0] || null;
  },

  /**
   * Get job with results
   */
  async getJobWithResults(db: Database, jobId: string, workspaceId: string) {
    const job = await this.getJob(db, jobId, workspaceId);
    if (!job) {
      return null;
    }

    const results = await db
      .select({
        result: crmEnrichmentResults,
        contact: crmContacts,
      })
      .from(crmEnrichmentResults)
      .leftJoin(
        crmContacts,
        and(
          eq(crmEnrichmentResults.entityId, crmContacts.id),
          eq(crmEnrichmentResults.entityType, 'contact')
        )
      )
      .where(eq(crmEnrichmentResults.jobId, jobId))
      .orderBy(crmEnrichmentResults.createdAt);

    // Flatten the result structure
    const formattedResults = results.map((r) => ({
      ...r.result,
      contact: r.contact,
    }));

    return {
      ...job,
      results: formattedResults,
    };
  },

  /**
   * Get enrichment result with tool calls
   */
  async getResultWithToolCalls(db: Database, resultId: string, workspaceId: string) {
    const results = await db
      .select()
      .from(crmEnrichmentResults)
      .where(
        and(
          eq(crmEnrichmentResults.id, resultId),
          eq(crmEnrichmentResults.workspaceId, workspaceId)
        )
      );

    const result = results[0];
    if (!result) {
      return null;
    }

    // Get tool calls for this result
    const toolCalls = await db
      .select()
      .from(crmToolCalls)
      .where(eq(crmToolCalls.enrichmentResultId, resultId))
      .orderBy(crmToolCalls.createdAt);

    return {
      ...result,
      toolCalls,
    };
  },

  /**
   * List jobs for a workspace
   */
  async listJobs(db: Database, workspaceId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(crmEnrichmentJobs)
      .where(
        and(
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${crmEnrichmentJobs.createdAt} DESC`);
  },

  /**
   * Update job status and progress
   */
  async updateJob(
    db: Database,
    jobId: string,
    workspaceId: string,
    data: Partial<NewCrmEnrichmentJob>
  ) {
    const results = await db
      .update(crmEnrichmentJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      )
      .returning();
    return results[0] || null;
  },

  /**
   * Cancel a running job
   */
  async cancelJob(db: Database, jobId: string, workspaceId: string) {
    return this.updateJob(db, jobId, workspaceId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  },

  /**
   * Get total spend for a list from all enrichment results
   */
  async getTotalSpendForList(db: Database, listId: string): Promise<number> {
    // Sum all costs from enrichment results associated with the list
    const results = await db
      .select({ totalCost: sum(crmEnrichmentResults.cost) })
      .from(crmEnrichmentResults)
      .innerJoin(
        crmEnrichmentJobs,
        eq(crmEnrichmentResults.jobId, crmEnrichmentJobs.id)
      )
      .where(
        and(
          eq(crmEnrichmentJobs.sourceListId, listId),
          eq(crmEnrichmentResults.status, 'success')
        )
      );

    const totalCost = results[0]?.totalCost;
    return totalCost ? Number(totalCost) : 0;
  },

  /**
   * Check if list budget allows starting a new job
   */
  async checkListBudget(db: Database, listId: string): Promise<BudgetCheckResult> {
    // Get the list to check budget limit
    const list = await db
      .select()
      .from(crmContactLists)
      .where(eq(crmContactLists.id, listId))
      .then((results) => results[0] || null);

    if (!list) {
      return { allowed: false, reason: 'List not found' };
    }

    // If no budget limit set, allow
    if (!list.budgetLimit) {
      return { allowed: true };
    }

    const budgetLimit = Number(list.budgetLimit);
    const currentSpend = await this.getTotalSpendForList(db, listId);

    // Check if budget already exceeded
    if (currentSpend >= budgetLimit) {
      return {
        allowed: false,
        reason: `Budget limit exceeded: $${currentSpend.toFixed(4)} >= $${budgetLimit.toFixed(2)}`,
        currentSpend,
        budgetLimit,
      };
    }

    return {
      allowed: true,
      currentSpend,
      budgetLimit,
    };
  },

  /**
   * Check if a single contact can be enriched within budget constraints
   */
  checkContactBudget(cost: number, list: CrmContactList): BudgetCheckResult {
    // Check per-contact budget limit
    if (list.budgetPerContact) {
      const perContactLimit = Number(list.budgetPerContact);
      if (cost > perContactLimit) {
        return {
          allowed: false,
          reason: `Cost exceeds per-contact limit: $${cost.toFixed(4)} > $${perContactLimit.toFixed(2)}`,
        };
      }
    }

    return { allowed: true };
  },

  /**
   * Get contacts/leads from a list (polymorphic - supports both entity types)
   */
  async getContactsFromList(
    db: Database,
    listId: string,
    workspaceId: string,
    limit?: number
  ): Promise<EnrichableEntity[]> {
    // Get entity IDs and types from memberships
    const memberships = await db
      .select({
        entityId: crmContactListMemberships.entityId,
        entityType: crmContactListMemberships.entityType,
      })
      .from(crmContactListMemberships)
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          eq(crmContactListMemberships.workspaceId, workspaceId),
          eq(crmContactListMemberships.isActive, true),
          isNull(crmContactListMemberships.deletedAt)
        )
      )
      .limit(limit || 1000);

    if (memberships.length === 0) {
      return [];
    }

    // Separate entity IDs by type
    const contactIds = memberships
      .filter((m) => m.entityType === 'contact')
      .map((m) => m.entityId);
    const leadIds = memberships
      .filter((m) => m.entityType === 'lead')
      .map((m) => m.entityId);

    const results: EnrichableEntity[] = [];

    // Fetch contacts if any
    if (contactIds.length > 0) {
      const contacts = await db
        .select()
        .from(crmContacts)
        .where(
          and(
            inArray(crmContacts.id, contactIds),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        );
      results.push(...contacts);
    }

    // Fetch leads if any
    if (leadIds.length > 0) {
      const leads = await db
        .select()
        .from(crmLeads)
        .where(
          and(
            inArray(crmLeads.id, leadIds),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        );
      results.push(...leads);
    }

    return results;
  },

  /**
   * Get random sample of contacts/leads from a list (polymorphic)
   */
  async getRandomSample(
    db: Database,
    listId: string,
    workspaceId: string,
    sampleSize: number
  ): Promise<EnrichableEntity[]> {
    // Get all entity IDs and types from list
    const memberships = await db
      .select({
        entityId: crmContactListMemberships.entityId,
        entityType: crmContactListMemberships.entityType,
      })
      .from(crmContactListMemberships)
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          eq(crmContactListMemberships.workspaceId, workspaceId),
          eq(crmContactListMemberships.isActive, true),
          isNull(crmContactListMemberships.deletedAt)
        )
      );

    if (memberships.length === 0) {
      return [];
    }

    // Shuffle and take sample
    const shuffled = memberships.sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);

    // Separate entity IDs by type
    const contactIds = sample
      .filter((m) => m.entityType === 'contact')
      .map((m) => m.entityId);
    const leadIds = sample
      .filter((m) => m.entityType === 'lead')
      .map((m) => m.entityId);

    const results: EnrichableEntity[] = [];

    // Fetch contacts if any
    if (contactIds.length > 0) {
      const contacts = await db
        .select()
        .from(crmContacts)
        .where(
          and(
            inArray(crmContacts.id, contactIds),
            eq(crmContacts.workspaceId, workspaceId),
            isNull(crmContacts.deletedAt)
          )
        );
      results.push(...contacts);
    }

    // Fetch leads if any
    if (leadIds.length > 0) {
      const leads = await db
        .select()
        .from(crmLeads)
        .where(
          and(
            inArray(crmLeads.id, leadIds),
            eq(crmLeads.workspaceId, workspaceId),
            isNull(crmLeads.deletedAt)
          )
        );
      results.push(...leads);
    }

    return results;
  },

  /**
   * Process a single entity with full enrichment pipeline.
   * Returns result type and cost for batch aggregation.
   */
  async processEntity(
    entity: EnrichableEntity,
    job: any,
    db: Database,
    workspaceId: string,
    jobId: string,
    list: CrmContactList,
    contacts: EnrichableEntity[],
    currentTotalCost: number,
  ): Promise<{ type: 'success' | 'failed' | 'skipped', cost: number }> {
    let enrichmentResultId: string | undefined;
    try {
      // Create enrichment result first to get ID for tool call logging
      const enrichmentResults = await db.insert(crmEnrichmentResults).values({
        workspaceId,
        jobId,
        entityId: entity.id,
        entityType: isLead(entity) ? 'lead' : 'contact',
        status: 'success', // Will be updated if enrichment fails
        enrichmentData: {},
      }).returning();
      enrichmentResultId = enrichmentResults[0].id;

      // Log entity processing start (US-011: Task Execution Transparency)
      const entityName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.email || 'Unknown';
      await jobLoggingService.logEntityStart(
        db,
        workspaceId,
        jobId,
        'enrichment',
        entity.id,
        isLead(entity) ? 'lead' : 'contact',
        entityName
      );

      const result = await this.enrichContact(entity, job, db, enrichmentResultId, jobId, workspaceId);

      // Check per-entity budget
      const contactBudgetCheck = this.checkContactBudget(result.cost, list);
      if (!contactBudgetCheck.allowed) {
        console.log(`Skipping entity ${entity.id}: ${contactBudgetCheck.reason}`);

        await db.update(crmEnrichmentResults)
          .set({
            status: 'skipped',
            errorMessage: contactBudgetCheck.reason,
          })
          .where(eq(crmEnrichmentResults.id, enrichmentResultId));

        return { type: 'skipped', cost: 0 };
      }

      // Check if total spend would exceed list budget
      if (
        list.budgetLimit &&
        currentTotalCost + result.cost > Number(list.budgetLimit)
      ) {
        console.log(
          `List budget exceeded: ${currentTotalCost + result.cost} > ${list.budgetLimit}`
        );

        await db.update(crmEnrichmentResults)
          .set({
            status: 'skipped',
            errorMessage: 'List budget limit reached',
          })
          .where(eq(crmEnrichmentResults.id, enrichmentResultId));

        return { type: 'skipped', cost: 0 };
      }

      // Update result with enrichment data
      await db.update(crmEnrichmentResults)
        .set({
          status: 'success',
          score: result.score ? String(result.score) : null,
          enrichmentData: result.enrichmentData,
          reasoning: result.reasoning,
          tokensUsed: result.tokensUsed,
          cost: result.cost ? String(result.cost) : null,
          durationMs: result.durationMs,
        })
        .where(eq(crmEnrichmentResults.id, enrichmentResultId));

      // Auto-apply enrichment results to entity fields
      if (result.enrichmentData && Object.keys(result.enrichmentData).length > 0) {
        // Extract standard fields from enrichment data
        const standardFields: {
          email?: string;
          phone?: string;
          title?: string;
          linkedinUrl?: string;
          companyName?: string;
          leadScore?: number;
          website?: string;
        } = {};
        const customFieldsData: Record<string, any> = {};

        // US-012 AC-003: Tool-extracted fields take precedence over AI text parsing
        // US-012 AC-004: Track source attribution for each field
        // Extract fields from tool calls FIRST (structured, verified data)
        const { fields: toolExtractedFields, sources: toolFieldSources } = await extractFieldsFromToolCalls(db, enrichmentResultId!);
        if (Object.keys(toolExtractedFields).length > 0) {
          console.log('[US-012] Applying tool-extracted fields (takes precedence over AI text)');
          // Apply tool-extracted fields to standardFields
          Object.assign(standardFields, toolExtractedFields);
        }

        // Separate standard fields from custom fields
        // First, try to extract from top-level enrichmentData
        for (const [key, value] of Object.entries(result.enrichmentData)) {
          if (['email', 'phone', 'title', 'linkedinUrl', 'companyName', 'leadScore', 'website'].includes(key)) {
            // AC-003: Don't overwrite tool-extracted fields with AI-parsed fields
            if (!(key in toolExtractedFields)) {
              standardFields[key as keyof typeof standardFields] = value as any;
            }
          } else {
            customFieldsData[key] = value;
          }
        }

        // If no standard fields found and rawResponse exists, try to extract from embedded JSON
        // This handles cases where AI response wasn't properly parsed as JSON
        // AC-003: Only use AI text parsing for fields NOT already extracted from tools
        const hasNoStandardFields = !standardFields.email && !standardFields.phone && !standardFields.title;
        if (hasNoStandardFields && typeof result.enrichmentData.rawResponse === 'string') {
          const rawResponse = result.enrichmentData.rawResponse;

          // Try to find JSON object in the raw response (often wrapped in markdown code blocks)
          const jsonPatterns = [
            /```json\s*\n?([\s\S]*?)\n?```/,  // ```json ... ```
            /```\s*\n?([\s\S]*?)\n?```/,      // ``` ... ```
            /\{[\s\S]*"email"[\s\S]*\}/,      // Any JSON with email key
          ];

          for (const pattern of jsonPatterns) {
            const match = rawResponse.match(pattern);
            if (match) {
              try {
                // For patterns that capture a group, use the group; otherwise use full match
                const jsonStr = match[1] || match[0];
                const parsed = JSON.parse(jsonStr);

                // Extract standard fields from parsed JSON
                // AC-003: Don't overwrite tool-extracted fields
                // AC-004: Track source as 'ai_text_parse' for AI-extracted fields
                if (parsed.email && typeof parsed.email === 'string' && !toolExtractedFields.email) {
                  standardFields.email = parsed.email;
                  toolFieldSources.email = {
                    value: parsed.email,
                    source: 'ai_text_parse',
                    confidence: 0.7, // Lower confidence for AI-parsed data
                  };
                }
                if (parsed.phone && typeof parsed.phone === 'string' && !toolExtractedFields.phone) {
                  standardFields.phone = parsed.phone;
                  toolFieldSources.phone = {
                    value: parsed.phone,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.mobile && typeof parsed.mobile === 'string' && !standardFields.phone && !toolExtractedFields.phone) {
                  standardFields.phone = parsed.mobile;
                  toolFieldSources.phone = {
                    value: parsed.mobile,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.title && typeof parsed.title === 'string' && !toolExtractedFields.title) {
                  standardFields.title = parsed.title;
                  toolFieldSources.title = {
                    value: parsed.title,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.linkedinUrl && typeof parsed.linkedinUrl === 'string' && !toolExtractedFields.linkedinUrl) {
                  standardFields.linkedinUrl = parsed.linkedinUrl;
                  toolFieldSources.linkedinUrl = {
                    value: parsed.linkedinUrl,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.linkedin_url && typeof parsed.linkedin_url === 'string' && !standardFields.linkedinUrl && !toolExtractedFields.linkedinUrl) {
                  standardFields.linkedinUrl = parsed.linkedin_url;
                  toolFieldSources.linkedinUrl = {
                    value: parsed.linkedin_url,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.customFields?.linkedin_url && typeof parsed.customFields.linkedin_url === 'string' && !standardFields.linkedinUrl && !toolExtractedFields.linkedinUrl) {
                  standardFields.linkedinUrl = parsed.customFields.linkedin_url;
                  toolFieldSources.linkedinUrl = {
                    value: parsed.customFields.linkedin_url,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.companyName && typeof parsed.companyName === 'string' && !toolExtractedFields.companyName) {
                  standardFields.companyName = parsed.companyName;
                  toolFieldSources.companyName = {
                    value: parsed.companyName,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }
                if (parsed.leadScore !== undefined && typeof parsed.leadScore === 'number') {
                  standardFields.leadScore = parsed.leadScore;
                }
                if (parsed.lead_score !== undefined && typeof parsed.lead_score === 'number' && standardFields.leadScore === undefined) {
                  standardFields.leadScore = parsed.lead_score;
                }
                if (parsed.website && typeof parsed.website === 'string' && !toolExtractedFields.website) {
                  standardFields.website = parsed.website;
                  toolFieldSources.website = {
                    value: parsed.website,
                    source: 'ai_text_parse',
                    confidence: 0.7,
                  };
                }

                console.log(`[enrichment] Extracted standard fields from rawResponse:`, {
                  email: standardFields.email ? '***' : null,
                  phone: standardFields.phone ? '***' : null,
                  title: standardFields.title,
                });

                break; // Successfully parsed, stop trying patterns
              } catch {
                // Continue to next pattern
              }
            }
          }
        }

        if (isLead(entity)) {
          // Update lead with both standard fields and customFields
          const updateData: any = {
            updatedAt: new Date(),
          };

          // Only set standard fields if they have values and the current field is empty
          if (standardFields.email && !entity.email) updateData.email = standardFields.email;
          if (standardFields.phone && !entity.phone) updateData.phone = standardFields.phone;
          if (standardFields.title && !entity.title) updateData.title = standardFields.title;
          if (standardFields.linkedinUrl && !entity.linkedinUrl) updateData.linkedinUrl = standardFields.linkedinUrl;
          if (standardFields.companyName && !entity.companyName) updateData.companyName = standardFields.companyName;
          if (standardFields.leadScore !== undefined && !entity.leadScore) updateData.leadScore = standardFields.leadScore;

          // Extract country from enrichment data if lead.country is empty
          if (!entity.country) {
            const extractedCountry = extractCountryFromEnrichment(result.enrichmentData);
            if (extractedCountry) {
              updateData.country = extractedCountry;
              console.log(`[enrichment] Extracted country "${extractedCountry}" for lead ${entity.id}`);
            }
          }

          // US-CONF-003: Calculate effective lead score from confidence data
          // Only calculate if we have a lead score (either new or existing)
          const finalLeadScore = standardFields.leadScore ?? entity.leadScore ?? 0;
          if (finalLeadScore > 0 && result.enrichmentData._confidence) {
            const confidenceScores = result.enrichmentData._confidence;
            const effectiveScore = calculateEffectiveLeadScore(finalLeadScore, confidenceScores);
            updateData.effectiveLeadScore = effectiveScore;

            console.log(`[US-CONF-003] Calculated effective lead score: base=${finalLeadScore}, effective=${effectiveScore}`);
          }

          // US-012 AC-004: Add field sources to enrichment data
          const enrichmentDataWithSources = {
            ...result.enrichmentData,
            _fieldSources: toolFieldSources,
          };

          // Merge custom fields (both standard and extra fields go here for history)
          updateData.customFields = sql`${crmLeads.customFields} || ${JSON.stringify(enrichmentDataWithSources)}::jsonb`;

          await db.update(crmLeads)
            .set(updateData)
            .where(eq(crmLeads.id, entity.id));
        } else {
          // Update contact with both standard fields and customFields
          const updateData: any = {
            updatedAt: new Date(),
          };

          // Only set standard fields if they have values and the current field is empty
          if (standardFields.email && !entity.email) updateData.email = standardFields.email;
          if (standardFields.phone && !entity.phone) updateData.phone = standardFields.phone;
          if (standardFields.title && !entity.title) updateData.title = standardFields.title;
          if (standardFields.linkedinUrl && !entity.linkedinUrl) updateData.linkedinUrl = standardFields.linkedinUrl;

          // US-012 AC-004: Add field sources to enrichment data
          const enrichmentDataWithSources = {
            ...result.enrichmentData,
            _fieldSources: toolFieldSources,
          };

          // Merge custom fields (both standard and extra fields go here for history)
          updateData.customFields = sql`${crmContacts.customFields} || ${JSON.stringify(enrichmentDataWithSources)}::jsonb`;

          await db.update(crmContacts)
            .set(updateData)
            .where(eq(crmContacts.id, entity.id));
        }
      }

      // Write enrichment history (Epic 2: Backend API & Services)
      try {
        const { enrichmentHistoryService } = await import('./enrichment-history.service');

        // Generate markdown report from enrichment result
        const markdownReport = this.generateEnrichmentReport({
          entity,
          result,
          job,
          jobId,
        });

        // Get template snapshot (if this was a task-based enrichment)
        let templateSnapshot: any = {
          model: job.model,
          prompt: job.prompt,
          temperature: job.temperature,
          maxTokens: job.maxTokens,
          type: job.type,
        };

        // Epic 5: Detect changes from previous enrichment
        const changesSinceLast = await this.detectChanges(
          db,
          entity.id,
          isLead(entity) ? 'lead' : 'contact',
          workspaceId,
          result.enrichmentData
        );

        // Create history entry with content deduplication
        const historyEntry = await enrichmentHistoryService.createEntry(db, {
          workspaceId,
          entityId: entity.id,
          entityType: isLead(entity) ? 'lead' : 'contact',
          enrichmentReport: markdownReport,
          templateSnapshot,
          taskId: job.taskId || undefined,
          jobId,
          enrichmentSummary: result.reasoning?.substring(0, 500), // First 500 chars as summary
          changesSinceLast, // Epic 5: AI Context Integration
        });

        // Trigger SSE notification via PostgreSQL NOTIFY
        await db.execute(sql`
          SELECT pg_notify(
            'enrichment_history_changed',
            ${JSON.stringify({
              workspaceId,
              entityId: entity.id,
              historyId: historyEntry.id,
            })}
          )
        `);

        console.log(`[enrichment-history] Created history entry ${historyEntry.id} for entity ${entity.id}`);
      } catch (historyError) {
        // Don't fail enrichment if history writing fails
        console.error(`[enrichment-history] Failed to write history for entity ${entity.id}:`, historyError);
      }

      // Emit progress event via PostgreSQL NOTIFY for real-time SSE updates
      if (job.taskId) {
        const entityName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
        const progressEvent = {
          type: 'contact_processed',
          contactId: entity.id,
          contactName: entityName || 'Unknown',
          contactEmail: entity.email || undefined,
          status: 'success',
          cost: result.cost,
          timestamp: new Date().toISOString(),
        };

        const channel = `task_progress_${job.taskId}`;
        const payload = JSON.stringify(progressEvent);
        await db.execute(sql.raw(`SELECT pg_notify('${channel}', '${payload.replace(/'/g, "''")}')`));
      }

      // Log entity completion (US-011: Task Execution Transparency)
      await jobLoggingService.logEntityComplete(
        db,
        workspaceId,
        jobId,
        'enrichment',
        entity.id,
        isLead(entity) ? 'lead' : 'contact',
        { score: result.score, cost: result.cost }
      );

      return { type: 'success', cost: result.cost || 0 };
    } catch (error) {
      console.error(`Failed to enrich entity ${entity.id}:`, error);

      // Update result with error (if enrichment result was created)
      if (enrichmentResultId) {
        await db.update(crmEnrichmentResults)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          })
          .where(eq(crmEnrichmentResults.id, enrichmentResultId));
      }

      // Update progress with error
      await this.updateJob(db, jobId, workspaceId, {
        lastError: error instanceof Error ? error.message : String(error),
        errorCount: sql`${crmEnrichmentJobs.errorCount} + 1`,
      });

      // Emit failed progress event
      if (job.taskId) {
        const entityName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
        const progressEvent = {
          type: 'contact_processed',
          contactId: entity.id,
          contactName: entityName || 'Unknown',
          contactEmail: entity.email || undefined,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };

        const channel = `task_progress_${job.taskId}`;
        const payload = JSON.stringify(progressEvent);
        await db.execute(sql.raw(`SELECT pg_notify('${channel}', '${payload.replace(/'/g, "''")}')`));
      }

      return { type: 'failed', cost: 0 };
    }
  },

  /**
   * Run sample mode - test enrichment on N contacts
   */
  async runSample(db: Database, jobId: string, workspaceId: string) {
    const job = await this.getJob(db, jobId, workspaceId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'draft' && job.status !== 'review') {
      throw new Error(`Cannot run sample on job with status: ${job.status}`);
    }

    // Update status to sampling
    await this.updateJob(db, jobId, workspaceId, {
      status: 'sampling',
      startedAt: new Date(),
    });

    try {
      // Get the source list for budget checking
      const list = await db
        .select()
        .from(crmContactLists)
        .where(eq(crmContactLists.id, job.sourceListId))
        .then((results) => results[0] || null);

      if (!list) {
        throw new Error('Source list not found');
      }

      // Check if list budget allows starting
      const budgetCheck = await this.checkListBudget(db, job.sourceListId);
      if (!budgetCheck.allowed) {
        await this.updateJob(db, jobId, workspaceId, {
          status: 'budget_exceeded',
          completedAt: new Date(),
          lastError: budgetCheck.reason,
        });
        return {
          processedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalCost: 0,
        };
      }

      // Get random sample of contacts
      const contacts = await this.getRandomSample(
        db,
        job.sourceListId,
        workspaceId,
        job.sampleSize
      );

      if (contacts.length === 0) {
        throw new Error('No contacts found in list');
      }

      // Update total contacts
      await this.updateJob(db, jobId, workspaceId, {
        totalContacts: contacts.length,
      });

      // Process entities in parallel batches
      let processedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let totalCost = Number(job.actualCost) || 0;

      const BATCH_SIZE = 3;

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        // Process batch in parallel using Promise.allSettled
        const batchPromises = batch.map(entity =>
          this.processEntity(
            entity,
            job,
            db,
            workspaceId,
            jobId,
            list,
            contacts,
            totalCost,
          )
        );

        const batchResults = await Promise.allSettled(batchPromises);

        // Aggregate results from batch
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const { type, cost } = result.value;

            if (type === 'success') {
              processedCount++;
              totalCost += cost;
            } else if (type === 'failed') {
              failedCount++;
            } else if (type === 'skipped') {
              skippedCount++;
            }
          } else {
            // Promise rejected (shouldn't happen as processEntity catches errors)
            console.error('Batch promise rejected:', result.reason);
            failedCount++;
          }
        }

        // Update progress after each batch
        await this.updateJob(db, jobId, workspaceId, {
          processedContacts: processedCount,
          failedContacts: failedCount,
          actualCost: String(totalCost),
        });

        // Update batch progress metrics (for persistent tracking)
        if (job.taskId) {
          const { crmBatches } = await import('@agios/db');
          await db.update(crmBatches)
            .set({
              totalEntities: contacts.length,
              processedEntities: processedCount + failedCount + skippedCount,
              successfulEntities: processedCount,
              failedEntities: failedCount,
              skippedEntities: skippedCount,
              actualCost: String(totalCost),
              updatedAt: new Date(),
            })
            .where(eq(crmBatches.id, job.taskId));
        }

        console.log(`[batch-processing] Completed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contacts.length / BATCH_SIZE)}: processed=${processedCount}, failed=${failedCount}, skipped=${skippedCount}, cost=${totalCost.toFixed(4)}`);
      }

      // Update to review status
      await this.updateJob(db, jobId, workspaceId, {
        status: 'review',
        completedAt: new Date(),
        skippedContacts: skippedCount,
      });

      return {
        processedCount,
        failedCount,
        skippedCount,
        totalCost,
      };
    } catch (error) {
      // Mark as failed
      await this.updateJob(db, jobId, workspaceId, {
        status: 'failed',
        completedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Run batch mode - enrich all contacts in list
   */
  async runBatch(db: Database, jobId: string, workspaceId: string) {
    const job = await this.getJob(db, jobId, workspaceId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Handle idempotent execution - skip if already running or completed
    if (job.status === 'running') {
      console.log(`Job ${jobId} already running, checking if it needs recovery...`);

      // Check if job is stuck (running for more than 30 minutes without updates)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const jobUpdatedAt = job.updatedAt ? new Date(job.updatedAt) : new Date(job.createdAt);

      if (jobUpdatedAt > thirtyMinutesAgo) {
        console.log(`Job ${jobId} is actively running, skipping duplicate execution`);
        return {
          processedCount: job.processedEntities || 0,
          failedCount: job.failedEntities || 0,
          skippedCount: job.skippedEntities || 0,
          totalCost: Number(job.actualCost) || 0,
        };
      }

      console.log(`Job ${jobId} appears stuck, will attempt recovery`);
      // Continue to recovery logic below
    } else if (job.status === 'completed') {
      console.log(`Job ${jobId} already completed, returning existing results`);
      return {
        processedCount: job.processedEntities || 0,
        failedCount: job.failedEntities || 0,
        skippedCount: job.skippedEntities || 0,
        totalCost: Number(job.actualCost) || 0,
      };
    } else if (job.status !== 'review' && job.status !== 'draft') {
      throw new Error(`Cannot run batch on job with status: ${job.status}`);
    }

    // Update status to running (or mark for recovery if stuck)
    await this.updateJob(db, jobId, workspaceId, {
      status: 'running',
      mode: 'batch',
      startedAt: job.status === 'running' ? job.startedAt : new Date(),
    });

    try {
      // Get the source list for budget checking
      const list = await db
        .select()
        .from(crmContactLists)
        .where(eq(crmContactLists.id, job.sourceListId))
        .then((results) => results[0] || null);

      if (!list) {
        throw new Error('Source list not found');
      }

      // Check if list budget allows starting
      const budgetCheck = await this.checkListBudget(db, job.sourceListId);
      if (!budgetCheck.allowed) {
        await this.updateJob(db, jobId, workspaceId, {
          status: 'budget_exceeded',
          completedAt: new Date(),
          lastError: budgetCheck.reason,
        });
        return {
          processedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalCost: 0,
        };
      }

      // Get all contacts/leads from list
      const contacts = await this.getContactsFromList(
        db,
        job.sourceListId,
        workspaceId
      );

      if (contacts.length === 0) {
        throw new Error('No entities found in list');
      }

      // Update total contacts
      await this.updateJob(db, jobId, workspaceId, {
        totalContacts: contacts.length,
      });

      // Process each entity (contact or lead)
      let processedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let totalCost = Number(job.actualCost) || 0;

      const BATCH_SIZE = 3;

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        try {
          const batchResults = await Promise.allSettled(
            batch.map(async (entity) => {
              let enrichmentResultId: string | undefined;

              try {
                // Create enrichment result first to get ID for tool call logging
                const enrichmentResults = await db.insert(crmEnrichmentResults).values({
                  workspaceId,
                  jobId,
                  entityId: entity.id,
                  entityType: isLead(entity) ? 'lead' : 'contact',
                  status: 'success', // Will be updated if enrichment fails
                  enrichmentData: {},
                }).returning();
                enrichmentResultId = enrichmentResults[0].id;

                const result = await this.enrichContact(entity, job, db, enrichmentResultId, jobId, workspaceId);

                // Check per-entity budget
                const contactBudgetCheck = this.checkContactBudget(result.cost, list);
                if (!contactBudgetCheck.allowed) {
                  console.log(`Skipping entity ${entity.id}: ${contactBudgetCheck.reason}`);

                  await db.update(crmEnrichmentResults)
                    .set({
                      status: 'skipped',
                      errorMessage: contactBudgetCheck.reason,
                    })
                    .where(eq(crmEnrichmentResults.id, enrichmentResultId));

                  return { status: 'skipped' as const, cost: 0 };
                }

                // Update result with enrichment data
                await db.update(crmEnrichmentResults)
                  .set({
                    status: 'success',
                    score: result.score ? String(result.score) : null,
                    enrichmentData: result.enrichmentData,
                    reasoning: result.reasoning,
                    tokensUsed: result.tokensUsed,
                    cost: result.cost ? String(result.cost) : null,
                    durationMs: result.durationMs,
                  })
                  .where(eq(crmEnrichmentResults.id, enrichmentResultId));

                // Auto-apply enrichment results to entity fields
                if (result.enrichmentData && Object.keys(result.enrichmentData).length > 0) {
                  // Extract standard fields from enrichment data
                  const standardFields: {
                    email?: string;
                    phone?: string;
                    title?: string;
                    linkedinUrl?: string;
                    companyName?: string;
                    leadScore?: number;
                  } = {};
                  const customFieldsData: Record<string, any> = {};

                  // Separate standard fields from custom fields
                  for (const [key, value] of Object.entries(result.enrichmentData)) {
                    if (['email', 'phone', 'title', 'linkedinUrl', 'companyName', 'leadScore'].includes(key)) {
                      standardFields[key as keyof typeof standardFields] = value as any;
                    } else {
                      customFieldsData[key] = value;
                    }
                  }

                  if (isLead(entity)) {
                    // Update lead with both standard fields and customFields
                    const updateData: any = {
                      updatedAt: new Date(),
                    };

                    // Only set standard fields if they have values and the current field is empty
                    if (standardFields.email && !entity.email) updateData.email = standardFields.email;
                    if (standardFields.phone && !entity.phone) updateData.phone = standardFields.phone;
                    if (standardFields.title && !entity.title) updateData.title = standardFields.title;
                    if (standardFields.linkedinUrl && !entity.linkedinUrl) updateData.linkedinUrl = standardFields.linkedinUrl;
                    if (standardFields.companyName && !entity.companyName) updateData.companyName = standardFields.companyName;
                    if (standardFields.leadScore !== undefined && !entity.leadScore) updateData.leadScore = standardFields.leadScore;

                    // Extract country from enrichment data if lead.country is empty
                    if (!entity.country) {
                      const extractedCountry = extractCountryFromEnrichment(result.enrichmentData);
                      if (extractedCountry) {
                        updateData.country = extractedCountry;
                        console.log(`[enrichment] Extracted country "${extractedCountry}" for lead ${entity.id}`);
                      }
                    }

                    // US-CONF-003: Calculate effective lead score from confidence data
                    // Only calculate if we have a lead score (either new or existing)
                    const finalLeadScore = standardFields.leadScore ?? entity.leadScore ?? 0;
                    if (finalLeadScore > 0 && result.enrichmentData._confidence) {
                      const confidenceScores = result.enrichmentData._confidence;
                      const effectiveScore = calculateEffectiveLeadScore(finalLeadScore, confidenceScores);
                      updateData.effectiveLeadScore = effectiveScore;

                      console.log(`[US-CONF-003] Calculated effective lead score: base=${finalLeadScore}, effective=${effectiveScore}`);
                    }

                    // Merge custom fields (both standard and extra fields go here for history)
                    updateData.customFields = sql`${crmLeads.customFields} || ${JSON.stringify(result.enrichmentData)}::jsonb`;

                    await db.update(crmLeads)
                      .set(updateData)
                      .where(eq(crmLeads.id, entity.id));
                  } else {
                    // Update contact with both standard fields and customFields
                    const updateData: any = {
                      updatedAt: new Date(),
                    };

                    // Only set standard fields if they have values and the current field is empty
                    if (standardFields.email && !entity.email) updateData.email = standardFields.email;
                    if (standardFields.phone && !entity.phone) updateData.phone = standardFields.phone;
                    if (standardFields.title && !entity.title) updateData.title = standardFields.title;
                    if (standardFields.linkedinUrl && !entity.linkedinUrl) updateData.linkedinUrl = standardFields.linkedinUrl;

                    // Merge custom fields (both standard and extra fields go here for history)
                    updateData.customFields = sql`${crmContacts.customFields} || ${JSON.stringify(result.enrichmentData)}::jsonb`;

                    await db.update(crmContacts)
                      .set(updateData)
                      .where(eq(crmContacts.id, entity.id));
                  }
                }

                // Write enrichment history (Epic 2: Backend API & Services)
                try {
                  const { enrichmentHistoryService } = await import('./enrichment-history.service');

                  // Generate markdown report from enrichment result
                  const markdownReport = this.generateEnrichmentReport({
                    entity,
                    result,
                    job,
                    jobId,
                  });

                  // Get template snapshot (if this was a task-based enrichment)
                  let templateSnapshot: any = {
                    model: job.model,
                    prompt: job.prompt,
                    temperature: job.temperature,
                    maxTokens: job.maxTokens,
                    type: job.type,
                  };

                  // Epic 5: Detect changes from previous enrichment
                  const changesSinceLast = await this.detectChanges(
                    db,
                    entity.id,
                    isLead(entity) ? 'lead' : 'contact',
                    workspaceId,
                    result.enrichmentData
                  );

                  // Create history entry with content deduplication
                  const historyEntry = await enrichmentHistoryService.createEntry(db, {
                    workspaceId,
                    entityId: entity.id,
                    entityType: isLead(entity) ? 'lead' : 'contact',
                    enrichmentReport: markdownReport,
                    templateSnapshot,
                    taskId: job.taskId || undefined,
                    jobId,
                    enrichmentSummary: result.reasoning?.substring(0, 500), // First 500 chars as summary
                    changesSinceLast, // Epic 5: AI Context Integration
                  });

                  // Trigger SSE notification via PostgreSQL NOTIFY
                  await db.execute(sql`
                    SELECT pg_notify(
                      'enrichment_history_changed',
                      ${JSON.stringify({
                        workspaceId,
                        entityId: entity.id,
                        historyId: historyEntry.id,
                      })}
                    )
                  `);

                  console.log(`[enrichment-history] Created history entry ${historyEntry.id} for entity ${entity.id}`);
                } catch (historyError) {
                  // Don't fail enrichment if history writing fails
                  console.error(`[enrichment-history] Failed to write history for entity ${entity.id}:`, historyError);
                }

                // Emit progress event via PostgreSQL NOTIFY for real-time SSE updates
                if (job.taskId) {
                  const entityName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
                  const progressEvent = {
                    type: 'contact_processed',
                    contactId: entity.id,
                    contactName: entityName || 'Unknown',
                    contactEmail: entity.email || undefined,
                    status: 'success',
                    cost: result.cost,
                    timestamp: new Date().toISOString(),
                  };

                  const channel = `task_progress_${job.taskId}`;
                  const payload = JSON.stringify(progressEvent);
                  await db.execute(sql.raw(`SELECT pg_notify('${channel}', '${payload.replace(/'/g, "''")}')`));
                }

                return { status: 'success' as const, cost: result.cost || 0 };
              } catch (error) {
                console.error(`Failed to enrich entity ${entity.id}:`, error);

                // Update result with error (if enrichment result was created)
                if (enrichmentResultId) {
                  await db.update(crmEnrichmentResults)
                    .set({
                      status: 'failed',
                      errorMessage: error instanceof Error ? error.message : String(error),
                    })
                    .where(eq(crmEnrichmentResults.id, enrichmentResultId));
                }

                // Emit failed progress event
                if (job.taskId) {
                  const entityName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
                  const progressEvent = {
                    type: 'contact_processed',
                    contactId: entity.id,
                    contactName: entityName || 'Unknown',
                    contactEmail: entity.email || undefined,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                  };

                  const channel = `task_progress_${job.taskId}`;
                  const payload = JSON.stringify(progressEvent);
                  await db.execute(sql.raw(`SELECT pg_notify('${channel}', '${payload.replace(/'/g, "''")}')`));
                }

                return { status: 'failed' as const, cost: 0, error: error instanceof Error ? error.message : String(error) };
              }
            })
          );

          // Process batch results and update counters
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const value = result.value;
              if (value.status === 'success') {
                processedCount++;
                totalCost += value.cost;
              } else if (value.status === 'skipped') {
                skippedCount++;
              } else if (value.status === 'failed') {
                failedCount++;
              }
            } else {
              // Promise was rejected (shouldn't happen with our error handling, but just in case)
              failedCount++;
              console.error('Batch promise rejected:', result.reason);
            }
          }

          // Update progress after batch completion
          await this.updateJob(db, jobId, workspaceId, {
            processedContacts: processedCount,
            failedContacts: failedCount,
            actualCost: String(totalCost),
            lastError: failedCount > 0 ? 'Some contacts failed to enrich' : undefined,
          });

          // Update batch progress metrics (for persistent tracking)
          if (job.taskId) {
            const { crmBatches } = await import('@agios/db');
            await db.update(crmBatches)
              .set({
                totalEntities: contacts.length,
                processedEntities: processedCount + failedCount + skippedCount,
                successfulEntities: processedCount,
                failedEntities: failedCount,
                skippedEntities: skippedCount,
                actualCost: String(totalCost),
                updatedAt: new Date(),
              })
              .where(eq(crmBatches.id, job.taskId));
          }
        } catch (batchError) {
          console.error(`Batch processing error:`, batchError);
          // Continue with next batch even if this one had issues
        }
      }

      // Emit task completed event
      if (job.taskId) {
        const completedEvent = {
          type: 'task_completed',
          timestamp: new Date().toISOString(),
          summary: {
            processedCount,
            failedCount,
            skippedCount,
            totalCost,
          },
        };

        await db.execute(sql`
          SELECT pg_notify(
            ${`task_progress_${job.taskId}`},
            ${JSON.stringify(completedEvent)}
          )
        `);
      }

      // Update to completed status
      await this.updateJob(db, jobId, workspaceId, {
        status: 'completed',
        completedAt: new Date(),
        skippedContacts: skippedCount,
      });

      // Update template metadata if this job was created from a batch
      const enrichmentJob = await this.getJob(db, jobId, workspaceId);
      if (enrichmentJob?.taskId) {
        // Get batch to find template ID (taskId column still references batch for backwards compatibility)
        const { crmBatches } = await import('@agios/db');
        const [task] = await db
          .select()
          .from(crmBatches)
          .where(eq(crmBatches.id, enrichmentJob.taskId));

        if (task?.configuration?.templateId) {
          try {
            const { templatesService } = await import('./templates.service');
            const { crmTemplates } = await import('@agios/db');

            // Calculate estimated cost per contact
            const estimatedCostPerContact = processedCount > 0
              ? totalCost / processedCount
              : 0;

            // Update template metadata
            await db.execute(sql`
              UPDATE crm_templates
              SET
                metadata = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      metadata,
                      '{usageCount}',
                      to_jsonb(COALESCE((metadata->>'usageCount')::int, 0) + ${processedCount})
                    ),
                    '{lastUsedAt}',
                    to_jsonb(NOW()::text)
                  ),
                  '{estimatedCostPerContact}',
                  to_jsonb(${estimatedCostPerContact})
                ),
                updated_at = NOW()
              WHERE id = ${task.configuration.templateId}
            `);

            console.log(`[Enrichment] Updated template ${task.configuration.templateId} metadata: usageCount +${processedCount}, estimatedCost: $${estimatedCostPerContact.toFixed(4)}`);
          } catch (templateError) {
            // Log error but don't fail the job - enrichment succeeded
            console.error('[Enrichment] Failed to update template metadata (non-fatal):', templateError);
          }
        }
      }

      return {
        processedCount,
        failedCount,
        skippedCount,
        totalCost,
      };
    } catch (error) {
      // Mark as failed
      await this.updateJob(db, jobId, workspaceId, {
        status: 'failed',
        completedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Enrich a single contact/lead using AI (with function calling support)
   */
  async enrichContact(
    entity: EnrichableEntity,
    job: {
      model: string;
      prompt: string;
      temperature: string | null;
      maxTokens: number | null;
      type: 'scoring' | 'classification' | 'enhancement' | 'qualification';
    },
    db?: Database,
    enrichmentResultId?: string,
    jobId?: string,
    workspaceId?: string
  ): Promise<{
    score?: number;
    classification?: string;
    enrichmentData: Record<string, any>;
    reasoning: string;
    tokensUsed: number;
    cost: number;
    durationMs: number;
    toolCalls?: Array<{
      toolName: string;
      arguments: any;
      result: any;
      cost: number;
      durationMs: number;
    }>;
  }> {
    const startTime = Date.now();

    // Epic 5: Fetch enrichment history for AI context integration
    let historyContext = '';
    if (db && entity.workspaceId) {
      historyContext = await this.getEnrichmentContext(db, {
        entityId: entity.id,
        entityType: isLead(entity) ? 'lead' : 'contact',
        workspaceId: entity.workspaceId,
        limit: 3, // Last 3 enrichments
      });
    }

    // Prepare entity data for AI (works for both contacts and leads)
    const entityData = {
      name: `${entity.firstName} ${entity.lastName}`,
      companyName: 'companyName' in entity ? entity.companyName : undefined,
      email: entity.email,
      phone: entity.phone,
      title: 'title' in entity ? entity.title : undefined,
      department: 'department' in entity ? entity.department : undefined,
      leadScore: 'leadScore' in entity ? entity.leadScore : undefined,
      engagementScore: 'engagementScore' in entity ? entity.engagementScore : undefined,
      lifecycleStage: 'lifecycleStage' in entity ? entity.lifecycleStage : undefined,
      customFields: entity.customFields,
    };

    // Epic 5: Build prompt with historical context
    const enhancedPrompt = this.buildPromptWithContext(
      entityData,
      job,
      historyContext
    );

    const messages: any[] = [
      {
        role: 'system',
        content: enhancedPrompt.systemPrompt,
      },
      {
        role: 'user',
        content: enhancedPrompt.userPrompt,
      },
    ];

    let totalTokensUsed = 0;
    let totalCost = 0;
    const toolCalls: Array<{
      toolName: string;
      arguments: any;
      result: any;
      cost: number;
      durationMs: number;
    }> = [];

    // Main conversation loop (handles multiple tool calls)
    let iteration = 0;
    const MAX_ITERATIONS = 15; // Increased to allow more web searches per lead

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // BL-ENR-017: Check elapsed time before each iteration
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > ENRICHMENT_TIMEOUT_MS) {
        throw new Error(`Enrichment timed out after ${Math.floor(elapsedMs / 1000)}s (max ${ENRICHMENT_TIMEOUT_MS / 1000}s)`);
      }

      // Call OpenRouter API with tools (with rate limit retry)
      let response: Response;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (retryCount <= MAX_RETRIES) {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://agios.dev',
            'X-Title': 'NewLeads CRM',
          },
          // BL-ENR-017: Abort if single API call takes >60s
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({
            model: job.model,
            messages,
            temperature: job.temperature ? Number(job.temperature) : 0.7,
            max_tokens: job.maxTokens || 1000,
            tools: [
              webSearchFunctionDefinition,
              emailVerificationFunctionDefinition,
              googleMapsFunctionDefinition,
              linkedInFunctionDefinition,
              cipcFunctionDefinition,
              contactUpdateFunctionDefinition,
            ],
            tool_choice: 'auto',
          }),
        });

        // Handle rate limiting (429) with exponential backoff
        if (response.status === 429) {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API rate limit exceeded after ${MAX_RETRIES} retries: ${errorText}`);
          }

          // Exponential backoff: 2^retryCount seconds (2s, 4s, 8s)
          const delaySeconds = Math.pow(2, retryCount);
          console.log(`[enrichContact] Rate limited, retrying in ${delaySeconds}s (attempt ${retryCount}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }

        // Break on success or other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        break;
      }

      const data = await response!.json();

      // Track token usage
      if (data.usage) {
        totalTokensUsed += data.usage.total_tokens;
        totalCost += this.calculateCost(data.usage, job.model);
      }

      const assistantMessage = data.choices[0].message;

      // Check if AI wants to call a tool
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message to conversation
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolStartTime = Date.now();
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`🔧 Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);

          let toolResult: any;
          let toolCost = 0;
          let toolError: string | undefined;
          let toolProvider: string | undefined;

          try {
            if (toolName === 'web_search') {
              const webSearch = getWebSearchTool();
              const searchResult = await webSearch.search(toolArgs.query, {
                count: toolArgs.count,
                freshness: toolArgs.freshness,
              });
              toolResult = {
                results: searchResult.results,
                cached: searchResult.cached,
                provider: searchResult.provider,
              };
              toolCost = searchResult.cost;
              toolProvider = searchResult.provider;
            } else if (toolName === 'verify_email') {
              const emailVerification = getEmailVerificationTool();
              const verifyResult = await emailVerification.verify(
                toolArgs.email,
                toolArgs.ip_address
              );
              toolResult = {
                ...verifyResult.result,
                cached: verifyResult.cached,
              };
              toolCost = verifyResult.cost;
            } else if (toolName === 'lookup_business') {
              const googleMaps = getGoogleMapsTool();
              const lookupResult = await googleMaps.lookupBusiness(
                toolArgs.query,
                toolArgs.location
              );
              toolResult = {
                results: lookupResult.results,
                cached: lookupResult.cached,
              };
              toolCost = lookupResult.cost;
            } else if (toolName === 'enrich_linkedin') {
              const linkedin = getLinkedInTool();
              const enrichResult = await linkedin.enrichProfile(
                toolArgs.profile_url
              );
              toolResult = {
                profile: enrichResult.profile,
                cached: enrichResult.cached,
              };
              toolCost = enrichResult.cost;
            } else if (toolName === 'lookup_sa_company') {
              const cipc = getCIPCTool();
              const lookupResult = await cipc.lookupCompany(toolArgs.query);
              toolResult = {
                company: lookupResult.company,
                cached: lookupResult.cached,
              };
              toolCost = lookupResult.cost;
            } else if (toolName === 'update_contact') {
              const contactUpdater = getContactUpdateTool();
              const updateResult = await contactUpdater.updateContact({
                contactId: toolArgs.contact_id,
                workspaceId: toolArgs.workspace_id,
                updates: toolArgs.updates,
                reason: toolArgs.reason,
                source: toolArgs.source,
              });
              toolResult = updateResult;
              toolCost = 0; // No external cost for database operations
            } else {
              throw new Error(`Unknown tool: ${toolName}`);
            }
          } catch (error) {
            console.error(`❌ Tool call failed: ${error instanceof Error ? error.message : error}`);
            toolError = error instanceof Error ? error.message : String(error);
            toolResult = { error: toolError };
          }

          const toolDurationMs = Date.now() - toolStartTime;

          // Track tool call
          const toolCallRecord = {
            toolName,
            arguments: toolArgs,
            result: toolResult,
            cost: toolCost,
            durationMs: toolDurationMs,
          };
          toolCalls.push(toolCallRecord);
          totalCost += toolCost;

          // Log tool call to database if we have context
          if (db && enrichmentResultId && entity.workspaceId) {
            try {
              await db.insert(crmToolCalls).values({
                workspaceId: entity.workspaceId,
                enrichmentResultId,
                toolName,
                arguments: toolArgs,
                result: toolResult,
                provider: toolProvider,
                cost: String(toolCost),
                durationMs: toolDurationMs,
                status: toolError ? 'failed' : 'success',
                error: toolError,
              });

              // Log to job_logs for real-time SSE streaming (US-011: Task Execution Transparency)
              if (jobId && workspaceId) {
                await jobLoggingService.logToolCall(db, {
                  workspaceId,
                  jobId,
                  jobType: 'enrichment',
                  toolName,
                  toolStatus: toolError ? 'failed' : 'completed',
                  duration: toolDurationMs,
                  cost: toolCost,
                  error: toolError ? { code: 'TOOL_ERROR', message: toolError } : undefined,
                  entityId: entity.id,
                  entityType: isLead(entity) ? 'lead' : 'contact',
                });
              }
            } catch (dbError) {
              console.error('Failed to log tool call to database:', dbError);
            }
          }

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Continue conversation with tool results
        continue;
      }

      // No more tool calls - extract final response
      const aiResponse = assistantMessage.content;
      const durationMs = Date.now() - startTime;

      // Parse AI response based on job type
      const result = this.parseEnrichmentResponse(aiResponse, job.type);

      return {
        ...result,
        tokensUsed: totalTokensUsed,
        cost: totalCost,
        durationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    }

    // Max iterations reached
    throw new Error('Maximum tool call iterations reached');
  },

  /**
   * Parse AI response based on job type
   * US-CONF-001: Enhanced to validate and apply confidence scores
   */
  parseEnrichmentResponse(
    response: string,
    jobType: 'scoring' | 'classification' | 'enhancement' | 'qualification'
  ): EnrichmentResponse {
    let jsonString = response.trim();
    let extractedJson: any = null;

    // Strategy 1: Try to extract JSON from markdown code blocks with flexible matching
    // Handles: ```json...```, ```...```, ````json...````, etc.
    const codeBlockPatterns = [
      /`{3,}(?:json|JSON)?\s*\n?([\s\S]*?)\n?`{3,}/,  // Flexible backtick count
      /`{4,}([\s\S]*?)`{4,}/,  // 4+ backticks (alternate format)
      /```[\s\S]*?\n([\s\S]*?)\n```/,  // Original strict pattern
    ];

    for (const pattern of codeBlockPatterns) {
      const match = jsonString.match(pattern);
      if (match) {
        const extracted = match[1].trim();
        try {
          extractedJson = JSON.parse(extracted);
          break; // Successfully parsed
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Strategy 2: If markdown extraction failed, try to find JSON object in response
    if (!extractedJson) {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedJson = JSON.parse(jsonMatch[0]);
        } catch {
          // Continue to fallback
        }
      }
    }

    // Strategy 3: Try to find JSON within various markdown patterns
    if (!extractedJson) {
      const patterns = [
        /##\s+(?:Enriched\s+)?Data[\s\S]*?\n([\s\S]*?)\n(?:##|$)/i,
        /###\s+(?:Enriched\s+)?Data[\s\S]*?\n([\s\S]*?)\n(?:###|##|$)/i,
        /(?:Enriched|Extracted)\s+(?:Data|Information)[\s\S]*?\n([\s\S]*?)\n(?:##|$)/i,
      ];

      for (const pattern of patterns) {
        const match = jsonString.match(pattern);
        if (match) {
          const section = match[1].trim();
          // Try to extract JSON from this section
          const jsonInSection = section.match(/\{[\s\S]*\}/);
          if (jsonInSection) {
            try {
              extractedJson = JSON.parse(jsonInSection[0]);
              break;
            } catch {
              // Continue
            }
          }
        }
      }
    }

    // If we successfully extracted JSON, use it
    if (extractedJson && typeof extractedJson === 'object') {
      try {
        let enrichmentData = extractedJson;

        // US-CONF-001: Validate and normalize confidence scores
        const confidence = extractConfidence(enrichmentData);
        if (confidence) {
          // AI provided confidence - replace with validated version
          enrichmentData._confidence = confidence;
        } else {
          // No confidence provided - apply default (legacy handling)
          enrichmentData = applyDefaultConfidence(enrichmentData);
        }

        return {
          score: extractedJson.score,
          classification: extractedJson.classification,
          enrichmentData,
          reasoning: extractedJson.reasoning || response,
        };
      } catch (error) {
        // Fall through to error handling below
        console.error('[parseEnrichmentResponse] Error processing extracted JSON:', error);
      }
    }

    // Fallback: Parse as direct JSON (in case response is just JSON without markdown)
    try {
      const parsed = JSON.parse(jsonString);
      let enrichmentData = parsed;

      const confidence = extractConfidence(enrichmentData);
      if (confidence) {
        enrichmentData._confidence = confidence;
      } else {
        enrichmentData = applyDefaultConfidence(enrichmentData);
      }

      return {
        score: parsed.score,
        classification: parsed.classification,
        enrichmentData,
        reasoning: parsed.reasoning || response,
      };
    } catch {
      // Unable to extract/parse JSON - store full response and handle by type
      if (jobType === 'scoring') {
        const scoreMatch = response.match(/score[:\s]+(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined;

        const enrichmentData = applyDefaultConfidence({ rawResponse: response });

        return {
          score,
          enrichmentData,
          reasoning: response,
        };
      }

      // For non-scoring types, store full response
      const enrichmentData = applyDefaultConfidence({ rawResponse: response });

      return {
        enrichmentData,
        reasoning: response,
      };
    }
  },

  /**
   * Calculate cost based on token usage
   */
  calculateCost(
    usage: { prompt_tokens: number; completion_tokens: number },
    model: string
  ): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['openai/gpt-4o-mini'];

    const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  },

  /**
   * Estimate cost for enriching N contacts
   */
  estimateCost(
    contactCount: number,
    model: string,
    avgTokensPerContact = 500
  ): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['openai/gpt-4o-mini'];

    // Assume 60% input, 40% output
    const inputTokens = avgTokensPerContact * 0.6;
    const outputTokens = avgTokensPerContact * 0.4;

    const costPerContact =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output;

    return costPerContact * contactCount;
  },

  /**
   * Generate markdown enrichment report for history
   * Epic 2: Backend API & Services for Enrichment History
   */
  generateEnrichmentReport(params: {
    entity: EnrichableEntity;
    result: {
      score?: number;
      classification?: string;
      enrichmentData: Record<string, any>;
      reasoning: string;
      tokensUsed: number;
      cost: number;
      durationMs: number;
      toolCalls?: Array<{
        toolName: string;
        arguments: any;
        result: any;
        cost: number;
        durationMs: number;
      }>;
    };
    job: {
      model: string;
      type: string;
      [key: string]: any;
    };
    jobId: string;
  }): string {
    const { entity, result, job, jobId } = params;

    const entityName = `${entity.firstName} ${entity.lastName}`.trim();
    const entityType = isLead(entity) ? 'Lead' : 'Contact';

    let markdown = `# Enrichment Report\n\n`;
    markdown += `**Entity:** ${entityName} (${entityType})\n`;
    markdown += `**Job ID:** ${jobId}\n`;
    markdown += `**Model:** ${job.model}\n`;
    markdown += `**Type:** ${job.type}\n`;
    markdown += `**Date:** ${new Date().toISOString()}\n\n`;

    markdown += `---\n\n`;

    // Score/Classification
    if (result.score !== undefined) {
      markdown += `## Score\n\n**${result.score}** / 100\n\n`;
    }
    if (result.classification) {
      markdown += `## Classification\n\n${result.classification}\n\n`;
    }

    // Reasoning
    markdown += `## Reasoning\n\n${result.reasoning}\n\n`;

    // Enrichment Data
    if (Object.keys(result.enrichmentData).length > 0) {
      markdown += `## Enrichment Data\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify(result.enrichmentData, null, 2)}\n\`\`\`\n\n`;
    }

    // Tool Calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      markdown += `## Tool Calls\n\n`;
      for (const toolCall of result.toolCalls) {
        markdown += `### ${toolCall.toolName}\n\n`;
        markdown += `**Arguments:**\n\`\`\`json\n${JSON.stringify(toolCall.arguments, null, 2)}\n\`\`\`\n\n`;
        markdown += `**Result:**\n\`\`\`json\n${JSON.stringify(toolCall.result, null, 2)}\n\`\`\`\n\n`;
        markdown += `**Cost:** $${toolCall.cost.toFixed(4)} | **Duration:** ${toolCall.durationMs}ms\n\n`;
      }
    }

    // Email Verification Summary (CRM-005)
    // Extract verify_email tool calls and summarize eliminated emails
    if (result.toolCalls && result.toolCalls.length > 0) {
      const emailVerifications = result.toolCalls.filter(tc => tc.toolName === 'verify_email');
      if (emailVerifications.length > 0) {
        const invalidEmails = emailVerifications.filter(tc => {
          const res = tc.result as { status?: string };
          return res && res.status !== 'valid';
        });

        if (invalidEmails.length > 0) {
          markdown += `## Email Verification Results\n\n`;
          markdown += `**${invalidEmails.length} of ${emailVerifications.length} email(s) failed verification:**\n\n`;

          for (const tc of invalidEmails) {
            const res = tc.result as {
              email?: string;
              status?: string;
              subStatus?: string;
              mxFound?: boolean;
              didYouMean?: string;
            };
            if (res && res.email) {
              // Map subStatus to human-readable text
              const subStatusLabels: Record<string, string> = {
                mailbox_not_found: 'Mailbox does not exist',
                no_dns_entries: 'No DNS records found for domain',
                does_not_accept_mail: 'Domain does not accept mail',
                failed_syntax_check: 'Invalid email format',
                possible_typo: 'Possible typo in email address',
                disposable: 'Disposable email address',
                role_based: 'Role-based email (e.g., info@, support@)',
                global_suppression: 'On global suppression list',
              };
              const reason = subStatusLabels[res.subStatus || ''] || res.subStatus || 'Unknown reason';
              const suggestion = res.didYouMean ? ` (Did you mean: ${res.didYouMean}?)` : '';
              markdown += `- **${res.email}**: ${reason}${suggestion}\n`;
            }
          }
          markdown += '\n';

          // Note about MX records
          const noMx = invalidEmails.filter(tc => {
            const res = tc.result as { mxFound?: boolean };
            return res && res.mxFound === false;
          });
          if (noMx.length > 0) {
            markdown += `*${noMx.length} domain(s) had no MX records configured.*\n\n`;
          }
        }
      }
    }

    // Metadata
    markdown += `---\n\n`;
    markdown += `## Metadata\n\n`;
    markdown += `- **Tokens Used:** ${result.tokensUsed}\n`;
    markdown += `- **Cost:** $${result.cost.toFixed(4)}\n`;
    markdown += `- **Duration:** ${result.durationMs}ms\n`;

    return markdown;
  },

  // ========================================================================
  // SCORING MODELS
  // ========================================================================

  /**
   * List scoring models
   * Includes workspace-specific models AND global templates (workspace_id = NULL)
   */
  async listScoringModels(
    db: Database,
    workspaceId: string,
    isTemplate?: boolean
  ) {
    const conditions = [
      isNull(crmScoringModels.deletedAt),
      // Include both workspace-specific models AND global templates
      or(
        eq(crmScoringModels.workspaceId, workspaceId),
        and(
          isNull(crmScoringModels.workspaceId),
          eq(crmScoringModels.isTemplate, true)
        )
      ),
    ];

    if (isTemplate !== undefined) {
      conditions.push(eq(crmScoringModels.isTemplate, isTemplate));
    }

    return await db
      .select()
      .from(crmScoringModels)
      .where(and(...conditions))
      .orderBy(crmScoringModels.createdAt);
  },

  /**
   * Get scoring model by ID
   * Can retrieve workspace-specific models OR global templates
   */
  async getScoringModel(
    db: Database,
    id: string,
    workspaceId: string
  ) {
    const [model] = await db
      .select()
      .from(crmScoringModels)
      .where(
        and(
          eq(crmScoringModels.id, id),
          or(
            eq(crmScoringModels.workspaceId, workspaceId),
            and(
              isNull(crmScoringModels.workspaceId),
              eq(crmScoringModels.isTemplate, true)
            )
          ),
          isNull(crmScoringModels.deletedAt)
        )
      );

    return model;
  },

  /**
   * Create scoring model
   */
  async createScoringModel(
    db: Database,
    data: NewCrmScoringModel
  ) {
    const [model] = await db
      .insert(crmScoringModels)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return model;
  },

  /**
   * Update scoring model
   */
  async updateScoringModel(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<NewCrmScoringModel>
  ) {
    const [model] = await db
      .update(crmScoringModels)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmScoringModels.id, id),
          eq(crmScoringModels.workspaceId, workspaceId),
          isNull(crmScoringModels.deletedAt)
        )
      )
      .returning();

    return model;
  },

  /**
   * Delete scoring model (soft delete)
   */
  async deleteScoringModel(
    db: Database,
    id: string,
    workspaceId: string
  ) {
    const [model] = await db
      .update(crmScoringModels)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmScoringModels.id, id),
          eq(crmScoringModels.workspaceId, workspaceId),
          isNull(crmScoringModels.deletedAt)
        )
      )
      .returning();

    return model;
  },

  // ========================================================================
  // SCHEDULING
  // ========================================================================

  /**
   * Schedule recurring enrichment job
   */
  async scheduleJob(
    db: Database,
    jobId: string,
    workspaceId: string,
    schedule: {
      cron: string;
      timezone?: string;
      endDate?: Date;
      maxRuns?: number;
    }
  ) {
    // Get the job
    const [job] = await db
      .select()
      .from(crmEnrichmentJobs)
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      );

    if (!job) {
      throw new Error('Job not found');
    }

    // Generate unique schedule name for pg-boss
    const scheduleName = `enrichment-${jobId}`;

    // Schedule with pg-boss
    await jobQueue.schedule(
      'execute-enrichment',
      schedule.cron,
      {
        jobId,
        workspaceId,
        mode: 'batch' as const,
      },
      {
        timezone: schedule.timezone || 'UTC',
      }
    );

    // Update job with schedule info
    const [updatedJob] = await db
      .update(crmEnrichmentJobs)
      .set({
        isScheduled: true,
        scheduleCron: schedule.cron,
        scheduleTimezone: schedule.timezone || 'UTC',
        schedulePaused: false,
        scheduleEndDate: schedule.endDate,
        scheduleMaxRuns: schedule.maxRuns,
        pgbossScheduleName: scheduleName,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId)
        )
      )
      .returning();

    return updatedJob;
  },

  /**
   * Pause scheduled job
   */
  async pauseSchedule(
    db: Database,
    jobId: string,
    workspaceId: string
  ) {
    const [job] = await db
      .update(crmEnrichmentJobs)
      .set({
        schedulePaused: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          eq(crmEnrichmentJobs.isScheduled, true),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      )
      .returning();

    return job;
  },

  /**
   * Resume paused schedule
   */
  async resumeSchedule(
    db: Database,
    jobId: string,
    workspaceId: string
  ) {
    const [job] = await db
      .update(crmEnrichmentJobs)
      .set({
        schedulePaused: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          eq(crmEnrichmentJobs.isScheduled, true),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      )
      .returning();

    return job;
  },

  /**
   * Unschedule job
   */
  async unscheduleJob(
    db: Database,
    jobId: string,
    workspaceId: string
  ) {
    const [job] = await db
      .select()
      .from(crmEnrichmentJobs)
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId),
          isNull(crmEnrichmentJobs.deletedAt)
        )
      );

    if (!job || !job.pgbossScheduleName) {
      throw new Error('Job not found or not scheduled');
    }

    // Unschedule from pg-boss
    await jobQueue.unschedule(job.pgbossScheduleName);

    // Update job
    const [updatedJob] = await db
      .update(crmEnrichmentJobs)
      .set({
        isScheduled: false,
        schedulePaused: false,
        pgbossScheduleName: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmEnrichmentJobs.id, jobId),
          eq(crmEnrichmentJobs.workspaceId, workspaceId)
        )
      )
      .returning();

    return updatedJob;
  },

  // ========================================================================
  // A/B TESTING
  // ========================================================================

  /**
   * Create A/B test
   */
  async createAbTest(
    db: Database,
    data: NewCrmEnrichmentAbTest
  ) {
    const [abTest] = await db
      .insert(crmEnrichmentAbTests)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return abTest;
  },

  /**
   * Run A/B test (creates and runs both variant jobs)
   */
  async runAbTest(
    db: Database,
    abTestId: string,
    workspaceId: string
  ) {
    const [abTest] = await db
      .select()
      .from(crmEnrichmentAbTests)
      .where(
        and(
          eq(crmEnrichmentAbTests.id, abTestId),
          eq(crmEnrichmentAbTests.workspaceId, workspaceId),
          isNull(crmEnrichmentAbTests.deletedAt)
        )
      );

    if (!abTest) {
      throw new Error('A/B test not found');
    }

    // Create Variant A job
    const variantAJob = await this.createJob(db, {
      workspaceId,
      name: `${abTest.name} - ${abTest.variantAName}`,
      type: 'scoring',
      mode: 'sample',
      sampleSize: abTest.sampleSize,
      sourceListId: abTest.sourceListId,
      model: abTest.model,
      prompt: abTest.variantAPrompt,
      temperature: abTest.temperature ? String(abTest.temperature) : '0.7',
      maxTokens: abTest.maxTokens || 500,
      ownerId: abTest.ownerId,
      createdBy: abTest.createdBy,
    });

    // Create Variant B job
    const variantBJob = await this.createJob(db, {
      workspaceId,
      name: `${abTest.name} - ${abTest.variantBName}`,
      type: 'scoring',
      mode: 'sample',
      sampleSize: abTest.sampleSize,
      sourceListId: abTest.sourceListId,
      model: abTest.model,
      prompt: abTest.variantBPrompt,
      temperature: abTest.temperature ? String(abTest.temperature) : '0.7',
      maxTokens: abTest.maxTokens || 500,
      ownerId: abTest.ownerId,
      createdBy: abTest.createdBy,
    });

    // Update A/B test with job IDs
    const [updatedTest] = await db
      .update(crmEnrichmentAbTests)
      .set({
        variantAJobId: variantAJob.id,
        variantBJobId: variantBJob.id,
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmEnrichmentAbTests.id, abTestId))
      .returning();

    // Run both variants
    await Promise.all([
      this.runSample(db, variantAJob.id, workspaceId),
      this.runSample(db, variantBJob.id, workspaceId),
    ]);

    // Calculate results
    await this.calculateAbTestResults(db, abTestId, workspaceId);

    return updatedTest;
  },

  /**
   * Calculate A/B test results and statistical significance
   */
  async calculateAbTestResults(
    db: Database,
    abTestId: string,
    workspaceId: string
  ) {
    const [abTest] = await db
      .select()
      .from(crmEnrichmentAbTests)
      .where(
        and(
          eq(crmEnrichmentAbTests.id, abTestId),
          eq(crmEnrichmentAbTests.workspaceId, workspaceId)
        )
      );

    if (!abTest || !abTest.variantAJobId || !abTest.variantBJobId) {
      throw new Error('A/B test not found or variants not run');
    }

    // Get average scores for both variants
    const [variantAResults] = await db
      .select({
        avgScore: sql<number>`AVG(${crmEnrichmentResults.score})`,
      })
      .from(crmEnrichmentResults)
      .where(eq(crmEnrichmentResults.jobId, abTest.variantAJobId));

    const [variantBResults] = await db
      .select({
        avgScore: sql<number>`AVG(${crmEnrichmentResults.score})`,
      })
      .from(crmEnrichmentResults)
      .where(eq(crmEnrichmentResults.jobId, abTest.variantBJobId));

    const avgScoreA = variantAResults?.avgScore || 0;
    const avgScoreB = variantBResults?.avgScore || 0;

    // Simple winner determination (for MVP - can be enhanced with proper t-test)
    const diff = Math.abs(avgScoreA - avgScoreB);
    const isSignificant = diff > 5; // 5 point difference threshold
    const winner = avgScoreA > avgScoreB ? 'A' : avgScoreB > avgScoreA ? 'B' : null;

    // Update A/B test with results
    const [updatedTest] = await db
      .update(crmEnrichmentAbTests)
      .set({
        variantAAvgScore: String(avgScoreA),
        variantBAvgScore: String(avgScoreB),
        winner,
        isSignificant,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmEnrichmentAbTests.id, abTestId))
      .returning();

    return updatedTest;
  },

  /**
   * Get A/B test with results
   */
  async getAbTest(
    db: Database,
    abTestId: string,
    workspaceId: string
  ) {
    const [abTest] = await db
      .select()
      .from(crmEnrichmentAbTests)
      .where(
        and(
          eq(crmEnrichmentAbTests.id, abTestId),
          eq(crmEnrichmentAbTests.workspaceId, workspaceId),
          isNull(crmEnrichmentAbTests.deletedAt)
        )
      );

    return abTest;
  },

  /**
   * List A/B tests
   */
  async listAbTests(
    db: Database,
    workspaceId: string
  ) {
    const tests = await db
      .select()
      .from(crmEnrichmentAbTests)
      .where(
        and(
          eq(crmEnrichmentAbTests.workspaceId, workspaceId),
          isNull(crmEnrichmentAbTests.deletedAt)
        )
      )
      .orderBy(crmEnrichmentAbTests.createdAt);

    return tests;
  },

  /**
   * Promote winner to production (create scoring model from winning variant)
   */
  async promoteAbTestWinner(
    db: Database,
    abTestId: string,
    workspaceId: string
  ) {
    const abTest = await this.getAbTest(db, abTestId, workspaceId);

    if (!abTest || !abTest.winner) {
      throw new Error('A/B test not found or no clear winner');
    }

    const winningPrompt = abTest.winner === 'A' ? abTest.variantAPrompt : abTest.variantBPrompt;
    const winningName = abTest.winner === 'A' ? abTest.variantAName : abTest.variantBName;

    // Create scoring model from winner
    const model = await this.createScoringModel(db, {
      workspaceId,
      name: `${abTest.name} - ${winningName} (Winner)`,
      description: `Winning variant from A/B test. Avg Score: ${abTest.winner === 'A' ? abTest.variantAAvgScore : abTest.variantBAvgScore}`,
      type: 'scoring',
      model: abTest.model,
      prompt: winningPrompt,
      temperature: abTest.temperature ? String(abTest.temperature) : '0.7',
      maxTokens: abTest.maxTokens || 500,
      isTemplate: false,
      ownerId: abTest.ownerId,
      tags: ['ab-test-winner'],
      metadata: { abTestId: abTest.id, winner: abTest.winner },
      createdBy: abTest.createdBy,
    });

    return model;
  },

  /**
   * Get enrichment analytics for workspace
   */
  async getAnalytics(
    db: Database,
    workspaceId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      listId?: string;
      model?: string;
    }
  ) {
    const { startDate, endDate, listId, model } = filters || {};

    // Build base query conditions
    const conditions = [
      eq(crmEnrichmentJobs.workspaceId, workspaceId),
      isNull(crmEnrichmentJobs.deletedAt),
    ];

    if (startDate) {
      conditions.push(gte(crmEnrichmentJobs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(crmEnrichmentJobs.createdAt, endDate));
    }
    if (listId) {
      conditions.push(eq(crmEnrichmentJobs.sourceListId, listId));
    }
    if (model) {
      conditions.push(eq(crmEnrichmentJobs.model, model));
    }

    // Get all jobs matching filters
    const jobs = await db
      .select({
        id: crmEnrichmentJobs.id,
        name: crmEnrichmentJobs.name,
        status: crmEnrichmentJobs.status,
        processedContacts: crmEnrichmentJobs.processedContacts,
        actualCost: crmEnrichmentJobs.actualCost,
        createdAt: crmEnrichmentJobs.createdAt,
        completedAt: crmEnrichmentJobs.completedAt,
        model: crmEnrichmentJobs.model,
      })
      .from(crmEnrichmentJobs)
      .where(and(...conditions));

    // Handle empty data
    if (!jobs || jobs.length === 0) {
      return {
        summary: {
          totalJobs: 0,
          completedJobs: 0,
          runningJobs: 0,
          failedJobs: 0,
          totalContactsProcessed: 0,
          totalCostSpent: '0.0000',
          averageCostPerContact: '0.0000',
        },
        byType: [],
        byModel: [],
        timeline: [],
        recentJobs: [],
      };
    }

    // Calculate summary metrics
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j) => j.status === 'completed').length;
    const runningJobs = jobs.filter((j) => j.status === 'running' || j.status === 'sampling').length;
    const failedJobs = jobs.filter((j) => j.status === 'failed').length;
    const totalContactsProcessed = jobs.reduce((sum, j) => sum + (j.processedContacts || 0), 0);
    const totalCostSpent = jobs.reduce((sum, j) => sum + parseFloat(j.actualCost || '0'), 0);
    const averageCostPerContact = totalContactsProcessed > 0
      ? totalCostSpent / totalContactsProcessed
      : 0;

    // Group by type (need to get type from jobs)
    const jobsWithType = await db
      .select({
        type: crmEnrichmentJobs.type,
        processedContacts: crmEnrichmentJobs.processedContacts,
        actualCost: crmEnrichmentJobs.actualCost,
      })
      .from(crmEnrichmentJobs)
      .where(and(...conditions));

    const byType: Array<{
      type: string;
      jobCount: number;
      contactsProcessed: number;
      totalCost: string;
    }> = [];
    const typeData = new Map<string, { jobCount: number; contactsProcessed: number; totalCost: number }>();

    for (const job of jobsWithType) {
      const type = job.type || 'unknown';
      const data = typeData.get(type) || { jobCount: 0, contactsProcessed: 0, totalCost: 0 };
      data.jobCount += 1;
      data.contactsProcessed += job.processedContacts || 0;
      data.totalCost += parseFloat(job.actualCost || '0');
      typeData.set(type, data);
    }

    for (const [type, data] of typeData.entries()) {
      byType.push({
        type,
        jobCount: data.jobCount,
        contactsProcessed: data.contactsProcessed,
        totalCost: data.totalCost.toFixed(4),
      });
    }

    // Group by model
    const byModel: Array<{
      model: string;
      jobCount: number;
      contactsProcessed: number;
      totalCost: string;
      avgCostPerContact: string;
    }> = [];
    const modelData = new Map<string, { jobCount: number; contactsProcessed: number; totalCost: number }>();

    for (const job of jobs) {
      if (job.model) {
        const data = modelData.get(job.model) || { jobCount: 0, contactsProcessed: 0, totalCost: 0 };
        data.jobCount += 1;
        data.contactsProcessed += job.processedContacts || 0;
        data.totalCost += parseFloat(job.actualCost || '0');
        modelData.set(job.model, data);
      }
    }

    for (const [model, data] of modelData.entries()) {
      const avgCostPerContact = data.contactsProcessed > 0
        ? data.totalCost / data.contactsProcessed
        : 0;
      byModel.push({
        model,
        jobCount: data.jobCount,
        contactsProcessed: data.contactsProcessed,
        totalCost: data.totalCost.toFixed(4),
        avgCostPerContact: avgCostPerContact.toFixed(4),
      });
    }

    // Timeline (group by date)
    const timeline: Array<{
      date: string;
      jobsCompleted: number;
      contactsProcessed: number;
      costSpent: string;
    }> = [];
    const timelineData = new Map<string, { jobsCompleted: number; contactsProcessed: number; costSpent: number }>();

    for (const job of jobs) {
      if (job.completedAt) {
        const date = job.completedAt.toISOString().slice(0, 10); // YYYY-MM-DD
        const data = timelineData.get(date) || { jobsCompleted: 0, contactsProcessed: 0, costSpent: 0 };
        data.jobsCompleted += 1;
        data.contactsProcessed += job.processedContacts || 0;
        data.costSpent += parseFloat(job.actualCost || '0');
        timelineData.set(date, data);
      }
    }

    for (const [date, data] of timelineData.entries()) {
      timeline.push({
        date,
        jobsCompleted: data.jobsCompleted,
        contactsProcessed: data.contactsProcessed,
        costSpent: data.costSpent.toFixed(4),
      });
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date));

    // Recent jobs (last 10)
    const recentJobs = jobs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        completedAt: job.completedAt?.toISOString() || null,
        contactsProcessed: job.processedContacts || 0,
        actualCost: (job.actualCost || '0'),
      }));

    return {
      summary: {
        totalJobs,
        completedJobs,
        runningJobs,
        failedJobs,
        totalContactsProcessed,
        totalCostSpent: totalCostSpent.toFixed(4),
        averageCostPerContact: averageCostPerContact.toFixed(4),
      },
      byType,
      byModel,
      timeline,
      recentJobs,
    };
  },

  /**
   * Export analytics data to CSV
   */
  async exportAnalyticsToCsv(
    db: Database,
    workspaceId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      listId?: string;
      model?: string;
    }
  ) {
    const analytics = await this.getAnalytics(db, workspaceId, filters);

    // Build CSV content
    const lines: string[] = [];

    // Summary section
    lines.push('SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Jobs,${analytics.summary.totalJobs}`);
    lines.push(`Completed Jobs,${analytics.summary.completedJobs}`);
    lines.push(`Running Jobs,${analytics.summary.runningJobs}`);
    lines.push(`Failed Jobs,${analytics.summary.failedJobs}`);
    lines.push(`Total Contacts Processed,${analytics.summary.totalContactsProcessed}`);
    lines.push(`Total Cost Spent,$${analytics.summary.totalCostSpent}`);
    lines.push(`Average Cost Per Contact,$${analytics.summary.averageCostPerContact}`);
    lines.push('');

    // By Type section
    lines.push('BY TYPE');
    lines.push('Type,Job Count,Contacts Processed,Total Cost');
    for (const item of analytics.byType) {
      lines.push(`${item.type},${item.jobCount},${item.contactsProcessed},$${item.totalCost}`);
    }
    lines.push('');

    // By Model section
    lines.push('BY MODEL');
    lines.push('Model,Job Count,Contacts Processed,Total Cost,Avg Cost Per Contact');
    for (const item of analytics.byModel) {
      lines.push(`${item.model},${item.jobCount},${item.contactsProcessed},$${item.totalCost},$${item.avgCostPerContact}`);
    }
    lines.push('');

    // Timeline section
    lines.push('TIMELINE');
    lines.push('Date,Jobs Completed,Contacts Processed,Cost Spent');
    for (const item of analytics.timeline) {
      lines.push(`${item.date},${item.jobsCompleted},${item.contactsProcessed},$${item.costSpent}`);
    }
    lines.push('');

    // Recent Jobs section
    lines.push('RECENT JOBS');
    lines.push('ID,Name,Status,Completed At,Contacts Processed,Cost');
    for (const item of analytics.recentJobs) {
      lines.push(`${item.id},${item.name},${item.status},${item.completedAt || 'N/A'},${item.contactsProcessed},$${item.actualCost}`);
    }

    return lines.join('\n');
  },

  // ========================================================================
  // EPIC 5: AI CONTEXT INTEGRATION
  // ========================================================================

  /**
   * Get enrichment history context for AI prompts
   * Epic 5: AI Context Integration
   *
   * Fetches recent enrichment history for an entity and formats it
   * as context to be included in AI prompts. This helps the AI:
   * - Avoid repeating the same information
   * - Build upon previous findings
   * - Identify changes since last enrichment
   * - Flag inconsistencies with past data
   */
  async getEnrichmentContext(
    db: Database,
    params: {
      entityId: string;
      entityType: 'contact' | 'lead';
      workspaceId: string;
      limit?: number;
    }
  ): Promise<string> {
    const { entityId, entityType, workspaceId, limit = 3 } = params;

    try {
      // Fetch recent enrichment history
      const { enrichmentHistoryService } = await import('./enrichment-history.service');

      const history = await enrichmentHistoryService.getHistory(db, {
        workspaceId,
        entityId,
        entityType,
        limit,
        offset: 0,
      });

      if (!history.history || history.history.length === 0) {
        return ''; // No history available
      }

      // Format context for AI
      let context = '\n\n## Previous Enrichment History\n\n';
      context += `This ${entityType} has been enriched ${history.totalCount} time(s) before.\n\n`;

      for (const entry of history.history) {
        const date = new Date(entry.createdAt).toLocaleDateString();
        const templateName = entry.templateSnapshot?.name || 'Unknown Template';

        context += `### Enrichment on ${date} (${templateName})\n`;

        if (entry.enrichmentSummary) {
          context += `**Summary**: ${entry.enrichmentSummary}\n`;
        }

        if (entry.changesSinceLast) {
          context += `**Changes**: ${entry.changesSinceLast}\n`;
        }

        context += '\n';
      }

      context += '**Important**: Use this historical context to:\n';
      context += '- Avoid repeating the same information\n';
      context += '- Build upon previous findings\n';
      context += '- Identify changes since last enrichment\n';
      context += '- Flag inconsistencies with past data\n\n';

      // Apply token budget management
      return this.truncateContextForTokens(context, 2000);
    } catch (error) {
      console.error('[enrichment] Failed to fetch history context:', error);
      return ''; // Don't fail enrichment if history fetch fails
    }
  },

  /**
   * Build AI prompt with historical context
   * Epic 5: AI Context Integration
   */
  buildPromptWithContext(
    entityData: Record<string, any>,
    job: {
      prompt: string;
      type: string;
      [key: string]: any;
    },
    historyContext: string
  ): { systemPrompt: string; userPrompt: string } {
    // System prompt combines job prompt with instructions
    let systemPrompt = job.prompt || 'You are an AI assistant helping to enrich contact data.';

    // Add historical context to system prompt if available
    if (historyContext) {
      systemPrompt += `\n\n${historyContext}`;
    }

    // US-CONF-001: Add confidence scoring instructions to system prompt
    systemPrompt += `\n\n${buildConfidenceInstructions()}`;

    // User prompt with entity data
    let userPrompt = `# Enrichment Task\n\n`;
    userPrompt += `Analyze this entity and provide your assessment:\n\n`;
    userPrompt += `\`\`\`json\n${JSON.stringify(entityData, null, 2)}\n\`\`\`\n\n`;

    userPrompt += `## Output Format\n\n`;
    userPrompt += `Provide your enrichment in the following structure:\n`;
    userPrompt += `1. **Summary**: Brief overview of findings (2-3 sentences)\n`;
    userPrompt += `2. **Enriched Data**: JSON object with new/updated fields (MUST include _confidence object)\n`;
    userPrompt += `3. **Changes**: What changed since last enrichment (if applicable)\n`;
    userPrompt += `4. **Confidence**: Detailed confidence scores with reasoning (in _confidence object)\n`;
    userPrompt += `5. **Reasoning**: Explain your findings and sources\n\n`;
    userPrompt += `**CRITICAL**: Your enrichment data MUST include a \`_confidence\` object with scores and factors for ALL fields.\n\n`;

    return {
      systemPrompt,
      userPrompt,
    };
  },

  /**
   * Detect changes between current and previous enrichment
   * Epic 5: AI Context Integration
   */
  async detectChanges(
    db: Database,
    entityId: string,
    entityType: 'contact' | 'lead',
    workspaceId: string,
    currentData: Record<string, any>
  ): Promise<string> {
    try {
      const { enrichmentHistoryService } = await import('./enrichment-history.service');

      // Get the most recent enrichment
      const history = await enrichmentHistoryService.getHistory(db, {
        workspaceId,
        entityId,
        entityType,
        limit: 1,
        offset: 0,
      });

      if (!history.history || history.history.length === 0) {
        return 'First enrichment for this entity';
      }

      const lastEntry = history.history[0];

      // Fetch full entry with enrichment data
      const fullEntry = await enrichmentHistoryService.getEntry(db, lastEntry.id, workspaceId);

      if (!fullEntry || !fullEntry.enrichmentReport) {
        return 'No previous data to compare';
      }

      // Simple change detection based on current enrichment data keys
      const changes: string[] = [];
      const changedKeys = Object.keys(currentData);

      if (changedKeys.length > 0) {
        for (const key of changedKeys) {
          changes.push(`Updated: ${key}`);
        }
      }

      return changes.length > 0
        ? changes.join(', ')
        : 'No significant changes detected';
    } catch (error) {
      console.error('[enrichment] Failed to detect changes:', error);
      return 'Change detection unavailable';
    }
  },

  /**
   * Truncate context to fit within token budget
   * Epic 5: AI Context Integration
   *
   * Rough estimation: 1 token ≈ 4 characters
   */
  truncateContextForTokens(
    context: string,
    maxTokens: number = 2000
  ): string {
    // Rough estimation: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;

    if (context.length <= maxChars) {
      return context;
    }

    // Truncate and add note
    const truncated = context.substring(0, maxChars);
    return truncated + '\n\n[... context truncated for token limit ...]\n';
  },

  /**
   * BL-ENR-017: Clean up stale enrichment jobs stuck in 'running' status.
   * Marks jobs older than STALE_ENRICHMENT_THRESHOLD_MS as 'failed' with timeout message.
   * Should be called periodically or at service startup.
   */
  async cleanupStaleEnrichments(db: Database): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_ENRICHMENT_THRESHOLD_MS);
    const staleJobs = await db
      .select({ id: crmEnrichmentJobs.id, workspaceId: crmEnrichmentJobs.workspaceId })
      .from(crmEnrichmentJobs)
      .where(
        and(
          eq(crmEnrichmentJobs.status, 'running'),
          lte(crmEnrichmentJobs.startedAt, cutoff)
        )
      );

    let cleaned = 0;
    for (const job of staleJobs) {
      await db.update(crmEnrichmentJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          lastError: `Enrichment timed out — job was running for more than ${STALE_ENRICHMENT_THRESHOLD_MS / 1000}s`,
        })
        .where(eq(crmEnrichmentJobs.id, job.id));
      cleaned++;
      console.log(`[enrichment] Cleaned up stale job ${job.id} (workspace: ${job.workspaceId})`);
    }

    if (cleaned > 0) {
      console.log(`[enrichment] Cleaned up ${cleaned} stale enrichment jobs`);
    }
    return cleaned;
  },
};
