/**
 * useCallDisposition Hook
 * Mutation hook for saving call dispositions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

interface CallDispositionRequest {
  workspaceId: string;
  leadId: string;
  type: 'call';
  disposition: 'ntu' | 'rpc_interested' | 'rpc_not_interested' | 'wpc' | 'npc' | 'callback_scheduled';
  notes?: string;
  callbackDate?: string;
  duration?: number;
  customFields?: {
    nextAction?: string;
  };
}

interface CallDispositionResponse {
  activity: {
    id: string;
    leadId: string;
    type: string;
    disposition: string;
    notes?: string;
    callbackDate?: string;
    createdAt: string;
  };
  lead: {
    id: string;
    status: string;
    callbackDate?: string;
  };
}

/**
 * Save call disposition and update lead status
 */
export function useCallDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CallDispositionRequest): Promise<CallDispositionResponse> => {
      const response = await fetch(
        `/api/v1/crm/activities?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: data.leadId,
            type: data.type,
            disposition: data.disposition,
            notes: data.notes,
            callbackDate: data.callbackDate,
            duration: data.duration,
            customFields: data.customFields,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(`Failed to save disposition: ${errorText}`);
        throw new Error(errorText || 'Failed to save call disposition');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate call list to reflect updated lead status
      queryClient.invalidateQueries({
        queryKey: ['crm', 'agent', 'call-list', variables.workspaceId],
      });

      // Invalidate lead detail to show new activity
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lead-detail', variables.leadId, variables.workspaceId],
      });

      // Invalidate activities list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'activities', variables.workspaceId],
      });
    },
  });
}
