/**
 * useOnboardingProgress Hook
 * Fetches onboarding progress counts from the CRM API.
 */

import { useQuery } from '@tanstack/react-query';

export interface OnboardingProgress {
  leads: number;
  contacts: number;
  templates: number;
  campaigns: number;
  activities: number;
  opportunities: number;
}

export function useOnboardingProgress(workspaceId: string) {
  return useQuery<OnboardingProgress>({
    queryKey: ['onboarding-progress', workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/onboarding/progress?workspaceId=${workspaceId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch onboarding progress');
      return res.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    enabled: !!workspaceId,
  });
}
