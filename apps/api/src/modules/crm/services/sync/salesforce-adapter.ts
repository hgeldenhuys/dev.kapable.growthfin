/**
 * Salesforce Sync Adapter (Phase V)
 *
 * Scaffold implementation for Salesforce CRM integration.
 * Uses Salesforce REST API v59.0.
 *
 * Required environment variables:
 * - SALESFORCE_CLIENT_ID
 * - SALESFORCE_CLIENT_SECRET
 */

import type {
  CrmSyncAdapter,
  SyncRecord,
  TokenExchangeResult,
  RefreshedToken,
  FetchRecordsResult,
  CreateRecordResult,
  ExternalField,
} from './sync-adapter';

// ============================================================================
// ENTITY NAME MAPPING
// ============================================================================

const ENTITY_MAP: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contact',
  account: 'Account',
  opportunity: 'Opportunity',
};

const SF_API_VERSION = 'v59.0';

// ============================================================================
// SALESFORCE ADAPTER
// ============================================================================

export class SalesforceAdapter implements CrmSyncAdapter {
  private accessToken: string;
  private instanceUrl: string;

  constructor(accessToken: string, instanceUrl: string) {
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
  }

  // ---- OAuth ----

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env['SALESFORCE_CLIENT_ID'];
    if (!clientId) {
      throw new Error('SALESFORCE_CLIENT_ID environment variable is not set');
    }
    return `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }

  async exchangeToken(code: string, redirectUri: string): Promise<TokenExchangeResult> {
    const clientId = process.env['SALESFORCE_CLIENT_ID'];
    const clientSecret = process.env['SALESFORCE_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new Error('Salesforce OAuth not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.');
    }

    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce token exchange failed: ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      instance_url: string;
      id: string;
    };

    // Extract org ID from the identity URL
    const idParts = data.id.split('/');
    const orgId = idParts[idParts.length - 2] || '';

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
      externalAccountId: orgId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
    const clientId = process.env['SALESFORCE_CLIENT_ID'];
    const clientSecret = process.env['SALESFORCE_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new Error('Salesforce OAuth not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.');
    }

    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce token refresh failed: ${errorText}`);
    }

    const data = await response.json() as { access_token: string; refresh_token?: string };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  // ---- Read ----

  async fetchRecords(
    entityType: string,
    since?: string,
    _deltaToken?: string,
  ): Promise<FetchRecordsResult> {
    const sfEntity = this.getEntityName(entityType);
    let query = `SELECT Id, LastModifiedDate FROM ${sfEntity}`;
    if (since) {
      query += ` WHERE LastModifiedDate > ${since}`;
    }
    query += ' ORDER BY LastModifiedDate ASC LIMIT 2000';

    const url = `${this.instanceUrl}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce query failed: ${errorText}`);
    }

    const data = await response.json() as {
      records: Array<{ Id: string; LastModifiedDate: string; IsDeleted?: boolean; [key: string]: unknown }>;
      nextRecordsUrl?: string;
    };

    const records: SyncRecord[] = data.records.map((r) => ({
      externalId: r.Id,
      data: r,
      updatedAt: r.LastModifiedDate,
      isDeleted: r.IsDeleted ?? false,
    }));

    return {
      records,
      nextDeltaToken: data.nextRecordsUrl,
    };
  }

  async fetchRecord(entityType: string, externalId: string): Promise<SyncRecord | null> {
    const sfEntity = this.getEntityName(entityType);
    const url = `${this.instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${sfEntity}/${externalId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce fetch record failed: ${errorText}`);
    }

    const data = await response.json() as { Id: string; LastModifiedDate: string; IsDeleted?: boolean; [key: string]: unknown };

    return {
      externalId: data.Id,
      data,
      updatedAt: data.LastModifiedDate,
      isDeleted: data.IsDeleted ?? false,
    };
  }

  // ---- Write ----

  async createRecord(entityType: string, data: Record<string, unknown>): Promise<CreateRecordResult> {
    const sfEntity = this.getEntityName(entityType);
    const url = `${this.instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${sfEntity}/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce create record failed: ${errorText}`);
    }

    const result = await response.json() as { id: string };

    return { externalId: result.id };
  }

  async updateRecord(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    const sfEntity = this.getEntityName(entityType);
    const url = `${this.instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${sfEntity}/${externalId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce update record failed: ${errorText}`);
    }
  }

  // ---- Schema ----

  async getAvailableFields(entityType: string): Promise<ExternalField[]> {
    const sfEntity = this.getEntityName(entityType);
    const url = `${this.instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${sfEntity}/describe`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce describe failed: ${errorText}`);
    }

    const data = await response.json() as {
      fields: Array<{
        name: string;
        label: string;
        type: string;
        nillable: boolean;
        createable: boolean;
        updateable: boolean;
      }>;
    };

    return data.fields
      .filter((f) => f.createable || f.updateable)
      .map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable,
      }));
  }

  // ---- Entity mapping ----

  getEntityName(entityType: string): string {
    return ENTITY_MAP[entityType] || entityType;
  }
}
