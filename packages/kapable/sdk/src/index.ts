/**
 * @kapable/sdk — Barrel re-export of all Kapable packages.
 *
 * For tree-shaking, prefer importing individual packages:
 *   import { email } from '@kapable/email';
 *   import { getDB } from '@kapable/db';
 *
 * But this barrel works for quick prototyping:
 *   import { email, images, storage, flags, getDB } from '@kapable/sdk';
 */

// Database
export { getDB, getSchema, closeDB } from '@kapable/db';

// SSE
export { createSSEStream } from '@kapable/sse';
export type { SSEOptions } from '@kapable/sse';

// Migrations
export { runMigration } from '@kapable/migrate';

// Platform services
export { email } from '@kapable/email';
export { images } from '@kapable/images';
export { storage } from '@kapable/storage';
export { flags } from '@kapable/flags';
export { tickets } from '@kapable/tickets';

// Types
export type { PlatformResponse } from '@kapable/internal';
export type { EmailOptions } from '@kapable/email';
export type { ImageGenerateOptions, ImageAnalyzeOptions } from '@kapable/images';
export type { PresignUploadOptions } from '@kapable/storage';
export type { FeatureToggleOptions, BulkFeatureToggleOptions, FeatureToggleResult } from '@kapable/flags';
export type {
  CreateTicketParams,
  ReportErrorParams,
  UpdateTicketParams,
  ListTicketFilters,
  Ticket,
  TicketComment,
  TicketUsage,
  ErrorTicketResult,
} from '@kapable/tickets';
