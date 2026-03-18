/**
 * CallWidget Component
 *
 * Browser-based voice calling widget for leads using Twilio WebRTC.
 * Displays call button, status, duration timer, and control buttons.
 *
 * States:
 * - Idle: Show "Call" button with phone icon
 * - Connecting: Show "Connecting..." with spinner
 * - Ringing: Show "Ringing..." with animation
 * - Connected: Show duration timer + Mute button + Hang Up button
 * - Disconnected: Briefly show "Call Ended", then return to idle
 * - No Phone: Show disabled state when lead has no phone number
 */

import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { useTwilioDevice } from '~/hooks/useTwilioDevice';

export interface CallWidgetProps {
  /** Workspace ID for token generation */
  workspaceId: string;
  /** Lead ID for tracking (provide either leadId OR contactId, not both) */
  leadId?: string;
  /** Contact ID for tracking (provide either leadId OR contactId, not both) */
  contactId?: string;
  /** User ID for tracking */
  userId: string;
  /** Phone number to call (E.164 format), null if no phone */
  phoneNumber: string | null;
  /** Lead name for display (deprecated: use entityName instead) */
  leadName?: string;
  /** Entity name for display (works for both leads and contacts) */
  entityName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format call duration as MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


export function CallWidget({
  workspaceId,
  leadId,
  contactId,
  userId,
  phoneNumber,
  leadName,
  entityName,
  className,
}: CallWidgetProps) {
  // Use entityName if provided, otherwise fall back to leadName
  const displayName = entityName || leadName;
  const {
    deviceState,
    callState,
    isMuted,
    callDuration,
    error,
    initDevice,
    makeCall,
    hangUp,
    toggleMute,
  } = useTwilioDevice(workspaceId);

  // Track if we're showing the "Call Ended" message
  const [showEndedMessage, setShowEndedMessage] = useState(false);

  // Track if a call is in progress (to prevent double-clicking)
  const [isInitiating, setIsInitiating] = useState(false);

  // Handle the disconnected state - show "Call Ended" briefly then reset
  useEffect(() => {
    if (callState === 'disconnected') {
      setShowEndedMessage(true);
      const timer = setTimeout(() => {
        setShowEndedMessage(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [callState]);

  /**
   * Handle call button click
   */
  const handleCall = useCallback(async () => {
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }

    // Validate that at least one entity ID is provided
    if (!leadId && !contactId) {
      toast.error('Either lead ID or contact ID is required');
      return;
    }

    if (isInitiating) {
      return;
    }

    setIsInitiating(true);

    try {
      // Initialize device if not registered
      if (deviceState !== 'registered') {
        await initDevice();
      }

      // Make the call - pass either leadId or contactId
      await makeCall({
        to: phoneNumber,
        leadId,
        contactId,
        userId,
      });
    } catch (err) {
      console.error('[CallWidget] Failed to initiate call:', err);
      // Error is already handled by the hook with toast
    } finally {
      setIsInitiating(false);
    }
  }, [phoneNumber, deviceState, initDevice, makeCall, leadId, contactId, userId, isInitiating]);

  /**
   * Handle hang up button click
   */
  const handleHangUp = useCallback(() => {
    hangUp();
  }, [hangUp]);

  /**
   * Handle mute toggle
   */
  const handleToggleMute = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  // Determine the effective state for rendering
  const isCallActive = callState === 'connecting' || callState === 'ringing' || callState === 'connected';
  const isConnected = callState === 'connected';
  const isLoading = isInitiating || deviceState === 'registering' || callState === 'connecting';
  const hasNoPhone = !phoneNumber;

  // If showing "Call Ended" message
  if (showEndedMessage) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Phone className="h-4 w-4" />
          <span>Call Ended</span>
        </div>
      </div>
    );
  }

  // No phone number state
  if (hasNoPhone) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-2"
          title="No phone number available"
        >
          <Phone className="h-4 w-4" />
          <span>Call</span>
        </Button>
        <span className="text-xs text-muted-foreground">No phone</span>
      </div>
    );
  }

  // Idle state - show call button
  if (!isCallActive) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCall}
          disabled={isLoading}
          className="gap-2"
          title={displayName ? `Call ${displayName}` : 'Make call'}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Phone className="h-4 w-4" />
              <span>Call</span>
            </>
          )}
        </Button>
        {error && (
          <span className="text-xs text-destructive" title={error}>
            Error
          </span>
        )}
      </div>
    );
  }

  // Active call state (connecting, ringing, connected)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status / Duration display */}
      <div className="flex items-center gap-2 min-w-[80px]">
        {callState === 'connecting' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Connecting...</span>
          </div>
        )}

        {callState === 'ringing' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 animate-bounce text-green-500" />
            <span>Ringing...</span>
          </div>
        )}

        {isConnected && (
          <div className="flex items-center gap-2 text-sm font-mono">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-600 dark:text-green-400">
              {formatDuration(callDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {/* Mute button - only shown when connected */}
        {isConnected && (
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="icon"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="h-8 w-8"
          >
            {isMuted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Hang up button */}
        <Button
          variant="destructive"
          size="icon"
          onClick={handleHangUp}
          title="Hang up"
          className="h-8 w-8"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default CallWidget;
