/**
 * SignalDB JavaScript/TypeScript Client
 *
 * Official SDK for interacting with SignalDB - realtime database as a service
 *
 * @example
 * ```typescript
 * import { SignalDBClient } from '@signaldb-live/client';
 *
 * const db = new SignalDBClient({ apiKey: 'sk_live_xxx' });
 *
 * // Query data
 * const users = await db.from('users').select();
 *
 * // Insert data
 * const newUser = await db.from('users').insert({ name: 'John' });
 *
 * // Subscribe to changes
 * const unsubscribe = db.from('users').subscribe((users) => {
 *   console.log('Users updated:', users);
 * });
 *
 * // Create scoped token for end-user
 * const { token } = await db.createToken({
 *   sub: 'user-123',
 *   scopes: { team_id: 'sales' },
 *   expires_in: 86400
 * });
 * ```
 */

// Main client
export { SignalDBClient } from './client';

// Table class (usually accessed via client.from())
export { Table } from './table';

// Realtime WebSocket client
export { RealtimeClient, type RealtimeOptions, type ConnectionState } from './realtime';

// Auth utilities
export {
  parseToken,
  isTokenExpired,
  getTokenTimeRemaining,
  getTokenUserId,
  getTokenScopes,
  getTokenProjectId,
  verifyWebhookSignature,
} from './auth';

// Types
export type {
  // Client options
  SignalDBClientOptions,

  // Query types
  FilterOperator,
  FilterCondition,
  SelectOptions,
  PaginatedResponse,

  // Schema types
  FieldDefinition,
  TableSchema,
  TableSettings,
  TableMetadata,
  CreateTableRequest,

  // Token types
  TokenClaims,
  TokenResponse,

  // Realtime types
  RealtimeEventType,
  ChangeEvent,
  SubscriptionOptions,
  Unsubscribe,

  // Webhook types
  WebhookConfig,
  CreateWebhookRequest,
  WebhookLogEntry,

  // Email types
  EmailUsageStats,
  SendEmailParams,
  SendEmailResult,

  // Error
  SignalDBError,
} from './types';
