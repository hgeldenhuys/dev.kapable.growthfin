/**
 * useSDLC Hook
 * React Query hooks for SDLC data with SSE real-time updates
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface SDLCSnapshot {
  stories: {
    todo: Story[];
    ready: Story[];
    inProgress: Story[];
    review: Story[];
    done: Story[];
    backlog: Story[];
    blocked: Story[];
    archived: Story[];
  };
  epics: {
    active: Epic[];
    planned: Epic[];
    completed: Epic[];
  };
  kanban: {
    board: KanbanBoard | null;
    wipLimits: Record<string, any> | null;
    boardHistory: any[];
  };
  knowledgeGraph: {
    entities: {
      components: any[];
      decisions: any[];
      understandings: any[];
      values: any[];
      purposes: any[];
    };
    relations: any[];
  };
  coherence: {
    latest: any;
    historical: any[];
  };
  retrospectives: Retrospective[];
  backlog: {
    improvements: any[];
    experiments: any[];
    technicalDebt: any[];
  };
  prds: PRD[];
  metadata: {
    timestamp: string;
    totalFiles: number;
    categories: Record<string, number>;
  };
}

export interface Story {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  points?: number;
  epic?: string;
  [key: string]: any;
}

export interface Epic {
  id: string;
  title: string;
  status?: string;
  [key: string]: any;
}

export interface KanbanBoard {
  [key: string]: any;
}

export interface Retrospective {
  [key: string]: any;
}

export interface PRD {
  id: string;
  title: string;
  [key: string]: any;
}

export interface SDLCStreamEvent {
  type: 'sdlc:file-updated' | 'sdlc:file-created' | 'sdlc:file-deleted' | 'sdlc:snapshot-complete';
  category: 'stories' | 'epics' | 'kanban' | 'knowledgeGraph' | 'coherence' | 'retrospectives' | 'backlog' | 'prds' | 'unknown';
  path: string;
  content?: any;
  timestamp: string;
}

/**
 * Hook to connect to SSE stream for real-time SDLC updates
 */
export function useSDLCStream(sessionId?: string) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const url = sessionId
      ? `/api/v1/sdlc/stream?sessionId=${sessionId}`
      : `/api/v1/sdlc/stream`;

    console.log('[useSDLC] Connecting to SSE stream:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useSDLC] SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[useSDLC] Received SSE event:', data.type, data.path);

        // Invalidate query to trigger refetch when file changes detected
        queryClient.invalidateQueries({ queryKey: ['sdlc', 'snapshot'] });
      } catch (error) {
        console.error('[useSDLC] Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useSDLC] SSE connection error:', error);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      console.log('[useSDLC] Closing SSE connection');
      eventSource.close();
    };
  }, [sessionId, queryClient]);

  return eventSourceRef;
}

/**
 * Fetch SDLC snapshot with SSE real-time updates
 * No polling - uses SSE for instant updates
 */
export function useSDLCSnapshot() {
  // Connect to SSE stream for real-time updates
  useSDLCStream();

  const query = useQuery({
    queryKey: ['sdlc', 'snapshot'],
    queryFn: async (): Promise<SDLCSnapshot> => {
      const response = await fetch(`/api/v1/sdlc/snapshot`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch SDLC snapshot');
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (data stays fresh via SSE)
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    // No refetchInterval - using SSE for real-time updates
  });

  return query;
}

/**
 * Get stories by status category
 */
export function useStories(status?: keyof SDLCSnapshot['stories']) {
  const { data, ...rest } = useSDLCSnapshot();

  if (!data) {
    return { stories: [], ...rest };
  }

  if (status) {
    return { stories: data.stories[status] || [], ...rest };
  }

  // Return all stories flattened
  const allStories = Object.values(data.stories).flat();
  return { stories: allStories, ...rest };
}

/**
 * Get epics by status
 */
export function useEpics(status?: keyof SDLCSnapshot['epics']) {
  const { data, ...rest } = useSDLCSnapshot();

  if (!data) {
    return { epics: [], ...rest };
  }

  if (status) {
    return { epics: data.epics[status] || [], ...rest };
  }

  // Return all epics flattened
  const allEpics = Object.values(data.epics).flat();
  return { epics: allEpics, ...rest };
}

/**
 * Get kanban board data
 */
export function useKanbanBoard() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    board: data?.kanban?.board || null,
    wipLimits: data?.kanban?.wipLimits || {},
    boardHistory: data?.kanban?.boardHistory || [],
    ...rest,
  };
}

/**
 * Get knowledge graph data
 */
export function useKnowledgeGraph() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    entities: data?.knowledgeGraph?.entities || {
      components: [],
      decisions: [],
      understandings: [],
      values: [],
      purposes: [],
    },
    relations: data?.knowledgeGraph?.relations || [],
    ...rest,
  };
}

/**
 * Get coherence metrics
 */
export function useCoherenceMetrics() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    latest: data?.coherence?.latest || null,
    historical: data?.coherence?.historical || [],
    ...rest,
  };
}

/**
 * Get retrospectives
 */
export function useRetrospectives() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    retrospectives: data?.retrospectives || [],
    ...rest,
  };
}

/**
 * Get backlog items
 */
export function useBacklog() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    improvements: data?.backlog?.improvements || [],
    experiments: data?.backlog?.experiments || [],
    technicalDebt: data?.backlog?.technicalDebt || [],
    ...rest,
  };
}

/**
 * Get PRDs
 */
export function usePRDs() {
  const { data, ...rest } = useSDLCSnapshot();

  return {
    prds: data?.prds || [],
    ...rest,
  };
}
