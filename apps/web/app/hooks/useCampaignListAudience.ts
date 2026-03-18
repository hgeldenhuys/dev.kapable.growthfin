/**
 * useCampaignListAudience Hook
 * Calculate campaign audience from a list
 */

import { useMutation } from '@tanstack/react-query';

interface CalculateListAudienceRequest {
  workspaceId: string;
  userId: string;
  listId: string;
  recipientSelection: 'all' | 'filter';
  filters?: any[];
}

interface CalculateListAudienceResponse {
  count: number;
  snapshotId?: string;
}

export function useCampaignListAudience() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      workspaceId,
      data,
    }: {
      campaignId: string;
      workspaceId: string;
      data: CalculateListAudienceRequest;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/calculate-list-audience?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to calculate list audience');
      }

      return response.json() as Promise<CalculateListAudienceResponse>;
    },
  });
}
