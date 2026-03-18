/**
 * CrashRecoveryDialog Component
 * Dialog for taking over a stale/crashed session with full context
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from 'sonner';

export interface StaleLock {
  session_id: string;
  board_scope: string;
  locked_at: string;
  heartbeat: string;
  stale_threshold_seconds: number;
  stale_duration_ms?: number;
}

export interface CheckpointData {
  stories_completed: string[];
  stories_in_progress: string[];
  last_updated: string;
}

interface CrashRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staleLock: StaleLock;
  checkpoint: CheckpointData;
  onTakeover?: (newSessionId: string) => void;
  onCancel?: () => void;
}

export function CrashRecoveryDialog({
  open,
  onOpenChange,
  staleLock,
  checkpoint,
  onTakeover,
  onCancel,
}: CrashRecoveryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const staleDuration = staleLock.stale_duration_ms
    ? formatDistanceToNow(
        new Date(Date.now() - staleLock.stale_duration_ms),
        { addSuffix: true }
      )
    : "unknown";

  const lockAge = formatDistanceToNow(new Date(staleLock.locked_at), {
    addSuffix: true,
  });

  const handleTakeover = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/sdlc/locks/takeover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_scope: staleLock.board_scope,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error('Takeover Failed', { description: error.message || "Failed to take over the stale lock" });
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        toast.error('Takeover Failed', { description: data.message || "Failed to take over the stale lock" });
        setIsLoading(false);
        return;
      }

      // Success!
      toast.success('Session Recovered', { description: `Successfully took over the stale session. New session ID: ${data.new_session_id.slice(0, 8)}...` });

      // Call callback if provided
      if (onTakeover) {
        onTakeover(data.new_session_id);
      }

      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error("[CrashRecoveryDialog] Takeover error:", error);
      toast.error('Error', { description: 'An error occurred while taking over the session. Please try again.' });
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0" />
            <div>
              <DialogTitle>Stale Session Detected</DialogTitle>
              <DialogDescription>
                A previous session appears to have crashed
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Details */}
          <div className="space-y-3 rounded-lg bg-orange-50 p-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Session ID
              </p>
              <p className="text-sm font-mono text-gray-900">
                {staleLock.session_id}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Last Heartbeat
              </p>
              <p className="text-sm text-gray-900">{staleDuration}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Lock Age
              </p>
              <p className="text-sm text-gray-900">{lockAge}</p>
            </div>
          </div>

          {/* Checkpoint Summary */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              Last Checkpoint
            </p>
            <div className="space-y-2 text-sm">
              {/* Completed Stories */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Completed ({checkpoint.stories_completed.length})
                  </Badge>
                </div>
                {checkpoint.stories_completed.length > 0 ? (
                  <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    {checkpoint.stories_completed.map((story) => (
                      <li key={story} className="text-xs">
                        {story}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    No completed stories
                  </p>
                )}
              </div>

              {/* In Progress Stories */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    In Progress ({checkpoint.stories_in_progress.length})
                  </Badge>
                </div>
                {checkpoint.stories_in_progress.length > 0 ? (
                  <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    {checkpoint.stories_in_progress.map((story) => (
                      <li key={story} className="text-xs">
                        {story}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    No stories in progress
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">
            <p className="font-semibold mb-1">What happens next?</p>
            <p className="text-xs">
              Taking over this session will allow you to resume work from the
              last checkpoint. The stale session lock will be archived.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTakeover}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isLoading ? "Taking Over..." : "Take Over"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
