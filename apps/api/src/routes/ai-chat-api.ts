/**
 * AI Chat API - Platform AI Chat Service for Connect Apps
 *
 * Endpoints:
 *   POST  /v1/ai/chat   - Send messages and get AI response (rate limited)
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { chatComplete } from '../services/ai-chat-service';

export async function handleAiChatRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/ai/chat
  if (pathname === '/v1/ai/chat' && req.method === 'POST') {
    // Rate limit: 20 requests per minute per org
    const rateKey = `ai-chat:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 20 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      messages?: Array<{ role: string; content: string }>;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'messages array is required' }, { status: 400 });
    }

    const result = await chatComplete(
      {
        messages: body.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        systemPrompt: body.systemPrompt,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      },
      {
        orgId: ctx.orgId,
        appId: body.appId,
      }
    );

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({
      success: true,
      response: result.response,
    });
  }

  return null;
}
