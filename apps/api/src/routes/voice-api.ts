/**
 * Voice API - Platform Voice Service for Connect Apps
 *
 * Endpoints:
 *   POST  /v1/voice/generate  - Generate speech (returns base64 MP3)
 *   GET   /v1/voice/voices    - List available ElevenLabs voices (cached)
 *   GET   /v1/voice/usage     - Get current month usage + quota
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { generateSpeech, listVoices, getVoiceUsage } from '../services/voice-service';

export async function handleVoiceRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/voice/generate
  if (pathname === '/v1/voice/generate' && req.method === 'POST') {
    // Rate limit: 15 requests per minute per org
    const rateKey = `voice:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 15 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      text?: string;
      voiceId?: string;
      emotionDirection?: string;
      voiceSettings?: {
        stability?: number;
        similarity_boost?: number;
        style?: number;
        use_speaker_boost?: boolean;
      };
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    if (!body.voiceId?.trim()) {
      return Response.json({ error: 'voiceId is required' }, { status: 400 });
    }

    const result = await generateSpeech(
      {
        text: body.text,
        voiceId: body.voiceId,
        emotionDirection: body.emotionDirection,
        voiceSettings: body.voiceSettings,
      },
      {
        orgId: ctx.orgId,
        appId: body.appId,
      }
    );

    if (!result.success) {
      const status = result.error?.includes('quota exceeded') ? 402
        : result.error?.includes('rate') ? 429
        : 500;
      return Response.json({
        error: result.error,
        usage: result.usage,
      }, { status });
    }

    return Response.json({
      success: true,
      audio: result.audio,
      usage: result.usage,
    });
  }

  // GET /v1/voice/voices
  if (pathname === '/v1/voice/voices' && req.method === 'GET') {
    const rateKey = `voice-list:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    const voices = await listVoices();
    return Response.json({ voices });
  }

  // GET /v1/voice/usage
  if (pathname === '/v1/voice/usage' && req.method === 'GET') {
    const usage = await getVoiceUsage(ctx.orgId);
    return Response.json(usage);
  }

  return null;
}
