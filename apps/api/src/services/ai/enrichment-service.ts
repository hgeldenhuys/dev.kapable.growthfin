/**
 * Lead Enrichment Service (US-LEAD-AI-009)
 * AI-powered lead enrichment with confidence scoring
 */

import { db } from '@agios/db';
import {
  crmLeads,
  leadEnrichments,
  leadEnrichmentConfigs,
  type CrmLead,
  type LeadEnrichmentStatus,
} from '@agios/db';
import { and, eq, desc, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentField {
  value: any;
  confidence: number;
  source: string;
}

export interface EnrichmentResult {
  enrichment_id: string;
  lead_id: string;
  status: LeadEnrichmentStatus;
  enriched_fields: Record<string, EnrichmentField>;
  error_message?: string;
}

export interface EnrichmentOptions {
  sources: ('company' | 'contact' | 'social')[];
  force: boolean;
  fields?: string[];
}

export interface EnrichmentProvider {
  enrich(lead: CrmLead): Promise<EnrichmentResult>;
  getRateLimit(): { remaining: number; resetAt: Date };
}

// ============================================================================
// MOCK ENRICHMENT PROVIDER
// ============================================================================

export class MockEnrichmentProvider implements EnrichmentProvider {
  /**
   * Generate mock enrichment data based on lead's existing fields
   */
  async enrich(lead: CrmLead): Promise<EnrichmentResult> {
    // Infer industry from email domain
    const industry = this.inferIndustryFromEmail(lead.email);

    // Generate realistic mock data
    const enrichedFields: Record<string, EnrichmentField> = {
      industry: {
        value: industry,
        confidence: 0.85,
        source: 'mock',
      },
      employee_count: {
        value: Math.floor(Math.random() * 10000) + 100,
        confidence: 0.75,
        source: 'mock',
      },
      annual_revenue: {
        value: Math.floor(Math.random() * 50000000) + 1000000,
        confidence: 0.70,
        source: 'mock',
      },
      technologies: {
        value: this.generateMockTechnologies(industry),
        confidence: 0.80,
        source: 'mock',
      },
      company_description: {
        value: `${lead.companyName} is a ${industry} company providing innovative solutions.`,
        confidence: 0.65,
        source: 'mock',
      },
      headquarters: {
        value: this.generateMockLocation(),
        confidence: 0.70,
        source: 'mock',
      },
      founded_year: {
        value: 2000 + Math.floor(Math.random() * 24),
        confidence: 0.60,
        source: 'mock',
      },
    };

    return {
      enrichment_id: crypto.randomUUID(),
      lead_id: lead.id,
      status: 'completed',
      enriched_fields: enrichedFields,
    };
  }

  /**
   * Mock rate limiting (always has capacity)
   */
  getRateLimit() {
    return {
      remaining: 1000,
      resetAt: new Date(Date.now() + 3600000), // 1 hour from now
    };
  }

  /**
   * Infer industry from email domain
   */
  private inferIndustryFromEmail(email: string | null): string {
    if (!email) {
      return 'Technology';
    }

    const domain = email.split('@')[1]?.toLowerCase() || '';

    const industryMap: Record<string, string> = {
      // Tech
      'tech': 'Technology',
      'software': 'Technology',
      'cloud': 'Technology',
      'app': 'Technology',
      'dev': 'Technology',
      'digital': 'Technology',
      'ai': 'Technology',
      'data': 'Technology',

      // Finance
      'bank': 'Financial Services',
      'finance': 'Financial Services',
      'invest': 'Financial Services',
      'capital': 'Financial Services',
      'insurance': 'Financial Services',

      // Healthcare
      'health': 'Healthcare',
      'medical': 'Healthcare',
      'pharma': 'Healthcare',
      'clinic': 'Healthcare',
      'hospital': 'Healthcare',

      // Education
      'edu': 'Education',
      'school': 'Education',
      'academy': 'Education',
      'university': 'Education',

      // Retail
      'shop': 'Retail',
      'store': 'Retail',
      'market': 'Retail',
      'ecommerce': 'Retail',

      // Manufacturing
      'mfg': 'Manufacturing',
      'industrial': 'Manufacturing',
      'factory': 'Manufacturing',
    };

    for (const [keyword, industry] of Object.entries(industryMap)) {
      if (domain.includes(keyword)) {
        return industry;
      }
    }

    return 'Technology'; // Default
  }

  /**
   * Generate mock technologies based on industry
   */
  private generateMockTechnologies(industry: string): string[] {
    const techStacks: Record<string, string[]> = {
      'Technology': ['React', 'Node.js', 'PostgreSQL', 'AWS', 'TypeScript'],
      'Financial Services': ['Java', 'Spring', 'Oracle', 'Kubernetes', 'Python'],
      'Healthcare': ['Python', 'Django', 'MySQL', 'Azure', 'HIPAA Compliance Tools'],
      'Education': ['PHP', 'WordPress', 'MySQL', 'Google Cloud', 'Moodle'],
      'Retail': ['Shopify', 'BigCommerce', 'Stripe', 'Google Analytics', 'Facebook Ads'],
      'Manufacturing': ['SAP', 'Oracle ERP', 'SQL Server', 'Azure', 'IoT Platforms'],
    };

    return techStacks[industry] || techStacks['Technology'];
  }

  /**
   * Generate mock location
   */
  private generateMockLocation(): string {
    const locations = [
      'San Francisco, CA',
      'New York, NY',
      'Austin, TX',
      'Seattle, WA',
      'Boston, MA',
      'Chicago, IL',
      'Los Angeles, CA',
      'Denver, CO',
      'Atlanta, GA',
      'Miami, FL',
    ];

    return locations[Math.floor(Math.random() * locations.length)];
  }
}

// ============================================================================
// FIELD SANITIZATION
// ============================================================================

/**
 * Truncate oversized fields in enrichment results before DB save.
 * web_search_results values are capped at 2000 chars, other top-level
 * strings at 10000 chars. This prevents postgres.js prepared statement
 * failures with very large JSONB parameters.
 */
function truncateEnrichedFields(fields: Record<string, any>): Record<string, any> {
  const sanitized = { ...fields };
  if (sanitized.web_search_results && Array.isArray(sanitized.web_search_results)) {
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
  // Also truncate any other oversized string values at the top level
  for (const key of Object.keys(sanitized)) {
    if (key === 'web_search_results') continue;
    const val = sanitized[key];
    if (typeof val === 'string' && val.length > 10000) {
      sanitized[key] = val.substring(0, 10000) + '... [truncated]';
    }
    // Handle EnrichmentField shape: { value: string, ... }
    if (val && typeof val === 'object' && typeof val.value === 'string' && val.value.length > 10000) {
      sanitized[key] = { ...val, value: val.value.substring(0, 10000) + '... [truncated]' };
    }
  }
  return sanitized;
}

// ============================================================================
// ENRICHMENT SERVICE
// ============================================================================

export class EnrichmentService {
  private provider: EnrichmentProvider;

  constructor(provider: EnrichmentProvider) {
    this.provider = provider;
  }

  /**
   * Enrich a lead with external data
   */
  async enrichLead(
    leadId: string,
    workspaceId: string,
    options: EnrichmentOptions
  ): Promise<EnrichmentResult> {
    console.log(`[Enrichment Service] Enriching lead ${leadId}...`);

    // 1. Check rate limits
    const rateLimit = this.provider.getRateLimit();
    if (rateLimit.remaining === 0) {
      throw new Error(`Rate limit exceeded. Resets at ${rateLimit.resetAt.toISOString()}`);
    }

    // 2. Fetch lead data
    const lead = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // 3. Check if already enriched (unless force=true)
    if (!options.force) {
      const existing = await db.query.leadEnrichments.findFirst({
        where: and(
          eq(leadEnrichments.leadId, leadId),
          eq(leadEnrichments.status, 'completed')
        ),
        orderBy: [desc(leadEnrichments.createdAt)],
      });

      if (existing) {
        console.log(`[Enrichment Service] Lead already enriched, returning existing data`);
        return {
          enrichment_id: existing.id,
          lead_id: existing.leadId,
          status: existing.status,
          enriched_fields: existing.enrichedFields as Record<string, EnrichmentField>,
        };
      }
    }

    // 4. Create pending enrichment record
    const [enrichmentRecord] = await db
      .insert(leadEnrichments)
      .values({
        leadId,
        workspaceId,
        status: 'in_progress',
        source: 'ai',
      })
      .onConflictDoUpdate({
        target: [leadEnrichments.leadId, leadEnrichments.source],
        set: {
          status: 'in_progress',
          retryCount: 0,
          errorMessage: null,
        },
      })
      .returning();

    try {
      // 5. Call enrichment provider
      const result = await this.provider.enrich(lead);

      // 6. Truncate oversized fields before DB save to prevent prepared statement failures
      const sanitizedFields = truncateEnrichedFields(result.enriched_fields);

      // 7. Update enrichment record with results
      await db
        .update(leadEnrichments)
        .set({
          status: 'completed',
          enrichedFields: sanitizedFields,
          confidenceScores: this.extractConfidenceScores(sanitizedFields),
          enrichedAt: new Date(),
        })
        .where(eq(leadEnrichments.id, enrichmentRecord.id));

      // 8. Apply high-confidence fields to lead
      await this.applyEnrichedData(leadId, workspaceId, sanitizedFields);

      console.log(`[Enrichment Service] Successfully enriched lead ${leadId}`);

      return {
        ...result,
        enrichment_id: enrichmentRecord.id,
      };
    } catch (error: any) {
      console.error(`[Enrichment Service] Failed to enrich lead ${leadId}:`, error.message?.substring(0, 500));
      console.error('[Enrichment] Save failed for enrichment:', enrichmentRecord?.id, {
        cause: error.cause,
        stack: error.stack?.substring(0, 500),
      });

      // Truncate error message to prevent cascading DB failure
      // (DrizzleQueryError.message can contain the full 200KB+ params)
      const truncatedError = typeof error.message === 'string'
        ? error.message.substring(0, 1000)
        : 'Unknown error';

      // Update enrichment record with error
      try {
        await db
          .update(leadEnrichments)
          .set({
            status: 'failed',
            errorMessage: truncatedError,
          })
          .where(eq(leadEnrichments.id, enrichmentRecord.id));
      } catch (saveError: any) {
        console.error('[Enrichment] Failed to save error status:', saveError.message?.substring(0, 500));
      }

      throw error;
    }
  }

  /**
   * Extract confidence scores from enriched fields
   */
  private extractConfidenceScores(
    fields: Record<string, EnrichmentField>
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [key, data] of Object.entries(fields)) {
      scores[key] = data.confidence;
    }
    return scores;
  }

  /**
   * Apply enriched data to lead (only high-confidence fields)
   */
  private async applyEnrichedData(
    leadId: string,
    workspaceId: string,
    fields: Record<string, EnrichmentField>
  ) {
    // Get workspace enrichment config
    const config = await this.getEnrichmentConfig(workspaceId);

    const customFieldsToMerge: Record<string, any> = {};

    // Apply fields that meet confidence threshold
    for (const [key, data] of Object.entries(fields)) {
      if (data.confidence >= config.minConfidenceToApply) {
        // Map enriched field to database field
        if (key === 'industry') customFieldsToMerge.industry = data.value;
        else if (key === 'employee_count') customFieldsToMerge.employeeCount = data.value;
        else if (key === 'annual_revenue') customFieldsToMerge.annualRevenue = data.value;
        else customFieldsToMerge[key] = data.value;
      }
    }

    if (Object.keys(customFieldsToMerge).length > 0) {
      // Use JSONB merge (||) to preserve existing customFields
      await db
        .update(crmLeads)
        .set({
          updatedAt: new Date(),
          customFields: sql`COALESCE(${crmLeads.customFields}, '{}'::jsonb) || ${JSON.stringify(customFieldsToMerge)}::jsonb`,
        })
        .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)));

      console.log(`[Enrichment Service] Applied ${Object.keys(customFieldsToMerge).length} enriched fields to lead ${leadId}`);
    }
  }

  /**
   * Get or create enrichment config for workspace
   */
  private async getEnrichmentConfig(workspaceId: string) {
    let config = await db.query.leadEnrichmentConfigs.findFirst({
      where: eq(leadEnrichmentConfigs.workspaceId, workspaceId),
    });

    if (!config) {
      // Create default config — use real providers by default
      [config] = await db
        .insert(leadEnrichmentConfigs)
        .values({
          workspaceId,
          autoEnrichNewLeads: true,
          autoEnrichFields: ['industry', 'employee_count', 'annual_revenue', 'technologies'],
          provider: 'real',
          rateLimitPerHour: 100,
          minConfidenceToApply: '0.70',
        })
        .returning();
    }

    return {
      autoEnrichNewLeads: config.autoEnrichNewLeads,
      autoEnrichFields: config.autoEnrichFields || [],
      provider: config.provider,
      rateLimitPerHour: config.rateLimitPerHour,
      minConfidenceToApply: parseFloat(config.minConfidenceToApply || '0.70'),
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create enrichment service with default provider (mock)
 */
export function createEnrichmentService(): EnrichmentService {
  const provider = new MockEnrichmentProvider();
  return new EnrichmentService(provider);
}

/**
 * Create enrichment service based on workspace configuration (CRM-004)
 * Reads workspace config and instantiates the correct provider with rate limiting
 */
export async function createEnrichmentServiceForWorkspace(
  workspaceId: string
): Promise<EnrichmentService> {
  // Import dependencies
  const { RealEnrichmentProvider } = await import('./real-enrichment-provider');
  const { RateLimitedEnrichmentProvider } = await import('./rate-limited-provider');

  // Get workspace config
  const config = await db.query.leadEnrichmentConfigs.findFirst({
    where: eq(leadEnrichmentConfigs.workspaceId, workspaceId),
  });

  // Default to real provider if no config
  const providerType = config?.provider || 'real';

  console.log(`[EnrichmentService] Creating service for workspace ${workspaceId} with provider: ${providerType}`);

  let baseProvider: EnrichmentProvider;

  switch (providerType) {
    case 'real':
      // Use real providers (LinkedIn, ZeroBounce, WebSearch)
      baseProvider = new RealEnrichmentProvider();
      break;

    case 'hybrid':
      // Use real providers with mock fallback on failure
      baseProvider = new HybridEnrichmentProvider();
      break;

    case 'clearbit':
    case 'zoominfo':
      // Future: implement these providers
      console.warn(`[EnrichmentService] Provider ${providerType} not implemented, falling back to mock`);
      baseProvider = new MockEnrichmentProvider();
      break;

    case 'mock':
    default:
      baseProvider = new MockEnrichmentProvider();
      break;
  }

  // Wrap with rate limiting using workspace config
  const rateLimitConfig = {
    maxRequestsPerHour: config?.rateLimitPerHour || 100,
    linkedinMaxPerHour: config?.linkedinRateLimitPerHour || 5,
    zerobounceMaxPerHour: config?.zerobounceRateLimitPerHour || 20,
    websearchMaxPerHour: config?.websearchRateLimitPerHour || 60,
  };

  const rateLimitedProvider = new RateLimitedEnrichmentProvider(baseProvider, rateLimitConfig);

  // Create service with cost tracking enabled
  const service = new EnrichmentService(rateLimitedProvider);

  // Store workspace config for cost tracking
  (service as any)._workspaceConfig = config;

  return service;
}

// ============================================================================
// HYBRID ENRICHMENT PROVIDER (CRM-004)
// ============================================================================

/**
 * Hybrid provider: tries real providers first, falls back to mock on failure
 */
export class HybridEnrichmentProvider implements EnrichmentProvider {
  private realProvider: EnrichmentProvider | null = null;
  private mockProvider: EnrichmentProvider;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.mockProvider = new MockEnrichmentProvider();
  }

  private async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { RealEnrichmentProvider } = await import('./real-enrichment-provider');
        this.realProvider = new RealEnrichmentProvider();
      })();
    }
    return this.initPromise;
  }

  async enrich(lead: CrmLead): Promise<EnrichmentResult> {
    await this.init();

    try {
      if (this.realProvider) {
        console.log(`[HybridProvider] Attempting real enrichment for lead ${lead.id}`);
        const result = await this.realProvider.enrich(lead);

        // Check if we got meaningful data
        const enrichedFieldCount = Object.keys(result.enriched_fields).length;
        if (enrichedFieldCount > 1) { // More than just metadata
          return result;
        }

        console.log(`[HybridProvider] Real enrichment returned insufficient data, falling back to mock`);
      }
    } catch (error) {
      console.warn(`[HybridProvider] Real enrichment failed, falling back to mock:`, error);
    }

    // Fallback to mock
    console.log(`[HybridProvider] Using mock enrichment for lead ${lead.id}`);
    const mockResult = await this.mockProvider.enrich(lead);

    // Mark source as 'hybrid_mock' to indicate fallback
    for (const field of Object.values(mockResult.enriched_fields)) {
      field.source = 'hybrid_mock';
    }

    return mockResult;
  }

  getRateLimit(): { remaining: number; resetAt: Date } {
    return {
      remaining: 100,
      resetAt: new Date(Date.now() + 3600000),
    };
  }
}

// ============================================================================
// COST TRACKING UTILITIES (CRM-004)
// ============================================================================

export const ENRICHMENT_COSTS = {
  linkedin: 0.01, // $0.01 per profile lookup
  zerobounce: 0.008, // $0.008 per email verification
  websearch: 0.005, // $0.005 per search (average)
  mock: 0, // Free
} as const;

/**
 * Estimate cost for enriching leads
 */
export function estimateEnrichmentCost(
  leadCount: number,
  options: {
    useLinkedIn?: boolean;
    useEmailVerification?: boolean;
    useWebSearch?: boolean;
    provider?: string;
  } = {}
): { total: number; breakdown: Record<string, number> } {
  const {
    useLinkedIn = true,
    useEmailVerification = true,
    useWebSearch = true,
    provider = 'real',
  } = options;

  if (provider === 'mock') {
    return { total: 0, breakdown: { mock: 0 } };
  }

  const breakdown: Record<string, number> = {};
  let total = 0;

  if (useLinkedIn) {
    breakdown.linkedin = leadCount * ENRICHMENT_COSTS.linkedin;
    total += breakdown.linkedin;
  }

  if (useEmailVerification) {
    breakdown.zerobounce = leadCount * ENRICHMENT_COSTS.zerobounce;
    total += breakdown.zerobounce;
  }

  if (useWebSearch) {
    breakdown.websearch = leadCount * ENRICHMENT_COSTS.websearch;
    total += breakdown.websearch;
  }

  return { total, breakdown };
}

/**
 * Update workspace budget tracking after enrichment
 */
export async function updateBudgetTracking(
  workspaceId: string,
  cost: number
): Promise<void> {
  await db
    .update(leadEnrichmentConfigs)
    .set({
      budgetUsedThisMonth: sql`COALESCE(budget_used_this_month, 0) + ${cost}`,
      updatedAt: new Date(),
    })
    .where(eq(leadEnrichmentConfigs.workspaceId, workspaceId));
}

/**
 * Check if workspace has budget remaining
 */
export async function checkBudgetAvailable(
  workspaceId: string,
  estimatedCost: number
): Promise<{ available: boolean; remaining: number | null; message?: string }> {
  const config = await db.query.leadEnrichmentConfigs.findFirst({
    where: eq(leadEnrichmentConfigs.workspaceId, workspaceId),
  });

  if (!config || !config.budgetLimitMonthly) {
    return { available: true, remaining: null };
  }

  const budgetLimit = parseFloat(config.budgetLimitMonthly);
  const budgetUsed = parseFloat(config.budgetUsedThisMonth || '0');
  const remaining = budgetLimit - budgetUsed;

  if (remaining < estimatedCost) {
    return {
      available: false,
      remaining,
      message: `Budget exceeded. Remaining: $${remaining.toFixed(4)}, Estimated cost: $${estimatedCost.toFixed(4)}`,
    };
  }

  return { available: true, remaining };
}
