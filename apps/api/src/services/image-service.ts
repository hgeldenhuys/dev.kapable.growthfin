/**
 * Platform Image Service
 *
 * Provides AI image generation for Connect apps with per-org quota tracking.
 * Primary: fal.ai with Storyboard Sketch LoRA (authentic grayscale storyboard style)
 * Fallback: Google Gemini (if FAL_KEY not set but GEMINI_API_KEY is)
 */

import { GoogleGenAI } from '@google/genai';
import { sql } from '../lib/db';

const FAL_KEY = process.env.FAL_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FAL_IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || 'fal-ai/flux-general';
const FAL_IMAGE_LORA_URL = process.env.FAL_IMAGE_LORA_URL || 'https://huggingface.co/blink7630/storyboard-sketch/resolve/main/Storyboard_sketch.safetensors';
const FAL_IMAGE_LORA_SCALE = parseFloat(process.env.FAL_IMAGE_LORA_SCALE || '0.8');
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const ANALYSIS_MODEL = 'gemini-3-flash-preview';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

type ImageProvider = 'fal' | 'gemini' | 'none';

function getProvider(): ImageProvider {
  if (FAL_KEY) return 'fal';
  if (GEMINI_API_KEY) return 'gemini';
  return 'none';
}

// ─── Aspect Ratio Mapping ────────────────────────────────────────────────────

type FalImageSize = string | { width: number; height: number };

const ASPECT_RATIO_MAP: Record<string, FalImageSize> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '3:2': { width: 1216, height: 832 },
  '2:3': { width: 832, height: 1216 },
};

function mapAspectRatio(ratio?: string): FalImageSize {
  return ASPECT_RATIO_MAP[ratio || '3:2'] || ASPECT_RATIO_MAP['3:2'];
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: '1:1' | '3:2' | '2:3' | '16:9' | '9:16' | '3:4' | '4:3';
  referenceImages?: Array<{
    base64: string;
    mimeType: string;
  }>;
  negativePrompt?: string;
}

export interface ImageContext {
  orgId: string;
  appId?: string;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string; // base64 encoded PNG
  mimeType?: string;
  error?: string;
  usage: ImageUsageStats;
}

export interface SceneAnalysis {
  characters: Array<{ name: string; action: string }>;
  setting: string;
  mood: string;
  composition: string;
  keyElements: string[];
}

export interface TransitionAnalysis {
  locationChange: 'same' | 'nearby' | 'different';
  locationDescription: string;
  timeProgression: 'continuous' | 'minutes_later' | 'hours_later' | 'days_later' | 'flashback';
  timeDescription: string;
  characterMovement: Array<{ name: string; startPosition: string; endPosition: string; action: string }>;
  cameraMotion: string;
  moodShift: { from: string; to: string };
  continuityElements: string[];
  startFrameVisual: string;
  endFrameVisual: string;
}

export interface ImageUsageStats {
  generated: number;
  quota: number;
  remaining: number;
  month: string;
}

// ─── Quota ──────────────────────────────────────────────────────────────────

async function getImageQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'image_monthly_limit')::int,
      50
    ) as image_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].image_limit) : 50;
}

export async function getImageUsage(orgId: string): Promise<ImageUsageStats> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT images_generated FROM image_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getImageQuotaLimit(orgId),
  ]);

  const generated = usageRows.length > 0 ? Number(usageRows[0].images_generated) : 0;
  const remaining = quota === 0 ? -1 : Math.max(0, quota - generated);

  return {
    generated,
    quota,
    remaining, // -1 = unlimited
    month: monthStr,
  };
}

export async function checkImageQuota(orgId: string): Promise<{ allowed: boolean; usage: ImageUsageStats }> {
  const usage = await getImageUsage(orgId);
  const allowed = usage.quota === 0 || usage.generated < usage.quota;
  return { allowed, usage };
}

// ─── Scene Analysis ─────────────────────────────────────────────────────────

export async function analyzeScene(
  text: string,
  characters: Array<{ name: string; appearance?: string }> = [],
  narrativeContext?: string
): Promise<SceneAnalysis> {
  if (!genai) {
    return {
      characters: [],
      setting: 'unknown',
      mood: 'neutral',
      composition: 'medium shot',
      keyElements: [],
    };
  }

  const charContext = characters.length > 0
    ? `\nKnown characters:\n${characters.map(c => `- ${c.name}${c.appearance ? ': ' + c.appearance : ''}`).join('\n')}`
    : '';

  const storyContext = narrativeContext
    ? `\nPreceding story context (for setting/mood continuity — illustrate ONLY the current turn):\n${narrativeContext}\n`
    : '';

  const response = await genai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      role: 'user',
      parts: [{ text: `Analyze this story scene for illustration. Return ONLY valid JSON with these fields:
- characters: array of {name, action} for characters present in the scene
- setting: brief description of the location/environment
- mood: emotional tone (e.g., "tense", "peaceful", "dramatic")
- composition: camera/composition suggestion (e.g., "wide shot", "close-up", "over-the-shoulder")
- keyElements: array of important visual elements to include

IMPORTANT CHARACTER RULES:
- For first-person narrators ("I"), infer gender from context clues in the text (pronouns used by others, physical descriptions, names). If genuinely ambiguous, default to MALE.
- NEVER describe characters as "gender-neutral" or "androgynous" — always commit to a specific gender based on textual evidence.
- Use concrete physical descriptions (e.g., "a man in his 30s" not "a person").

NARRATIVE ACCURACY:
- keyElements should ONLY contain objects/props explicitly mentioned in the text.
- Do NOT invent details. If the text says "zip ties" include that, not "handcuffs" or "seatbelt".
- Read the text LITERALLY for physical details.
${charContext}
${storyContext}
Current turn to illustrate:
${text}` }],
    }],
  });

  try {
    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SceneAnalysis;
    }
  } catch {
    // Fall through to default
  }

  return {
    characters: [],
    setting: 'unknown',
    mood: 'neutral',
    composition: 'medium shot',
    keyElements: [],
  };
}

// ─── Transition Analysis ─────────────────────────────────────────────────────

export async function analyzeTransition(
  currentText: string,
  previousSceneContext: SceneAnalysis,
  previousText: string | undefined,
  characters: Array<{ name: string; appearance?: string }> = [],
  storyContext?: string
): Promise<TransitionAnalysis> {
  if (!genai) {
    return {
      locationChange: 'same',
      locationDescription: previousSceneContext.setting || 'unknown',
      timeProgression: 'continuous',
      timeDescription: 'Moments later',
      characterMovement: [],
      cameraMotion: 'static',
      moodShift: { from: previousSceneContext.mood || 'neutral', to: 'neutral' },
      continuityElements: previousSceneContext.keyElements || [],
      startFrameVisual: `Wide establishing shot of ${previousSceneContext.setting || 'the scene'}, neutral lighting.`,
      endFrameVisual: `Close-up of the scene conclusion, shifted lighting and mood.`,
    };
  }

  const charContext = characters.length > 0
    ? `\nKnown characters:\n${characters.map(c => `- ${c.name}${c.appearance ? ': ' + c.appearance : ''}`).join('\n')}`
    : '';

  const prevContext = previousText
    ? `\nPrevious turn text:\n${previousText}\n`
    : '';

  const storyLine = storyContext
    ? `\nFULL STORY CONTEXT (use this to understand the narrative arc, recurring characters, and setting evolution):\n${storyContext}\n`
    : '';

  const response = await genai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      role: 'user',
      parts: [{ text: `You are a storyboard director designing TWO visually distinct keyframes for an animated scene transition. Return ONLY valid JSON.
${storyLine}
Previous scene context:
- Setting: ${previousSceneContext.setting || 'unknown'}
- Mood: ${previousSceneContext.mood || 'neutral'}
- Key elements: ${(previousSceneContext.keyElements || []).join(', ') || 'none'}
- Characters present: ${(previousSceneContext.characters || []).map((c: { name: string; action: string }) => `${c.name} (${c.action})`).join(', ') || 'none'}
${prevContext}${charContext}

Current turn to illustrate:
${currentText}

Think like a cinematographer. The START frame is the OPENING SHOT — it establishes the scene at the very beginning of this turn's action. The END frame is the CLOSING SHOT — it shows the conclusion, aftermath, or emotional resolution. These two frames will be interpolated into a video, so they MUST be visually different enough to create meaningful motion.

Analyze the transition and return JSON:
{
  "locationChange": "same" | "nearby" | "different",
  "locationDescription": "current location",
  "timeProgression": "continuous" | "minutes_later" | "hours_later" | "days_later" | "flashback",
  "timeDescription": "brief time context",
  "characterMovement": [{"name": "...", "startPosition": "where at start of turn", "endPosition": "where at end of turn", "action": "what they do during the turn"}],
  "cameraMotion": "camera movement between frames (e.g., 'dolly in from wide to close-up', 'pan left following character')",
  "moodShift": {"from": "mood at start of turn", "to": "mood at end of turn"},
  "continuityElements": ["visual elements that MUST persist in both frames"],
  "startFrameVisual": "Detailed visual description for the OPENING image. Describe: exact camera angle/distance, character positions and poses, facial expressions, lighting direction and quality, background details, color palette emphasis. This is the BEGINNING of the action — characters are in their initial positions, the tension/emotion is building. Make this specific enough to generate a distinct image.",
  "endFrameVisual": "Detailed visual description for the CLOSING image. Describe: how camera angle has changed, where characters have MOVED to, how their expressions/poses changed, how lighting shifted (e.g., darker, warmer, shadows moved), what new visual elements appeared. This is the CONCLUSION — show the result of the action, the emotional payoff. Must be visually DIFFERENT from the start frame in at least 3 ways: character position, camera angle, and mood/lighting."
}

CRITICAL: startFrameVisual and endFrameVisual must describe VISUALLY DIFFERENT scenes. They will become two separate illustrations. If a character walks across a room, show them at the door in START and at the window in END. If mood shifts from hope to despair, START should have warm golden light and END should have cold blue shadows. Always specify concrete visual differences.

CHARACTER RULES:
- For first-person narrators ("I"), infer gender from context clues (pronouns, physical descriptions, names). If genuinely ambiguous, default to MALE.
- NEVER describe characters as "gender-neutral" — always commit to a specific gender.
- Use concrete physical descriptions (e.g., "a man" not "a person", "his face" not "their face").

NARRATIVE ACCURACY (CRITICAL):
- ONLY describe what the text explicitly states. Do NOT invent props, clothing, or objects not mentioned.
- If the text says "zip ties" do NOT show a seatbelt. If the text says "blindfold" do NOT show sunglasses.
- Read the text LITERALLY for physical details: restraints, injuries, clothing, objects in hands.
- If a character is kidnapped/restrained, show the SPECIFIC restraint method from the text, not a generic one.
- Do NOT add text, captions, speech bubbles, or written words to the visual descriptions.` }],
    }],
  });

  try {
    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TransitionAnalysis;
    }
  } catch {
    // Fall through to default
  }

  return {
    locationChange: 'same',
    locationDescription: previousSceneContext.setting || 'unknown',
    timeProgression: 'continuous',
    timeDescription: 'Moments later',
    characterMovement: [],
    cameraMotion: 'static',
    moodShift: { from: previousSceneContext.mood || 'neutral', to: 'neutral' },
    continuityElements: previousSceneContext.keyElements || [],
    startFrameVisual: `Wide establishing shot of ${previousSceneContext.setting || 'the scene'}, neutral lighting.`,
    endFrameVisual: `Close-up of the scene conclusion, shifted lighting and mood.`,
  };
}

// ─── Narrative Arc Analysis (for first turn with no previous context) ────────

export interface NarrativeArcAnalysis {
  startFrameVisual: string;
  endFrameVisual: string;
  moodShift: { from: string; to: string };
  cameraMotion: string;
  setting: string;
}

export async function analyzeNarrativeArc(
  text: string,
  characters: Array<{ name: string; appearance?: string }> = []
): Promise<NarrativeArcAnalysis> {
  if (!genai) {
    return {
      startFrameVisual: 'Wide establishing shot of the scene opening.',
      endFrameVisual: 'Close-up showing the scene conclusion.',
      moodShift: { from: 'neutral', to: 'neutral' },
      cameraMotion: 'slow dolly in',
      setting: 'unknown',
    };
  }

  const charContext = characters.length > 0
    ? `\nKnown characters:\n${characters.map(c => `- ${c.name}${c.appearance ? ': ' + c.appearance : ''}`).join('\n')}`
    : '';

  const response = await genai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      role: 'user',
      parts: [{ text: `You are a storyboard director designing TWO visually distinct keyframes for the OPENING and CLOSING of a single story passage. These will become two separate illustrations that get interpolated into a short animation. Return ONLY valid JSON.
${charContext}

Story passage:
${text}

Design two visually distinct frames — the OPENING moment and the CLOSING moment of this passage. Think cinematically: how does the "camera" move, where do characters shift, how does mood/lighting evolve?

Return JSON:
{
  "setting": "location description",
  "moodShift": {"from": "mood at passage start", "to": "mood at passage end"},
  "cameraMotion": "how camera moves between frames (e.g., 'wide establishing to intimate close-up')",
  "startFrameVisual": "Detailed visual description for the OPENING image. Include: camera angle/distance (e.g., wide shot, medium shot), exact character positions and body language, facial expressions, lighting direction and color temperature, specific background details. This is the moment before or at the very start of the action.",
  "endFrameVisual": "Detailed visual description for the CLOSING image. Include: how camera angle has changed (e.g., moved closer, shifted angle), where characters have MOVED to and how their posture/expression changed, how lighting SHIFTED (warmer/cooler, different shadows), what visual elements appeared or disappeared. This is the aftermath or resolution."
}

CRITICAL: The two frames must be visually DIFFERENT in at least 3 concrete ways: character position/pose, camera distance/angle, and lighting/mood. They will be two separate images — make them tell a visual story of change.

CHARACTER RULES:
- For first-person narrators ("I"), infer gender from context clues (pronouns, physical descriptions, names). If genuinely ambiguous, default to MALE.
- NEVER describe characters as "gender-neutral" — always commit to a specific gender.
- Use concrete physical descriptions (e.g., "a man" not "a person").

NARRATIVE ACCURACY (CRITICAL):
- ONLY describe what the text explicitly states. Do NOT invent props, clothing, or objects not mentioned.
- If the text says "zip ties" do NOT show a seatbelt. If the text says "blindfold" do NOT show sunglasses.
- Read the text LITERALLY for physical details: restraints, injuries, clothing, objects in hands.
- Do NOT add text, captions, speech bubbles, or written words to the visual descriptions.` }],
    }],
  });

  try {
    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as NarrativeArcAnalysis;
    }
  } catch {
    // Fall through to default
  }

  return {
    startFrameVisual: 'Wide establishing shot of the scene opening.',
    endFrameVisual: 'Close-up showing the scene conclusion.',
    moodShift: { from: 'neutral', to: 'neutral' },
    cameraMotion: 'slow dolly in',
    setting: 'unknown',
  };
}

// ─── Generate (dispatcher) ──────────────────────────────────────────────────

export async function generateImage(
  params: GenerateImageParams,
  context: ImageContext
): Promise<GenerateImageResult> {
  const provider = getProvider();

  if (provider === 'none') {
    return {
      success: false,
      error: 'Image service not configured (set FAL_KEY or GEMINI_API_KEY)',
      usage: await getImageUsage(context.orgId),
    };
  }

  // Check quota
  const { allowed, usage } = await checkImageQuota(context.orgId);
  if (!allowed) {
    logImage(context, params, provider, 'quota_exceeded', null, 'Monthly image quota exceeded').catch(() => {});
    return {
      success: false,
      error: `Monthly image quota exceeded (${usage.generated}/${usage.quota})`,
      usage,
    };
  }

  if (!params.prompt?.trim()) {
    return {
      success: false,
      error: 'prompt is required',
      usage,
    };
  }

  if (provider === 'fal') {
    return generateViaFal(params, context, usage);
  }
  return generateViaGemini(params, context, usage);
}

// ─── fal.ai with Storyboard Sketch LoRA ─────────────────────────────────────

const DEFAULT_NEGATIVE_PROMPT = 'photorealistic, polished, detailed, smooth shading, 3d render, digital painting';

async function generateViaFal(
  params: GenerateImageParams,
  context: ImageContext,
  usage: ImageUsageStats
): Promise<GenerateImageResult> {
  const startTime = Date.now();

  try {
    // Build prompt with storyboard trigger words
    const fullPrompt = `digital sketch, ${params.prompt}`;

    // Merge negative prompts
    const negativePrompt = params.negativePrompt
      ? `${DEFAULT_NEGATIVE_PROMPT}, ${params.negativePrompt}`
      : DEFAULT_NEGATIVE_PROMPT;

    // Build request body
    const body: Record<string, unknown> = {
      prompt: fullPrompt,
      negative_prompt: negativePrompt,
      loras: [{ path: FAL_IMAGE_LORA_URL, scale: FAL_IMAGE_LORA_SCALE }],
      image_size: mapAspectRatio(params.aspectRatio),
      num_images: 1,
      output_format: 'png',
    };

    // Map reference images to IP-Adapter
    if (params.referenceImages && params.referenceImages.length > 0) {
      const ipImages: Array<{ url: string }> = [];
      for (const ref of params.referenceImages) {
        ipImages.push({ url: `data:${ref.mimeType};base64,${ref.base64}` });
      }
      body.ip_adapter = {
        images: ipImages,
        scale: 0.6,
      };
    }

    // Submit to fal.ai queue
    const submitRes = await fetch(`https://queue.fal.run/${FAL_IMAGE_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`fal.ai submit failed (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json() as { request_id: string };
    const requestId = submitData.request_id;

    if (!requestId) {
      throw new Error('No request_id returned from fal.ai');
    }

    // Poll for completion (images are fast, 2 min max)
    const maxPollMs = 2 * 60 * 1000;
    const pollIntervalMs = 3000;
    const deadline = Date.now() + maxPollMs;

    let imageUrl: string | undefined;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs));

      const statusRes = await fetch(`https://queue.fal.run/${FAL_IMAGE_MODEL}/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json() as { status: string };

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(`https://queue.fal.run/${FAL_IMAGE_MODEL}/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        if (resultRes.ok) {
          const resultData = await resultRes.json() as { images?: Array<{ url: string; content_type?: string }> };
          if (resultData.images && resultData.images.length > 0) {
            imageUrl = resultData.images[0].url;
          }
        }
        break;
      }

      if (statusData.status === 'FAILED') {
        throw new Error('fal.ai image generation failed');
      }
    }

    if (!imageUrl) {
      throw new Error('Image generation timed out or produced no output');
    }

    // Download image and convert to base64
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download image: ${imageRes.status}`);
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    const latencyMs = Date.now() - startTime;

    // Increment usage
    await incrementImageUsage(context.orgId);
    logImage(context, params, 'fal', 'success', latencyMs, null).catch(() => {});

    const updatedUsage = await getImageUsage(context.orgId);
    return {
      success: true,
      image: imageBase64,
      mimeType: 'image/png',
      usage: updatedUsage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;
    logImage(context, params, 'fal', 'failed', latencyMs, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      usage: await getImageUsage(context.orgId),
    };
  }
}

// ─── Gemini (fallback) ──────────────────────────────────────────────────────

async function generateViaGemini(
  params: GenerateImageParams,
  context: ImageContext,
  usage: ImageUsageStats
): Promise<GenerateImageResult> {
  if (!genai) {
    return {
      success: false,
      error: 'Gemini not configured (GEMINI_API_KEY missing)',
      usage,
    };
  }

  const startTime = Date.now();

  try {
    // Build parts array
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    // Add reference images first for character consistency
    if (params.referenceImages && params.referenceImages.length > 0) {
      for (const ref of params.referenceImages) {
        parts.push({
          inlineData: {
            data: ref.base64,
            mimeType: ref.mimeType,
          },
        });
      }
    }

    // Add the prompt
    let fullPrompt = params.prompt;
    if (params.negativePrompt) {
      fullPrompt += `\n\nAvoid: ${params.negativePrompt}`;
    }
    parts.push({ text: fullPrompt });

    const response = await genai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: params.aspectRatio || '3:2',
        },
      },
    });

    const latencyMs = Date.now() - startTime;

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            await incrementImageUsage(context.orgId);
            logImage(context, params, 'gemini', 'success', latencyMs, null).catch(() => {});

            const updatedUsage = await getImageUsage(context.orgId);
            return {
              success: true,
              image: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
              usage: updatedUsage,
            };
          }
        }
      }

      // Check for safety blocks
      if (candidate.finishReason === 'SAFETY') {
        logImage(context, params, 'gemini', 'safety_blocked', Date.now() - startTime, 'Content blocked by safety filters').catch(() => {});
        return {
          success: false,
          error: 'Image generation blocked by safety filters. Try adjusting your prompt.',
          usage,
        };
      }
    }

    logImage(context, params, 'gemini', 'failed', Date.now() - startTime, 'No image in response').catch(() => {});
    return {
      success: false,
      error: 'No image generated. Try a different prompt.',
      usage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;
    logImage(context, params, 'gemini', 'failed', latencyMs, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      usage: await getImageUsage(context.orgId),
    };
  }
}

// ─── Usage & Logging ────────────────────────────────────────────────────────

async function incrementImageUsage(orgId: string): Promise<void> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  await sql`
    INSERT INTO image_usage (organization_id, month, images_generated, updated_at)
    VALUES (${orgId}, ${monthStr}, 1, now())
    ON CONFLICT (organization_id, month)
    DO UPDATE SET images_generated = image_usage.images_generated + 1, updated_at = now()
  `;
}

async function logImage(
  context: ImageContext,
  params: GenerateImageParams,
  provider: string,
  status: string,
  latencyMs: number | null,
  errorMessage: string | null
): Promise<void> {
  const model = provider === 'fal' ? FAL_IMAGE_MODEL : GEMINI_IMAGE_MODEL;
  const promptSummary = params.prompt?.slice(0, 200) || null;
  await sql`
    INSERT INTO image_logs (organization_id, app_id, model, prompt_summary, aspect_ratio, status, latency_ms, error_message)
    VALUES (
      ${context.orgId},
      ${context.appId || null},
      ${model},
      ${promptSummary},
      ${params.aspectRatio || '3:2'},
      ${status},
      ${latencyMs},
      ${errorMessage}
    )
  `;
}
