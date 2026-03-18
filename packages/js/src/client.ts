/**
 * SignalDB Client
 *
 * Main entry point for interacting with SignalDB API
 */

import { Table } from './table';
import type {
  SignalDBClientOptions,
  TokenClaims,
  TokenResponse,
  TableMetadata,
  CreateTableRequest,
  WebhookConfig,
  CreateWebhookRequest,
  WebhookLogEntry,
  PaginatedResponse,
  SignalDBError,
  EmailUsageStats,
  SendEmailParams,
  SendEmailResult,
  ImageUsageStats,
  GenerateImageParams,
  GenerateImageResult,
  SceneAnalysis,
} from './types';

/**
 * SignalDB Client
 */
export class SignalDBClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private fetchFn: typeof fetch;
  private timeout: number;

  constructor(options: SignalDBClientOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }

    this.baseUrl = (options.baseUrl || 'https://api.signaldb.live').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.fetchFn = options.fetch || fetch.bind(globalThis);

    this.headers = {
      'Authorization': `Bearer ${options.apiKey}`,
      'Accept': 'application/json',
    };
  }

  /**
   * Make API request
   */
  private async request<R>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<R> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...this.headers,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        const err = new Error(error.error || `HTTP ${response.status}`) as SignalDBError;
        err.name = 'SignalDBError';
        (err as SignalDBError).status = response.status;
        throw err;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as R;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const err = new Error('Request timeout') as SignalDBError;
        err.name = 'SignalDBError';
        (err as SignalDBError).status = 408;
        throw err;
      }
      throw error;
    }
  }

  // ============================================================================
  // Table Access
  // ============================================================================

  /**
   * Get a Table instance for CRUD operations
   */
  from<T = Record<string, unknown>>(tableName: string): Table<T> {
    return new Table<T>(
      tableName,
      this.baseUrl,
      this.headers,
      this.fetchFn,
      this.timeout
    );
  }

  // ============================================================================
  // Schema Management
  // ============================================================================

  /**
   * List all tables in the project
   */
  async listTables(): Promise<TableMetadata[]> {
    const response = await this.request<{ tables: TableMetadata[] }>(
      'GET',
      '/v1/_meta/tables'
    );
    return response.tables;
  }

  /**
   * Get table schema and metadata
   */
  async getTable(tableName: string): Promise<TableMetadata | null> {
    try {
      return await this.request<TableMetadata>(
        'GET',
        `/v1/_meta/tables/${tableName}`
      );
    } catch (error) {
      if ((error as SignalDBError).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a table schema
   */
  async createTable(
    tableName: string,
    options?: CreateTableRequest
  ): Promise<TableMetadata> {
    return this.request<TableMetadata>(
      'PUT',
      `/v1/_meta/tables/${tableName}`,
      options || {}
    );
  }

  /**
   * Delete a table
   */
  async deleteTable(tableName: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/_meta/tables/${tableName}`);
  }

  /**
   * Migrate table storage mode
   */
  async migrateTable(
    tableName: string,
    targetMode: 'jsonb' | 'typed'
  ): Promise<TableMetadata> {
    return this.request<TableMetadata>(
      'POST',
      `/v1/_meta/tables/${tableName}/migrate`,
      { target_mode: targetMode }
    );
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  /**
   * Create a scoped token for end-user RLS
   */
  async createToken(claims: TokenClaims): Promise<TokenResponse> {
    return this.request<TokenResponse>('POST', '/v1/tokens', claims);
  }

  /**
   * List tokens
   */
  async listTokens(options?: {
    sub?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<{
    id: string;
    sub: string | null;
    scopes: Record<string, unknown>;
    expires_at: string;
    created_at: string;
    revoked: boolean;
  }>> {
    const params = new URLSearchParams();
    if (options?.sub) params.set('sub', options.sub);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const qs = params.toString();
    return this.request('GET', `/v1/tokens${qs ? `?${qs}` : ''}`);
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/tokens/${tokenId}`);
  }

  // ============================================================================
  // Webhook Management
  // ============================================================================

  /**
   * List webhooks
   */
  async listWebhooks(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<WebhookConfig>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const qs = params.toString();
    return this.request('GET', `/v1/webhooks${qs ? `?${qs}` : ''}`);
  }

  /**
   * Create a webhook
   */
  async createWebhook(config: CreateWebhookRequest): Promise<WebhookConfig & { secret: string }> {
    return this.request('POST', '/v1/webhooks', config);
  }

  /**
   * Get a webhook
   */
  async getWebhook(webhookId: string): Promise<WebhookConfig | null> {
    try {
      return await this.request<WebhookConfig>('GET', `/v1/webhooks/${webhookId}`);
    } catch (error) {
      if ((error as SignalDBError).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<CreateWebhookRequest>
  ): Promise<WebhookConfig> {
    return this.request('PATCH', `/v1/webhooks/${webhookId}`, updates);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/webhooks/${webhookId}`);
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookLogs(
    webhookId: string,
    options?: { limit?: number; offset?: number; success?: boolean }
  ): Promise<PaginatedResponse<WebhookLogEntry>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.success !== undefined) params.set('success', options.success.toString());

    const qs = params.toString();
    return this.request('GET', `/v1/webhooks/${webhookId}/logs${qs ? `?${qs}` : ''}`);
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    status?: number;
    duration_ms?: number;
    error?: string;
  }> {
    return this.request('POST', `/v1/webhooks/${webhookId}/test`);
  }

  /**
   * Rotate webhook secret
   */
  async rotateWebhookSecret(webhookId: string): Promise<WebhookConfig & { secret: string }> {
    return this.request('POST', `/v1/webhooks/${webhookId}/rotate-secret`);
  }

  // ============================================================================
  // Email Service (requires admin key sk_admin_* or platform key pk_*)
  // ============================================================================

  /**
   * Send an email via the platform email service
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    return this.request<SendEmailResult>('POST', '/v1/email/send', params);
  }

  /**
   * Get current month email usage and quota
   */
  async getEmailUsage(): Promise<EmailUsageStats> {
    return this.request<EmailUsageStats>('GET', '/v1/email/usage');
  }

  // ============================================================================
  // Image Service (requires admin key sk_admin_* or platform key pk_*)
  // ============================================================================

  /**
   * Generate an image via the platform image service
   */
  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    return this.request<GenerateImageResult>('POST', '/v1/images/generate', params);
  }

  /**
   * Analyze text for scene context (no image generated)
   */
  async analyzeScene(text: string, characters?: Array<{ name: string; appearance?: string }>): Promise<SceneAnalysis> {
    return this.request<SceneAnalysis>('POST', '/v1/images/analyze', { text, characters });
  }

  /**
   * Get current month image usage and quota
   */
  async getImageUsage(): Promise<ImageUsageStats> {
    return this.request<ImageUsageStats>('GET', '/v1/images/usage');
  }
}
