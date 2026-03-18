/**
 * Realtime Subscription Manager
 *
 * Handles WebSocket connections for multiplexed subscriptions
 */

import type {
  ChangeEvent,
  SubscriptionOptions,
  Unsubscribe,
} from './types';

/**
 * WebSocket message types
 */
interface WsMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  id?: string;
  table?: string;
  filter?: Record<string, unknown>;
}

interface WsResponse {
  type: 'subscribed' | 'unsubscribed' | 'error' | 'event' | 'pong' | 'connected';
  id?: string;
  error?: string;
  data?: ChangeEvent;
  ts: number;
}

/**
 * Subscription callback
 */
type SubscriptionCallback<T> = (event: ChangeEvent<T>) => void;

/**
 * Internal subscription state
 */
interface InternalSubscription {
  id: string;
  table: string;
  filter?: Record<string, unknown>;
  callback: SubscriptionCallback<unknown>;
}

/**
 * Realtime connection options
 */
export interface RealtimeOptions {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for WebSocket (default: wss://api.signaldb.live) */
  baseUrl?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Max reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
}

/**
 * Connection states
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * Realtime subscription manager
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, InternalSubscription>();
  private pendingSubscriptions = new Map<string, InternalSubscription>();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private idCounter = 0;

  private options: Required<RealtimeOptions>;
  private stateChangeCallbacks: ((state: ConnectionState) => void)[] = [];

  constructor(options: RealtimeOptions) {
    this.options = {
      apiKey: options.apiKey,
      baseUrl: (options.baseUrl || 'wss://api.signaldb.live').replace(/^http/, 'ws').replace(/\/$/, ''),
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      pingInterval: options.pingInterval ?? 30000,
    };
  }

  /**
   * Generate unique subscription ID
   */
  private generateId(): string {
    return `sub_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Set connection state and notify listeners
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      for (const callback of this.stateChangeCallbacks) {
        try {
          callback(state);
        } catch (error) {
          console.error('[SignalDB Realtime] Error in state change callback:', error);
        }
      }
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');

      const url = `${this.options.baseUrl}/v1/ws?apiKey=${encodeURIComponent(this.options.apiKey)}`;
      this.ws = new WebSocket(url);

      const onOpen = () => {
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.resubscribeAll();
        resolve();
      };

      const onError = (event: Event) => {
        console.error('[SignalDB Realtime] WebSocket error:', event);
        if (this.state === 'connecting') {
          reject(new Error('Failed to connect to WebSocket'));
        }
      };

      const onClose = () => {
        this.setState('disconnected');
        this.stopPingInterval();
        this.ws = null;

        if (this.options.autoReconnect && this.subscriptions.size > 0) {
          this.scheduleReconnect();
        }
      };

      const onMessage = (event: MessageEvent) => {
        try {
          const message: WsResponse = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[SignalDB Realtime] Error parsing message:', error);
        }
      };

      this.ws.addEventListener('open', onOpen);
      this.ws.addEventListener('error', onError);
      this.ws.addEventListener('close', onClose);
      this.ws.addEventListener('message', onMessage);
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.options.autoReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.setState('reconnecting');
    this.reconnectAttempts++;

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectDelay
    );

    console.log(`[SignalDB Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error('[SignalDB Realtime] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingTimer = setInterval(() => {
      this.send({ action: 'ping' });
    }, this.options.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Send message to WebSocket
   */
  private send(message: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WsResponse): void {
    switch (message.type) {
      case 'connected':
        console.log('[SignalDB Realtime] Connected');
        break;

      case 'subscribed':
        if (message.id) {
          const pending = this.pendingSubscriptions.get(message.id);
          if (pending) {
            this.subscriptions.set(message.id, pending);
            this.pendingSubscriptions.delete(message.id);
          }
        }
        break;

      case 'unsubscribed':
        if (message.id) {
          this.subscriptions.delete(message.id);
        }
        break;

      case 'event':
        if (message.id && message.data) {
          const subscription = this.subscriptions.get(message.id);
          if (subscription) {
            try {
              subscription.callback(message.data);
            } catch (error) {
              console.error('[SignalDB Realtime] Error in subscription callback:', error);
            }
          }
        }
        break;

      case 'error':
        console.error('[SignalDB Realtime] Server error:', message.error);
        break;

      case 'pong':
        // Pong received, connection is alive
        break;
    }
  }

  /**
   * Resubscribe all active subscriptions after reconnect
   */
  private resubscribeAll(): void {
    for (const [id, subscription] of this.subscriptions) {
      this.send({
        action: 'subscribe',
        id,
        table: subscription.table,
        filter: subscription.filter,
      });
    }
  }

  /**
   * Subscribe to changes on a table
   */
  subscribe<T = Record<string, unknown>>(
    options: SubscriptionOptions,
    callback: SubscriptionCallback<T>
  ): Unsubscribe {
    const id = this.generateId();

    const subscription: InternalSubscription = {
      id,
      table: options.table,
      filter: options.filter,
      callback: callback as SubscriptionCallback<unknown>,
    };

    // Add to pending until server confirms
    this.pendingSubscriptions.set(id, subscription);
    // Also add to subscriptions for reconnection
    this.subscriptions.set(id, subscription);

    // Connect if not connected
    if (this.state === 'disconnected') {
      this.connect().catch(console.error);
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: 'subscribe',
        id,
        table: options.table,
        filter: options.filter,
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
      this.pendingSubscriptions.delete(id);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          action: 'unsubscribe',
          id,
        });
      }

      // Disconnect if no more subscriptions
      if (this.subscriptions.size === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * Listen for connection state changes
   */
  onStateChange(callback: (state: ConnectionState) => void): Unsubscribe {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }
}
