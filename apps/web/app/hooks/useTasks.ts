/**
 * useTasks Hook - CQRS Commands Only
 *
 * ARCHITECTURE CHANGE (US-007):
 * - Queries now come from BFF loaders (use useLoaderData in your components)
 * - This hook only handles COMMANDS (create, update, delete, execute, etc.)
 * - Mutations trigger React Router revalidation instead of React Query cache
 */

import { useMutation } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';

// Task types
export interface Task {
  id: string;
  workspaceId: string;
  listId: string;
  type: 'enrichment' | 'export' | 'segmentation' | 'scoring';
  name: string;
  description: string | null;
  status: 'planned' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  configuration: Record<string, any>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  // Progress tracking fields
  totalEntities: number | null;
  processedEntities: number | null;
  successfulEntities: number | null;
  failedEntities: number | null;
  skippedEntities: number | null;
  actualCost: string | null;
}

export interface CreateTaskRequest {
  workspaceId: string;
  listId: string;
  type: 'enrichment' | 'export' | 'segmentation' | 'scoring';
  name: string;
  description?: string;
  configuration: Record<string, any>;
  scheduledAt?: string;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string | null;
  configuration?: Record<string, any>;
  scheduledAt?: string | null;
}

export interface ChangeTaskStatusRequest {
  status: 'planned' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
}

interface UseTasksOptions {
  workspaceId: string;
  listId?: string;
  type?: string;
  status?: string;
  enabled?: boolean;
}

/**
 * @deprecated Use React Router loader instead. See apps/web/app/routes/dashboard.$workspaceId.crm.tasks._index.tsx
 *
 * Migration guide:
 * 1. Add loader to your route that queries database directly
 * 2. Use useLoaderData() in component instead of this hook
 * 3. Subscribe to SSE for real-time updates with useTasksSSE()
 */
export function useTasks(_options: UseTasksOptions): never {
  throw new Error(
    'useTasks query hook is deprecated. Use React Router loader + useLoaderData instead. ' +
    'See apps/web/app/routes/dashboard.$workspaceId.crm.tasks._index.tsx for pattern.'
  );
}

/**
 * @deprecated Use React Router loader instead. See apps/web/app/routes/dashboard.$workspaceId.crm.tasks.$taskId._index.tsx
 *
 * Migration guide:
 * 1. Add loader to your route that queries database directly
 * 2. Use useLoaderData() in component instead of this hook
 * 3. Subscribe to SSE for real-time updates with useTasksSSE()
 */
export function useTask(_taskId: string, _workspaceId: string, _options?: { refetchInterval?: number | ((data: Task | undefined) => number | false) }): never {
  throw new Error(
    'useTask query hook is deprecated. Use React Router loader + useLoaderData instead. ' +
    'See apps/web/app/routes/dashboard.$workspaceId.crm.tasks.$taskId._index.tsx for pattern.'
  );
}

/**
 * Create a new task (COMMAND)
 */
export function useCreateTask() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async (data: CreateTaskRequest) => {
      const response = await fetch(`/api/v1/crm/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create task');
      }

      const result = await response.json();
      // API returns { success: true, task: {...} }
      return result.task as Task;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Update an existing task (COMMAND)
 */
export function useUpdateTask() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      workspaceId: string;
      updates: UpdateTaskRequest;
    }) => {
      const { taskId, workspaceId, updates } = data;

      const response = await fetch(`/api/v1/crm/batches/${taskId}?workspaceId=${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update task');
      }

      const result = await response.json();
      // API returns { success: true, task: {...} }
      return result.task as Task;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Change task status (COMMAND)
 */
export function useChangeTaskStatus() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      workspaceId: string;
      status: ChangeTaskStatusRequest;
    }) => {
      const { taskId, workspaceId, status } = data;

      const response = await fetch(
        `/api/v1/crm/batches/${taskId}/status?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(status),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to change task status');
      }

      const result = await response.json();
      // API returns { success: true, task: {...} }
      return result.task as Task;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Delete a task (only for planned tasks) (COMMAND)
 */
export function useDeleteTask() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ taskId, workspaceId }: { taskId: string; workspaceId: string }) => {
      const response = await fetch(`/api/v1/crm/batches/${taskId}?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete task');
      }

      return response.json();
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Bulk cancel tasks (COMMAND)
 */
export function useBulkCancelTasks() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ taskIds, workspaceId }: { taskIds: string[]; workspaceId: string }) => {
      const promises = taskIds.map((taskId) =>
        fetch(`/api/v1/crm/batches/${taskId}/status?workspaceId=${workspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to cancel ${failed.length} task(s)`);
      }

      return { success: true, count: taskIds.length };
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

/**
 * Bulk delete tasks (COMMAND)
 */
export function useBulkDeleteTasks() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ taskIds, workspaceId }: { taskIds: string[]; workspaceId: string }) => {
      const promises = taskIds.map((taskId) =>
        fetch(`/api/v1/crm/batches/${taskId}?workspaceId=${workspaceId}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} task(s)`);
      }

      return { success: true, count: taskIds.length };
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

// Response type for execute endpoint
export interface ExecuteTaskResponse {
  success: boolean;
  message: string;
  jobId: string;
}

/**
 * Execute a task (start task execution) (COMMAND)
 */
export function useExecuteTask() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ taskId, workspaceId }: { taskId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/batches/${taskId}/execute?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // API expects object body (even if empty)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start task execution');
      }

      // API returns { success: true, message, jobId }
      return response.json() as Promise<ExecuteTaskResponse>;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}

// Response type for retry endpoint
export interface RetryTaskResponse {
  success: boolean;
  message: string;
  retryTask: {
    id: string;
    name: string;
    failedContactCount: number;
    failedLeadCount: number;
  };
}

/**
 * Retry failed contacts in a task (creates a new retry task) (COMMAND)
 */
export function useRetryTask() {
  const revalidator = useRevalidator();

  return useMutation({
    mutationFn: async ({ taskId, workspaceId }: { taskId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/batches/${taskId}/retry?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // API expects object body (even if empty)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create retry task');
      }

      // API returns { success: true, message, retryTask: {...} }
      return response.json() as Promise<RetryTaskResponse>;
    },
    onSuccess: () => {
      // Revalidate React Router loader data (not React Query cache)
      revalidator.revalidate();
    },
  });
}
