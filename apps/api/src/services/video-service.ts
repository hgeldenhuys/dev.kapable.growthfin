/**
 * Platform Video Service
 *
 * Provides AI video generation for Connect apps with per-org quota tracking.
 * Primary: Kling 3.0 via fal.ai (best quality, native first+last frame)
 * Fallback: Google Veo 3.1 (if FAL_KEY not set but GEMINI_API_KEY is)
 */

import { sql } from '../lib/db';

const FAL_KEY = process.env.FAL_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Kling model on fal.ai - use O1 for dedicated interpolation or v3/pro for general
const KLING_MODEL = 'fal-ai/kling-video/v3/pro/image-to-video';
const KLING_O1_MODEL = 'fal-ai/kling-video/o1/image-to-video';
const VEO_MODEL = 'veo-3.1-generate-preview';

type VideoProvider = 'kling' | 'veo' | 'none';

function getProvider(): VideoProvider {
  if (FAL_KEY) return 'kling';
  if (GEMINI_API_KEY) return 'veo';
  return 'none';
}

export function isVideoConfigured(): boolean {
  return getProvider() !== 'none';
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerateVideoParams {
  firstFrame: string;    // base64 image
  lastFrame: string;     // base64 image
  firstFrameMime?: string;
  lastFrameMime?: string;
  prompt: string;
  aspectRatio?: '16:9' | '9:16';
  duration?: number;     // seconds (5 or 10 for Kling)
}

export interface VideoContext {
  orgId: string;
  appId?: string;
}

export interface GenerateVideoResult {
  success: boolean;
  video?: string;        // base64 MP4
  mimeType?: string;
  durationSec?: number;
  provider?: string;
  error?: string;
  usage: VideoUsageStats;
}

export interface VideoUsageStats {
  generated: number;
  quota: number;
  remaining: number;
  month: string;
}

// ─── Quota ──────────────────────────────────────────────────────────────────

async function getVideoQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'video_monthly_limit')::int,
      10
    ) as video_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].video_limit) : 10;
}

export async function getVideoUsage(orgId: string): Promise<VideoUsageStats> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT videos_generated FROM video_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getVideoQuotaLimit(orgId),
  ]);

  const generated = usageRows.length > 0 ? Number(usageRows[0].videos_generated) : 0;
  const remaining = quota === 0 ? -1 : Math.max(0, quota - generated);

  return {
    generated,
    quota,
    remaining,  // -1 = unlimited
    month: monthStr,
  };
}

export async function checkVideoQuota(orgId: string): Promise<{ allowed: boolean; usage: VideoUsageStats }> {
  const usage = await getVideoUsage(orgId);
  const allowed = usage.quota === 0 || usage.generated < usage.quota;
  return { allowed, usage };
}

// ─── Generate (dispatcher) ──────────────────────────────────────────────────

export async function generateVideo(
  params: GenerateVideoParams,
  context: VideoContext
): Promise<GenerateVideoResult> {
  const provider = getProvider();

  if (provider === 'none') {
    return {
      success: false,
      error: 'Video service not configured (set FAL_KEY or GEMINI_API_KEY)',
      usage: await getVideoUsage(context.orgId),
    };
  }

  // Check quota
  const { allowed, usage } = await checkVideoQuota(context.orgId);
  if (!allowed) {
    logVideo(context, provider, 'quota_exceeded', null, null, 'Monthly video quota exceeded').catch(() => {});
    return {
      success: false,
      error: `Monthly video quota exceeded (${usage.generated}/${usage.quota})`,
      usage,
    };
  }

  if (!params.firstFrame || !params.lastFrame) {
    return { success: false, error: 'firstFrame and lastFrame are required', usage };
  }

  if (!params.prompt?.trim()) {
    return { success: false, error: 'prompt is required', usage };
  }

  if (provider === 'kling') {
    return generateViaKling(params, context, usage);
  }
  return generateViaVeo(params, context, usage);
}

// ─── Kling via fal.ai ───────────────────────────────────────────────────────

async function generateViaKling(
  params: GenerateVideoParams,
  context: VideoContext,
  usage: VideoUsageStats
): Promise<GenerateVideoResult> {
  const startTime = Date.now();

  try {
    // Upload images to fal.ai as data URIs
    const firstFrameDataUri = `data:${params.firstFrameMime || 'image/png'};base64,${params.firstFrame}`;
    const lastFrameDataUri = `data:${params.lastFrameMime || 'image/png'};base64,${params.lastFrame}`;

    const duration = String(params.duration || 10);

    // fal.ai REST API - queue-based for long-running operations
    const submitRes = await fetch(`https://queue.fal.run/${KLING_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_url: firstFrameDataUri,
        tail_image_url: lastFrameDataUri,
        duration,
        aspect_ratio: params.aspectRatio || '16:9',
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`fal.ai submit failed (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json() as { request_id: string; status_url?: string };
    const requestId = submitData.request_id;

    if (!requestId) {
      throw new Error('No request_id returned from fal.ai');
    }

    // Poll for completion (Kling takes 2-5 minutes)
    const maxPollMs = 10 * 60 * 1000; // 10 min max
    const pollIntervalMs = 5000;       // 5s between polls
    const deadline = Date.now() + maxPollMs;

    let videoUrl: string | undefined;
    let videoDuration: number | undefined;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs));

      const statusRes = await fetch(`https://queue.fal.run/${KLING_MODEL}/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json() as { status: string; response_url?: string };

      if (statusData.status === 'COMPLETED') {
        // Fetch the result
        const resultRes = await fetch(`https://queue.fal.run/${KLING_MODEL}/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (resultRes.ok) {
          const resultData = await resultRes.json() as { video?: { url: string; content_type?: string; duration?: number } };
          if (resultData.video?.url) {
            videoUrl = resultData.video.url;
            videoDuration = resultData.video.duration;
            break;
          }
        }
        break;
      }

      if (statusData.status === 'FAILED') {
        throw new Error('Kling video generation failed');
      }
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out or produced no output');
    }

    // Download the video and convert to base64
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.status}`);
    }

    const videoBuffer = await videoRes.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');

    const latencyMs = Date.now() - startTime;

    // Increment usage
    await incrementUsage(context.orgId);
    logVideo(context, 'kling', 'success', latencyMs, videoDuration || null, null).catch(() => {});

    const updatedUsage = await getVideoUsage(context.orgId);
    return {
      success: true,
      video: videoBase64,
      mimeType: 'video/mp4',
      durationSec: videoDuration,
      provider: 'kling',
      usage: updatedUsage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;
    logVideo(context, 'kling', 'failed', latencyMs, null, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      provider: 'kling',
      usage: await getVideoUsage(context.orgId),
    };
  }
}

// ─── Veo (fallback) ─────────────────────────────────────────────────────────

async function generateViaVeo(
  params: GenerateVideoParams,
  context: VideoContext,
  usage: VideoUsageStats
): Promise<GenerateVideoResult> {
  // Lazy import to avoid loading when not needed
  const { GoogleGenAI } = await import('@google/genai');
  const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

  const startTime = Date.now();

  try {
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      {
        inlineData: {
          data: params.firstFrame,
          mimeType: params.firstFrameMime || 'image/png',
        },
      },
      {
        inlineData: {
          data: params.lastFrame,
          mimeType: params.lastFrameMime || 'image/png',
        },
      },
      {
        text: `Generate a smooth video transition between these two frames. ${params.prompt}`,
      },
    ];

    const response = await genai.models.generateContent({
      model: VEO_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['VIDEO'],
        ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {}),
      },
    });

    const latencyMs = Date.now() - startTime;

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            await incrementUsage(context.orgId);
            logVideo(context, 'veo', 'success', latencyMs, null, null).catch(() => {});

            const updatedUsage = await getVideoUsage(context.orgId);
            return {
              success: true,
              video: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'video/mp4',
              provider: 'veo',
              usage: updatedUsage,
            };
          }
        }
      }

      if (candidate.finishReason === 'SAFETY') {
        logVideo(context, 'veo', 'failed', latencyMs, null, 'Content blocked by safety filters').catch(() => {});
        return {
          success: false,
          error: 'Video generation blocked by safety filters. Try adjusting your prompt.',
          provider: 'veo',
          usage,
        };
      }
    }

    logVideo(context, 'veo', 'failed', Date.now() - startTime, null, 'No video in response').catch(() => {});
    return {
      success: false,
      error: 'No video generated. Try a different prompt.',
      provider: 'veo',
      usage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logVideo(context, 'veo', 'failed', Date.now() - startTime, null, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      provider: 'veo',
      usage: await getVideoUsage(context.orgId),
    };
  }
}

// ─── Usage & Logging ────────────────────────────────────────────────────────

async function incrementUsage(orgId: string): Promise<void> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  await sql`
    INSERT INTO video_usage (organization_id, month, videos_generated, updated_at)
    VALUES (${orgId}, ${monthStr}, 1, now())
    ON CONFLICT (organization_id, month)
    DO UPDATE SET videos_generated = video_usage.videos_generated + 1, updated_at = now()
  `;
}

async function logVideo(
  context: VideoContext,
  provider: string,
  status: string,
  latencyMs: number | null,
  durationSec: number | null,
  errorMessage: string | null
): Promise<void> {
  const model = provider === 'kling' ? KLING_MODEL : VEO_MODEL;
  await sql`
    INSERT INTO video_logs (organization_id, app_id, model, duration_sec, status, latency_ms, error_message)
    VALUES (
      ${context.orgId},
      ${context.appId || null},
      ${model},
      ${durationSec},
      ${status},
      ${latencyMs},
      ${errorMessage}
    )
  `;
}
