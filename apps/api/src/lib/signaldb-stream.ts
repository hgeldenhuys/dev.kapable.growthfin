/**
 * SignalDB Stream Client
 *
 * Replaces ElectricSQL Shape Stream with SignalDB's built-in real-time streaming.
 * SignalDB automatically creates NOTIFY triggers on all tables and provides
 * SSE streaming endpoints at /v1/{table}/stream.
 *
 * Key differences from ElectricSQL:
 * - Native SSE (no long-polling, no shape handles)
 * - Automatic NOTIFY triggers (no manual pg_notify needed)
 * - API key authentication instead of open proxy
 * - Filter syntax uses query params: filter[column]=value
 */

const SIGNALDB_URL = process.env.SIGNALDB_URL || 'http://localhost:3003';
const SIGNALDB_API_KEY = process.env.SIGNALDB_API_KEY || '';

export interface SignalDBStreamOptions {
  table: string;
  where?: string;
  columns?: string[];
  subscriptionTimestamp: Date;
}

interface SignalDBEvent {
  id?: string;
  operation?: 'insert' | 'update' | 'delete';
  table?: string;
  /** Row data — SignalDB sends this as 'data', not 'row' */
  data?: Record<string, any>;
  row?: Record<string, any>;
  old_row?: Record<string, any>;
  ts?: number;
  timestamp?: string;
}

/**
 * SignalDBStream provides async iteration over database changes via SSE.
 *
 * Usage:
 * ```typescript
 * const stream = new SignalDBStream({
 *   table: 'crm_leads',
 *   where: "workspace_id='abc'",
 *   subscriptionTimestamp: new Date()
 * });
 *
 * for await (const sseMessage of stream.stream()) {
 *   response.write(sseMessage); // SSE-formatted string
 * }
 * ```
 */
export class SignalDBStream {
  private options: SignalDBStreamOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000;
  private abortController: AbortController | null = null;

  constructor(options: SignalDBStreamOptions) {
    this.options = options;
  }

  /**
   * Stream table changes as SSE-formatted strings.
   * Yields one SSE message per database change.
   */
  async *stream(): AsyncGenerator<string> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        yield* this.streamInternal();
        this.reconnectAttempts = 0;
      } catch (error) {
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[SignalDBStream] Max reconnection attempts reached', error);
          throw error;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(2, this.reconnectAttempts - 1),
          30000
        );

        console.warn(`[SignalDBStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Internal streaming implementation using fetch with streaming response.
   * SignalDB provides native SSE endpoints.
   */
  private async *streamInternal(): AsyncGenerator<string> {
    const url = this.buildUrl();

    console.log(`[SignalDBStream] Connecting to ${url}`);

    this.abortController = new AbortController();

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SignalDB HTTP error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('SignalDB response has no body');
    }

    // Reset reconnect attempts on successful connection
    this.reconnectAttempts = 0;

    // Parse SSE stream from response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[SignalDBStream] Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (delimited by \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue;

          // Parse SSE fields
          const lines = message.split('\n');

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();

              // Skip heartbeat/comment messages
              if (!dataStr || dataStr === '""') continue;

              try {
                const event: SignalDBEvent = JSON.parse(dataStr);
                const sseMessage = this.processEvent(event, currentEventType);
                if (sseMessage) {
                  yield sseMessage;
                }
              } catch {
                // Not JSON — might be a keepalive or comment, skip
              }
            } else if (line.startsWith(':')) {
              // SSE comment (keepalive), skip
            }
          }

          currentEventType = '';
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process a SignalDB SSE event and convert to output format.
   * Filters out DELETEs and minimal UPDATEs (matching ElectricSQL behavior).
   */
  private processEvent(event: SignalDBEvent, eventType: string): string | null {
    const operation = eventType || event.operation;

    // Skip DELETE operations (matching existing behavior)
    if (operation === 'delete') {
      return null;
    }

    // SignalDB sends row data as 'data' field, fall back to 'row' for compatibility
    const row = event.data || event.row;
    if (!row) return null;

    // For UPDATE operations, skip minimal updates (only id + timestamp changed)
    if (operation === 'update') {
      const keys = Object.keys(row);
      const hasOnlyIdAndTimestamp =
        keys.length <= 2 &&
        keys.includes('id') &&
        (keys.includes('processed_at') || keys.includes('updated_at'));

      if (hasOnlyIdAndTimestamp) {
        return null;
      }
    }

    // Skip events with no meaningful data (e.g. SignalDB keepalives with only "ts")
    const meaningfulKeys = Object.keys(row).filter(k => k !== 'ts' && k !== 'id');
    if (meaningfulKeys.length === 0) {
      return null;
    }

    // Timestamp filter (extra safety)
    if (!this.passesTimestampFilter(row)) {
      return null;
    }

    // Convert snake_case to camelCase and parse JSONB strings
    const camelCasedValue = this.toCamelCase(row);

    return `data: ${JSON.stringify(camelCasedValue)}\n\n`;
  }

  /**
   * Build SignalDB stream URL with query parameters.
   *
   * SignalDB filter syntax: filter[column]=value
   * WHERE clauses like "workspace_id='abc' AND entity_type='lead'"
   * become: filter[workspace_id]=abc&filter[entity_type]=lead
   */
  private buildUrl(): string {
    const params = new URLSearchParams();

    // API key authentication
    if (SIGNALDB_API_KEY) {
      params.set('apiKey', SIGNALDB_API_KEY);
    }

    // Convert SQL WHERE clause to SignalDB filter params
    if (this.options.where) {
      const filters = this.parseWhereClause(this.options.where);
      for (const [key, value] of filters) {
        params.set(`filter[${key}]`, value);
      }
    }

    // Column selection
    if (this.options.columns && this.options.columns.length > 0) {
      params.set('columns', this.options.columns.join(','));
    }

    return `${SIGNALDB_URL}/v1/${this.options.table}/stream?${params.toString()}`;
  }

  /**
   * Parse SQL WHERE clause into key-value filter pairs.
   *
   * Handles:
   * - "workspace_id='abc'" → [["workspace_id", "abc"]]
   * - "workspace_id='abc' AND entity_type='lead'" → [["workspace_id", "abc"], ["entity_type", "lead"]]
   * - "id IN ('a','b','c')" → [["id", "a,b,c"]]
   * - Combined: "(workspace_id='abc') AND (id IN ('a','b'))" → both filters
   */
  private parseWhereClause(where: string): Array<[string, string]> {
    const filters: Array<[string, string]> = [];

    // Remove outer parentheses
    let cleaned = where.replace(/^\(|\)$/g, '');

    // Split on AND
    const parts = cleaned.split(/\s+AND\s+/i);

    for (let part of parts) {
      // Remove surrounding parentheses from each part
      part = part.replace(/^\(|\)$/g, '').trim();

      // Handle IN clause: "id IN ('a','b','c')"
      const inMatch = part.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
      if (inMatch) {
        const column = inMatch[1];
        const values = inMatch[2]
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));
        filters.push([column, values.join(',')]);
        continue;
      }

      // Handle equality: "column='value'"
      const eqMatch = part.match(/^(\w+)\s*=\s*'([^']*)'$/);
      if (eqMatch) {
        filters.push([eqMatch[1], eqMatch[2]]);
        continue;
      }
    }

    return filters;
  }

  /**
   * Filter messages by timestamp (additional safety layer).
   */
  private passesTimestampFilter(row: Record<string, any>): boolean {
    if (row.updated_at) {
      const updatedAt = new Date(row.updated_at);
      if (updatedAt < this.options.subscriptionTimestamp) {
        return false;
      }
    }

    if (row.created_at && !row.updated_at) {
      const createdAt = new Date(row.created_at);
      if (createdAt < this.options.subscriptionTimestamp) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert snake_case to camelCase recursively.
   * Also parses JSONB string fields into proper objects/arrays.
   */
  private toCamelCase(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toCamelCase(item));
    }

    if (typeof value === 'string') {
      if ((value.startsWith('[') && value.endsWith(']')) ||
          (value.startsWith('{') && value.endsWith('}'))) {
        try {
          const parsed = JSON.parse(value);
          return this.toCamelCase(parsed);
        } catch {
          return value;
        }
      }
      return value;
    }

    if (typeof value === 'object' && value.constructor === Object) {
      const camelCased: Record<string, any> = {};

      for (const [key, val] of Object.entries(value)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        camelCased[camelKey] = this.toCamelCase(val);
      }

      return camelCased;
    }

    return value;
  }

  /**
   * Abort the current stream connection.
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

/**
 * Create a SignalDB stream for a table with optional filters.
 */
export function createSignalDBStream(options: SignalDBStreamOptions): SignalDBStream {
  return new SignalDBStream(options);
}
