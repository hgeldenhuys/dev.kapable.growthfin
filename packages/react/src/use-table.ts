/**
 * useTable hook
 *
 * High-level hook for working with a SignalDB table
 */

import { useState, useEffect, useCallback } from 'react';
import { useSignalDB } from './provider';
import { useRealtime, type ChangeEvent } from './use-realtime';

export interface UseTableOptions {
  /** Enable/disable realtime updates */
  realtime?: boolean;
  /** Initial filter (also used for realtime) */
  filter?: Record<string, string>;
  /** Sorting */
  orderBy?: string;
  order?: 'asc' | 'desc';
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface UseTableResult<T extends { id: string }> {
  /** Current data */
  data: T[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Realtime connection status */
  connected: boolean;
  /** Total count (for pagination) */
  total: number;
  /** Refetch data */
  refetch: () => Promise<void>;
  /** Insert a new row */
  insert: (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => Promise<T>;
  /** Update a row */
  update: (id: string, data: Partial<T>) => Promise<T>;
  /** Delete a row */
  remove: (id: string) => Promise<void>;
}

export function useTable<T extends { id: string }>(
  tableName: string,
  options: UseTableOptions = {}
): UseTableResult<T> {
  const { fetch: signalFetch } = useSignalDB();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const {
    realtime = true,
    filter,
    orderBy = 'created_at',
    order = 'desc',
    limit = 100,
    offset = 0,
  } = options;

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        orderBy,
        order,
      });

      const response = await signalFetch(`/${tableName}?${params}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result.data);
      setTotal(result.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [signalFetch, tableName, limit, offset, orderBy, order]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime updates
  const { connected } = useRealtime<T>({
    table: tableName,
    enabled: realtime,
    filter,
    onInsert: useCallback((event: ChangeEvent<T>) => {
      setData((prev) => {
        // Avoid duplicates
        if (prev.some((item) => item.id === event.data.id)) {
          return prev;
        }
        return [event.data, ...prev];
      });
      setTotal((prev) => prev + 1);
    }, []),
    onUpdate: useCallback((event: ChangeEvent<T>) => {
      setData((prev) =>
        prev.map((item) =>
          item.id === event.data.id ? event.data : item
        )
      );
    }, []),
    onDelete: useCallback((event: ChangeEvent<T>) => {
      setData((prev) => prev.filter((item) => item.id !== event.id));
      setTotal((prev) => Math.max(0, prev - 1));
    }, []),
  });

  // Insert
  const insert = useCallback(
    async (newData: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> => {
      const response = await signalFetch(`/${tableName}`, {
        method: 'POST',
        body: JSON.stringify(newData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to insert');
      }

      const result = await response.json();

      // If realtime is disabled, add to local state
      if (!realtime) {
        setData((prev) => [result, ...prev]);
        setTotal((prev) => prev + 1);
      }

      return result;
    },
    [signalFetch, tableName, realtime]
  );

  // Update
  const update = useCallback(
    async (id: string, updateData: Partial<T>): Promise<T> => {
      const response = await signalFetch(`/${tableName}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }

      const result = await response.json();

      // If realtime is disabled, update local state
      if (!realtime) {
        setData((prev) =>
          prev.map((item) => (item.id === id ? result : item))
        );
      }

      return result;
    },
    [signalFetch, tableName, realtime]
  );

  // Delete
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const response = await signalFetch(`/${tableName}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }

      // If realtime is disabled, remove from local state
      if (!realtime) {
        setData((prev) => prev.filter((item) => item.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    },
    [signalFetch, tableName, realtime]
  );

  return {
    data,
    loading,
    error,
    connected,
    total,
    refetch: fetchData,
    insert,
    update,
    remove,
  };
}
