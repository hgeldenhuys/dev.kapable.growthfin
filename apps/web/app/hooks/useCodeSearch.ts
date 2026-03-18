/**
 * Code Search Hook
 * Manages ripgrep-based code search with SSE streaming
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

export interface SearchParams {
  query: string;
  caseSensitive?: boolean;
  filePattern?: string;
  contextLines?: number;
  maxResults?: number;
}

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface SearchStats {
  totalMatches: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface SearchProgress {
  filesScanned: number;
}

interface SSEProgressEvent {
  type: 'progress';
  filesScanned: number;
}

interface SSEResultEvent {
  type: 'result';
  data: SearchResult;
}

interface SSECompleteEvent {
  type: 'complete';
  totalMatches: number;
  executionTimeMs: number;
  truncated: boolean;
}

interface SSEErrorEvent {
  type: 'error';
  error: string;
  message: string;
}

type SSEEvent = SSEProgressEvent | SSEResultEvent | SSECompleteEvent | SSEErrorEvent;

export function useCodeSearch(workspaceId: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cancel ongoing search
  const cancel = useCallback(() => {
    cleanup();
    setIsSearching(false);
  }, [cleanup]);

  // Perform search
  const search = useCallback(async (params: SearchParams) => {
    // Cancel any existing search
    cleanup();

    // Reset state
    setResults([]);
    setError(null);
    setStats(null);
    setProgress(null);
    setIsSearching(true);

    try {
      // Create abort controller for the POST request
      abortControllerRef.current = new AbortController();

      // Step 1: POST to create search
      const response = await fetch(
        `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/code-search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(params),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));

        // Handle specific error cases
        if (response.status === 503) {
          throw new Error(errorData.message || 'Code search is unavailable. Please ensure CLI is running and connected to this workspace.');
        } else if (response.status === 429) {
          throw new Error(errorData.message || 'Too many searches. Please wait a moment and try again.');
        } else if (response.status === 400) {
          throw new Error(errorData.message || 'Invalid search parameters');
        } else {
          throw new Error(errorData.message || `Search failed with status ${response.status}`);
        }
      }

      const { searchId, sseUrl } = await response.json();

      // Step 2: Establish SSE connection
      const fullSseUrl = sseUrl.startsWith('http') ? sseUrl : `${API_BASE}${sseUrl}`;
      const eventSource = new EventSource(fullSseUrl);
      eventSourceRef.current = eventSource;

      let searchCompleted = false;

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'progress':
              setProgress({ filesScanned: data.filesScanned });
              break;

            case 'result':
              setResults((prev) => [...prev, data.data]);
              break;

            case 'complete':
              setStats({
                totalMatches: data.totalMatches,
                executionTimeMs: data.executionTimeMs,
                truncated: data.truncated,
              });
              setIsSearching(false);
              searchCompleted = true;
              cleanup();
              break;

            case 'error':
              setError(data.message || data.error);
              setIsSearching(false);
              searchCompleted = true;
              cleanup();
              break;
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        if (!searchCompleted) {
          setError('Connection lost. Search may have timed out.');
          setIsSearching(false);
        }
        cleanup();
      };

      // Set a 15-second timeout
      setTimeout(() => {
        if (isSearching && !searchCompleted) {
          setError('Search timed out after 15 seconds. Try a more specific query.');
          setIsSearching(false);
          cleanup();
        }
      }, 15000);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Search was cancelled, ignore
        return;
      }
      setError(err.message || 'An unexpected error occurred');
      setIsSearching(false);
      cleanup();
    }
  }, [workspaceId, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    search,
    cancel,
    results,
    isSearching,
    error,
    stats,
    progress,
  };
}
