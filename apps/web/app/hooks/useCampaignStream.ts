/**
 * useCampaignStream Hook
 * Subscribe to real-time campaign updates via SSE
 */

import { useEffect, useState, useRef } from 'react';
import type { Campaign } from '~/types/crm';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

export interface CampaignStreamData {
  campaign: Campaign;
  timestamp: string;
}

interface UseCampaignStreamOptions {
  campaignId: string;
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Subscribe to real-time campaign updates via SSE
 */
export function useCampaignStream({ campaignId, workspaceId, enabled = true }: UseCampaignStreamOptions) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!enabled || !campaignId || !workspaceId) {
      return;
    }

    mountedRef.current = true;

    // Initial fetch
    const fetchInitial = async () => {
      try {
        const response = await fetch(
          `/api/v1/crm/campaigns/${campaignId}?workspaceId=${workspaceId}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch campaign: ${response.statusText}`);
        }
        const data = await response.json();
        if (mountedRef.current) {
          setCampaign(data);
        }
      } catch (err) {
        console.error('[useCampaignStream] Initial fetch error:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    fetchInitial();

    // Setup SSE stream for updates
    const streamUrl = `/api/v1/crm/campaigns/${campaignId}/stream?workspaceId=${workspaceId}`;
    console.log('[useCampaignStream] Connecting to:', streamUrl);

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      console.log('[useCampaignStream] Connected to campaign stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data: CampaignStreamData = JSON.parse(event.data);
        console.log('[useCampaignStream] Received update:', data);
        setCampaign(data.campaign);
      } catch (err) {
        console.error('[useCampaignStream] Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      if (!mountedRef.current) return;
      console.error('[useCampaignStream] SSE connection error:', err);
      setIsConnected(false);
      setError(new Error('SSE connection failed'));
      eventSource.close();
    };

    // Cleanup
    return () => {
      mountedRef.current = false;
      console.log('[useCampaignStream] Cleaning up campaign stream');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [campaignId, workspaceId, enabled]);

  return { campaign, isConnected, error };
}
