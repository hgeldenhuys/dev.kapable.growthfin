/**
 * WebSocket handler with subscription multiplexing
 *
 * Protocol:
 * - Client sends: { action: 'subscribe', id: 'sub1', table: 'users', filter?: { status: 'active' } }
 * - Client sends: { action: 'unsubscribe', id: 'sub1' }
 * - Client sends: { action: 'ping' }
 * - Server sends: { type: 'subscribed', id: 'sub1', ts: 1234567890 }
 * - Server sends: { type: 'event', id: 'sub1', data: { op: 'insert', id: '...', data: {...} }, ts: 1234567890 }
 */

import type { ServerWebSocket } from 'bun';
import type { WsClient, WsMessage, WsResponse, Subscription } from './types';
import { subscribeClient, unsubscribeClient } from './lib/realtime';
import { removeWsConnection } from './lib/rate-limit';
import { trackWsDisconnect, trackWsEvent } from './lib/usage';
import { decrementGauge, incrementCounter } from './lib/metrics';

// Rate limiting: max messages per second per client
const RATE_LIMIT = 50;
const rateLimitMap = new Map<ServerWebSocket<WsClient>, { count: number; resetAt: number }>();

function checkRateLimit(ws: ServerWebSocket<WsClient>): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ws);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    rateLimitMap.set(ws, entry);
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function send(ws: ServerWebSocket<WsClient>, msg: WsResponse): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Client disconnected
  }
}

export const websocket = {
  async open(ws: ServerWebSocket<WsClient>) {
    const { orgId, projectId } = ws.data;

    // Send connected message first
    send(ws, {
      type: 'connected',
      ts: Date.now(),
    });

    // Subscribe to project changes (for data isolation)
    await subscribeClient(ws, projectId);

    console.log(`[ws] Client connected for project ${projectId} (org ${orgId})`);
  },

  message(ws: ServerWebSocket<WsClient>, message: string | Buffer) {
    // Rate limit check
    if (!checkRateLimit(ws)) {
      send(ws, { type: 'error', error: 'Rate limited', ts: Date.now() });
      return;
    }

    let msg: WsMessage;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : message.toString());
    } catch {
      send(ws, { type: 'error', error: 'Invalid JSON', ts: Date.now() });
      return;
    }

    // Validate action
    if (!['subscribe', 'unsubscribe', 'ping'].includes(msg.action)) {
      send(ws, { type: 'error', error: 'Invalid action', ts: Date.now() });
      return;
    }

    switch (msg.action) {
      case 'ping':
        send(ws, { type: 'pong', ts: Date.now() });
        break;

      case 'subscribe':
        handleSubscribe(ws, msg);
        break;

      case 'unsubscribe':
        handleUnsubscribe(ws, msg);
        break;
    }
  },

  close(ws: ServerWebSocket<WsClient>) {
    const { orgId, projectId, keyId } = ws.data;

    // Clean up rate limit tracking
    rateLimitMap.delete(ws);

    // Remove from connection count
    removeWsConnection(keyId);

    // Track disconnection for usage/metrics (using orgId for billing)
    trackWsDisconnect(orgId);
    decrementGauge('signaldb_websocket_connections');

    // Unsubscribe from project channel
    unsubscribeClient(ws, projectId);

    console.log(`[ws] Client disconnected for project ${projectId} (org ${orgId})`);
  },
};

function handleSubscribe(ws: ServerWebSocket<WsClient>, msg: WsMessage): void {
  const { id, table, filter } = msg;

  if (!id || !table) {
    send(ws, { type: 'error', error: 'Missing id or table', ts: Date.now() });
    return;
  }

  // Validate table name (alphanumeric and underscore only)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    send(ws, { type: 'error', error: 'Invalid table name', ts: Date.now() });
    return;
  }

  // Max subscriptions per client
  if (ws.data.subscriptions.size >= 100) {
    send(ws, { type: 'error', error: 'Too many subscriptions', ts: Date.now() });
    return;
  }

  const subscription: Subscription = { id, table, filter };
  ws.data.subscriptions.set(id, subscription);

  send(ws, { type: 'subscribed', id, ts: Date.now() });
  console.log(`[ws] Subscribed ${id} to ${table}`);
}

function handleUnsubscribe(ws: ServerWebSocket<WsClient>, msg: WsMessage): void {
  const { id } = msg;

  if (!id) {
    send(ws, { type: 'error', error: 'Missing id', ts: Date.now() });
    return;
  }

  if (ws.data.subscriptions.delete(id)) {
    send(ws, { type: 'unsubscribed', id, ts: Date.now() });
    console.log(`[ws] Unsubscribed ${id}`);
  } else {
    send(ws, { type: 'error', error: 'Subscription not found', ts: Date.now() });
  }
}
