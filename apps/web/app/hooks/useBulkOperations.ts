/**
 * useBulkOperations Hook
 * TanStack Query hooks for bulk lead operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { useSharedSSE } from './useSharedSSE';


interface BulkOperation {
  id: string;
  workspaceId: string;
  operationType: 'assign' | 'update' | 'delete' | 'export';
  operationName?: string;
  payload: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  errorSummary?: string;
  errorDetails?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
}

interface CreateBulkAssignmentRequest {
  workspaceId: string;
  leadIds: string[];
  agentId: string;
  userId: string;
  distributionStrategy?: 'single' | 'even';
  notification?: boolean;
}

interface CreateBulkUpdateRequest {
  workspaceId: string;
  leadIds: string[];
  fields: Record<string, any>;
  userId: string;
  rollbackEnabled?: boolean;
}

interface UseBulkOperationsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch all bulk operations with real-time updates
 */
export function useBulkOperations({ workspaceId, enabled = true }: UseBulkOperationsOptions) {
  return useSharedSSE<BulkOperation[]>({
    table: 'bulk_operations',
    queryKey: ['workspaces', workspaceId, 'bulk-operations'],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/bulk-operations?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch bulk operations: ${response.statusText}`);
      }
      const data = await response.json();
      return data.operations || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single bulk operation by ID
 */
export function useBulkOperation(operationId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'bulk-operations', operationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/bulk-operations/${operationId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch bulk operation: ${response.statusText}`);
      }
      return response.json() as Promise<BulkOperation>;
    },
    enabled: !!operationId && !!workspaceId,
    refetchInterval: (data) => {
      // Poll every 2 seconds while operation is running
      if (data?.status === 'pending' || data?.status === 'running') {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * Create bulk assignment operation
 */
export function useCreateBulkAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBulkAssignmentRequest) => {
      const response = await fetch(
        `/api/v1/crm/bulk-operations/assign?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadIds: data.leadIds,
            agentId: data.agentId,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create bulk assignment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'bulk-operations'],
      });
    },
  });
}

/**
 * Create bulk update operation
 */
export function useCreateBulkUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBulkUpdateRequest) => {
      const response = await fetch(
        `/api/v1/crm/bulk-operations/update?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_ids: data.leadIds,
            fields: data.fields,
            rollback_enabled: data.rollbackEnabled,
            user_id: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create bulk update');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'bulk-operations'],
      });
    },
  });
}

/**
 * Rollback a bulk operation
 */
export function useRollbackBulkOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      operationId,
      workspaceId,
    }: {
      operationId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/bulk-operations/${operationId}/rollback?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to rollback operation');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', variables.workspaceId, 'bulk-operations'],
      });
    },
  });
}
