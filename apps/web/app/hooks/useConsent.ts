/**
 * useConsent Hook
 * Real-time consent records data using TanStack Query + Shared SSE
 * POPIA Compliance Management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type {
  ConsentRecord,
  CreateConsentRequest,
  UpdateConsentRequest,
  RevokeConsentRequest,
  ExtendConsentRequest,
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseConsentRecordsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch consent records with real-time SSE updates
 */
export function useConsentRecords({ workspaceId, enabled = true }: UseConsentRecordsOptions) {
  return useSharedSSE({
    table: 'consent_records',
    queryKey: ['crm', 'consent', 'recent', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/consent/recent?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch consent records: ${response.statusText}`);
      }
      const data = await response.json();
      return data.consentRecords || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single consent record by ID
 */
export function useConsentRecord(consentId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'consent', consentId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/consent/${consentId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch consent record: ${response.statusText}`);
      }
      return response.json() as Promise<ConsentRecord>;
    },
    enabled: !!consentId && !!workspaceId,
  });
}

/**
 * Create a new consent record
 */
export function useCreateConsentRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateConsentRequest) => {
      const response = await fetch(`/api/v1/crm/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create consent record');
      }

      return response.json() as Promise<ConsentRecord>;
    },
    onSuccess: (data, variables) => {
      // Invalidate consent list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', 'recent', variables.workspaceId]
      });
    },
  });
}

/**
 * Update a consent record
 */
export function useUpdateConsentRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consentId,
      workspaceId,
      data,
    }: {
      consentId: string;
      workspaceId: string;
      data: UpdateConsentRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/consent/${consentId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update consent record');
      }

      return response.json() as Promise<ConsentRecord>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific record
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', variables.consentId, variables.workspaceId]
      });
    },
  });
}

/**
 * Revoke a consent record
 */
export function useRevokeConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consentId,
      workspaceId,
      data,
    }: {
      consentId: string;
      workspaceId: string;
      data?: RevokeConsentRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/consent/${consentId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'revoked',
            ...(data?.reason && {
              metadata: { revocation_reason: data.reason }
            }),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to revoke consent');
      }

      return response.json() as Promise<ConsentRecord>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', variables.consentId, variables.workspaceId]
      });
    },
  });
}

/**
 * Extend consent expiry date
 */
export function useExtendConsentExpiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consentId,
      workspaceId,
      data,
    }: {
      consentId: string;
      workspaceId: string;
      data: ExtendConsentRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/consent/${consentId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresAt: data.expiresAt }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to extend consent expiry');
      }

      return response.json() as Promise<ConsentRecord>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', variables.consentId, variables.workspaceId]
      });
    },
  });
}

/**
 * Delete a consent record
 */
export function useDeleteConsentRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ consentId, workspaceId }: { consentId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/consent/${consentId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete consent record');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'consent', 'recent', variables.workspaceId]
      });
    },
  });
}
