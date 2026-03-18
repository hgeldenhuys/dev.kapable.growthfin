/**
 * useOpportunityOutcome Hook - Stage Advance and Close Commands
 * Handles opportunity outcome state machine transitions (US-CRM-STATE-MACHINE T-014)
 */

import { useMutation } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';
import type { CrmOpportunity } from '@agios/db';
import { toast } from 'sonner';

interface AdvanceStageRequest {
  opportunityId: string;
  workspaceId: string;
  stage: string;
  userId: string;
}

interface CloseOpportunityRequest {
  opportunityId: string;
  workspaceId: string;
  outcome: 'won' | 'lost';
  amount?: number;
  lostReason?: string;
  notes?: string;
  userId: string;
}

/**
 * Advance opportunity to next stage (COMMAND)
 */
export function useAdvanceStage() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: AdvanceStageRequest) => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${data.opportunityId}/advance?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: data.stage,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to advance opportunity' });
        throw new Error(error || 'Failed to advance opportunity');
      }

      return response.json() as Promise<CrmOpportunity>;
    },
    onSuccess: (_data, variables) => {
      toast.success('Stage advanced', { description: `Opportunity moved to ${variables.stage}` });

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useAdvanceStage] Error:', error);
    },
  });
}

/**
 * Close opportunity as won or lost (COMMAND)
 */
export function useCloseOpportunity() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: CloseOpportunityRequest) => {
      const response = await fetch(
        `/api/v1/crm/opportunities/${data.opportunityId}/close?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: data.outcome,
            amount: data.amount,
            lostReason: data.lostReason,
            notes: data.notes,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to close opportunity' });
        throw new Error(error || 'Failed to close opportunity');
      }

      return response.json() as Promise<CrmOpportunity>;
    },
    onSuccess: (_data, variables) => {
      const outcomeLabels = {
        won: 'Opportunity Won! 🎉',
        lost: 'Opportunity Closed as Lost',
      };

      toast.success('outcomeLabels[variables.outcome]');

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useCloseOpportunity] Error:', error);
    },
  });
}
