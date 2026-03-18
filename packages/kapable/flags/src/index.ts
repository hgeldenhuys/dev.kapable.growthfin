/**
 * @kapable/flags — Feature toggle evaluation for Kapable apps.
 *
 * Usage:
 *   import { flags } from '@kapable/flags';
 *   const result = await flags.evaluate('dark-mode', { userId: 'user-123' });
 */

import { platformFetch, platformGet, getApiUrl } from '@kapable/internal';
import type { PlatformResponse } from '@kapable/internal';

export type { PlatformResponse };

export interface FeatureToggleOptions {
  userId?: string;
  environment?: string;
  context?: Record<string, unknown>;
  appId?: string;
}

export interface BulkFeatureToggleOptions extends Omit<FeatureToggleOptions, 'appId'> {
  appId?: string;
}

export interface FeatureToggleResult {
  flagName: string;
  enabled: boolean;
  reason: string;
}

export const flags = {
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

  async bulkEvaluate(
    flagNames: string[],
    options?: BulkFeatureToggleOptions,
  ): Promise<PlatformResponse<{ results: FeatureToggleResult[] }>> {
    return platformFetch('/v1/feature-toggles/bulk-evaluate', {
      flags: flagNames,
      userId: options?.userId,
      environment: options?.environment,
      context: options?.context,
      appId: options?.appId,
    });
  },

  async usage(): Promise<PlatformResponse<{ evaluations: number; quota: number; remaining: number }>> {
    return platformGet('/v1/feature-toggles/usage');
  },

  subscribe(callback: (event: { action: string; flag_name: string; enabled: boolean; timestamp: number }) => void): () => void {
    const url = `${getApiUrl()}/v1/feature-toggles/stream`;
    const eventSource = new EventSource(url);

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
