/**
 * Image API - Platform Image Service for Connect Apps
 *
 * Endpoints:
 *   POST  /v1/images/generate  - Generate an image (returns base64)
 *   POST  /v1/images/analyze   - Analyze text for scene context (no image)
 *   GET   /v1/images/usage     - Get current month usage + quota
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { generateImage, analyzeScene, analyzeTransition, analyzeNarrativeArc, getImageUsage } from '../services/image-service';
import type { SceneAnalysis } from '../services/image-service';

export async function handleImageRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/images/generate
  if (pathname === '/v1/images/generate' && req.method === 'POST') {
    // Rate limit: 10 images per minute per org
    const rateKey = `image:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 10 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      prompt?: string;
      aspectRatio?: '1:1' | '3:2' | '2:3' | '16:9' | '9:16' | '3:4' | '4:3';
      referenceImages?: Array<{ base64: string; mimeType: string }>;
      negativePrompt?: string;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.prompt?.trim()) {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await generateImage(
      {
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        referenceImages: body.referenceImages,
        negativePrompt: body.negativePrompt,
      },
      {
        orgId: ctx.orgId,
        appId: body.appId,
      }
    );

    if (!result.success) {
      const status = result.error?.includes('quota exceeded') ? 402
        : result.error?.includes('safety') ? 422
        : 500;
      return Response.json({
        error: result.error,
        usage: result.usage,
      }, { status });
    }

    return Response.json({
      success: true,
      image: result.image,
      mimeType: result.mimeType,
      usage: result.usage,
    });
  }

  // POST /v1/images/analyze
  if (pathname === '/v1/images/analyze' && req.method === 'POST') {
    const rateKey = `image-analyze:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      text?: string;
      characters?: Array<{ name: string; appearance?: string }>;
      narrativeContext?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    const analysis = await analyzeScene(body.text, body.characters || [], body.narrativeContext);
    return Response.json(analysis);
  }

  // POST /v1/images/analyze-transition
  if (pathname === '/v1/images/analyze-transition' && req.method === 'POST') {
    const rateKey = `image-analyze:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      currentText?: string;
      previousSceneContext?: SceneAnalysis;
      previousText?: string;
      characters?: Array<{ name: string; appearance?: string }>;
      storyContext?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.currentText?.trim()) {
      return Response.json({ error: 'currentText is required' }, { status: 400 });
    }

    if (!body.previousSceneContext) {
      return Response.json({ error: 'previousSceneContext is required' }, { status: 400 });
    }

    const analysis = await analyzeTransition(
      body.currentText,
      body.previousSceneContext,
      body.previousText,
      body.characters || [],
      body.storyContext
    );
    return Response.json(analysis);
  }

  // POST /v1/images/analyze-arc (narrative arc within a single turn)
  if (pathname === '/v1/images/analyze-arc' && req.method === 'POST') {
    const rateKey = `image-analyze:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      text?: string;
      characters?: Array<{ name: string; appearance?: string }>;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    const analysis = await analyzeNarrativeArc(body.text, body.characters || []);
    return Response.json(analysis);
  }

  // GET /v1/images/usage
  if (pathname === '/v1/images/usage' && req.method === 'GET') {
    const usage = await getImageUsage(ctx.orgId);
    return Response.json(usage);
  }

  return null;
}
