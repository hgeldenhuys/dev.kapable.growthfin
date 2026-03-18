/**
 * useKYC Hook
 * Real-time KYC records data using TanStack Query + Shared SSE
 * FICA Compliance Management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSharedSSE } from './useSharedSSE';
import type {
  KYCRecord,
  CreateKYCRequest,
  UpdateKYCRequest,
  VerifyKYCRequest,
  RejectKYCRequest,
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseKYCRecordsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch KYC records with real-time SSE updates
 */
export function useKYCRecords({ workspaceId, enabled = true }: UseKYCRecordsOptions) {
  return useSharedSSE({
    table: 'kyc_records',
    queryKey: ['crm', 'kyc', 'recent', workspaceId],
    where: `workspace_id = '${workspaceId}'`,
    fetchFn: async () => {
      const response = await fetch(
        `/api/v1/crm/kyc/recent?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch KYC records: ${response.statusText}`);
      }
      const data = await response.json();
      return data.kycRecords || [];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single KYC record by ID
 */
export function useKYCRecord(kycId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'kyc', kycId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/kyc/${kycId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch KYC record: ${response.statusText}`);
      }
      return response.json() as Promise<KYCRecord>;
    },
    enabled: !!kycId && !!workspaceId,
  });
}

/**
 * Create a new KYC record
 */
export function useCreateKYCRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateKYCRequest) => {
      const response = await fetch(`/api/v1/crm/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create KYC record');
      }

      return response.json() as Promise<KYCRecord>;
    },
    onSuccess: (data, variables) => {
      // Invalidate KYC list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', 'recent', variables.workspaceId]
      });
    },
  });
}

/**
 * Update a KYC record
 */
export function useUpdateKYCRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kycId,
      workspaceId,
      data,
    }: {
      kycId: string;
      workspaceId: string;
      data: UpdateKYCRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/kyc/${kycId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update KYC record');
      }

      return response.json() as Promise<KYCRecord>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific record
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', variables.kycId, variables.workspaceId]
      });
    },
  });
}

/**
 * Verify a KYC record (approve)
 */
export function useVerifyKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kycId,
      workspaceId,
      data,
    }: {
      kycId: string;
      workspaceId: string;
      data: VerifyKYCRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/kyc/${kycId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'verified',
            riskRating: data.riskRating,
            nextReviewDate: data.nextReviewDate,
            verifiedBy: data.verifiedBy,
            verifiedAt: new Date().toISOString(),
            reviewedBy: data.verifiedBy,
            reviewedAt: new Date().toISOString(),
            ...(data.notes && {
              metadata: { verification_notes: data.notes }
            }),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to verify KYC');
      }

      return response.json() as Promise<KYCRecord>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', variables.kycId, variables.workspaceId]
      });
    },
  });
}

/**
 * Reject a KYC record
 */
export function useRejectKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kycId,
      workspaceId,
      data,
    }: {
      kycId: string;
      workspaceId: string;
      data: RejectKYCRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/kyc/${kycId}?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'rejected',
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date().toISOString(),
            metadata: { rejection_reason: data.reason },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to reject KYC');
      }

      return response.json() as Promise<KYCRecord>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', 'recent', variables.workspaceId]
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', variables.kycId, variables.workspaceId]
      });
    },
  });
}

/**
 * Delete a KYC record
 */
export function useDeleteKYCRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kycId, workspaceId }: { kycId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/kyc/${kycId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete KYC record');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'kyc', 'recent', variables.workspaceId]
      });
    },
  });
}
