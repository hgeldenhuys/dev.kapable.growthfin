/**
 * useAccounts Hook
 * Real-time CRM accounts data using TanStack Query + Shared SSE
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type { CRMAccount, CreateAccountRequest, UpdateAccountRequest } from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseAccountsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch accounts with real-time SSE updates
 */
export function useAccounts({ workspaceId, enabled = true }: UseAccountsOptions) {
  return useSharedSSE({
    table: 'crm_accounts',
    queryKey: ['crm', 'accounts', 'recent', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/accounts/recent?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }
      const data = await response.json();
      return data.accounts || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single account by ID
 */
export function useAccount(accountId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'accounts', accountId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/accounts/${accountId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch account: ${response.statusText}`);
      }
      return response.json() as Promise<CRMAccount>;
    },
    enabled: !!accountId && !!workspaceId,
  });
}

/**
 * Create a new account
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAccountRequest) => {
      const response = await fetch(`/api/v1/crm/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create account');
      }

      return response.json() as Promise<CRMAccount>;
    },
    onSuccess: (data, variables) => {
      // Invalidate accounts list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'accounts', 'recent', variables.workspaceId]
      });
    },
  });
}

/**
 * Update an account
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      workspaceId,
      data,
    }: {
      accountId: string;
      workspaceId: string;
      data: UpdateAccountRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/accounts/${accountId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update account');
      }

      return response.json() as Promise<CRMAccount>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific account
      queryClient.invalidateQueries({
        queryKey: ['crm', 'accounts', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'accounts', variables.accountId, variables.workspaceId]
      });
    },
  });
}

/**
 * Delete an account
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, workspaceId }: { accountId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/accounts/${accountId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete account');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'accounts', 'recent', variables.workspaceId]
      });
    },
  });
}
