/**
 * useCampaignScheduling Hook
 * React Query hooks for campaign scheduling, recurrence, and triggers
 *
 * Backend routes:
 *   /api/v1/crm/campaign-schedules     (flat, workspaceId as query param)
 *   /api/v1/crm/campaign-recurrences   (flat, workspaceId as query param)
 *   /api/v1/crm/campaign-triggers      (flat, workspaceId as query param)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecurrenceConfiguration } from '~/components/crm/campaigns/RecurrenceConfig';
import type { TriggerConfiguration } from '~/components/crm/campaigns/TriggerBuilder';
import type { ScheduledCampaign } from '~/components/crm/campaigns/ScheduledCampaignsList';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

// Schedule Interfaces
interface ScheduleCampaignRequest {
  campaignId: string;
  workspaceId: string;
  userId: string;
  scheduledAt: string; // ISO timestamp
  timezone: string;
  sendNotification?: boolean;
}

interface ScheduleCampaignResponse {
  scheduleId: string;
  campaignId: string;
  scheduledAt: string;
  timezone: string;
  status: string;
  createdAt: string;
}

// Recurrence Interfaces
interface CreateRecurrenceRequest {
  campaignId: string;
  workspaceId: string;
  userId: string;
  pattern: string;
  time: string;
  timezone: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endCondition: string;
  maxExecutions?: number;
  endDate?: Date;
}

// Trigger Interfaces
interface CreateTriggerRequest {
  campaignId: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  triggerEvent: string;
  conditions: {
    logic: string;
    conditions: Array<{
      field: string;
      operator: string;
      value: string | number;
    }>;
  };
  maxTriggersPerDay: number;
}

/**
 * Get all scheduled campaigns for a workspace
 */
export function useScheduledCampaigns(workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'schedules', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-schedules?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch scheduled campaigns: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.schedules || []) as ScheduledCampaign[];
    },
    enabled: !!workspaceId,
    refetchInterval: 60000,
  });
}

/**
 * Get schedule for a specific campaign (by schedule ID)
 */
export function useCampaignSchedule(scheduleId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'schedule', scheduleId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-schedules/${scheduleId}?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch campaign schedule: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!scheduleId && !!workspaceId,
  });
}

/**
 * Schedule a campaign for one-time execution
 */
export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleCampaignRequest) => {
      const response = await fetch(
        `/api/v1/crm/campaign-schedules?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: data.campaignId,
            workspaceId: data.workspaceId,
            scheduledAt: data.scheduledAt,
            timezone: data.timezone,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to schedule campaign');
      }

      return response.json() as Promise<ScheduleCampaignResponse>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Update/reschedule a campaign
 */
export function useRescheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleCampaignRequest & { scheduleId: string }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-schedules/${data.scheduleId}?workspaceId=${data.workspaceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledAt: data.scheduledAt,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to reschedule campaign');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Cancel a scheduled campaign
 */
export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      workspaceId,
      userId,
    }: {
      scheduleId: string;
      workspaceId: string;
      userId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-schedules/${scheduleId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to cancel schedule');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Create recurring campaign schedule
 */
export function useCreateRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRecurrenceRequest) => {
      const response = await fetch(
        `/api/v1/crm/campaign-recurrences?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: data.campaignId,
            workspaceId: data.workspaceId,
            pattern: data.pattern,
            time: data.time,
            timezone: data.timezone,
            daysOfWeek: data.daysOfWeek,
            dayOfMonth: data.dayOfMonth,
            endCondition: data.endCondition,
            maxExecutions: data.maxExecutions,
            endDate: data.endDate,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create recurrence');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Pause a recurring campaign
 */
export function usePauseRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recurrenceId,
      workspaceId,
    }: {
      recurrenceId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-recurrences/${recurrenceId}/pause?workspaceId=${workspaceId}`,
        {
          method: 'PATCH',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to pause recurrence');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Resume a paused recurring campaign
 */
export function useResumeRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recurrenceId,
      workspaceId,
    }: {
      recurrenceId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-recurrences/${recurrenceId}/resume?workspaceId=${workspaceId}`,
        {
          method: 'PATCH',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to resume recurrence');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'schedules', variables.workspaceId],
      });
    },
  });
}

/**
 * Get all triggers for a campaign
 */
export function useCampaignTriggers(campaignId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'campaigns', 'triggers', campaignId, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/campaign-triggers?workspaceId=${workspaceId}&campaignId=${campaignId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign triggers: ${response.statusText}`);
      }
      const data = await response.json();
      return data.triggers || [];
    },
    enabled: !!campaignId && !!workspaceId,
  });
}

/**
 * Create campaign trigger
 */
export function useCreateTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTriggerRequest) => {
      const response = await fetch(
        `/api/v1/crm/campaign-triggers?workspaceId=${data.workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: data.campaignId,
            workspaceId: data.workspaceId,
            name: data.name,
            description: data.description,
            triggerEvent: data.triggerEvent,
            conditions: data.conditions,
            maxTriggersPerLeadPerDay: data.maxTriggersPerDay,
            userId: data.userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create trigger');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'triggers', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Delete campaign trigger
 */
export function useDeleteTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      triggerId,
      campaignId,
      workspaceId,
    }: {
      triggerId: string;
      campaignId: string;
      workspaceId: string;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-triggers/${triggerId}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete trigger');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'campaigns', 'triggers', variables.campaignId, variables.workspaceId],
      });
    },
  });
}

/**
 * Preview trigger matches (how many leads would trigger)
 */
export function usePreviewTrigger() {
  return useMutation({
    mutationFn: async ({
      triggerId,
      workspaceId,
    }: {
      triggerId: string;
      workspaceId: string;
      config?: TriggerConfiguration;
    }) => {
      const response = await fetch(
        `/api/v1/crm/campaign-triggers/${triggerId}/preview?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to preview trigger');
      }

      return response.json() as Promise<{ count: number; leads: any[] }>;
    },
  });
}
