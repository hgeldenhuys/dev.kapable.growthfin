/**
 * ElectricSQL Shape Stream Client
 *
 * Wraps Electric's HTTP API for real-time streaming of database changes.
 * Key feature: Uses offset=now to skip historical data and only stream NEW events.
 */

import { electricLogger } from './electric-logger';

export interface ElectricShapeStreamOptions {
  electricUrl: string;
  table: string;
  where?: string;
  columns?: string[];
  subscriptionTimestamp: Date; // Used for additional client-side filtering
}

interface ShapeLogEntry {
  key: string;
  value: Record<string, any>;
  headers: {
    operation: 'insert' | 'update' | 'delete';
    relation: [string, string];
  };
}

interface ControlMessage {
  headers: {
    control: 'up-to-date' | 'snapshot-end' | 'must-refetch';
  };
}

type ShapeMessage = ShapeLogEntry | ControlMessage;

/**
 * ElectricShapeStream provides async iteration over database changes.
 *
 * Usage:
 * ```typescript
 * const stream = new ElectricShapeStream({
 *   electricUrl: 'http://localhost:3001',
 *   table: 'claude_sessions',
 *   where: "project_id='abc'",
 *   subscriptionTimestamp: new Date()
 * });
 *
 * for await (const sseMessage of stream.stream()) {
 *   response.write(sseMessage); // SSE-formatted string
 * }
 * ```
 */
export class ElectricShapeStream {
  private options: ElectricShapeStreamOptions;
  private currentOffset: string = 'now'; // Start with 'now' to skip historical data!
  private shapeHandle?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1 second

  constructor(options: ElectricShapeStreamOptions) {
    this.options = options;
  }

  /**
   * Stream shape changes as SSE-formatted strings.
   * Yields one SSE message per database change.
   */
  async *stream(): AsyncGenerator<string> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        yield* this.streamInternal();
        // If we exit cleanly, reset reconnect attempts
        this.reconnectAttempts = 0;
      } catch (error) {
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          electricLogger.error('[ElectricShapeStream] Max reconnection attempts reached', error);
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, ...
        const delay = Math.min(
          this.baseDelay * Math.pow(2, this.reconnectAttempts - 1),
          30000 // Max 30 seconds
        );

        electricLogger.warn(`[ElectricShapeStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Internal streaming implementation.
   * Handles initial sync with offset=now, then switches to live mode.
   */
  private async *streamInternal(): AsyncGenerator<string> {
    const url = this.buildUrl();

    electricLogger.log(`[ElectricShapeStream] Connecting to ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Electric HTTP error: ${response.status} ${response.statusText}`);
    }

    // Extract offset and handle from response headers
    const offsetHeader = response.headers.get('electric-offset');
    const handleHeader = response.headers.get('electric-handle');

    electricLogger.log(`[ElectricShapeStream] Got headers - offset: ${offsetHeader}, handle: ${handleHeader}`);

    if (offsetHeader) {
      this.currentOffset = offsetHeader;
    }

    if (handleHeader) {
      this.shapeHandle = handleHeader;
    }

    // Parse JSON response
    electricLogger.log(`[ElectricShapeStream] Parsing initial response...`);
    const messages: ShapeMessage[] = await response.json();
    electricLogger.log(`[ElectricShapeStream] Got ${messages.length} messages`);

    // Process messages
    for (const message of messages) {
      if (this.isControlMessage(message)) {
        electricLogger.log(`[ElectricShapeStream] Control: ${message.headers.control}`);

        if (message.headers.control === 'must-refetch') {
          // Reset to refetch from beginning
          this.currentOffset = 'now';
          this.shapeHandle = undefined;
          throw new Error('must-refetch - restarting stream');
        }

        if (message.headers.control === 'up-to-date') {
          // Switch to live mode for subsequent requests
          electricLogger.log('[ElectricShapeStream] Caught up - entering live mode');
        }

        continue;
      }

      // Skip DELETE operations (we don't stream deletions)
      if (message.headers.operation === 'delete') {
        electricLogger.log(`[ElectricShapeStream] Skipping delete operation`);
        continue;
      }

      // For UPDATE operations, check if we have enough data
      // Some UPDATEs only contain changed fields (e.g., {id, processed_at})
      // Skip those, but allow UPDATEs with full row data
      if (message.headers.operation === 'update') {
        // Check if this is a minimal update (only id + one timestamp field)
        const keys = Object.keys(message.value);
        const hasOnlyIdAndTimestamp =
          keys.length <= 2 &&
          keys.includes('id') &&
          (keys.includes('processed_at') || keys.includes('updated_at'));

        if (hasOnlyIdAndTimestamp) {
          electricLogger.log(`[ElectricShapeStream] Skipping minimal update operation (only timestamp changed)`);
          continue;
        }
      }

      // Filter by timestamp (extra safety, though offset=now should handle this)
      if (!this.passesTimestampFilter(message)) {
        continue;
      }

      // Convert to SSE format
      const sseMessage = this.toSSE(message);
      yield sseMessage;
    }

    // After processing initial batch, continue in live mode
    electricLogger.log(`[ElectricShapeStream] Finished initial batch. shapeHandle: ${this.shapeHandle}, entering live mode: ${!!this.shapeHandle}`);
    if (this.shapeHandle) {
      yield* this.streamLive();
    } else {
      electricLogger.log(`[ElectricShapeStream] No shape handle - cannot enter live mode!`);
    }
  }

  /**
   * Stream in live mode using long-polling.
   */
  private async *streamLive(): AsyncGenerator<string> {
    electricLogger.log(`[ElectricShapeStream] Entering live mode with handle: ${this.shapeHandle}`);
    while (true) {
      const url = this.buildUrl(true);

      electricLogger.log(`[ElectricShapeStream] Live poll to: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Electric live mode error: ${response.status}`);
      }

      // Update offset from response
      const offsetHeader = response.headers.get('electric-offset');
      if (offsetHeader) {
        this.currentOffset = offsetHeader;
      }

      electricLogger.log(`[ElectricShapeStream] Live response received, parsing...`);
      const messages: ShapeMessage[] = await response.json();
      electricLogger.log(`[ElectricShapeStream] Live got ${messages.length} messages`);

      let hasNewData = false;

      for (const message of messages) {
        if (this.isControlMessage(message)) {
          electricLogger.log(`[ElectricShapeStream] Live control message: ${message.headers.control}`);
          if (message.headers.control === 'must-refetch') {
            this.currentOffset = 'now';
            this.shapeHandle = undefined;
            throw new Error('must-refetch in live mode');
          }

          if (message.headers.control === 'up-to-date') {
            // No new data, will wait before next poll
            continue;
          }

          continue;
        }

        electricLogger.log(`[ElectricShapeStream] Live data message - operation: ${message.headers.operation}, id: ${message.value.id}`);

        // Skip DELETE operations (we don't stream deletions)
        if (message.headers.operation === 'delete') {
          electricLogger.log(`[ElectricShapeStream] Skipping delete operation`);
          continue;
        }

        // For UPDATE operations, check if we have enough data
        // Some UPDATEs only contain changed fields (e.g., {id, processed_at})
        // Skip those, but allow UPDATEs with full row data
        if (message.headers.operation === 'update') {
          // Check if this is a minimal update (only id + one timestamp field)
          const keys = Object.keys(message.value);
          const hasOnlyIdAndTimestamp =
            keys.length <= 2 &&
            keys.includes('id') &&
            (keys.includes('processed_at') || keys.includes('updated_at'));

          if (hasOnlyIdAndTimestamp) {
            electricLogger.log(`[ElectricShapeStream] Skipping minimal update operation (only timestamp changed)`);
            continue;
          }
        }

        hasNewData = true;

        const passesFilter = this.passesTimestampFilter(message);
        electricLogger.log(`[ElectricShapeStream] Timestamp filter result: ${passesFilter} for event ${message.value.id}`);
        if (!passesFilter) {
          continue;
        }

        electricLogger.log(`[ElectricShapeStream] ✅ Yielding SSE message for event ${message.value.id}`);
        yield this.toSSE(message);
        electricLogger.log(`[ElectricShapeStream] ✅ Yielded successfully, continuing...`);
      }

      electricLogger.log(`[ElectricShapeStream] Finished processing batch, looping back for next long-poll...`);
      // ElectricSQL uses long-polling, so we should NOT add artificial delays
      // The next fetch will block until data is available or timeout occurs
      // This ensures true event-driven streaming without polling
    }
  }

  /**
   * Build Electric HTTP API URL.
   */
  private buildUrl(liveMode: boolean = false): string {
    const params = new URLSearchParams();

    params.set('table', this.options.table);
    params.set('offset', this.currentOffset);

    if (this.options.where) {
      params.set('where', this.options.where);
    }

    if (this.options.columns && this.options.columns.length > 0) {
      params.set('columns', this.options.columns.join(','));
    }

    if (liveMode && this.shapeHandle) {
      params.set('live', 'true');
      params.set('handle', this.shapeHandle);
    }

    return `${this.options.electricUrl}/v1/shape?${params.toString()}`;
  }

  /**
   * Check if message is a control message.
   */
  private isControlMessage(message: ShapeMessage): message is ControlMessage {
    return 'headers' in message && 'control' in message.headers;
  }

  /**
   * Filter messages by timestamp (additional safety layer).
   * Since we use offset=now, this should rarely filter anything.
   */
  private passesTimestampFilter(message: ShapeLogEntry): boolean {
    const value = message.value;

    // Check updated_at (for sessions, todos)
    if (value.updated_at) {
      const updatedAt = new Date(value.updated_at);
      if (updatedAt < this.options.subscriptionTimestamp) {
        electricLogger.log(`[ElectricShapeStream] Filtered out pre-subscription event: ${value.id}`);
        return false;
      }
    }

    // Check created_at (for summaries, chat)
    if (value.created_at && !value.updated_at) {
      const createdAt = new Date(value.created_at);
      if (createdAt < this.options.subscriptionTimestamp) {
        electricLogger.log(`[ElectricShapeStream] Filtered out pre-subscription event: ${value.id}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Convert snake_case to camelCase recursively (handles nested objects and arrays)
   * Also parses JSONB string fields into proper objects/arrays
   */
  private toCamelCase(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      return value.map((item) => this.toCamelCase(item));
    }

    // Handle JSON strings (JSONB fields come as strings from Electric)
    if (typeof value === 'string') {
      // Try to parse strings that look like JSON arrays/objects
      if ((value.startsWith('[') && value.endsWith(']')) ||
          (value.startsWith('{') && value.endsWith('}'))) {
        try {
          const parsed = JSON.parse(value);
          // Recursively convert the parsed value
          return this.toCamelCase(parsed);
        } catch (e) {
          // Not valid JSON, return as-is
          return value;
        }
      }
      return value;
    }

    // Handle objects recursively
    if (typeof value === 'object' && value.constructor === Object) {
      const camelCased: Record<string, any> = {};

      for (const [key, val] of Object.entries(value)) {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        // Recursively convert nested values (including parsing JSON strings)
        camelCased[camelKey] = this.toCamelCase(val);
      }

      return camelCased;
    }

    // Return primitives as-is
    return value;
  }

  /**
   * Convert ShapeLogEntry to SSE format.
   * Sends only the value object (row data) to match CLI expectations.
   * Converts snake_case to camelCase for compatibility with Drizzle ORM.
   */
  private toSSE(message: ShapeLogEntry): string {
    // Convert snake_case database column names to camelCase (Drizzle format)
    // Also parses JSONB string fields into proper objects/arrays
    const camelCasedValue = this.toCamelCase(message.value);

    // CLI expects just the row data, not wrapped in {operation, key, value}
    return `data: ${JSON.stringify(camelCasedValue)}\n\n`;
  }
}

/**
 * Create a shape stream for a table with where clause.
 */
export function createShapeStream(options: ElectricShapeStreamOptions): ElectricShapeStream {
  return new ElectricShapeStream(options);
}
