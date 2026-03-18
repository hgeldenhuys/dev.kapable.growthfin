/**
 * useTwilioDevice Hook
 *
 * Manages Twilio Device lifecycle for browser-based calling.
 * Handles device registration, call state, token refresh, and cleanup.
 *
 * @example
 * ```typescript
 * const {
 *   deviceState,
 *   callState,
 *   activeCall,
 *   error,
 *   isMuted,
 *   callDuration,
 *   initDevice,
 *   makeCall,
 *   hangUp,
 *   toggleMute,
 * } = useTwilioDevice(workspaceId);
 *
 * // Initialize device on mount
 * useEffect(() => {
 *   initDevice();
 * }, [initDevice]);
 *
 * // Make a call
 * await makeCall({ to: '+1234567890', leadId: 'lead-123', userId: 'user-456' });
 *
 * // Hang up
 * hangUp();
 *
 * // Toggle mute
 * toggleMute();
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { toast } from 'sonner';

// Re-export Call type for consumers
export type { Call };

/**
 * Device registration states
 */
export type DeviceState = 'unregistered' | 'registering' | 'registered' | 'error';

/**
 * Call lifecycle states
 */
export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'disconnected';

/**
 * Parameters for making an outbound call
 * Supports either leadId OR contactId (at least one must be provided)
 */
export interface MakeCallParams {
  /** Phone number to call (E.164 format) */
  to: string;
  /** Lead ID for tracking (provide either leadId OR contactId) */
  leadId?: string;
  /** Contact ID for tracking (provide either leadId OR contactId) */
  contactId?: string;
  /** User ID for tracking */
  userId: string;
  /** Optional: Account ID for tracking */
  accountId?: string;
  /** Optional: Campaign ID for tracking */
  campaignId?: string;
}

/**
 * Return type for useTwilioDevice hook
 */
export interface UseTwilioDeviceReturn {
  // State
  deviceState: DeviceState;
  callState: CallState;
  activeCall: Call | null;
  error: string | null;
  isMuted: boolean;
  callDuration: number;

  // Actions
  initDevice: () => Promise<void>;
  makeCall: (params: MakeCallParams) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
}

/**
 * Fetch capability token from the backend
 */
async function fetchToken(workspaceId: string): Promise<string> {
  const response = await fetch(`/api/v1/voice/token?workspaceId=${workspaceId}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch voice token');
  }

  const data = await response.json();
  return data.token;
}

/**
 * Map Twilio Call.State to our CallState
 */
function mapCallState(twilioState: Call.State): CallState {
  switch (twilioState) {
    case Call.State.Connecting:
      return 'connecting';
    case Call.State.Ringing:
      return 'ringing';
    case Call.State.Open:
      return 'connected';
    case Call.State.Closed:
      return 'disconnected';
    case Call.State.Pending:
      return 'connecting';
    case Call.State.Reconnecting:
      return 'connecting';
    default:
      return 'idle';
  }
}

/**
 * Map Twilio Device.State to our DeviceState
 * Note: Kept for potential future use when observing device state changes
 */
function _mapDeviceState(twilioState: Device.State): DeviceState {
  switch (twilioState) {
    case Device.State.Registered:
      return 'registered';
    case Device.State.Registering:
      return 'registering';
    case Device.State.Unregistered:
      return 'unregistered';
    case Device.State.Destroyed:
      return 'unregistered';
    default:
      return 'unregistered';
  }
}

// Export for testing
export { _mapDeviceState as mapDeviceState };

/**
 * React hook for managing Twilio Device lifecycle
 *
 * @param workspaceId - The workspace ID for token generation
 * @returns Hook state and actions
 */
export function useTwilioDevice(workspaceId: string): UseTwilioDeviceReturn {
  // State
  const [deviceState, setDeviceState] = useState<DeviceState>('unregistered');
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Refs for cleanup and preventing stale closures
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Clear call duration timer
   */
  const clearDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Start call duration timer
   */
  const startDurationTimer = useCallback(() => {
    clearDurationTimer();
    callStartTimeRef.current = Date.now();
    setCallDuration(0);

    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallDuration(elapsed);
      }
    }, 1000);
  }, [clearDurationTimer]);

  /**
   * Clean up call event listeners and state
   */
  const cleanupCall = useCallback(() => {
    clearDurationTimer();
    callStartTimeRef.current = null;
    setCallDuration(0);
    setIsMuted(false);
    setActiveCall(null);
    setCallState('idle');
    callRef.current = null;
  }, [clearDurationTimer]);

  /**
   * Set up event listeners for a call
   */
  const setupCallListeners = useCallback(
    (call: Call) => {
      // Call accepted/connected
      call.on('accept', () => {
        console.log('[useTwilioDevice] Call accepted');
        setCallState('connected');
        startDurationTimer();
      });

      // Call ringing (outbound call, callee's phone is ringing)
      call.on('ringing', (hasEarlyMedia: boolean) => {
        console.log('[useTwilioDevice] Call ringing, early media:', hasEarlyMedia);
        setCallState('ringing');
      });

      // Call disconnected
      call.on('disconnect', () => {
        console.log('[useTwilioDevice] Call disconnected');
        setCallState('disconnected');
        cleanupCall();
      });

      // Call cancelled (before answered)
      call.on('cancel', () => {
        console.log('[useTwilioDevice] Call cancelled');
        cleanupCall();
      });

      // Call rejected
      call.on('reject', () => {
        console.log('[useTwilioDevice] Call rejected');
        cleanupCall();
      });

      // Call error
      call.on('error', (twilioError) => {
        console.error('[useTwilioDevice] Call error:', twilioError);
        const errorMessage = twilioError.message || 'Call error occurred';
        setError(errorMessage);
        toast.error(`Call error: ${errorMessage}`);
        cleanupCall();
      });

      // Mute state change
      call.on('mute', (muted: boolean) => {
        console.log('[useTwilioDevice] Mute changed:', muted);
        setIsMuted(muted);
      });

      // Reconnecting (media connectivity issues)
      call.on('reconnecting', (twilioError) => {
        console.warn('[useTwilioDevice] Call reconnecting:', twilioError);
        toast.warning('Call reconnecting...');
      });

      // Reconnected
      call.on('reconnected', () => {
        console.log('[useTwilioDevice] Call reconnected');
        toast.success('Call reconnected');
      });

      // Warning events for call quality issues
      call.on('warning', (name: string, data: unknown) => {
        console.warn('[useTwilioDevice] Call warning:', name, data);
        if (name === 'low-mos') {
          toast.warning('Call quality is degraded');
        }
      });

      call.on('warning-cleared', (name: string) => {
        console.log('[useTwilioDevice] Call warning cleared:', name);
      });
    },
    [cleanupCall, startDurationTimer]
  );

  /**
   * Initialize Twilio Device with token
   */
  const initDevice = useCallback(async () => {
    if (!workspaceId) {
      setError('Workspace ID is required');
      return;
    }

    // Prevent double initialization
    if (isInitializedRef.current && deviceRef.current) {
      console.log('[useTwilioDevice] Device already initialized');
      return;
    }

    try {
      setError(null);
      setDeviceState('registering');

      // Fetch capability token
      const token = await fetchToken(workspaceId);

      // Create new Device instance
      const device = new Device(token, {
        logLevel: 1, // 0=trace, 1=debug, 2=info, 3=warn, 4=error
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        closeProtection: true,
        enableImprovedSignalingErrorPrecision: true,
      });

      // Device registered
      device.on('registered', () => {
        console.log('[useTwilioDevice] Device registered');
        setDeviceState('registered');
        setError(null);
      });

      // Device registering
      device.on('registering', () => {
        console.log('[useTwilioDevice] Device registering');
        setDeviceState('registering');
      });

      // Device unregistered
      device.on('unregistered', () => {
        console.log('[useTwilioDevice] Device unregistered');
        setDeviceState('unregistered');
      });

      // Device error
      device.on('error', (twilioError, call) => {
        console.error('[useTwilioDevice] Device error:', twilioError, call);
        const errorMessage = twilioError.message || 'Device error occurred';
        setError(errorMessage);
        setDeviceState('error');
        toast.error(`Voice device error: ${errorMessage}`);
      });

      // Token expiring - refresh before it expires
      device.on('tokenWillExpire', async () => {
        console.log('[useTwilioDevice] Token will expire, refreshing...');
        try {
          const newToken = await fetchToken(workspaceId);
          device.updateToken(newToken);
          console.log('[useTwilioDevice] Token refreshed successfully');
        } catch (err) {
          console.error('[useTwilioDevice] Failed to refresh token:', err);
          const errorMessage = err instanceof Error ? err.message : 'Token refresh failed';
          setError(errorMessage);
          toast.error(`Token refresh failed: ${errorMessage}`);
        }
      });

      // Handle incoming calls (if your app supports inbound)
      device.on('incoming', (incomingCall) => {
        console.log('[useTwilioDevice] Incoming call:', incomingCall);
        // For now, we just log. Could emit event or auto-answer based on config
        toast.info('Incoming call...');
      });

      // Register the device
      await device.register();

      deviceRef.current = device;
      isInitializedRef.current = true;

      console.log('[useTwilioDevice] Device initialized and registered');
    } catch (err) {
      console.error('[useTwilioDevice] Failed to initialize device:', err);

      // Parse error message - may be JSON from API
      let errorMessage = 'Failed to initialize voice device';
      let hint = '';

      if (err instanceof Error) {
        try {
          // Try to parse JSON error response
          const parsed = JSON.parse(err.message);
          errorMessage = parsed.message || parsed.error || err.message;
          hint = parsed.hint || '';
        } catch {
          // Not JSON, use as-is
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      // Reset to unregistered (not error) so button can be clicked again
      setDeviceState('unregistered');
      isInitializedRef.current = false;

      // Show instructive toast with hint if available
      if (hint) {
        toast.error(errorMessage, {
          description: hint,
          duration: 8000, // Longer duration for setup instructions
        });
      } else {
        toast.error(errorMessage);
      }
    }
  }, [workspaceId]);

  /**
   * Make an outbound call
   */
  const makeCall = useCallback(
    async (params: MakeCallParams) => {
      const device = deviceRef.current;

      if (!device) {
        const errorMessage = 'Device not initialized. Call initDevice() first.';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      if (device.state !== Device.State.Registered) {
        const errorMessage = 'Device not registered. Please wait for registration.';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      if (callRef.current) {
        const errorMessage = 'A call is already in progress';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      try {
        setError(null);
        setCallState('connecting');

        // Prepare TwiML params - these are sent to your TwiML application
        // Supports either LeadId or ContactId (at least one should be provided)
        const callParams: Record<string, string> = {
          To: params.to,
          UserId: params.userId,
          WorkspaceId: workspaceId,
        };

        // Add either LeadId or ContactId (H.1 - Voice Call Contact Support)
        if (params.leadId) {
          callParams['LeadId'] = params.leadId;
        }

        if (params.contactId) {
          callParams['ContactId'] = params.contactId;
        }

        if (params.accountId) {
          callParams['AccountId'] = params.accountId;
        }

        if (params.campaignId) {
          callParams['CampaignId'] = params.campaignId;
        }

        console.log('[useTwilioDevice] Making call with params:', callParams);

        // Make the call
        const call = await device.connect({ params: callParams });

        callRef.current = call;
        setActiveCall(call);
        setupCallListeners(call);

        // Update initial state based on call status
        setCallState(mapCallState(call.status()));

        console.log('[useTwilioDevice] Call initiated');
      } catch (err) {
        console.error('[useTwilioDevice] Failed to make call:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
        setError(errorMessage);
        setCallState('idle');
        toast.error(errorMessage);
      }
    },
    [workspaceId, setupCallListeners]
  );

  /**
   * Hang up the current call
   */
  const hangUp = useCallback(() => {
    const call = callRef.current;

    if (call) {
      console.log('[useTwilioDevice] Hanging up call');
      call.disconnect();
      // cleanupCall will be called by the 'disconnect' event handler
    } else {
      console.log('[useTwilioDevice] No active call to hang up');
    }
  }, []);

  /**
   * Toggle mute on the current call
   */
  const toggleMute = useCallback(() => {
    const call = callRef.current;

    if (call) {
      const newMutedState = !call.isMuted();
      console.log('[useTwilioDevice] Toggling mute to:', newMutedState);
      call.mute(newMutedState);
      // setIsMuted will be called by the 'mute' event handler
    } else {
      console.log('[useTwilioDevice] No active call to mute');
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[useTwilioDevice] Cleaning up...');

      // Clear duration timer
      clearDurationTimer();

      // Disconnect any active call
      if (callRef.current) {
        callRef.current.disconnect();
        callRef.current = null;
      }

      // Destroy device
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }

      isInitializedRef.current = false;
    };
  }, [clearDurationTimer]);

  /**
   * Re-initialize device if workspaceId changes
   */
  useEffect(() => {
    // If workspaceId changes and we were initialized, cleanup and reinitialize
    if (isInitializedRef.current && deviceRef.current) {
      console.log('[useTwilioDevice] WorkspaceId changed, re-initializing...');

      // Destroy existing device
      if (callRef.current) {
        callRef.current.disconnect();
        callRef.current = null;
      }

      deviceRef.current.destroy();
      deviceRef.current = null;
      isInitializedRef.current = false;

      // Reset state
      setDeviceState('unregistered');
      setCallState('idle');
      setActiveCall(null);
      setError(null);
      setIsMuted(false);
      setCallDuration(0);
    }
  }, [workspaceId]);

  return {
    // State
    deviceState,
    callState,
    activeCall,
    error,
    isMuted,
    callDuration,

    // Actions
    initDevice,
    makeCall,
    hangUp,
    toggleMute,
  };
}

// Default export for convenience
export default useTwilioDevice;
