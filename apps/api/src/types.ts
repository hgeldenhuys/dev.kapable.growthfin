/**
 * SignalDB API Types
 */

export interface ApiContext {
  orgId: string;        // Keep for billing/usage
  projectId: string;    // For data scoping
  schemaName: string | null;   // e.g., "project_abc123_def456" for hobbyist tier, null for pro/business/enterprise
  tier: string;         // 'hobbyist', 'pro', 'business', 'enterprise' - determines isolation level
  keyId: string;
  scopes: string[];
  // JWT-specific fields (populated when auth is via scoped token)
  authType: 'api_key' | 'jwt';           // Track authentication method
  userId?: string;                        // From JWT 'sub' claim
  tokenScopes?: Record<string, unknown>;  // From JWT 'scopes' claim for RLS
  tokenJti?: string;                      // JWT ID for revocation checks
}

export interface Subscription {
  id: string;
  table: string;
  filter?: Record<string, unknown>;
}

export interface WsClient {
  orgId: string;      // Keep for billing
  projectId: string;  // For data scoping
  keyId: string;
  scopes: string[];
  subscriptions: Map<string, Subscription>;
  // RLS context for filtering realtime events
  authType: 'api_key' | 'jwt';
  userId?: string;                        // From JWT 'sub' claim
  tokenScopes?: Record<string, unknown>;  // From JWT 'scopes' claim for RLS
}

export interface ChangeEvent {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  org_id?: string;
  project_id?: string;
  id: string;
  data: Record<string, unknown>;
  ts: number;
}

export interface WsMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  id?: string;
  table?: string;
  filter?: Record<string, unknown>;
}

export interface WsResponse {
  type: 'subscribed' | 'unsubscribed' | 'error' | 'event' | 'pong' | 'connected';
  id?: string;
  error?: string;
  data?: unknown;
  ts: number;
}

export interface RouteMatch {
  handler: (req: Request, params: Record<string, string>, ctx?: ApiContext) => Promise<Response>;
  params: Record<string, string>;
}

// ============================================================================
// Table Schema Types (for hybrid storage)
// ============================================================================

/**
 * Field definition in a table schema
 */
export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'json';
  required?: boolean;
  default?: unknown;
  options?: string[];  // For select type
}

/**
 * Table schema definition
 */
export interface TableSchema {
  fields: FieldDefinition[];
}

/**
 * Table settings including storage mode
 */
export interface TableSettings {
  storage_mode?: 'jsonb' | 'typed';
  [key: string]: unknown;
}

/**
 * Table metadata from registry
 */
export interface TableMetadata {
  id: string;
  name: string;
  display_name: string | null;
  schema: TableSchema;
  settings: TableSettings;
  storage_mode: 'jsonb' | 'typed';
  created_at: Date;
  updated_at: Date;
  /** RSC compiled schema for semantic validation (optional) */
  rsc_schema?: Record<string, unknown> | null;
  /** RSC source code that produced rsc_schema (optional) */
  rsc_source?: string | null;
}

// ============================================================================
// Filter API Types
// ============================================================================

/**
 * Supported filter operators
 */
export type FilterOperator =
  | 'eq'      // Equals
  | 'ne'      // Not equals
  | 'gt'      // Greater than
  | 'gte'     // Greater or equal
  | 'lt'      // Less than
  | 'lte'     // Less or equal
  | 'in'      // In list
  | 'contains'// Contains substring (case-insensitive)
  | 'starts'  // Starts with
  | 'isnull'; // Is null

/**
 * Single filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | string[] | boolean;
}

/**
 * Parsed query parameters for list operations
 */
export interface ListQueryParams {
  limit: number;
  offset: number;
  orderBy: string;
  order: 'ASC' | 'DESC';
  filters: FilterCondition[];
}

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Maps SignalDB types to PostgreSQL types
 */
export const TYPE_MAP: Record<FieldDefinition['type'], string> = {
  text: 'TEXT',
  number: 'NUMERIC',
  boolean: 'BOOLEAN',
  date: 'TIMESTAMPTZ',
  select: 'TEXT',
  json: 'JSONB',
};

// ============================================================================
// Scoped Token Types (for end-user RLS)
// ============================================================================

/**
 * Request to create a scoped token
 */
export interface CreateTokenRequest {
  sub?: string;                        // Subject (end-user identifier)
  scopes?: Record<string, unknown>;    // Custom scopes for RLS
  expires_in?: number;                 // Expiry in seconds (default: 86400, max: 2592000)
}

/**
 * JWT claims in a scoped token
 */
export interface TokenClaims {
  iss: string;                         // Issuer (always 'signaldb')
  pid: string;                         // Project ID
  sub?: string;                        // Subject (end-user identifier)
  jti: string;                         // Unique token ID
  scopes: Record<string, unknown>;     // Custom scopes for RLS
  iat: number;                         // Issued at (Unix timestamp)
  exp: number;                         // Expiry (Unix timestamp)
}

/**
 * Payload for scoped token operations
 */
export interface ScopedTokenPayload {
  sub?: string;
  scopes: Record<string, unknown>;
  expiresIn: number;
}

/**
 * Token record from database
 */
export interface TokenRecord {
  id: string;
  jti: string;
  sub: string | null;
  scopes: Record<string, unknown>;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  created_by: string | null;
}

/**
 * Response from token creation
 */
export interface CreateTokenResponse {
  token: string;
  token_id: string;
  expires_at: string;
}

/**
 * Token list item (without sensitive data)
 */
export interface TokenListItem {
  id: string;
  sub: string | null;
  scopes: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  revoked: boolean;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook event types
 */
export type WebhookEventType = 'insert' | 'update' | 'delete' | 'bulk' | 'test';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  headers?: Record<string, string>;
}

/**
 * Webhook event to be delivered
 */
export interface WebhookEvent {
  event: WebhookEventType;
  table: string;
  timestamp: string;
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Request to create a webhook
 */
export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
  tables?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Request to update a webhook
 */
export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEventType[];
  tables?: string[] | null;
  headers?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Webhook delivery result
 */
export interface DeliveryResult {
  success: boolean;
  status?: number;
  body?: string | null;
  durationMs?: number;
  error?: string;
}

/**
 * Webhook log entry
 */
export interface WebhookLogEntry {
  id: string;
  webhook_id: string;
  payload: object;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  success: boolean;
  error: string | null;
  attempt_number: number;
  created_at: string;
}
