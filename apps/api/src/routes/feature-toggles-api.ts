/**
 * Feature Toggles API — Platform Feature Flag Service for Connect Apps
 *
 * Endpoints:
 *   POST   /v1/feature-toggles/evaluate       - Evaluate a single flag
 *   POST   /v1/feature-toggles/bulk-evaluate   - Evaluate up to 100 flags
 *   GET    /v1/feature-toggles/usage           - Get monthly usage stats
 *   GET    /v1/feature-toggles                 - List all flags
 *   POST   /v1/feature-toggles                 - Create a flag
 *   GET    /v1/feature-toggles/:name           - Get flag by name
 *   PUT    /v1/feature-toggles/:name           - Update flag
 *   DELETE /v1/feature-toggles/:name           - Delete flag
 *   GET    /v1/feature-toggles/stream          - SSE real-time stream
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { sql } from '../lib/db';
import {
  evaluateFlag,
  bulkEvaluateFlags,
  getFeatureToggleUsage,
  checkFeatureToggleQuota,
  createFlag,
  listFlags,
  getFlag,
  updateFlag,
  deleteFlag,
} from '../services/feature-toggles-service';

export async function handleFeatureToggleRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/feature-toggles/evaluate
  if (pathname === '/v1/feature-toggles/evaluate' && req.method === 'POST') {
    const rateKey = `ft-eval:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 1000 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      flagName?: string;
      userId?: string;
      environment?: string;
      context?: Record<string, unknown>;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.flagName) {
      return Response.json({ error: 'flagName is required' }, { status: 400 });
    }

    // Quota check
    const { allowed, usage } = await checkFeatureToggleQuota(ctx.orgId);
    if (!allowed) {
      return Response.json({
        error: `Monthly feature toggle quota exceeded (${usage.evaluations}/${usage.quota})`,
        usage,
      }, { status: 402 });
    }

    const result = await evaluateFlag(ctx.orgId, {
      flagName: body.flagName,
      userId: body.userId,
      environment: body.environment,
      context: body.context,
      appId: body.appId,
    });

    return Response.json(result);
  }

  // POST /v1/feature-toggles/bulk-evaluate
  if (pathname === '/v1/feature-toggles/bulk-evaluate' && req.method === 'POST') {
    const rateKey = `ft-bulk:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 100 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      flags?: string[];
      userId?: string;
      environment?: string;
      context?: Record<string, unknown>;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.flags || !Array.isArray(body.flags) || body.flags.length === 0) {
      return Response.json({ error: 'flags array is required and must not be empty' }, { status: 400 });
    }

    if (body.flags.length > 100) {
      return Response.json({ error: 'Maximum 100 flags per bulk evaluate request' }, { status: 400 });
    }

    // Quota check
    const { allowed, usage } = await checkFeatureToggleQuota(ctx.orgId);
    if (!allowed) {
      return Response.json({
        error: `Monthly feature toggle quota exceeded (${usage.evaluations}/${usage.quota})`,
        usage,
      }, { status: 402 });
    }

    const results = await bulkEvaluateFlags(ctx.orgId, body.flags, {
      userId: body.userId,
      environment: body.environment,
      context: body.context,
      appId: body.appId,
    });

    return Response.json({ results });
  }

  // GET /v1/feature-toggles/usage
  if (pathname === '/v1/feature-toggles/usage' && req.method === 'GET') {
    const usage = await getFeatureToggleUsage(ctx.orgId);
    return Response.json(usage);
  }

  // GET /v1/feature-toggles/stream — SSE real-time
  if (pathname === '/v1/feature-toggles/stream' && req.method === 'GET') {
    return handleSSEStream(ctx.orgId);
  }

  // GET /v1/feature-toggles — List all flags
  if (pathname === '/v1/feature-toggles' && req.method === 'GET') {
    const flags = await listFlags(ctx.orgId);
    return Response.json({ flags });
  }

  // POST /v1/feature-toggles — Create flag
  if (pathname === '/v1/feature-toggles' && req.method === 'POST') {
    let body: {
      name?: string;
      description?: string;
      flagType?: 'boolean' | 'rollout';
      defaultValue?: boolean;
      rolloutConfig?: { percentage?: number; rules?: unknown[] };
      environmentOverrides?: Record<string, boolean>;
      enabled?: boolean;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    // Validate flag name format
    if (!/^[a-z0-9][a-z0-9._-]{0,98}[a-z0-9]$/.test(body.name) && body.name.length < 2) {
      return Response.json({ error: 'Flag name must be 2-100 chars, lowercase alphanumeric, dots, hyphens, underscores' }, { status: 400 });
    }

    try {
      const flag = await createFlag(ctx.orgId, {
        name: body.name,
        description: body.description,
        flagType: body.flagType,
        defaultValue: body.defaultValue,
        rolloutConfig: body.rolloutConfig as any,
        environmentOverrides: body.environmentOverrides,
        enabled: body.enabled,
      });
      return Response.json(flag, { status: 201 });
    } catch (err: any) {
      if (err?.message?.includes('unique') || err?.code === '23505') {
        return Response.json({ error: `Flag "${body.name}" already exists` }, { status: 409 });
      }
      throw err;
    }
  }

  // Match /v1/feature-toggles/:name
  const nameMatch = pathname.match(/^\/v1\/feature-toggles\/([a-z0-9._-]+)$/);
  if (nameMatch) {
    const flagName = nameMatch[1];

    // GET /v1/feature-toggles/:name
    if (req.method === 'GET') {
      const flag = await getFlag(ctx.orgId, flagName);
      if (!flag) {
        return Response.json({ error: 'Flag not found' }, { status: 404 });
      }
      return Response.json(flag);
    }

    // PUT /v1/feature-toggles/:name
    if (req.method === 'PUT') {
      let body: {
        description?: string;
        flagType?: 'boolean' | 'rollout';
        defaultValue?: boolean;
        rolloutConfig?: { percentage?: number; rules?: unknown[] };
        environmentOverrides?: Record<string, boolean>;
        enabled?: boolean;
      };

      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const updated = await updateFlag(ctx.orgId, flagName, {
        description: body.description,
        flagType: body.flagType,
        defaultValue: body.defaultValue,
        rolloutConfig: body.rolloutConfig as any,
        environmentOverrides: body.environmentOverrides,
        enabled: body.enabled,
      });

      if (!updated) {
        return Response.json({ error: 'Flag not found' }, { status: 404 });
      }

      return Response.json(updated);
    }

    // DELETE /v1/feature-toggles/:name
    if (req.method === 'DELETE') {
      const deleted = await deleteFlag(ctx.orgId, flagName);
      if (!deleted) {
        return Response.json({ error: 'Flag not found' }, { status: 404 });
      }
      return Response.json({ deleted: true });
    }
  }

  return null;
}

// ─── SSE Stream ─────────────────────────────────────────────────────────────

function handleSSEStream(orgId: string): Response {
  const channel = `org_${orgId.replace(/-/g, '_')}_flags`;

  let listener: (() => Promise<void>) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial connection event
      send(JSON.stringify({ type: 'connected', channel, timestamp: Date.now() }));

      // Heartbeat every 30 seconds
      heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }, 30_000);

      // Listen for pg_notify events
      try {
        const subscription = await sql.listen(channel, (payload: string) => {
          send(payload);
        });

        listener = async () => {
          try {
            await subscription.unlisten();
          } catch {
            // Ignore cleanup errors
          }
        };
      } catch (err) {
        send(JSON.stringify({ type: 'error', message: 'Failed to subscribe to flag changes' }));
      }
    },

    async cancel() {
      closed = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (listener) await listener();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
