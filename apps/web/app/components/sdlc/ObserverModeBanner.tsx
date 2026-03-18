/**
 * Observer Mode Banner Component
 * Displays when a board is locked, showing read-only access state
 * Auto-refreshes lock status every 5 seconds
 */

import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Lock, RefreshCw } from "lucide-react";
import { toast } from 'sonner';

interface LockStatus {
  locked: boolean;
  canWrite: boolean;
  lockOwner: string | null;
  lockOwnerId: string | null;
  lockOwnerHeartbeat: string | null;
  lockOwnerStatus: 'active' | 'warning' | 'stale' | null;
}

interface ObserverModeBannerProps {
  boardId: string;
  onLockStatusChange?: (locked: boolean) => void;
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const secondsAgo = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (secondsAgo < 60) {
    return "just now";
  } else if (secondsAgo < 3600) {
    const minutes = Math.floor(secondsAgo / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (secondsAgo < 86400) {
    const hours = Math.floor(secondsAgo / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(secondsAgo / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

/**
 * Get status badge color
 */
function getStatusColor(status: string | null): string {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'stale':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function ObserverModeBanner({
  boardId,
  onLockStatusChange,
}: ObserverModeBannerProps) {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Fetch lock status from API
   */
  const fetchLockStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `/api/v1/sdlc/boards/${boardId}/lock-status`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: LockStatus = await response.json();
      setLockStatus(data);
      onLockStatusChange?.(data.locked);

      // Show toast if lock was just released
      if (lockStatus?.locked && !data.locked) {
        toast.success('Board Unlocked', { description: 'Board is now available for editing', duration: 3000 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ObserverModeBanner] Error fetching lock status:', message);
      setError(message);
      toast.error('Error', { description: `Failed to check lock status: ${message}` });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [boardId, lockStatus?.locked, onLockStatusChange]);

  /**
   * Handle manual refresh
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchLockStatus();
  }, [fetchLockStatus]);

  /**
   * Set up auto-refresh interval (5 seconds)
   */
  useEffect(() => {
    // Initial fetch
    fetchLockStatus();

    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchLockStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [boardId, fetchLockStatus]);

  if (isLoading) {
    return null;
  }

  if (!lockStatus?.locked) {
    return null;
  }

  // Board is locked - show observer mode banner
  const lastActive = lockStatus.lockOwnerHeartbeat
    ? formatRelativeTime(lockStatus.lockOwnerHeartbeat)
    : "unknown";

  const statusColor = getStatusColor(lockStatus.lockOwnerStatus);

  return (
    <Alert className="sticky top-0 z-50 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-100">
        Observer Mode - Read Only
      </AlertTitle>
      <AlertDescription className="text-yellow-800 dark:text-yellow-200 mt-2">
        <div className="space-y-2">
          <div>
            Board is locked by session <strong>{lockStatus.lockOwner}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              Last active: <strong>{lastActive}</strong>
              {lockStatus.lockOwnerStatus && (
                <span className={`ml-2 font-medium ${statusColor}`}>
                  ({lockStatus.lockOwnerStatus})
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-yellow-600 text-yellow-600 hover:bg-yellow-100 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-900"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </>
              )}
            </Button>
          </div>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              Error: {error}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
