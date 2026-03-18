/**
 * Provider Adapters for API Usage Monitoring
 *
 * Each adapter queries a provider's usage/balance and returns a standardized
 * UsageSnapshot. Adapters are either API-based (direct provider calls) or
 * heuristic-based (estimated from internal database records).
 */

import {
  db,
  crmToolCalls,
  crmCampaignRecipients,
  crmCampaignMessages,
  type ApiProvider,
} from '@agios/db';
import { sql, eq, and, gte, count } from 'drizzle-orm';
import { getTwilioClient } from '../../lib/providers/twilio';
import { ElevenLabsProvider } from '../audio/elevenlabs-provider';
import { getZeroBounceProvider } from '../../lib/providers/zerobounce';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageSnapshot {
  provider: ApiProvider;
  trackingMethod: 'api' | 'heuristic';
  balanceRemaining?: number;
  balanceUnit?: string;
  quotaUsed?: number;
  quotaLimit?: number;
  quotaUnit?: string;
  quotaResetAt?: Date;
  callCountPeriod?: number;
  estimatedCostPeriod?: number;
  usagePercent?: number;
  isReachable: boolean;
  lastError?: string;
  latencyMs?: number;
  rawResponse?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Monthly budget assumptions for heuristic providers (USD) */
const MONTHLY_BUDGETS: Record<string, number> = {
  rapidapi: 50,
  brave: 10,
  perplexity: 25,
  resend: 100,
  google_maps: 20,
  anthropic: 200,
};

/** Estimated cost-per-call for heuristic providers (USD) */
const COST_PER_CALL: Record<string, number> = {
  anthropic: 0.015,
  rapidapi: 0.01,
  brave: 0.001,
  perplexity: 0.005,
  resend: 0.001,
  google_maps: 0.017,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - THIRTY_DAYS_MS);
}

function errorSnapshot(provider: ApiProvider, method: 'api' | 'heuristic', error: unknown, latencyMs: number): UsageSnapshot {
  return {
    provider,
    trackingMethod: method,
    isReachable: false,
    lastError: error instanceof Error ? error.message : String(error),
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// 1. Twilio (API-based)
// ---------------------------------------------------------------------------

export async function fetchTwilioUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const client = getTwilioClient();

    const [balance, todayRecords] = await Promise.all([
      client.balance.fetch(),
      client.usage.records.today.list(),
    ]);

    const latencyMs = Date.now() - start;

    const balanceValue = parseFloat(balance.balance);

    // Sum today's usage cost across all categories
    let todayCost = 0;
    for (const record of todayRecords) {
      if (record.price) {
        todayCost += Math.abs(parseFloat(String(record.price)));
      }
    }

    return {
      provider: 'twilio',
      trackingMethod: 'api',
      balanceRemaining: balanceValue,
      balanceUnit: balance.currency || 'USD',
      estimatedCostPeriod: todayCost,
      isReachable: true,
      latencyMs,
      rawResponse: {
        balance: balance.balance,
        currency: balance.currency,
        todayRecordCount: todayRecords.length,
        todayCost,
      },
    };
  } catch (error) {
    return errorSnapshot('twilio', 'api', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 2. ElevenLabs (API-based)
// ---------------------------------------------------------------------------

export async function fetchElevenLabsUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const provider = new ElevenLabsProvider(process.env['ELEVENLABS_API_KEY']!);
    const usage = await provider.getUsageStats();
    const latencyMs = Date.now() - start;

    const usagePercent =
      usage.characterLimit > 0
        ? Math.round((usage.charactersUsed / usage.characterLimit) * 10000) / 100
        : undefined;

    return {
      provider: 'elevenlabs',
      trackingMethod: 'api',
      quotaUsed: usage.charactersUsed,
      quotaLimit: usage.characterLimit,
      quotaUnit: 'characters',
      usagePercent,
      isReachable: true,
      latencyMs,
      rawResponse: {
        charactersUsed: usage.charactersUsed,
        characterLimit: usage.characterLimit,
      },
    };
  } catch (error) {
    return errorSnapshot('elevenlabs', 'api', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 3. OpenAI (API-based)
// ---------------------------------------------------------------------------

export async function fetchOpenAIUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      return {
        provider: 'openai',
        trackingMethod: 'api',
        isReachable: false,
        lastError: 'OPENAI_API_KEY not configured',
        latencyMs: Date.now() - start,
      };
    }

    // Start of current month in unix seconds
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startTime = Math.floor(monthStart.getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);

    const url = new URL('https://api.openai.com/v1/organization/usage/completions');
    url.searchParams.set('start_time', String(startTime));
    url.searchParams.set('end_time', String(endTime));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 401 || response.status === 403) {
      return {
        provider: 'openai',
        trackingMethod: 'api',
        isReachable: false,
        lastError: `OpenAI usage API returned ${response.status}. Admin API access may be required - check that your API key has organization usage read permissions.`,
        latencyMs,
      };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        provider: 'openai',
        trackingMethod: 'api',
        isReachable: false,
        lastError: `OpenAI API error: ${response.status} - ${errorText}`,
        latencyMs,
      };
    }

    const data = await response.json();

    return {
      provider: 'openai',
      trackingMethod: 'api',
      isReachable: true,
      latencyMs,
      rawResponse: data as Record<string, unknown>,
    };
  } catch (error) {
    return errorSnapshot('openai', 'api', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 4. Anthropic (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchAnthropicUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const cutoff = thirtyDaysAgo();

    // Count tool calls in last 30 days that are likely LLM-related
    // Most LLM calls do not have a provider set, so we count rows where
    // provider IS NULL as a proxy for Anthropic usage.
    const [result] = await db
      .select({ total: count() })
      .from(crmToolCalls)
      .where(
        and(
          gte(crmToolCalls.createdAt, cutoff),
          sql`${crmToolCalls.provider} IS NULL`
        )
      );

    const latencyMs = Date.now() - start;
    const callCount = result?.total ?? 0;
    const estimatedCost = callCount * (COST_PER_CALL['anthropic'] ?? 0);
    const budget = MONTHLY_BUDGETS['anthropic'] ?? 0;
    const usagePercent = budget > 0
      ? Math.round((estimatedCost / budget) * 10000) / 100
      : undefined;

    return {
      provider: 'anthropic',
      trackingMethod: 'heuristic',
      callCountPeriod: callCount,
      estimatedCostPeriod: Math.round(estimatedCost * 100) / 100,
      usagePercent,
      isReachable: true,
      latencyMs,
      rawResponse: {
        callCount,
        costPerCall: COST_PER_CALL['anthropic'],
        monthlyBudget: budget,
      },
    };
  } catch (error) {
    return errorSnapshot('anthropic', 'heuristic', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 5. ZeroBounce (API-based)
// ---------------------------------------------------------------------------

export async function fetchZeroBounceUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const provider = getZeroBounceProvider();
    const credits = await provider.getCredits();
    const latencyMs = Date.now() - start;

    if (credits === null) {
      return {
        provider: 'zerobounce',
        trackingMethod: 'api',
        isReachable: false,
        lastError: 'Unable to fetch credits (API key missing or API error)',
        latencyMs,
      };
    }

    return {
      provider: 'zerobounce',
      trackingMethod: 'api',
      balanceRemaining: credits,
      balanceUnit: 'credits',
      isReachable: true,
      latencyMs,
      rawResponse: { credits },
    };
  } catch (error) {
    return errorSnapshot('zerobounce', 'api', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// Shared heuristic helper for crmToolCalls-based providers
// ---------------------------------------------------------------------------

async function fetchHeuristicToolCallUsage(
  provider: ApiProvider,
  filterFn: () => ReturnType<typeof and>,
): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const cutoff = thirtyDaysAgo();

    const [result] = await db
      .select({ total: count() })
      .from(crmToolCalls)
      .where(
        and(
          gte(crmToolCalls.createdAt, cutoff),
          filterFn()
        )
      );

    const latencyMs = Date.now() - start;
    const callCount = result?.total ?? 0;
    const costPerCall = COST_PER_CALL[provider] ?? 0;
    const estimatedCost = callCount * costPerCall;
    const budget = MONTHLY_BUDGETS[provider] ?? 0;
    const usagePercent = budget > 0
      ? Math.round((estimatedCost / budget) * 10000) / 100
      : undefined;

    return {
      provider,
      trackingMethod: 'heuristic',
      callCountPeriod: callCount,
      estimatedCostPeriod: Math.round(estimatedCost * 1000) / 1000,
      usagePercent,
      isReachable: true,
      latencyMs,
      rawResponse: {
        callCount,
        costPerCall,
        monthlyBudget: budget,
      },
    };
  } catch (error) {
    return errorSnapshot(provider, 'heuristic', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 6. RapidAPI / LinkedIn (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchRapidAPIUsage(): Promise<UsageSnapshot> {
  return fetchHeuristicToolCallUsage('rapidapi', () =>
    sql`(${crmToolCalls.provider} = 'linkedin' OR ${crmToolCalls.toolName} ILIKE '%linkedin%')`
  );
}

// ---------------------------------------------------------------------------
// 7. Brave Search (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchBraveUsage(): Promise<UsageSnapshot> {
  return fetchHeuristicToolCallUsage('brave', () =>
    eq(crmToolCalls.provider, 'brave')
  );
}

// ---------------------------------------------------------------------------
// 8. Perplexity (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchPerplexityUsage(): Promise<UsageSnapshot> {
  return fetchHeuristicToolCallUsage('perplexity', () =>
    eq(crmToolCalls.provider, 'perplexity')
  );
}

// ---------------------------------------------------------------------------
// 9. Resend (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchResendUsage(): Promise<UsageSnapshot> {
  const start = Date.now();
  try {
    const cutoff = thirtyDaysAgo();

    // Count email recipients that have actually been sent (not pending) in last 30 days.
    // Join crmCampaignRecipients with crmCampaignMessages to filter by email channel.
    const [result] = await db
      .select({ total: count() })
      .from(crmCampaignRecipients)
      .innerJoin(
        crmCampaignMessages,
        eq(crmCampaignRecipients.messageId, crmCampaignMessages.id)
      )
      .where(
        and(
          eq(crmCampaignMessages.channel, 'email'),
          gte(crmCampaignRecipients.createdAt, cutoff),
          sql`${crmCampaignRecipients.status} != 'pending'`
        )
      );

    const latencyMs = Date.now() - start;
    const emailCount = result?.total ?? 0;
    const costPerEmail = COST_PER_CALL['resend'] ?? 0;
    const estimatedCost = emailCount * costPerEmail;
    const budget = MONTHLY_BUDGETS['resend'] ?? 0;
    const usagePercent = budget > 0
      ? Math.round((estimatedCost / budget) * 10000) / 100
      : undefined;

    return {
      provider: 'resend',
      trackingMethod: 'heuristic',
      callCountPeriod: emailCount,
      estimatedCostPeriod: Math.round(estimatedCost * 1000) / 1000,
      usagePercent,
      isReachable: true,
      latencyMs,
      rawResponse: {
        emailCount,
        costPerEmail,
        monthlyBudget: budget,
      },
    };
  } catch (error) {
    return errorSnapshot('resend', 'heuristic', error, Date.now() - start);
  }
}

// ---------------------------------------------------------------------------
// 10. Google Maps (Heuristic)
// ---------------------------------------------------------------------------

export async function fetchGoogleMapsUsage(): Promise<UsageSnapshot> {
  return fetchHeuristicToolCallUsage('google_maps', () =>
    eq(crmToolCalls.toolName, 'google_maps_search')
  );
}

// ---------------------------------------------------------------------------
// Aggregate collector
// ---------------------------------------------------------------------------

/**
 * Collect usage snapshots from all providers concurrently.
 *
 * Uses Promise.allSettled so a single provider failure does not block others.
 * Failed adapters return a minimal error snapshot.
 */
export async function collectAllUsageSnapshots(): Promise<UsageSnapshot[]> {
  const adapters = [
    fetchTwilioUsage,
    fetchElevenLabsUsage,
    fetchOpenAIUsage,
    fetchAnthropicUsage,
    fetchZeroBounceUsage,
    fetchRapidAPIUsage,
    fetchBraveUsage,
    fetchPerplexityUsage,
    fetchResendUsage,
    fetchGoogleMapsUsage,
  ];

  const providerNames: ApiProvider[] = [
    'twilio',
    'elevenlabs',
    'openai',
    'anthropic',
    'zerobounce',
    'rapidapi',
    'brave',
    'perplexity',
    'resend',
    'google_maps',
  ];

  const results = await Promise.allSettled(adapters.map((fn) => fn()));

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      provider: providerNames[i],
      trackingMethod: 'api' as const,
      isReachable: false,
      lastError: result.reason?.message || 'Unknown error',
    };
  });
}
