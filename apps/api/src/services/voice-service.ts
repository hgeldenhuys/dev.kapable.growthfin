/**
 * Platform Voice Service
 *
 * Provides TTS for Connect apps with per-org quota tracking.
 * Uses ElevenLabs v3 for speech synthesis with emotion control.
 */

import { sql } from '../lib/db';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = 'eleven_v3';
const VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerateSpeechParams {
  text: string;
  voiceId: string;
  emotionDirection?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface VoiceContext {
  orgId: string;
  appId?: string;
}

export interface GenerateSpeechResult {
  success: boolean;
  audio?: string; // base64 MP3
  error?: string;
  usage: VoiceUsageStats;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url?: string;
}

export interface VoiceUsageStats {
  charactersUsed: number;
  quota: number;
  remaining: number;
  month: string;
}

// ─── Voice Cache ────────────────────────────────────────────────────────────

let voiceCache: { voices: ElevenLabsVoice[]; cachedAt: number } | null = null;
const VOICE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ─── Quota ──────────────────────────────────────────────────────────────────

async function getVoiceQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'voice_monthly_chars')::int,
      10000
    ) as voice_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].voice_limit) : 10000;
}

export async function getVoiceUsage(orgId: string): Promise<VoiceUsageStats> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT characters_used FROM voice_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getVoiceQuotaLimit(orgId),
  ]);

  const charactersUsed = usageRows.length > 0 ? Number(usageRows[0].characters_used) : 0;
  const remaining = quota === 0 ? -1 : Math.max(0, quota - charactersUsed);

  return {
    charactersUsed,
    quota,
    remaining, // -1 = unlimited
    month: monthStr,
  };
}

export async function checkVoiceQuota(
  orgId: string,
  textLength: number
): Promise<{ allowed: boolean; usage: VoiceUsageStats }> {
  const usage = await getVoiceUsage(orgId);
  const allowed = usage.quota === 0 || (usage.charactersUsed + textLength) <= usage.quota;
  return { allowed, usage };
}

// ─── Voice Listing ──────────────────────────────────────────────────────────

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  // Return from cache if fresh
  if (voiceCache && Date.now() - voiceCache.cachedAt < VOICE_CACHE_TTL) {
    return voiceCache.voices;
  }

  if (!ELEVENLABS_API_KEY) {
    return [];
  }

  try {
    const res = await fetch(VOICES_URL, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });

    if (!res.ok) {
      console.error('[voice] Failed to fetch voices:', res.status);
      return voiceCache?.voices || [];
    }

    const data = await res.json() as { voices: Array<{
      voice_id: string;
      name: string;
      category: string;
      labels: Record<string, string>;
      preview_url?: string;
    }> };

    const voices: ElevenLabsVoice[] = data.voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'premade',
      labels: v.labels || {},
      preview_url: v.preview_url,
    }));

    // Sort: cloned > generated > premade, then alphabetical
    voices.sort((a, b) => {
      const order = ['cloned', 'generated', 'premade'];
      const catDiff = order.indexOf(a.category) - order.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    voiceCache = { voices, cachedAt: Date.now() };
    return voices;
  } catch (err) {
    console.error('[voice] Error fetching voices:', err);
    return voiceCache?.voices || [];
  }
}

// ─── Speech Generation ──────────────────────────────────────────────────────

export async function generateSpeech(
  params: GenerateSpeechParams,
  context: VoiceContext
): Promise<GenerateSpeechResult> {
  if (!ELEVENLABS_API_KEY) {
    return {
      success: false,
      error: 'Voice service not configured (ELEVENLABS_API_KEY missing)',
      usage: await getVoiceUsage(context.orgId),
    };
  }

  const textLength = params.text.length;

  // Check quota
  const { allowed, usage } = await checkVoiceQuota(context.orgId, textLength);
  if (!allowed) {
    logVoice(context, params, 'quota_exceeded', null, 'Monthly voice character quota exceeded').catch(() => {});
    return {
      success: false,
      error: `Monthly voice character quota exceeded (${usage.charactersUsed}/${usage.quota})`,
      usage,
    };
  }

  if (!params.text?.trim()) {
    return {
      success: false,
      error: 'text is required',
      usage,
    };
  }

  if (!params.voiceId?.trim()) {
    return {
      success: false,
      error: 'voiceId is required',
      usage,
    };
  }

  const startTime = Date.now();

  try {
    // Prepend emotion direction as audio tag if provided
    let speechText = params.text;
    if (params.emotionDirection?.trim()) {
      speechText = `[${params.emotionDirection.trim()}] ${speechText}`;
    }

    const voiceSettings = {
      stability: params.voiceSettings?.stability ?? 0.5,
      similarity_boost: params.voiceSettings?.similarity_boost ?? 0.75,
      style: params.voiceSettings?.style ?? 0.3,
      use_speaker_boost: params.voiceSettings?.use_speaker_boost ?? true,
    };

    const res = await fetch(`${TTS_URL}/${params.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: speechText,
        model_id: MODEL,
        voice_settings: voiceSettings,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      logVoice(context, params, 'failed', latencyMs, errText).catch(() => {});
      return {
        success: false,
        error: `ElevenLabs error: ${errText}`,
        usage,
      };
    }

    // Read audio as buffer and convert to base64
    const audioBuffer = await res.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Increment usage atomically
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStr = currentMonth.toISOString().slice(0, 10);

    await sql`
      INSERT INTO voice_usage (organization_id, month, characters_used, updated_at)
      VALUES (${context.orgId}, ${monthStr}, ${textLength}, now())
      ON CONFLICT (organization_id, month)
      DO UPDATE SET characters_used = voice_usage.characters_used + ${textLength}, updated_at = now()
    `;

    logVoice(context, params, 'success', latencyMs, null).catch(() => {});

    const updatedUsage = await getVoiceUsage(context.orgId);
    return {
      success: true,
      audio: audioBase64,
      usage: updatedUsage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;
    logVoice(context, params, 'failed', latencyMs, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      usage: await getVoiceUsage(context.orgId),
    };
  }
}

// ─── Logging ────────────────────────────────────────────────────────────────

async function logVoice(
  context: VoiceContext,
  params: GenerateSpeechParams,
  status: string,
  latencyMs: number | null,
  errorMessage: string | null
): Promise<void> {
  await sql`
    INSERT INTO voice_logs (organization_id, app_id, model, voice_id, text_length, status, latency_ms, error_message)
    VALUES (
      ${context.orgId},
      ${context.appId || null},
      ${MODEL},
      ${params.voiceId || null},
      ${params.text?.length || 0},
      ${status},
      ${latencyMs},
      ${errorMessage}
    )
  `;
}
