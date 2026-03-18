/**
 * Real Enrichment Provider (CRM-004)
 * Integrates LinkedIn, ZeroBounce, and WebSearch providers for actual lead enrichment
 */

import { type CrmLead } from '@agios/db';
import { LinkedInProvider, type LinkedInProfileResult } from '../../lib/providers/linkedin';
import { ZeroBounceProvider, type EmailVerificationResult } from '../../lib/providers/zerobounce';
import { WebSearchTool, type WebSearchToolResult } from '../../lib/tools/web-search';
import type { EnrichmentProvider, EnrichmentResult, EnrichmentField } from './enrichment-service';

// ============================================================================
// COST CONSTANTS
// ============================================================================

export const PROVIDER_COSTS = {
  linkedin: 0.01, // $0.01 per profile lookup
  zerobounce: 0.008, // $0.008 per email verification
  websearch: 0.005, // $0.005 per search (Perplexity) or $0.001 (Brave)
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderCallResult {
  provider: 'linkedin' | 'zerobounce' | 'websearch';
  cost: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface RealEnrichmentOptions {
  useLinkedIn?: boolean;
  useEmailVerification?: boolean;
  useWebSearch?: boolean;
  linkedInUrl?: string; // Direct LinkedIn URL if available
}

// ============================================================================
// REAL ENRICHMENT PROVIDER
// ============================================================================

export class RealEnrichmentProvider implements EnrichmentProvider {
  private linkedInProvider: LinkedInProvider;
  private zeroBounceProvider: ZeroBounceProvider;
  private webSearchTool: WebSearchTool;
  private providerCalls: ProviderCallResult[] = [];
  private totalCost = 0;

  constructor() {
    this.linkedInProvider = new LinkedInProvider();
    this.zeroBounceProvider = new ZeroBounceProvider();
    this.webSearchTool = new WebSearchTool();
  }

  /**
   * Enrich a lead using real external data providers
   */
  async enrich(lead: CrmLead, options?: RealEnrichmentOptions): Promise<EnrichmentResult> {
    console.log(`[RealEnrichmentProvider] Starting enrichment for lead: ${lead.firstName} ${lead.lastName} (${lead.companyName})`);

    // Reset tracking for this enrichment
    this.providerCalls = [];
    this.totalCost = 0;

    const enrichedFields: Record<string, EnrichmentField> = {};
    const defaultOptions: RealEnrichmentOptions = {
      useLinkedIn: true,
      useEmailVerification: true,
      useWebSearch: true,
      ...options,
    };

    // 1. Search for LinkedIn profile
    let linkedInProfile: LinkedInProfileResult | null = null;
    if (defaultOptions.useLinkedIn) {
      linkedInProfile = await this.fetchLinkedInProfile(lead, defaultOptions.linkedInUrl);
      if (linkedInProfile) {
        this.addLinkedInFields(enrichedFields, linkedInProfile);
      }
    }

    // 2. Verify email via ZeroBounce
    if (defaultOptions.useEmailVerification && lead.email) {
      const emailResult = await this.verifyEmail(lead.email);
      if (emailResult) {
        this.addEmailVerificationFields(enrichedFields, emailResult);
      }
    }

    // 3. Web search for additional company data
    if (defaultOptions.useWebSearch && lead.companyName) {
      const webResults = await this.searchCompanyInfo(lead);
      if (webResults) {
        this.addWebSearchFields(enrichedFields, webResults, lead);
      }
    }

    // Add metadata about the enrichment
    enrichedFields.enrichment_metadata = {
      value: {
        totalCost: this.totalCost,
        providerCalls: this.providerCalls,
        timestamp: new Date().toISOString(),
      },
      confidence: 1.0,
      source: 'real',
    };

    console.log(`[RealEnrichmentProvider] Completed enrichment: ${Object.keys(enrichedFields).length} fields, cost: $${this.totalCost.toFixed(4)}`);

    return {
      enrichment_id: crypto.randomUUID(),
      lead_id: lead.id,
      status: 'completed',
      enriched_fields: enrichedFields,
    };
  }

  /**
   * Get rate limit information
   */
  getRateLimit(): { remaining: number; resetAt: Date } {
    // Rate limiting is handled by the RateLimitedEnrichmentProvider wrapper
    return {
      remaining: 100,
      resetAt: new Date(Date.now() + 3600000),
    };
  }

  /**
   * Get estimated cost for enriching a lead
   */
  getCostEstimate(options?: RealEnrichmentOptions): number {
    let estimate = 0;
    const opts = { useLinkedIn: true, useEmailVerification: true, useWebSearch: true, ...options };

    if (opts.useLinkedIn) estimate += PROVIDER_COSTS.linkedin;
    if (opts.useEmailVerification) estimate += PROVIDER_COSTS.zerobounce;
    if (opts.useWebSearch) estimate += PROVIDER_COSTS.websearch;

    return estimate;
  }

  /**
   * Get provider call tracking for cost analysis
   */
  getProviderCalls(): ProviderCallResult[] {
    return [...this.providerCalls];
  }

  /**
   * Get total cost of the last enrichment
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Fetch LinkedIn profile using name/company or direct URL
   */
  private async fetchLinkedInProfile(
    lead: CrmLead,
    linkedInUrl?: string
  ): Promise<LinkedInProfileResult | null> {
    const startTime = Date.now();

    try {
      let profileUrl = linkedInUrl;

      // If no direct URL, try to construct a search URL
      if (!profileUrl) {
        // Try to find LinkedIn profile via web search first
        const searchQuery = `${lead.firstName} ${lead.lastName} ${lead.companyName} site:linkedin.com/in`;
        try {
          const searchResult = await this.webSearchTool.search(searchQuery, { count: 3 });
          const linkedInResult = searchResult.results.find(r => r.url.includes('linkedin.com/in/'));
          if (linkedInResult) {
            profileUrl = linkedInResult.url;
            // Add search cost
            this.providerCalls.push({
              provider: 'websearch',
              cost: searchResult.cost,
              durationMs: Date.now() - startTime,
              success: true,
            });
            this.totalCost += searchResult.cost;
          }
        } catch (searchError) {
          console.warn('[RealEnrichmentProvider] LinkedIn search failed:', searchError);
        }
      }

      if (!profileUrl) {
        console.log('[RealEnrichmentProvider] No LinkedIn URL found for lead');
        return null;
      }

      const profile = await this.linkedInProvider.getProfile(profileUrl);
      const durationMs = Date.now() - startTime;

      this.providerCalls.push({
        provider: 'linkedin',
        cost: PROVIDER_COSTS.linkedin,
        durationMs,
        success: profile !== null,
        error: profile === null ? 'Profile not found' : undefined,
      });
      this.totalCost += PROVIDER_COSTS.linkedin;

      return profile;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.providerCalls.push({
        provider: 'linkedin',
        cost: PROVIDER_COSTS.linkedin, // Still charged for attempt
        durationMs,
        success: false,
        error: errorMessage,
      });
      this.totalCost += PROVIDER_COSTS.linkedin;

      console.error('[RealEnrichmentProvider] LinkedIn fetch failed:', errorMessage);
      return null;
    }
  }

  /**
   * Verify email via ZeroBounce
   */
  private async verifyEmail(email: string): Promise<EmailVerificationResult | null> {
    const startTime = Date.now();

    try {
      const result = await this.zeroBounceProvider.validateEmail(email);
      const durationMs = Date.now() - startTime;

      this.providerCalls.push({
        provider: 'zerobounce',
        cost: PROVIDER_COSTS.zerobounce,
        durationMs,
        success: true,
      });
      this.totalCost += PROVIDER_COSTS.zerobounce;

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.providerCalls.push({
        provider: 'zerobounce',
        cost: PROVIDER_COSTS.zerobounce,
        durationMs,
        success: false,
        error: errorMessage,
      });
      this.totalCost += PROVIDER_COSTS.zerobounce;

      console.error('[RealEnrichmentProvider] Email verification failed:', errorMessage);
      return null;
    }
  }

  /**
   * Search for company information via web search
   */
  private async searchCompanyInfo(lead: CrmLead): Promise<WebSearchToolResult | null> {
    const startTime = Date.now();

    try {
      // Search for company info, funding, recent news
      const searchQuery = `${lead.companyName} company funding revenue employees`;
      const result = await this.webSearchTool.search(searchQuery, { count: 5 });

      this.providerCalls.push({
        provider: 'websearch',
        cost: result.cost,
        durationMs: Date.now() - startTime,
        success: true,
      });
      this.totalCost += result.cost;

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.providerCalls.push({
        provider: 'websearch',
        cost: PROVIDER_COSTS.websearch,
        durationMs,
        success: false,
        error: errorMessage,
      });
      this.totalCost += PROVIDER_COSTS.websearch;

      console.error('[RealEnrichmentProvider] Web search failed:', errorMessage);
      return null;
    }
  }

  /**
   * Add LinkedIn profile fields to enrichment result
   */
  private addLinkedInFields(
    fields: Record<string, EnrichmentField>,
    profile: LinkedInProfileResult
  ): void {
    if (profile.headline) {
      fields.job_title = {
        value: profile.currentPosition || profile.headline,
        confidence: 0.95,
        source: 'linkedin',
      };
    }

    if (profile.currentCompany) {
      fields.current_company = {
        value: profile.currentCompany,
        confidence: 0.95,
        source: 'linkedin',
      };
    }

    if (profile.location) {
      fields.location = {
        value: profile.location,
        confidence: 0.90,
        source: 'linkedin',
      };
    }

    if (profile.country) {
      fields.country = {
        value: profile.country,
        confidence: 0.90,
        source: 'linkedin',
      };
    }

    if (profile.profileUrl) {
      fields.linkedin_url = {
        value: profile.profileUrl,
        confidence: 1.0,
        source: 'linkedin',
      };
    }

    if (profile.connections) {
      fields.linkedin_connections = {
        value: profile.connections,
        confidence: 0.85,
        source: 'linkedin',
      };
    }

    if (profile.skills && profile.skills.length > 0) {
      fields.skills = {
        value: profile.skills,
        confidence: 0.85,
        source: 'linkedin',
      };
    }

    if (profile.experience && profile.experience.length > 0) {
      fields.work_experience = {
        value: profile.experience,
        confidence: 0.90,
        source: 'linkedin',
      };
    }

    if (profile.education && profile.education.length > 0) {
      fields.education = {
        value: profile.education,
        confidence: 0.90,
        source: 'linkedin',
      };
    }

    if (profile.summary) {
      fields.linkedin_summary = {
        value: profile.summary,
        confidence: 0.85,
        source: 'linkedin',
      };
    }

    if (profile.photoUrl) {
      fields.profile_photo_url = {
        value: profile.photoUrl,
        confidence: 1.0,
        source: 'linkedin',
      };
    }
  }

  /**
   * Add email verification fields to enrichment result
   */
  private addEmailVerificationFields(
    fields: Record<string, EnrichmentField>,
    result: EmailVerificationResult
  ): void {
    fields.email_status = {
      value: result.status,
      confidence: result.status === 'valid' ? 1.0 : 0.8,
      source: 'zerobounce',
    };

    fields.email_valid = {
      value: result.status === 'valid',
      confidence: 0.95,
      source: 'zerobounce',
    };

    if (result.freeEmail !== undefined) {
      fields.is_free_email = {
        value: result.freeEmail,
        confidence: 1.0,
        source: 'zerobounce',
      };
    }

    if (result.domain) {
      fields.email_domain = {
        value: result.domain,
        confidence: 1.0,
        source: 'zerobounce',
      };
    }

    if (result.smtpProvider) {
      fields.email_provider = {
        value: result.smtpProvider,
        confidence: 0.90,
        source: 'zerobounce',
      };
    }

    if (result.firstName) {
      fields.email_first_name = {
        value: result.firstName,
        confidence: 0.75, // Lower confidence as this is inferred
        source: 'zerobounce',
      };
    }

    if (result.lastName) {
      fields.email_last_name = {
        value: result.lastName,
        confidence: 0.75,
        source: 'zerobounce',
      };
    }

    if (result.country) {
      fields.email_country = {
        value: result.country,
        confidence: 0.70,
        source: 'zerobounce',
      };
    }

    if (result.city) {
      fields.email_city = {
        value: result.city,
        confidence: 0.70,
        source: 'zerobounce',
      };
    }

    if (result.didYouMean) {
      fields.email_suggestion = {
        value: result.didYouMean,
        confidence: 0.60,
        source: 'zerobounce',
      };
    }
  }

  /**
   * Add web search fields to enrichment result
   */
  private addWebSearchFields(
    fields: Record<string, EnrichmentField>,
    result: WebSearchToolResult,
    lead: CrmLead
  ): void {
    if (result.results.length === 0) return;

    // Store raw search results for reference
    fields.web_search_results = {
      value: result.results.slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
        description: r.description,
      })),
      confidence: 0.70,
      source: result.provider,
    };

    // Try to extract company information from search results
    const companyInfo = this.extractCompanyInfoFromSearch(result.results, lead.companyName || '');

    if (companyInfo.industry) {
      fields.industry = {
        value: companyInfo.industry,
        confidence: 0.65,
        source: result.provider,
      };
    }

    if (companyInfo.website) {
      fields.company_website = {
        value: companyInfo.website,
        confidence: 0.85,
        source: result.provider,
      };
    }

    if (companyInfo.description) {
      fields.company_description = {
        value: companyInfo.description,
        confidence: 0.60,
        source: result.provider,
      };
    }
  }

  /**
   * Extract company information from web search results
   */
  private extractCompanyInfoFromSearch(
    results: Array<{ title: string; url: string; description: string }>,
    companyName: string
  ): { industry?: string; website?: string; description?: string } {
    const info: { industry?: string; website?: string; description?: string } = {};

    // Look for company website (not social media)
    const companyNameLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const result of results) {
      const urlLower = result.url.toLowerCase();

      // Skip social media and news sites
      if (urlLower.includes('linkedin.com') ||
          urlLower.includes('twitter.com') ||
          urlLower.includes('facebook.com') ||
          urlLower.includes('crunchbase.com') ||
          urlLower.includes('wikipedia.org')) {
        continue;
      }

      // Check if URL might be company website
      if (urlLower.includes(companyNameLower) || result.title.toLowerCase().includes(companyName.toLowerCase())) {
        const url = new URL(result.url);
        info.website = `${url.protocol}//${url.host}`;
        info.description = result.description;
        break;
      }
    }

    // Try to infer industry from descriptions
    const combinedText = results.map(r => r.description).join(' ').toLowerCase();
    const industryKeywords: Record<string, string> = {
      'software': 'Technology',
      'saas': 'Technology',
      'fintech': 'Financial Services',
      'healthcare': 'Healthcare',
      'biotech': 'Biotechnology',
      'e-commerce': 'E-Commerce',
      'retail': 'Retail',
      'manufacturing': 'Manufacturing',
      'consulting': 'Consulting',
      'marketing': 'Marketing',
      'real estate': 'Real Estate',
      'education': 'Education',
      'media': 'Media & Entertainment',
      'insurance': 'Insurance',
      'logistics': 'Logistics',
      'telecommunications': 'Telecommunications',
    };

    for (const [keyword, industry] of Object.entries(industryKeywords)) {
      if (combinedText.includes(keyword)) {
        info.industry = industry;
        break;
      }
    }

    return info;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let realEnrichmentInstance: RealEnrichmentProvider | null = null;

/**
 * Get or create singleton RealEnrichmentProvider instance
 */
export function getRealEnrichmentProvider(): RealEnrichmentProvider {
  if (!realEnrichmentInstance) {
    realEnrichmentInstance = new RealEnrichmentProvider();
  }
  return realEnrichmentInstance;
}
