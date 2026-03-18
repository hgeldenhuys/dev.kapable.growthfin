/**
 * Connect SDK — Shared Types
 */

export interface SSEOptions {
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatMs?: number;
  /** Transform the pg_notify payload before sending to client */
  transform?: (payload: string) => string | null;
}

export interface EmailOptions {
  from?: string;
  replyTo?: string;
}

export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  style?: string;
}

export interface ImageAnalyzeOptions {
  maxTokens?: number;
}

export interface PresignUploadOptions {
  contentType?: string;
  expiresIn?: number;
}

export interface FeatureToggleOptions {
  /** User ID for percentage rollouts (deterministic hashing) */
  userId?: string;
  /** Environment name for environment-specific overrides */
  environment?: string;
  /** Context attributes for targeting rules */
  context?: Record<string, unknown>;
  /** App ID for audit logging */
  appId?: string;
}

export interface BulkFeatureToggleOptions extends Omit<FeatureToggleOptions, 'appId'> {
  /** App ID for audit logging */
  appId?: string;
}

export interface FeatureToggleResult {
  flagName: string;
  enabled: boolean;
  reason: string;
}

export interface PlatformResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
