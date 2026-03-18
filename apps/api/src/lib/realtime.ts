/**
 * Realtime subscription manager using Postgres LISTEN/NOTIFY
 *
 * One LISTEN connection per project, fans out to all WebSocket clients.
 * Also queues webhooks for delivery.
 */

import { createListenConnection } from './db';
import type { ChangeEvent, Subscription, WebhookEventType } from '../types';
import type { ServerWebSocket } from 'bun';
import type { WsClient } from '../types';
import { trackWsEvent } from './usage';
import { incrementCounter } from './metrics';
import { queueWebhook } from './webhook-delivery';

type ProjectListener = {
  sql: ReturnType<typeof createListenConnection>;
  clients: Set<ServerWebSocket<WsClient>>;
  listenResult?: { unlisten: () => Promise<void> };
};

// Active listeners by project ID
const listeners = new Map<string, ProjectListener>();

/**
 * Subscribe a WebSocket client to a project's changes
 */
export async function subscribeClient(
  ws: ServerWebSocket<WsClient>,
  projectId: string
): Promise<void> {
  let listener = listeners.get(projectId);

  if (!listener) {
    // Create new listener for this project
    const listenSql = createListenConnection();
    listener = { sql: listenSql, clients: new Set() };
    listeners.set(projectId, listener);

    // Set up LISTEN on project-specific channel
    const channel = `project_${projectId.replace(/-/g, '_')}`;

    const unsubscribe = await listenSql.listen(channel, (payload) => {
      console.log(`[realtime] Received event on ${channel}:`, payload?.substring(0, 100));
      if (!payload) return;

      try {
        const event = JSON.parse(payload) as ChangeEvent;
        console.log(`[realtime] Broadcasting ${event.op} on ${event.table} to ${listener?.clients.size || 0} clients`);
        broadcastToClients(projectId, event);

        // Queue webhooks for this event
        const webhookEventType = event.op.toLowerCase() as WebhookEventType;
        queueWebhook(projectId, {
          event: webhookEventType,
          table: event.table,
          timestamp: new Date(event.ts || Date.now()).toISOString(),
          data: event.data,
        }).catch(err => {
          console.error('[realtime] Error queuing webhook:', err);
        });
      } catch (e) {
        console.error('[realtime] Error parsing notification:', e);
      }
    });

    listener.listenResult = unsubscribe;
    console.log(`[realtime] Listening to ${channel}`);
  }

  listener.clients.add(ws);
}

/**
 * Unsubscribe a WebSocket client
 */
export function unsubscribeClient(
  ws: ServerWebSocket<WsClient>,
  projectId: string
): void {
  const listener = listeners.get(projectId);
  if (!listener) return;

  listener.clients.delete(ws);

  // Clean up if no more clients
  if (listener.clients.size === 0) {
    const channel = `project_${projectId.replace(/-/g, '_')}`;
    if (listener.listenResult) {
      listener.listenResult.unlisten().catch(() => {});
    }
    listener.sql.end().catch(() => {});
    listeners.delete(projectId);
    console.log(`[realtime] Stopped listening to ${channel}`);
  }
}

/**
 * Broadcast event to all subscribed clients for a project
 * Applies RLS filtering for JWT-authenticated clients
 */
function broadcastToClients(projectId: string, event: ChangeEvent): void {
  const listener = listeners.get(projectId);
  if (!listener) return;

  for (const ws of listener.clients) {
    const client = ws.data;

    // Check each subscription
    for (const [subId, sub] of client.subscriptions) {
      // Filter by table
      if (sub.table !== event.table) continue;

      // Apply filters if any
      if (sub.filter && !matchesFilter(event.data, sub.filter)) continue;

      // Apply RLS filtering for JWT-authenticated clients
      if (!passesRLSFilter(client, event.data)) continue;

      // Send to client
      try {
        ws.send(JSON.stringify({
          type: 'event',
          id: subId,
          data: {
            op: event.op.toLowerCase(),
            id: event.id,
            data: event.data,
          },
          ts: Date.now(),
        }));

        // Track event for usage metering (using orgId from client for billing)
        trackWsEvent(client.orgId);
        incrementCounter('signaldb_ws_events_total', { table: event.table, op: event.op.toLowerCase() });
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }
}

/**
 * Check if event data passes RLS filter for this client
 * Mirrors the PostgreSQL RLS policy logic
 */
function passesRLSFilter(client: WsClient, data: Record<string, unknown>): boolean {
  // API key requests get all events (no RLS filtering)
  if (client.authType === 'api_key') {
    return true;
  }

  // JWT requests: check if user has access to this row
  const userId = client.userId || '';
  const scopes = client.tokenScopes || {};

  // Check user_id match
  if (userId && data.user_id === userId) {
    return true;
  }

  // Check owner_id match
  if (userId && data.owner_id === userId) {
    return true;
  }

  // Check team_id scope match
  if (data.team_id && scopes.team_id === data.team_id) {
    return true;
  }

  // Check org_id scope match
  if (data.org_id && scopes.org_id === data.org_id) {
    return true;
  }

  // No match - filter out this event
  return false;
}

/**
 * Check if data matches a filter
 */
function matchesFilter(
  data: Record<string, unknown>,
  filter: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (data[key] !== value) return false;
  }
  return true;
}

/**
 * Get stats for monitoring
 */
export function getStats() {
  const stats: Record<string, number> = {};
  for (const [projectId, listener] of listeners) {
    stats[projectId] = listener.clients.size;
  }
  return {
    projects: listeners.size,
    clients: stats,
  };
}
