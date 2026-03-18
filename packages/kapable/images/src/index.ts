/**
 * @kapable/images — AI image generation and analysis via the Kapable platform.
 *
 * Usage:
 *   import { images } from '@kapable/images';
 *   const { data } = await images.generate('a sunset over mountains');
 */

import { platformFetch, platformGet } from '@kapable/internal';
import type { PlatformResponse } from '@kapable/internal';

export type { PlatformResponse };

export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  style?: string;
}

export interface ImageAnalyzeOptions {
  maxTokens?: number;
}

export const images = {
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

  async usage(): Promise<PlatformResponse<{ used: number; limit: number; remaining: number }>> {
    return platformGet('/v1/images/usage');
  },
};
