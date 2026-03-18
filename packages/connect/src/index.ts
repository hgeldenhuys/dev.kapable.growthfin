/**
 * @signaldb-live/connect — SDK for SignalDB Connect Apps
 *
 * Re-exports all modules so apps can import from a single package:
 *
 *   import { getDB, getSchema, closeDB } from '@signaldb-live/connect';
 *   import { createSSEStream } from '@signaldb-live/connect';
 *   import { email, images, storage } from '@signaldb-live/connect';
 *   import { runMigration } from '@signaldb-live/connect';
 */

// Database
export { getDB, getSchema, closeDB } from './db';

// Migrations
export { runMigration } from './migrate';

// SSE (Server-Sent Events via pg_notify)
export { createSSEStream } from './sse';

// Platform services
export { email, images, storage, featureToggles } from './platform';

// Types
export type {
  SSEOptions,
  EmailOptions,
  ImageGenerateOptions,
  ImageAnalyzeOptions,
  PresignUploadOptions,
  FeatureToggleOptions,
  BulkFeatureToggleOptions,
  FeatureToggleResult,
  PlatformResponse,
} from './types';

// Re-export connect-auth server helpers (if installed)
// Apps get auth + SDK from one import:
//   import { getDB, getUser, requireRole } from '@signaldb-live/connect';
export {
  getUser,
  requireUser,
  requireRole,
  hasPermission,
  requirePermission,
} from '@signaldb-live/connect-auth/server';

export type { ConnectUser } from '@signaldb-live/connect-auth';
