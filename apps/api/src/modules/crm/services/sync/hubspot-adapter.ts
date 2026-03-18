/**
 * HubSpot Sync Adapter (Phase V)
 *
 * Scaffold implementation for HubSpot CRM integration.
 * Uses HubSpot CRM API v3.
 *
 * Required environment variables:
 * - HUBSPOT_CLIENT_ID
 * - HUBSPOT_CLIENT_SECRET
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
  lead: 'contacts',
  contact: 'contacts',
  account: 'companies',
  opportunity: 'deals',
};

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// ============================================================================
// HUBSPOT ADAPTER
// ============================================================================

export class HubSpotAdapter implements CrmSyncAdapter {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // ---- OAuth ----

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env['HUBSPOT_CLIENT_ID'];
    if (!clientId) {
      throw new Error('HUBSPOT_CLIENT_ID environment variable is not set');
    }
    const scopes = 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write';
    return `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  }

  async exchangeToken(code: string, redirectUri: string): Promise<TokenExchangeResult> {
    const clientId = process.env['HUBSPOT_CLIENT_ID'];
    const clientSecret = process.env['HUBSPOT_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new Error('HubSpot OAuth not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.');
    }

    const response = await fetch(`${HUBSPOT_API_BASE}/oauth/v1/token`, {
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
      throw new Error(`HubSpot token exchange failed: ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
    };

    // Get the portal ID (account identifier)
    const portalResponse = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    let portalId = 'unknown';
    if (portalResponse.ok) {
      const portalData = await portalResponse.json() as { portalId: number };
      portalId = String(portalData.portalId);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      externalAccountId: portalId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
    const clientId = process.env['HUBSPOT_CLIENT_ID'];
    const clientSecret = process.env['HUBSPOT_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new Error('HubSpot OAuth not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.');
    }

    const response = await fetch(`${HUBSPOT_API_BASE}/oauth/v1/token`, {
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
      throw new Error(`HubSpot token refresh failed: ${errorText}`);
    }

    const data = await response.json() as { access_token: string; refresh_token: string };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  // ---- Read ----

  async fetchRecords(
    entityType: string,
    since?: string,
    deltaToken?: string,
  ): Promise<FetchRecordsResult> {
    const hsEntity = this.getEntityName(entityType);

    // Use the search endpoint for incremental sync
    if (since) {
      const url = `${HUBSPOT_API_BASE}/crm/v3/objects/${hsEntity}/search`;
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'lastmodifieddate',
                operator: 'GTE',
                value: since,
              },
            ],
          },
        ],
        sorts: [{ propertyName: 'lastmodifieddate', direction: 'ASCENDING' }],
        limit: 100,
      };

      if (deltaToken) {
        (body as Record<string, unknown>)['after'] = deltaToken;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HubSpot search failed: ${errorText}`);
      }

      const data = await response.json() as {
        results: Array<{
          id: string;
          properties: Record<string, unknown>;
          updatedAt: string;
        }>;
        paging?: { next?: { after: string } };
      };

      return {
        records: data.results.map((r) => ({
          externalId: r.id,
          data: r.properties,
          updatedAt: r.updatedAt,
        })),
        nextDeltaToken: data.paging?.next?.after,
      };
    }

    // Full sync: list all records
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/${hsEntity}?limit=100${deltaToken ? `&after=${deltaToken}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot list records failed: ${errorText}`);
    }

    const data = await response.json() as {
      results: Array<{
        id: string;
        properties: Record<string, unknown>;
        updatedAt: string;
      }>;
      paging?: { next?: { after: string } };
    };

    return {
      records: data.results.map((r) => ({
        externalId: r.id,
        data: r.properties,
        updatedAt: r.updatedAt,
      })),
      nextDeltaToken: data.paging?.next?.after,
    };
  }

  async fetchRecord(entityType: string, externalId: string): Promise<SyncRecord | null> {
    const hsEntity = this.getEntityName(entityType);
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/${hsEntity}/${externalId}`;

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
      throw new Error(`HubSpot fetch record failed: ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
      properties: Record<string, unknown>;
      updatedAt: string;
    };

    return {
      externalId: data.id,
      data: data.properties,
      updatedAt: data.updatedAt,
    };
  }

  // ---- Write ----

  async createRecord(entityType: string, data: Record<string, unknown>): Promise<CreateRecordResult> {
    const hsEntity = this.getEntityName(entityType);
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/${hsEntity}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: data }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot create record failed: ${errorText}`);
    }

    const result = await response.json() as { id: string };

    return { externalId: result.id };
  }

  async updateRecord(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    const hsEntity = this.getEntityName(entityType);
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/${hsEntity}/${externalId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: data }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot update record failed: ${errorText}`);
    }
  }

  // ---- Schema ----

  async getAvailableFields(entityType: string): Promise<ExternalField[]> {
    const hsEntity = this.getEntityName(entityType);
    const url = `${HUBSPOT_API_BASE}/crm/v3/properties/${hsEntity}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot get properties failed: ${errorText}`);
    }

    const data = await response.json() as {
      results: Array<{
        name: string;
        label: string;
        type: string;
        modificationMetadata?: { readOnlyValue: boolean };
      }>;
    };

    return data.results
      .filter((f) => !f.modificationMetadata?.readOnlyValue)
      .map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: false, // HubSpot doesn't mark required in this API
      }));
  }

  // ---- Entity mapping ----

  getEntityName(entityType: string): string {
    return ENTITY_MAP[entityType] || entityType;
  }
}
