/**
 * Rate Limiter - Sliding window algorithm
 *
 * In-memory rate limiting per API key.
 * Supports tier-based limits via getOrgRateLimit().
 * Can be replaced with Redis for horizontal scaling (SIGNALDB-006).
 */

import { sql } from './db';

interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;      // Unix timestamp when window resets
  retryAfter?: number;  // Seconds until retry (if rate limited)
}

interface WindowData {
  timestamps: number[];
  wsConnections: number;
}

// Default limits
const DEFAULT_API_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 1000,    // 1000 requests per minute
};

// Cache for org rate limits (5-minute TTL)
const orgRateLimitCache = new Map<string, { limit: number; cachedAt: number }>();
const RATE_LIMIT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get the rate limit for an org based on their billing plan.
 * Cached for 5 minutes to avoid hitting the DB on every request.
 */
export async function getOrgRateLimit(orgId: string): Promise<number> {
  const cached = orgRateLimitCache.get(orgId);
  if (cached && Date.now() - cached.cachedAt < RATE_LIMIT_CACHE_TTL) {
    return cached.limit;
  }

  try {
    const rows = await sql`
      SELECT COALESCE(
        (bp.limits->>'api_calls_per_minute')::int,
        ${DEFAULT_API_LIMIT.maxRequests}
      ) as rate_limit
      FROM org_subscriptions os
      JOIN billing_plans bp ON bp.id = os.plan_id
      WHERE os.org_id = ${orgId}
    `;

    const limit = rows.length > 0 ? Number(rows[0].rate_limit) : DEFAULT_API_LIMIT.maxRequests;
    orgRateLimitCache.set(orgId, { limit, cachedAt: Date.now() });
    return limit;
  } catch {
    // Fail open with default
    return DEFAULT_API_LIMIT.maxRequests;
  }
}

const DEFAULT_WS_LIMIT = {
  maxConnections: 10,   // 10 concurrent WebSocket connections per key
};

// Storage: keyId -> window data
const windows = new Map<string, WindowData>();

// Active WebSocket connections: keyId -> count
const wsConnections = new Map<string, number>();

/**
 * Clean up old timestamps from the window
 */
function cleanWindow(data: WindowData, windowMs: number, now: number): void {
  const cutoff = now - windowMs;
  // Remove timestamps older than the window
  while (data.timestamps.length > 0 && data.timestamps[0] < cutoff) {
    data.timestamps.shift();
  }
}

/**
 * Check rate limit for an API request
 */
export function checkRateLimit(
  keyId: string,
  config: RateLimitConfig = DEFAULT_API_LIMIT
): RateLimitResult {
  const now = Date.now();

  // Get or create window data
  let data = windows.get(keyId);
  if (!data) {
    data = { timestamps: [], wsConnections: 0 };
    windows.set(keyId, data);
  }

  // Clean old timestamps
  cleanWindow(data, config.windowMs, now);

  // Check if under limit
  const currentCount = data.timestamps.length;
  const allowed = currentCount < config.maxRequests;

  if (allowed) {
    // Record this request
    data.timestamps.push(now);
  }

  // Calculate reset time (when oldest request in window expires)
  const resetAt = data.timestamps.length > 0
    ? data.timestamps[0] + config.windowMs
    : now + config.windowMs;

  const remaining = Math.max(0, config.maxRequests - data.timestamps.length);

  return {
    allowed,
    remaining,
    resetAt,
    retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
  };
}

/**
 * Check if a new WebSocket connection is allowed
 */
export function checkWsConnectionLimit(
  keyId: string,
  maxConnections: number = DEFAULT_WS_LIMIT.maxConnections
): { allowed: boolean; current: number; max: number } {
  const current = wsConnections.get(keyId) || 0;
  return {
    allowed: current < maxConnections,
    current,
    max: maxConnections,
  };
}

/**
 * Track a new WebSocket connection
 */
export function trackWsConnection(keyId: string): void {
  const current = wsConnections.get(keyId) || 0;
  wsConnections.set(keyId, current + 1);
}

/**
 * Remove a WebSocket connection
 */
export function removeWsConnection(keyId: string): void {
  const current = wsConnections.get(keyId) || 0;
  if (current > 1) {
    wsConnections.set(keyId, current - 1);
  } else {
    wsConnections.delete(keyId);
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult, maxRequests?: number): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(maxRequests ?? DEFAULT_API_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result),
      },
    }
  );
}

/**
 * Get current stats for monitoring
 */
export function getRateLimitStats() {
  return {
    trackedKeys: windows.size,
    activeWsConnections: Object.fromEntries(wsConnections),
  };
}

/**
 * Cleanup old entries (call periodically)
 */
export function cleanup(): void {
  const now = Date.now();
  const windowMs = DEFAULT_API_LIMIT.windowMs;

  for (const [keyId, data] of windows) {
    cleanWindow(data, windowMs, now);
    if (data.timestamps.length === 0) {
      windows.delete(keyId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanup, 60 * 1000);
