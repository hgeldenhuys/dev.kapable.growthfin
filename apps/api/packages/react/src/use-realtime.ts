/**
 * useRealtime hook
 *
 * Low-level hook for SSE subscriptions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSignalDB } from './provider';

export interface ChangeEvent<T = unknown> {
  op: 'insert' | 'update' | 'delete';
  table?: string;
  id: string;
  data: T;
  ts: number;
}

export interface UseRealtimeOptions<T = unknown> {
  /** Table to subscribe to (optional, subscribes to all if not specified) */
  table?: string;
  /** Called on insert events */
  onInsert?: (event: ChangeEvent<T>) => void;
  /** Called on update events */
  onUpdate?: (event: ChangeEvent<T>) => void;
  /** Called on delete events */
  onDelete?: (event: ChangeEvent<T>) => void;
  /** Called on any change */
  onChange?: (event: ChangeEvent<T>) => void;
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Filter by field values (e.g., { status: 'active' }) */
  filter?: Record<string, string>;
}

export function useRealtime<T = unknown>({
  table,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
  filter,
}: UseRealtimeOptions<T>) {
  const { apiKey, baseUrl } = useSignalDB();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Store handlers in refs to avoid reconnecting on handler changes
  const handlersRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  handlersRef.current = { onInsert, onUpdate, onDelete, onChange };

  useEffect(() => {
    if (!enabled) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setConnected(false);
      return;
    }

    // Build URL
    let url = table
      ? `${baseUrl}/api/v1/${table}/stream`
      : `${baseUrl}/api/v1/stream`;

    // Add API key and filters as query params
    const params = new URLSearchParams();
    params.set('apiKey', apiKey);

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        params.set(`filter.${key}`, value);
      }
    }

    url += `?${params.toString()}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setConnected(true);
      setError(null);
    });

    eventSource.addEventListener('insert', (e) => {
      const event = JSON.parse(e.data) as ChangeEvent<T>;
      event.op = 'insert';
      handlersRef.current.onInsert?.(event);
      handlersRef.current.onChange?.(event);
    });

    eventSource.addEventListener('update', (e) => {
      const event = JSON.parse(e.data) as ChangeEvent<T>;
      event.op = 'update';
      handlersRef.current.onUpdate?.(event);
      handlersRef.current.onChange?.(event);
    });

    eventSource.addEventListener('delete', (e) => {
      const event = JSON.parse(e.data) as ChangeEvent<T>;
      event.op = 'delete';
      handlersRef.current.onDelete?.(event);
      handlersRef.current.onChange?.(event);
    });

    eventSource.onerror = () => {
      setConnected(false);
      setError(new Error('Connection lost'));
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [apiKey, baseUrl, table, enabled, filter ? JSON.stringify(filter) : '']);

  return { connected, error };
}
