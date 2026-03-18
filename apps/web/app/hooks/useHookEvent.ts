/**
 * useHookEvent Hook
 *
 * Fetch a single hook event by ID using TanStack Query
 */

import { useQuery } from '@tanstack/react-query';

// Use empty string for relative URLs in browser (proxied through React Router)
// On server-side (SSR), use API_URL from environment
// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend // Server: use env variable

export interface HookEventPayload {
  event: any;
  conversation: any;
  timestamp: string;
}

export interface HookEvent {
  id: string;
  projectId: string;
  sessionId: string;
  eventName: string;
  toolName?: string;
  payload: HookEventPayload;
  processed: boolean;
  createdAt: string;
  processedAt: string | null;
}

export function useHookEvent(eventId: string | undefined) {
  return useQuery<HookEvent>({
    queryKey: ['hook-event', eventId],
    queryFn: async () => {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const response = await fetch(`/api/v1/hook-events/${eventId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error(`Failed to fetch event: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!eventId,
    retry: 1,
    staleTime: 60000, // Events don't change, cache for 1 minute
  });
}
