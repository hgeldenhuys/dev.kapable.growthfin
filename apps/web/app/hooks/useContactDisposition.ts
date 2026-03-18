/**
 * useContactDisposition Hook - Disposition Update and Conversion Commands
 * Handles contact disposition state machine transitions (US-CRM-STATE-MACHINE T-012)
 */

import { useMutation } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';
import type { CrmContact } from '@agios/db';
import { toast } from 'sonner';

interface UpdateDispositionRequest {
  contactId: string;
  workspaceId: string;
  disposition: 'callback' | 'interested' | 'not_interested' | 'do_not_contact';
  callbackDate?: string; // ISO date string
  callbackNotes?: string;
  userId: string;
}

interface ConvertToOpportunityRequest {
  contactId: string;
  workspaceId: string;
  opportunityName: string;
  stage: string;
  amount?: number;
  closeDate?: string; // ISO date string
  userId: string;
}

/**
 * Update contact disposition (COMMAND)
 * - callback: requires callbackDate
 * - interested: can convert to opportunity
 * - not_interested: add to nurture
 * - do_not_contact: compliance block
 */
export function useUpdateDisposition() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: UpdateDispositionRequest) => {
      const response = await fetch(
        `/api/v1/crm/contacts/${data.contactId}/disposition?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disposition: data.disposition,
            callbackDate: data.callbackDate,
            callbackNotes: data.callbackNotes,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to update disposition' });
        throw new Error(error || 'Failed to update disposition');
      }

      return response.json() as Promise<CrmContact>;
    },
    onSuccess: (_data, variables) => {
      const dispositionLabels = {
        callback: 'Callback Scheduled',
        interested: 'Interested',
        not_interested: 'Not Interested',
        do_not_contact: 'Do Not Contact',
      };

      toast.success('Disposition updated', { description: dispositionLabels[variables.disposition] });

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useUpdateDisposition] Error:', error);
    },
  });
}

/**
 * Convert contact to opportunity (COMMAND)
 */
export function useConvertToOpportunity() {
  const revalidator = useRevalidator();
  return useMutation({
    mutationFn: async (data: ConvertToOpportunityRequest) => {
      const response = await fetch(
        `/api/v1/crm/contacts/${data.contactId}/convert?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityName: data.opportunityName,
            stage: data.stage,
            amount: data.amount,
            closeDate: data.closeDate,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        toast.error('Error', { description: error || 'Failed to convert to opportunity' });
        throw new Error(error || 'Failed to convert to opportunity');
      }

      return response.json();
    },
    onSuccess: (_data) => {
      toast.success('Opportunity created', { description: 'Contact successfully converted to opportunity.' });

      // Revalidate React Router loader data
      revalidator.revalidate();
    },
    onError: (error) => {
      // Error toast already shown in mutationFn
      console.error('[useConvertToOpportunity] Error:', error);
    },
  });
}
