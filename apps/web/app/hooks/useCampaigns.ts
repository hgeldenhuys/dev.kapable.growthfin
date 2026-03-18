/**
 * useCampaigns Hook
 * Campaign management data hooks using TanStack Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Campaign,
  CampaignMessage,
  CampaignRecipient,
  CampaignStats,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CreateMessageRequest,
  CalculateAudienceRequest,
  CalculateAudienceResponse,
  PreviewMessageResponse,
} from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface UseCampaignsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Fetch all campaigns for a workspace
 */
export function useCampaigns({ workspaceId, enabled = true }: UseCampaignsOptions) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'list', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaigns?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data : []) as Campaign[];
    },
    enabled: enabled && !!workspaceId,
  });
}

/**
 * Get a single campaign by ID
 */
export function useCampaign(campaignId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'detail', campaignId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign: ${response.statusText}`);
      }
      return response.json() as Promise<Campaign>;
    },
    enabled: !!campaignId && !!workspaceId,
  });
}

/**
 * Get campaign stats
 */
export function useCampaignStats(campaignId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'stats', campaignId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/stats?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign stats: ${response.statusText}`);
      }
      return response.json() as Promise<CampaignStats>;
    },
    enabled: !!campaignId && !!workspaceId,
  });
}

/**
 * Get campaign messages
 */
export function useCampaignMessages(campaignId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'messages', campaignId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/messages?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign messages: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.messages || []) as CampaignMessage[];
    },
    enabled: !!campaignId && !!workspaceId,
  });
}

/**
 * Get campaign recipients
 */
export function useCampaignRecipients(
  campaignId: string,
  workspaceId: string,
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'recipients', campaignId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/recipients?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign recipients: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.recipients || []) as CampaignRecipient[];
    },
    enabled: !!campaignId && !!workspaceId,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Create a new campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCampaignRequest) => {
      const response = await fetch(`/api/v1/crm/campaigns?workspaceId=${data.workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create campaign');
      }

      return response.json() as Promise<Campaign>;
    },
    onSuccess: (data, variables) => {
      // Invalidate campaigns list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
    },
  });
}

/**
 * Update a campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      data,
    }: {
      campaignId: string;
      workspaceId: string;
      data: UpdateCampaignRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}?workspaceId=${workspaceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update campaign');
      }

      return response.json() as Promise<Campaign>;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific campaign
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'detail', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Delete a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, workspaceId }: { campaignId: string; workspaceId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete campaign');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
    },
  });
}

/**
 * Create a campaign message
 */
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: CreateMessageRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${data.campaignId}/messages?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create message');
      }

      return response.json() as Promise<CampaignMessage>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'messages', variables.data.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Calculate audience size for given filters
 */
export function useCalculateAudience() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      data,
    }: {
      campaignId: string;
      workspaceId: string;
      data: CalculateAudienceRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/calculate-audience?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to calculate audience');
      }

      return response.json() as Promise<CalculateAudienceResponse>;
    },
  });
}

/**
 * Preview message with personalization for a contact
 */
export function usePreviewMessage() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      contactId,
      workspaceId,
    }: {
      campaignId: string;
      contactId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/preview-message?contactId=${contactId}&workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to preview message');
      }

      return response.json() as Promise<PreviewMessageResponse>;
    },
  });
}

/**
 * Activate campaign
 */
export function useActivateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      userId,
    }: {
      campaignId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(`/api/v1/crm/campaigns/${campaignId}/activate?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Failed to activate campaign';
        try {
          const parsed = JSON.parse(errorText);
          errorMsg = parsed.error || parsed.message || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'detail', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Pause campaign
 */
export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      userId,
    }: {
      campaignId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(`/api/v1/crm/campaigns/${campaignId}/pause?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to pause campaign');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'detail', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Resume campaign
 */
export function useResumeCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      userId,
    }: {
      campaignId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(`/api/v1/crm/campaigns/${campaignId}/resume?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to resume campaign');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'detail', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Cancel campaign
 */
export function useCancelCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      userId,
    }: {
      campaignId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(`/api/v1/crm/campaigns/${campaignId}/cancel?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to cancel campaign');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'list', variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'detail', variables.campaignId, variables.workspaceId],
      });
    },
  });
}
