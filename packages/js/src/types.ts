/**
 * SignalDB Client Types
 */

/**
 * Client configuration options
 */
export interface SignalDBClientOptions {
  /** API key (sk_live_*, sk_test_*, sk_admin_*, or pk_*) or JWT token */
  apiKey: string;
  /** Base URL for the API (default: https://api.signaldb.live) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * Email usage stats
 */
export interface EmailUsageStats {
  sent: number;
  quota: number;
  remaining: number;
  month: string;
}

/**
 * Send email parameters
 */
export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
  appId?: string;
}

/**
 * Send email result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  usage: EmailUsageStats;
}

/**
 * Image usage stats
 */
export interface ImageUsageStats {
  generated: number;
  quota: number;
  remaining: number;
  month: string;
}

/**
 * Generate image parameters
 */
export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: '1:1' | '3:2' | '2:3' | '16:9' | '9:16' | '3:4' | '4:3';
  referenceImages?: Array<{ base64: string; mimeType: string }>;
  negativePrompt?: string;
  appId?: string;
}

/**
 * Generate image result
 */
export interface GenerateImageResult {
  success: boolean;
  image?: string;
  mimeType?: string;
  error?: string;
  usage: ImageUsageStats;
}

/**
 * Scene analysis result
 */
export interface SceneAnalysis {
  characters: Array<{ name: string; action: string }>;
  setting: string;
  mood: string;
  composition: string;
  keyElements: string[];
}

/**
 * Filter operators
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
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | string[] | boolean | number;
}

/**
 * Select options for querying
 */
export interface SelectOptions {
  /** Maximum number of records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
  /** Field to order by */
  orderBy?: string;
  /** Sort direction */
  order?: 'asc' | 'desc';
  /** Filter conditions */
  filters?: FilterCondition[];
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Field definition in a table schema
 */
export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'json';
  required?: boolean;
  default?: unknown;
  options?: string[];
}

/**
 * Table schema definition
 */
export interface TableSchema {
  fields: FieldDefinition[];
}

/**
 * Table settings
 */
export interface TableSettings {
  storage_mode?: 'jsonb' | 'typed';
  [key: string]: unknown;
}

/**
 * Table metadata
 */
export interface TableMetadata {
  name: string;
  display_name?: string;
  schema: TableSchema;
  settings: TableSettings;
  storage_mode: 'jsonb' | 'typed';
  created_at: string;
  updated_at: string;
}

/**
 * Create table request
 */
export interface CreateTableRequest {
  schema?: TableSchema;
  settings?: TableSettings;
}

/**
 * Token claims for creating scoped tokens
 */
export interface TokenClaims {
  /** Subject (end-user identifier) */
  sub?: string;
  /** Custom scopes for RLS */
  scopes?: Record<string, unknown>;
  /** Expiry in seconds (default: 86400, max: 2592000) */
  expires_in?: number;
}

/**
 * Token response
 */
export interface TokenResponse {
  token: string;
  token_id: string;
  expires_at: string;
}

/**
 * Realtime event types
 */
export type RealtimeEventType = 'insert' | 'update' | 'delete';

/**
 * Realtime change event
 */
export interface ChangeEvent<T = Record<string, unknown>> {
  op: RealtimeEventType;
  id: string;
  data: T;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Table to subscribe to */
  table: string;
  /** Optional filter */
  filter?: Record<string, unknown>;
}

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  tables?: string[];
  headers?: Record<string, string>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Create webhook request
 */
export interface CreateWebhookRequest {
  url: string;
  events: string[];
  tables?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Webhook log entry
 */
export interface WebhookLogEntry {
  id: string;
  payload: object;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  success: boolean;
  error: string | null;
  attempt_number: number;
  created_at: string;
}

/**
 * API Error
 */
export class SignalDBError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SignalDBError';
  }
}
