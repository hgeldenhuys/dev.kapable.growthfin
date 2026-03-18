/**
 * useObserverMode Hook
 * Manages board lock status and observer mode state
 */

import { useState, useCallback, useEffect } from "react";

interface LockStatus {
  locked: boolean;
  canWrite: boolean;
  lockOwner: string | null;
  lockOwnerId: string | null;
  lockOwnerHeartbeat: string | null;
  lockOwnerStatus: 'active' | 'warning' | 'stale' | null;
}

interface UseObserverModeReturn {
  isObserverMode: boolean;
  lockStatus: LockStatus | null;
  isLoading: boolean;
  error: string | null;
  checkLockStatus: () => Promise<void>;
}

/**
 * Hook to manage observer mode state
 * Fetches lock status from API and tracks observer mode
 */
export function useObserverMode(boardId: string): UseObserverModeReturn {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkLockStatus = useCallback(async () => {
    try {
      setError(null);
      // Client-side code MUST use proxy routes (no API_URL prefix)
      const response = await fetch(
        `/api/v1/sdlc/boards/${boardId}/lock-status`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: LockStatus = await response.json();
      setLockStatus(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useObserverMode] Error checking lock status:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    checkLockStatus();
  }, [boardId, checkLockStatus]);

  return {
    isObserverMode: lockStatus?.locked ?? false,
    lockStatus,
    isLoading,
    error,
    checkLockStatus,
  };
}
