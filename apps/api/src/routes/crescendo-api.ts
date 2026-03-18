/**
 * Crescendo API — Conversational App Builder
 *
 * Endpoints for managing Crescendo sessions (idea → spec → app).
 * All endpoints require console session auth (X-Deploy-Secret + X-Org-Id).
 */

import { sql } from '../lib/db';
import { generateCrescendoReply, extractSpec, isSpecReady, type CrescendoSpec } from '../services/crescendo-ai';
import { runCrescendoBuild } from '../services/crescendo-orchestrator';
import type { AdminContext } from '../lib/admin-auth';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CrescendoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    specReady?: boolean;
    stage?: string;
    error?: string;
  };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function handleCrescendoRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext,
): Promise<Response | null> {
  // POST /v1/crescendo/sessions — create session
  if (pathname === '/v1/crescendo/sessions' && req.method === 'POST') {
    return createSession(req, ctx);
  }

  // GET /v1/crescendo/sessions — list sessions
  if (pathname === '/v1/crescendo/sessions' && req.method === 'GET') {
    return listSessions(req, ctx);
  }

  // Match /v1/crescendo/sessions/:id/*
  const sessionMatch = pathname.match(/^\/v1\/crescendo\/sessions\/([0-9a-f-]{36})(?:\/(.+))?$/);
  if (!sessionMatch) return null;

  const sessionId = sessionMatch[1];
  const subpath = sessionMatch[2];

  // GET /v1/crescendo/sessions/:id — get session
  if (!subpath && req.method === 'GET') {
    return getSession(sessionId, ctx);
  }

  // POST /v1/crescendo/sessions/:id/messages — send message
  if (subpath === 'messages' && req.method === 'POST') {
    return sendMessage(req, sessionId, ctx);
  }

  // POST /v1/crescendo/sessions/:id/approve — approve spec and start build
  if (subpath === 'approve' && req.method === 'POST') {
    return approveSpec(req, sessionId, ctx);
  }

  // GET /v1/crescendo/sessions/:id/stream — SSE build progress
  if (subpath === 'stream' && req.method === 'GET') {
    return streamBuildProgress(req, sessionId, ctx);
  }

  return null;
}

// ─── Create Session ─────────────────────────────────────────────────────────

async function createSession(req: Request, ctx: AdminContext): Promise<Response> {
  try {
    const body = await req.json() as {
      initialMessage?: string;
      targetAppId?: string;
      targetEnvName?: string;
      createdBy?: string;
    };

    const messages: CrescendoMessage[] = [];

    // If there's an initial message, add it
    if (body.initialMessage) {
      messages.push({
        role: 'user',
        content: body.initialMessage,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await sql`
      INSERT INTO crescendo_sessions (org_id, created_by, messages, target_app_id, target_env_name)
      VALUES (
        ${ctx.orgId},
        ${body.createdBy || ctx.orgId},
        ${sql.json(messages as any)},
        ${body.targetAppId || null},
        ${body.targetEnvName || 'production'}
      )
      RETURNING *
    `;

    const session = result[0];

    // If there's an initial message, generate AI reply
    if (body.initialMessage && session) {
      const orgContext = await getEnrichedOrgContext(ctx.orgId);
      const isFeatureMode = !!body.targetAppId;

      const aiResult = await generateCrescendoReply(
        messages.map(m => ({ role: m.role, content: m.content })),
        orgContext,
        isFeatureMode,
      );

      if (aiResult.reply) {
        const assistantMsg: CrescendoMessage = {
          role: 'assistant',
          content: aiResult.reply,
          timestamp: new Date().toISOString(),
          metadata: {
            specReady: aiResult.specReady,
          },
        };
        messages.push(assistantMsg);

        const newState = aiResult.specReady ? 'spec_ready' : 'conversing';

        await sql`
          UPDATE crescendo_sessions
          SET messages = ${sql.json(messages as any)},
              state = ${newState},
              spec = ${aiResult.spec ? sql.json(aiResult.spec as any) : null},
              title = ${aiResult.spec?.appName || session.title},
              updated_at = now()
          WHERE id = ${session.id}
        `;

        session.messages = messages;
        session.state = newState;
        session.spec = aiResult.spec || null;
        if (aiResult.spec?.appName) session.title = aiResult.spec.appName;
      }
    }

    return Response.json(session, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── List Sessions ──────────────────────────────────────────────────────────

async function listSessions(_req: Request, ctx: AdminContext): Promise<Response> {
  try {
    const sessions = await sql`
      SELECT id, org_id, title, state, app_id, target_app_id, created_at, updated_at
      FROM crescendo_sessions
      WHERE org_id = ${ctx.orgId}
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    return Response.json({ sessions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── Get Session ────────────────────────────────────────────────────────────

async function getSession(sessionId: string, ctx: AdminContext): Promise<Response> {
  try {
    const result = await sql`
      SELECT * FROM crescendo_sessions
      WHERE id = ${sessionId} AND org_id = ${ctx.orgId}
    `;
    if (result.length === 0) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }
    return Response.json(result[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── Send Message ───────────────────────────────────────────────────────────

async function sendMessage(req: Request, sessionId: string, ctx: AdminContext): Promise<Response> {
  try {
    const body = await req.json() as { message: string };
    if (!body.message?.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    // Get current session
    const result = await sql`
      SELECT * FROM crescendo_sessions
      WHERE id = ${sessionId} AND org_id = ${ctx.orgId}
    `;
    if (result.length === 0) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = result[0];

    // Can only send messages in conversing or spec_ready states
    if (!['conversing', 'spec_ready'].includes(session.state)) {
      return Response.json({ error: `Cannot send messages in state: ${session.state}` }, { status: 400 });
    }

    const messages: CrescendoMessage[] = Array.isArray(session.messages) ? session.messages : [];

    // Cap conversation length
    if (messages.length >= 50) {
      return Response.json({ error: 'Conversation limit reached (50 messages)' }, { status: 400 });
    }

    // Add user message
    const userMsg: CrescendoMessage = {
      role: 'user',
      content: body.message.trim(),
      timestamp: new Date().toISOString(),
    };
    messages.push(userMsg);

    // Generate AI reply
    const orgContext = await getEnrichedOrgContext(ctx.orgId);
    const isFeatureMode = !!session.target_app_id;

    const aiResult = await generateCrescendoReply(
      messages.map(m => ({ role: m.role, content: m.content })),
      orgContext,
      isFeatureMode,
    );

    if (aiResult.error) {
      return Response.json({ error: aiResult.error }, { status: 500 });
    }

    // Add assistant message
    const assistantMsg: CrescendoMessage = {
      role: 'assistant',
      content: aiResult.reply,
      timestamp: new Date().toISOString(),
      metadata: {
        specReady: aiResult.specReady,
      },
    };
    messages.push(assistantMsg);

    const newState = aiResult.specReady ? 'spec_ready' : 'conversing';

    await sql`
      UPDATE crescendo_sessions
      SET messages = ${sql.json(messages as any)},
          state = ${newState},
          spec = ${aiResult.spec ? sql.json(aiResult.spec as any) : session.spec},
          title = ${aiResult.spec?.appName || session.title},
          updated_at = now()
      WHERE id = ${sessionId}
    `;

    return Response.json({
      message: assistantMsg,
      state: newState,
      spec: aiResult.spec || session.spec,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── Approve Spec ───────────────────────────────────────────────────────────

async function approveSpec(req: Request, sessionId: string, ctx: AdminContext): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({})) as {
      spec?: CrescendoSpec;
      createdBy?: string;
      memberId?: string;
    };

    // Get current session
    const result = await sql`
      SELECT * FROM crescendo_sessions
      WHERE id = ${sessionId} AND org_id = ${ctx.orgId}
    `;
    if (result.length === 0) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = result[0];

    // Allow approval from conversing (user override) or spec_ready
    if (!['conversing', 'spec_ready'].includes(session.state)) {
      return Response.json({ error: `Cannot approve in state: ${session.state}` }, { status: 400 });
    }

    // Use provided spec or existing spec
    const spec: CrescendoSpec = body.spec || session.spec;
    if (!spec || !spec.appName || !spec.slug) {
      return Response.json({ error: 'No spec available to approve' }, { status: 400 });
    }

    // Update state to approved
    await sql`
      UPDATE crescendo_sessions
      SET state = 'approved',
          spec = ${sql.json(spec as any)},
          updated_at = now()
      WHERE id = ${sessionId}
    `;

    // Start async build
    const orgContext = await getEnrichedOrgContext(ctx.orgId);
    runCrescendoBuild(sessionId, ctx.orgId, orgContext.orgSlug, spec, {
      targetAppId: session.target_app_id,
      targetEnvName: session.target_env_name || 'production',
      createdBy: body.createdBy || session.created_by,
      memberId: body.memberId || session.created_by,
    }).catch(err => {
      console.error(`[crescendo] Build failed for session ${sessionId}:`, err);
    });

    return Response.json({ state: 'approved', message: 'Build started' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── Stream Build Progress ──────────────────────────────────────────────────

async function streamBuildProgress(req: Request, sessionId: string, ctx: AdminContext): Promise<Response> {
  // Verify session exists
  const result = await sql`
    SELECT id, state FROM crescendo_sessions
    WHERE id = ${sessionId} AND org_id = ${ctx.orgId}
  `;
  if (result.length === 0) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Poll session state every 2 seconds
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const latest = await sql`
            SELECT state, build_error, app_id, story_id, deployment_id
            FROM crescendo_sessions
            WHERE id = ${sessionId}
          `;

          if (latest.length === 0) {
            clearInterval(interval);
            send('error', { message: 'Session not found' });
            controller.close();
            closed = true;
            return;
          }

          const s = latest[0];
          send('state', {
            state: s.state,
            error: s.build_error,
            appId: s.app_id,
            storyId: s.story_id,
            deploymentId: s.deployment_id,
          });

          // Close on terminal states
          if (['complete', 'failed'].includes(s.state)) {
            clearInterval(interval);
            try { controller.close(); } catch {}
            closed = true;
          }
        } catch {
          // DB error, keep trying
        }
      }, 2000);

      // Send initial state immediately
      const initial = await sql`
        SELECT state, build_error, app_id, story_id, deployment_id
        FROM crescendo_sessions
        WHERE id = ${sessionId}
      `;
      if (initial.length > 0) {
        const s = initial[0];
        send('state', {
          state: s.state,
          error: s.build_error,
          appId: s.app_id,
          storyId: s.story_id,
          deploymentId: s.deployment_id,
        });
      }

      // Keepalive
      const keepalive = setInterval(() => {
        if (closed) { clearInterval(keepalive); return; }
        send('ping', { ts: Date.now() });
      }, 15000);

      // Max lifetime: 10 minutes
      setTimeout(() => {
        clearInterval(interval);
        clearInterval(keepalive);
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      }, 10 * 60 * 1000);

      // Handle abort
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepalive);
        closed = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface EnrichedOrgContext {
  orgId: string;
  orgSlug: string;
  orgName: string;
  existingApps: Array<{ id: string; name: string; slug: string; framework: string }>;
  billingPlan: string;
  billingLimits: Record<string, unknown>;
}

async function getEnrichedOrgContext(orgId: string): Promise<EnrichedOrgContext> {
  const [orgRows, appRows, planRows] = await Promise.all([
    sql`SELECT slug, name FROM organizations WHERE id = ${orgId}`,
    sql`SELECT id, name, slug, framework FROM apps WHERE org_id = ${orgId} ORDER BY name`,
    sql`SELECT bp.name as plan_name, bp.limits
        FROM org_subscriptions os JOIN billing_plans bp ON bp.id = os.plan_id
        WHERE os.org_id = ${orgId}`,
  ]);

  return {
    orgId,
    orgSlug: orgRows[0]?.slug || 'unknown',
    orgName: orgRows[0]?.name || 'Unknown',
    existingApps: appRows.map((a: any) => ({ id: a.id, name: a.name, slug: a.slug, framework: a.framework })),
    billingPlan: planRows[0]?.plan_name || 'hobbyist',
    billingLimits: planRows[0]?.limits || {},
  };
}
