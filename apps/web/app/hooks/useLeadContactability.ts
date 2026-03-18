/**
 * useLeadContactability Hook - Contact Attempt and Blacklist Commands
 * Handles lead contactability state machine transitions (US-CRM-STATE-MACHINE T-010)
 */

import { useMutation } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';
import type { CrmLead } from '@agios/db';
import { toast } from 'sonner';

interface RecordContactAttemptRequest {
  leadId: string;
  workspaceId: string;
  outcome: 'no_party' | 'wrong_party' | 'right_party';
  notes?: string;
  userId: string;
}

interface BlacklistLeadRequest {
  leadId: string;
  workspaceId: string;
  reason: 'wrong_party' | 'max_attempts' | 'compliance' | 'requested';
  notes?: string;
  userId: string;
}

/**
 * Record a contact attempt (COMMAND)
 * - no_party: increment attempts, blacklist if >= 3
 * - wrong_party: immediate blacklist
 * - right_party: proceed to qualification
 */
export function useRecordContactAttempt() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: RecordContactAttemptRequest) => {
      const response = await fetch(
        `/api/v1/crm/leads/${data.leadId}/contact-attempt?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: data.outcome,
            notes: data.notes,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to record contact attempt' });
        throw new Error(error || 'Failed to record contact attempt');
      }

      return response.json() as Promise<CrmLead>;
    },
    onSuccess: (_data, variables) => {
      const outcomeLabels = {
        no_party: 'No Party',
        wrong_party: 'Wrong Party',
        right_party: 'Right Party',
      };

      toast.success('Contact attempt recorded', { description: `Outcome: ${outcomeLabels[variables.outcome]}` });

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useRecordContactAttempt] Error:', error);
    },
  });
}

/**
 * Blacklist a lead (COMMAND)
 */
export function useBlacklistLead() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: BlacklistLeadRequest) => {
      const response = await fetch(
        `/api/v1/crm/leads/${data.leadId}/blacklist?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: data.reason,
            notes: data.notes,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to blacklist lead' });
        throw new Error(error || 'Failed to blacklist lead');
      }

      return response.json() as Promise<CrmLead>;
    },
    onSuccess: () => {
      toast.success('Lead blacklisted', { description: 'The lead has been added to the blacklist.' });

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useBlacklistLead] Error:', error);
    },
  });
}
