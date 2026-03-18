/**
 * Todos Hooks
 * React Query hooks for persistent todo management with cross-session continuity
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Types
export interface TodoItem {
  id: string;
  sessionId: string;
  projectId: string;
  agentId: string;
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
  isLatest: boolean;
  migratedFrom?: string | null;
  fromPreviousSession?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodosResponse {
  projectId: string;
  agentId: string;
  todos: TodoItem[];
  count: number;
  includeHistorical?: boolean;
  continuity?: {
    isNewSession: boolean;
    migratedCount: number;
    previousSessionId?: string;
  };
}

export interface SessionGroup {
  sessionId: string;
  todos: TodoItem[];
  isLatest: boolean;
}

export interface SessionHistory {
  sessionId: string;
  todoCount: number;
  isLatest: boolean;
  latestUpdate: string;
}

/**
 * Fetch current todos for a project+agent
 */
export function useTodos(
  projectId: string,
  agentId: string,
  options?: {
    includeHistorical?: boolean;
    sessionId?: string;
    enabled?: boolean;
  }
) {
  const queryKey = ['todos', projectId, agentId, options?.includeHistorical, options?.sessionId];

  return useQuery<TodosResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('projectId', projectId);
      params.set('agentId', agentId);
      if (options?.includeHistorical) {
        params.set('includeHistorical', 'true');
      }
      if (options?.sessionId) {
        params.set('sessionId', options.sessionId);
      }

      const res = await fetch(`/api/v1/todos?${params}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to fetch todos');
      }

      return res.json();
    },
    enabled: options?.enabled !== false && !!projectId && !!agentId,
  });
}

/**
 * Fetch todos grouped by session
 */
export function useTodosSessions(
  projectId: string,
  agentId: string,
  options?: { enabled?: boolean }
) {
  const queryKey = ['todos', 'sessions', projectId, agentId];

  return useQuery<{ projectId: string; agentId: string; sessions: SessionGroup[]; count: number }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('projectId', projectId);
      params.set('agentId', agentId);

      const res = await fetch(`/api/v1/todos/sessions?${params}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to fetch session todos');
      }

      return res.json();
    },
    enabled: options?.enabled !== false && !!projectId && !!agentId,
  });
}

/**
 * Fetch session history metadata
 */
export function useSessionHistory(
  projectId: string,
  agentId: string,
  options?: { enabled?: boolean }
) {
  const queryKey = ['todos', 'sessions', 'history', projectId, agentId];

  return useQuery<{ projectId: string; agentId: string; sessions: SessionHistory[] }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('projectId', projectId);
      params.set('agentId', agentId);

      const res = await fetch(`/api/v1/todos/sessions/history?${params}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to fetch session history');
      }

      return res.json();
    },
    enabled: options?.enabled !== false && !!projectId && !!agentId,
  });
}

/**
 * Create a new todo
 */
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sessionId: string;
      projectId: string;
      agentId: string;
      content: string;
      activeForm: string;
      status?: 'pending' | 'in_progress' | 'completed';
      order?: number;
    }) => {
      const res = await fetch(`/api/v1/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to create todo');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos', variables.projectId, variables.agentId] });
      toast.success('Todo created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create todo: ${error.message}`);
    },
  });
}

/**
 * Update a todo
 */
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      projectId: string;
      agentId: string;
      content?: string;
      activeForm?: string;
      status?: 'pending' | 'in_progress' | 'completed';
      order?: number;
    }) => {
      const { id, projectId, agentId, ...updates } = data;

      const res = await fetch(`/api/v1/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to update todo');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos', variables.projectId, variables.agentId] });
      toast.success('Todo updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update todo: ${error.message}`);
    },
  });
}

/**
 * Delete a todo
 */
export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; projectId: string; agentId: string }) => {
      const res = await fetch(`/api/v1/todos/${data.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to delete todo');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos', variables.projectId, variables.agentId] });
      toast.success('Todo deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete todo: ${error.message}`);
    },
  });
}

/**
 * Migrate todos to a new session
 */
export function useMigrateTodos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      newSessionId: string;
      projectId: string;
      agentId: string;
      previousSessionId?: string;
    }) => {
      const res = await fetch(`/api/v1/todos/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Failed to migrate todos');
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos', variables.projectId, variables.agentId] });

      if (data.count > 0) {
        toast.success(`Migrated ${data.count} todo${data.count !== 1 ? 's' : ''} from previous session`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to migrate todos: ${error.message}`);
    },
  });
}

/**
 * SSE streaming hook for real-time todo updates
 */
export function useTodosStream(
  projectId: string,
  agentId: string,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (options?.enabled === false || !projectId || !agentId) {
      return;
    }

    const params = new URLSearchParams();
    params.set('projectId', projectId);
    params.set('agentId', agentId);

    const streamUrl = `/api/v1/todos/stream?${params}`;
    console.log(`[useTodosStream] Connecting to: ${streamUrl}`);

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`[useTodosStream] Connected for ${projectId}/${agentId}`);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[useTodosStream] Update received:`, data);

        // Invalidate todos queries to refetch
        queryClient.invalidateQueries({ queryKey: ['todos', projectId, agentId] });
      } catch (error) {
        console.error(`[useTodosStream] Error parsing message:`, error);
      }
    };

    eventSource.onerror = (error) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error(`[useTodosStream] Connection closed`);
      }
    };

    return () => {
      console.log(`[useTodosStream] Cleaning up connection`);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [projectId, agentId, options?.enabled, queryClient]);
}
