/**
 * API Client
 * Type-safe client for interacting with the ACME CORP API
 */

const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/v1'  // Browser: use proxy route
  : `${process.env['API_URL'] || 'http://localhost:3000'}/api/v1`;  // Server: direct to API

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Workspaces
  async getWorkspaces() {
    return this.request('/workspaces');
  }

  async getWorkspace(id: string) {
    return this.request(`/workspaces/${id}`);
  }

  async createWorkspace(data: {
    name: string;
    slug: string;
    ownerId: string;
  }) {
    return this.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Hook Events
  async getHookEvents(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request(`/hook-events?${query}`);
  }

  async createHookEvent(data: {
    workspaceId: string;
    sessionId: string;
    eventName: string;
    toolName?: string;
    payload: any;
  }) {
    return this.request('/hook-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
