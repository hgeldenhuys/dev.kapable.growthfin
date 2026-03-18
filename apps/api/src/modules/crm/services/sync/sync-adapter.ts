/**
 * CRM Sync Adapter Interface (Phase V)
 *
 * Abstract interface that all CRM provider adapters must implement.
 * Provides a uniform API for:
 * - OAuth authentication flow
 * - Reading/writing records
 * - Schema introspection (available fields)
 * - Entity name mapping
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A record fetched from or to be pushed to an external CRM.
 */
export interface SyncRecord {
  externalId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  isDeleted?: boolean;
}

/**
 * Result of a sync operation (push or pull).
 */
export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ record: string; error: string }>;
}

/**
 * Token exchange result from OAuth flow.
 */
export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  instanceUrl?: string;
  externalAccountId: string;
}

/**
 * Refreshed token result.
 */
export interface RefreshedToken {
  accessToken: string;
  refreshToken?: string;
}

/**
 * Field metadata from the external CRM.
 */
export interface ExternalField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

/**
 * Result of creating a record in the external CRM.
 */
export interface CreateRecordResult {
  externalId: string;
}

/**
 * Paginated fetch result with optional delta token for incremental sync.
 */
export interface FetchRecordsResult {
  records: SyncRecord[];
  nextDeltaToken?: string;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * CRM Sync Adapter interface.
 * Each external CRM provider (Salesforce, HubSpot, etc.) must implement this.
 */
export interface CrmSyncAdapter {
  // ---- Connection / OAuth ----

  /**
   * Generate the OAuth authorization URL for the provider.
   */
  getAuthUrl(redirectUri: string, state: string): string;

  /**
   * Exchange an OAuth authorization code for access/refresh tokens.
   */
  exchangeToken(code: string, redirectUri: string): Promise<TokenExchangeResult>;

  /**
   * Refresh an expired access token using the refresh token.
   */
  refreshAccessToken(refreshToken: string): Promise<RefreshedToken>;

  // ---- Read ----

  /**
   * Fetch records from the external CRM.
   * Supports incremental sync via `since` timestamp or `deltaToken`.
   */
  fetchRecords(
    entityType: string,
    since?: string,
    deltaToken?: string,
  ): Promise<FetchRecordsResult>;

  /**
   * Fetch a single record by its external ID.
   */
  fetchRecord(entityType: string, externalId: string): Promise<SyncRecord | null>;

  // ---- Write ----

  /**
   * Create a new record in the external CRM.
   */
  createRecord(entityType: string, data: Record<string, unknown>): Promise<CreateRecordResult>;

  /**
   * Update an existing record in the external CRM.
   */
  updateRecord(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void>;

  // ---- Schema ----

  /**
   * Get available fields for a given entity type in the external CRM.
   * Used to populate field mapping UI.
   */
  getAvailableFields(entityType: string): Promise<ExternalField[]>;

  // ---- Entity mapping ----

  /**
   * Get the external CRM entity name for a given NewLeads entity type.
   * e.g., 'lead' -> 'Lead' (Salesforce) or 'contacts' (HubSpot)
   */
  getEntityName(entityType: string): string;
}
