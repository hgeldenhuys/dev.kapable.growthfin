/**
 * Connect SDK — Platform Services
 *
 * Wrappers for SignalDB platform APIs: email, image generation, storage.
 * All authenticated via SIGNALDB_PLATFORM_KEY (auto-injected on deploy).
 *
 * Usage:
 *   import { email, images, storage } from '@signaldb-live/connect/platform';
 *
 *   await email.send({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' });
 *   const { url } = await images.generate('a sunset over mountains');
 *   const { presignedUrl } = await storage.presignUpload('uploads/photo.jpg');
 */

import type {
  EmailOptions,
  ImageGenerateOptions,
  ImageAnalyzeOptions,
  PresignUploadOptions,
  FeatureToggleOptions,
  BulkFeatureToggleOptions,
  FeatureToggleResult,
  PlatformResponse,
} from './types';

function getApiUrl(): string {
  return process.env.SIGNALDB_API_URL || 'https://api.signaldb.live';
}

function getPlatformKey(): string {
  const key = process.env.SIGNALDB_PLATFORM_KEY;
  if (!key) {
    throw new Error(
      'SIGNALDB_PLATFORM_KEY is not set. Ensure your app is deployed via the platform and the org has a platform key.'
    );
  }
  return key;
}

async function platformFetch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<PlatformResponse<T>> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getPlatformKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    return { ok: false, error: data.error || data.message || `HTTP ${res.status}` };
  }

  return { ok: true, data: data as T };
}

// ── Email ──────────────────────────────────────────────────────────

export const email = {
  /**
   * Send an email via the platform email service.
   * Quota is per-org, per-billing-plan.
   */
  async send(params: {
    to: string | string[];
    subject: string;
    html: string;
    options?: EmailOptions;
  }): Promise<PlatformResponse<{ messageId: string }>> {
    return platformFetch('/v1/email/send', {
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      from: params.options?.from,
      replyTo: params.options?.replyTo,
    });
  },

  /**
   * Check email usage for the current org.
   */
  async usage(): Promise<PlatformResponse<{ used: number; limit: number; remaining: number }>> {
    const res = await fetch(`${getApiUrl()}/v1/email/usage`, {
      headers: { 'Authorization': `Bearer ${getPlatformKey()}` },
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  },
};

// ── Images ─────────────────────────────────────────────────────────

export const images = {
  /**
   * Generate an image using AI (Gemini 2.5 Flash).
   * Returns a URL to the generated image.
   */
  async generate(
    prompt: string,
    options?: ImageGenerateOptions,
  ): Promise<PlatformResponse<{ url: string; mimeType: string }>> {
    return platformFetch('/v1/images/generate', {
      prompt,
      width: options?.width,
      height: options?.height,
      style: options?.style,
    });
  },

  /**
   * Analyze an image using AI vision.
   */
  async analyze(
    imageUrl: string,
    prompt: string,
    options?: ImageAnalyzeOptions,
  ): Promise<PlatformResponse<{ analysis: string }>> {
    return platformFetch('/v1/images/analyze', {
      imageUrl,
      prompt,
      maxTokens: options?.maxTokens,
    });
  },

  /**
   * Check image usage for the current org.
   */
  async usage(): Promise<PlatformResponse<{ used: number; limit: number; remaining: number }>> {
    const res = await fetch(`${getApiUrl()}/v1/images/usage`, {
      headers: { 'Authorization': `Bearer ${getPlatformKey()}` },
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  },
};

// ── Storage ────────────────────────────────────────────────────────

export const storage = {
  /**
   * Get a presigned URL for uploading a file to S3/MinIO.
   */
  async presignUpload(
    key: string,
    options?: PresignUploadOptions,
  ): Promise<PlatformResponse<{ presignedUrl: string; publicUrl: string }>> {
    return platformFetch('/v1/storage/presign', {
      key,
      contentType: options?.contentType || 'application/octet-stream',
      expiresIn: options?.expiresIn || 3600,
    });
  },
};

// ── Feature Toggles ───────────────────────────────────────────────

export const featureToggles = {
  /**
   * Evaluate a single feature flag.
   * Returns whether the flag is enabled for the given context.
   */
  async evaluate(
    flagName: string,
    options?: FeatureToggleOptions,
  ): Promise<PlatformResponse<FeatureToggleResult>> {
    return platformFetch('/v1/feature-toggles/evaluate', {
      flagName,
      userId: options?.userId,
      environment: options?.environment,
      context: options?.context,
      appId: options?.appId,
    });
  },

  /**
   * Evaluate multiple feature flags in a single request.
   * More efficient than multiple individual evaluate calls.
   */
  async bulkEvaluate(
    flags: string[],
    options?: BulkFeatureToggleOptions,
  ): Promise<PlatformResponse<{ results: FeatureToggleResult[] }>> {
    return platformFetch('/v1/feature-toggles/bulk-evaluate', {
      flags,
      userId: options?.userId,
      environment: options?.environment,
      context: options?.context,
      appId: options?.appId,
    });
  },

  /**
   * Get feature toggle usage for the current org.
   */
  async usage(): Promise<PlatformResponse<{ evaluations: number; quota: number; remaining: number }>> {
    const res = await fetch(`${getApiUrl()}/v1/feature-toggles/usage`, {
      headers: { 'Authorization': `Bearer ${getPlatformKey()}` },
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  },

  /**
   * Subscribe to real-time flag changes via SSE.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (event: { action: string; flag_name: string; enabled: boolean; timestamp: number }) => void): () => void {
    const url = `${getApiUrl()}/v1/feature-toggles/stream`;
    const eventSource = new EventSource(url, {
      // Note: EventSource doesn't support custom headers natively.
      // For server-side usage, use the evaluate endpoint with polling instead.
    } as any);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') {
          callback(data);
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      eventSource.close();
    };
  },
};
