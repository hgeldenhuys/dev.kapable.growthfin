/**
 * useLockManager Hook
 * Manages lock state and takeover logic for SDLC boards
 */

import { useState, useCallback } from "react";
import { toast } from 'sonner';
import {
  StaleLock,
  CheckpointData,
} from "../components/sdlc/CrashRecoveryDialog";

interface UseLockManagerProps {
  boardId: string;
  isStale: boolean;
  onLockTaken?: () => void;
  onLockReleased?: () => void;
}

export function useLockManager({
  boardId,
  isStale,
  onLockTaken,
  onLockReleased,
}: UseLockManagerProps) {
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [staleLock, setStaleLock] = useState<StaleLock | null>(null);
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  /**
   * Initialize recovery dialog with lock and checkpoint data
   */
  const initializeRecoveryDialog = useCallback(
    (lock: StaleLock, checkpointData: CheckpointData) => {
      setStaleLock(lock);
      setCheckpoint(checkpointData);
      setShowRecoveryDialog(true);
    },
    []
  );

  /**
   * Handle successful takeover
   */
  const handleTakeoverSuccess = useCallback(
    (newSessionId: string) => {
      setShowRecoveryDialog(false);
      if (onLockTaken) {
        onLockTaken();
      }
    },
    [onLockTaken]
  );

  /**
   * Handle takeover cancellation
   */
  const handleTakeoverCancel = useCallback(() => {
    setShowRecoveryDialog(false);
  }, []);

  /**
   * Request lock for a board
   */
  const requestLock = useCallback(async () => {
    try {
      // TODO: Implement lock request API
      toast.success('Not Implemented', { description: 'Lock request API will be implemented in the next phase' });
    } catch (error) {
      console.error("[useLockManager] Request lock error:", error);
      toast.error('Error', { description: 'Failed to request lock' });
    }
  }, []);

  /**
   * Release lock for a board
   */
  const releaseLock = useCallback(async () => {
    try {
      // TODO: Implement lock release API
      toast.success('Not Implemented', { description: 'Lock release API will be implemented in the next phase' });
    } catch (error) {
      console.error("[useLockManager] Release lock error:", error);
      toast.error('Error', { description: 'Failed to release lock' });
    }
  }, []);

  /**
   * Check for stale locks and show recovery dialog
   */
  const checkForStaleLocks = useCallback(
    (boards: any[]) => {
      // Find stale locks
      const staleBoard = boards.find(
        (b) => b.board_id === boardId && b.is_stale && b.locked
      );

      if (staleBoard && isStale) {
        // Create lock and checkpoint objects
        const lock: StaleLock = {
          session_id: staleBoard.lock_owner || "unknown",
          board_scope: staleBoard.board_id,
          locked_at: staleBoard.locked_at || new Date().toISOString(),
          heartbeat: staleBoard.last_heartbeat || new Date().toISOString(),
          stale_threshold_seconds: 300,
        };

        const checkpointData: CheckpointData = {
          stories_completed: [],
          stories_in_progress: [],
          last_updated: new Date().toISOString(),
        };

        initializeRecoveryDialog(lock, checkpointData);
      }
    },
    [boardId, isStale, initializeRecoveryDialog]
  );

  return {
    // Dialog state
    showRecoveryDialog,
    setShowRecoveryDialog,
    staleLock,
    checkpoint,

    // Dialog initialization
    initializeRecoveryDialog,

    // Callbacks
    handleTakeoverSuccess,
    handleTakeoverCancel,

    // Lock operations
    requestLock,
    releaseLock,
    checkForStaleLocks,
  };
}
