/**
 * Video API - Platform Video Service for Connect Apps
 *
 * Endpoints:
 *   POST  /v1/video/generate  - Generate a video from first+last frame images
 *   GET   /v1/video/usage     - Get current month usage + quota
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { generateVideo, getVideoUsage, isVideoConfigured } from '../services/video-service';

export async function handleVideoRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/video/generate
  if (pathname === '/v1/video/generate' && req.method === 'POST') {
    // Rate limit: 3 videos per minute per org (generation is expensive)
    const rateKey = `video:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 3 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      firstFrame?: string;
      lastFrame?: string;
      firstFrameMime?: string;
      lastFrameMime?: string;
      prompt?: string;
      aspectRatio?: '16:9' | '9:16';
      duration?: number;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.firstFrame || !body.lastFrame) {
      return Response.json({ error: 'firstFrame and lastFrame are required' }, { status: 400 });
    }

    if (!body.prompt?.trim()) {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await generateVideo(
      {
        firstFrame: body.firstFrame,
        lastFrame: body.lastFrame,
        firstFrameMime: body.firstFrameMime,
        lastFrameMime: body.lastFrameMime,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        duration: body.duration,
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
      video: result.video,
      mimeType: result.mimeType,
      durationSec: result.durationSec,
      usage: result.usage,
    });
  }

  // GET /v1/video/usage
  if (pathname === '/v1/video/usage' && req.method === 'GET') {
    const usage = await getVideoUsage(ctx.orgId);
    return Response.json(usage);
  }

  // GET /v1/video/status — check if video service is configured
  if (pathname === '/v1/video/status' && req.method === 'GET') {
    return Response.json({ configured: isVideoConfigured() });
  }

  return null;
}
