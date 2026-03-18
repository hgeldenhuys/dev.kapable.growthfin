/**
 * Table class for CRUD operations
 */

import type {
  FilterCondition,
  PaginatedResponse,
  ChangeEvent,
  Unsubscribe,
  SignalDBError,
} from './types';

/**
 * Table class provides a fluent interface for querying and modifying data
 */
export class Table<T = Record<string, unknown>> {
  private _limit?: number;
  private _offset?: number;
  private _orderBy?: string;
  private _order?: 'asc' | 'desc';
  private _filters: FilterCondition[] = [];
  private _sseConnection: EventSource | null = null;

  constructor(
    private tableName: string,
    private baseUrl: string,
    private headers: Record<string, string>,
    private fetchFn: typeof fetch,
    private timeout: number
  ) {}

  /**
   * Build query string from current options
   */
  private buildQueryString(): string {
    const params = new URLSearchParams();

    if (this._limit !== undefined) {
      params.set('limit', this._limit.toString());
    }
    if (this._offset !== undefined) {
      params.set('offset', this._offset.toString());
    }
    if (this._orderBy) {
      params.set('order_by', this._orderBy);
    }
    if (this._order) {
      params.set('order', this._order);
    }

    // Add filters
    for (const filter of this._filters) {
      if (filter.operator === 'eq') {
        params.set(`filter[${filter.field}]`, String(filter.value));
      } else {
        params.set(`filter[${filter.field}][${filter.operator}]`, String(filter.value));
      }
    }

    const qs = params.toString();
    return qs ? `?${qs}` : '';
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

  /**
   * Clone this table with current filters (for chaining)
   */
  private clone(): Table<T> {
    const cloned = new Table<T>(
      this.tableName,
      this.baseUrl,
      this.headers,
      this.fetchFn,
      this.timeout
    );
    cloned._limit = this._limit;
    cloned._offset = this._offset;
    cloned._orderBy = this._orderBy;
    cloned._order = this._order;
    cloned._filters = [...this._filters];
    return cloned;
  }

  /**
   * Check if there's an active SSE subscription on this table
   */
  get isSubscribed(): boolean {
    return this._sseConnection !== null && this._sseConnection.readyState !== EventSource.CLOSED;
  }

  // ============================================================================
  // Query Building (Chainable)
  // ============================================================================

  /**
   * Add a filter condition
   */
  where(
    field: string,
    operator: FilterCondition['operator'] | FilterCondition['value'],
    value?: FilterCondition['value']
  ): Table<T> {
    const cloned = this.clone();

    // Handle shorthand: where('field', 'value') -> eq
    if (value === undefined) {
      cloned._filters.push({
        field,
        operator: 'eq',
        value: operator as FilterCondition['value'],
      });
    } else {
      cloned._filters.push({
        field,
        operator: operator as FilterCondition['operator'],
        value,
      });
    }

    return cloned;
  }

  /**
   * Set order by field and direction
   */
  orderBy(field: string, order: 'asc' | 'desc' = 'asc'): Table<T> {
    const cloned = this.clone();
    cloned._orderBy = field;
    cloned._order = order;
    return cloned;
  }

  /**
   * Set limit
   */
  limit(n: number): Table<T> {
    const cloned = this.clone();
    cloned._limit = n;
    return cloned;
  }

  /**
   * Set offset
   */
  offset(n: number): Table<T> {
    const cloned = this.clone();
    cloned._offset = n;
    return cloned;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Execute query and get results
   */
  async select(): Promise<T[]> {
    const qs = this.buildQueryString();
    const response = await this.request<PaginatedResponse<T>>(
      'GET',
      `/v1/${this.tableName}${qs}`
    );
    return response.data;
  }

  /**
   * Execute query and get paginated results
   */
  async selectWithCount(): Promise<PaginatedResponse<T>> {
    const qs = this.buildQueryString();
    return this.request<PaginatedResponse<T>>(
      'GET',
      `/v1/${this.tableName}${qs}`
    );
  }

  /**
   * Get a single record by ID
   */
  async get(id: string): Promise<T | null> {
    try {
      return await this.request<T>('GET', `/v1/${this.tableName}/${id}`);
    } catch (error) {
      if ((error as SignalDBError).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Insert a single record
   */
  async insert(data: Partial<T>): Promise<T> {
    return this.request<T>('POST', `/v1/${this.tableName}`, data);
  }

  /**
   * Insert multiple records
   */
  async insertMany(data: Partial<T>[]): Promise<T[]> {
    // SignalDB doesn't have bulk insert yet, so we do multiple inserts
    const results: T[] = [];
    for (const item of data) {
      const result = await this.insert(item);
      results.push(result);
    }
    return results;
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    return this.request<T>('PUT', `/v1/${this.tableName}/${id}`, data);
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/${this.tableName}/${id}`);
  }

  // ============================================================================
  // Realtime Subscriptions (SSE)
  // ============================================================================

  /**
   * Subscribe to changes on this table using SSE
   * Returns an unsubscribe function
   */
  subscribe(
    callback: (data: T[]) => void,
    options?: { filter?: Record<string, unknown> }
  ): Unsubscribe {
    // Build SSE URL with filters
    let url = `${this.baseUrl}/v1/${this.tableName}/stream`;
    const params = new URLSearchParams();

    // Add API key to query (required for SSE)
    const authHeader = this.headers['Authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      params.set('apiKey', authHeader.slice(7));
    }

    // Add filters
    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        params.set(`filter.${key}`, String(value));
      }
    }

    url += `?${params.toString()}`;

    // Create EventSource
    const eventSource = new EventSource(url);
    this._sseConnection = eventSource;

    // Track current data
    let currentData: T[] = [];

    // Initial load
    this.select().then((data) => {
      currentData = data;
      callback(currentData);
    }).catch(console.error);

    // Handle named SSE events (server sends: event: insert\ndata: {...}\n\n)
    const handleChange = (eventType: string) => (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const change: ChangeEvent<T> = {
          op: eventType as ChangeEvent<T>['op'],
          id: parsed.id,
          data: parsed.data,
        };

        switch (change.op) {
          case 'insert':
            currentData = [...currentData, change.data];
            break;
          case 'update':
            currentData = currentData.map((item) =>
              (item as Record<string, unknown>).id === change.id ? change.data : item
            );
            break;
          case 'delete':
            currentData = currentData.filter(
              (item) => (item as Record<string, unknown>).id !== change.id
            );
            break;
        }

        callback(currentData);
      } catch (error) {
        console.error('[SignalDB] Error parsing SSE event:', error);
      }
    };

    for (const eventType of ['insert', 'update', 'delete']) {
      eventSource.addEventListener(eventType, handleChange(eventType));
    }

    eventSource.onerror = (error) => {
      console.error('[SignalDB] SSE connection error:', error);
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
      this._sseConnection = null;
    };
  }

  /**
   * Subscribe to specific events on this table
   */
  on(
    event: 'insert' | 'update' | 'delete',
    callback: (record: T) => void,
    options?: { filter?: Record<string, unknown> }
  ): Unsubscribe {
    // Build SSE URL with filters
    let url = `${this.baseUrl}/v1/${this.tableName}/stream`;
    const params = new URLSearchParams();

    // Add API key to query (required for SSE)
    const authHeader = this.headers['Authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      params.set('apiKey', authHeader.slice(7));
    }

    // Add filters
    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        params.set(`filter.${key}`, String(value));
      }
    }

    url += `?${params.toString()}`;

    // Create EventSource
    const eventSource = new EventSource(url);

    // Listen for the specific named SSE event
    eventSource.addEventListener(event, (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        callback(parsed.data);
      } catch (error) {
        console.error('[SignalDB] Error parsing SSE event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('[SignalDB] SSE connection error:', error);
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }
}
