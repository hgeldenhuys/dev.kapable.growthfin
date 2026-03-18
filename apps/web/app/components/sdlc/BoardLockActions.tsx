/**
 * BoardLockActions Component
 * Action buttons for board lock management based on current state
 */

import { useState } from "react";
import { Button } from "../ui/button";
import { Lock, Unlock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from 'sonner';

interface BoardLockActionsProps {
  board_id: string;
  locked: boolean;
  is_stale: boolean;
  lock_owner: string | null;
  onTakeoverClick?: () => void;
}

export function BoardLockActions({
  board_id,
  locked,
  is_stale,
  lock_owner,
  onTakeoverClick,
}: BoardLockActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  // TODO: These will be connected to actual lock management logic
  const handleRequestLock = async () => {
    setIsLoading(true);
    console.log("Request lock for board:", board_id);
    try {
      // TODO: Implement request lock API
      toast.success('Not Implemented', { description: 'Lock request API will be implemented in the next phase' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseLock = async () => {
    setIsLoading(true);
    console.log("Release lock for board:", board_id);
    try {
      // TODO: Implement release lock API
      toast.success('Not Implemented', { description: 'Lock release API will be implemented in the next phase' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeOver = () => {
    console.log("Take over stale lock for board:", board_id);
    if (onTakeoverClick) {
      onTakeoverClick();
    }
  };

  // Available board - show request lock button
  if (!locked) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleRequestLock}
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {!isLoading && <Lock className="h-4 w-4 mr-2" />}
        Request Lock
      </Button>
    );
  }

  // Stale lock - show take over button
  if (is_stale) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-orange-600 hover:text-orange-700"
        onClick={handleTakeOver}
        disabled={isLoading}
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Take Over
      </Button>
    );
  }

  // Locked by current session - show release button
  // TODO: Check if current session owns the lock
  const isMyLock = false; // Will be determined by session context

  if (isMyLock) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleReleaseLock}
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {!isLoading && <Unlock className="h-4 w-4 mr-2" />}
        Release Lock
      </Button>
    );
  }

  // Locked by another active session - disabled
  return (
    <Button size="sm" variant="ghost" disabled>
      Locked
    </Button>
  );
}
