/**
 * SSE-specific realtime subscription handler
 *
 * Separate from WebSocket realtime to handle SSE callbacks
 * Uses project-scoped channels for data isolation
 * Supports RLS filtering for JWT-authenticated clients
 */

import postgres, { type Sql } from 'postgres';
import { connectionManager } from './connection-manager';
import type { ChangeEvent } from '../types';

type Callback = (event: ChangeEvent) => void;

type AuthContext = {
  authType: 'api_key' | 'jwt';
  userId?: string;
  tokenScopes?: Record<string, unknown>;
};

type Subscriber = {
  table?: string;
  filters?: Record<string, string>;
  callback: Callback;
  auth: AuthContext;  // RLS context for filtering
};

type ProjectListener = {
  sql: Sql;
  subscribers: Set<Subscriber>;
  listenResult?: { unlisten: () => Promise<void> };
};

const listeners = new Map<string, ProjectListener>();

/**
 * Subscribe to changes for a specific table (project-scoped)
 * @param projectId - Project ID for channel scoping
 * @param table - Table name to filter (optional)
 * @param filters - Field filters (optional)
 * @param auth - Auth context for RLS filtering
 * @param callback - Callback for each event
 */
export async function subscribeToChanges(
  projectId: string,
  table: string | undefined,
  filters: Record<string, string> | undefined,
  auth: AuthContext,
  callback: Callback
): Promise<() => void> {
  const subscriber: Subscriber = { table, filters, callback, auth };

  let listener = listeners.get(projectId);

  if (!listener) {
    // Get project-specific database connection details
    const location = await connectionManager.getProjectLocation(projectId);
    const listenSql = postgres({
      host: location.host,
      port: location.port,
      database: location.database,
      username: location.user,
      password: location.password,
      max: 1,
    });
    listener = { sql: listenSql, subscribers: new Set() };
    listeners.set(projectId, listener);

    // Use project-specific channel
    const channel = `project_${projectId.replace(/-/g, '_')}`;

    const unsubscribe = await listenSql.listen(channel, (payload) => {
      console.log(`[sse] Received event on ${channel}:`, payload?.substring(0, 100));
      if (!payload) return;

      try {
        const event = JSON.parse(payload) as ChangeEvent;
        broadcastToSubscribers(projectId, event);
      } catch (e) {
        console.error('[sse] Error parsing notification:', e);
      }
    });

    listener.listenResult = unsubscribe;
    console.log(`[sse] Listening to ${channel}`);
  }

  listener.subscribers.add(subscriber);

  // Return unsubscribe function
  return () => {
    listener!.subscribers.delete(subscriber);

    if (listener!.subscribers.size === 0) {
      const channel = `project_${projectId.replace(/-/g, '_')}`;
      if (listener!.listenResult) {
        listener!.listenResult.unlisten().catch(() => {});
      }
      listener!.sql.end().catch(() => {});
      listeners.delete(projectId);
      console.log(`[sse] Stopped listening to ${channel}`);
    }
  };
}

function broadcastToSubscribers(projectId: string, event: ChangeEvent): void {
  const listener = listeners.get(projectId);
  if (!listener) return;

  for (const sub of listener.subscribers) {
    // Filter by table if specified
    if (sub.table && event.table !== sub.table) continue;

    // Apply filters if any
    if (sub.filters && !matchesFilters(event.data, sub.filters)) continue;

    // Apply RLS filtering for JWT-authenticated subscribers
    if (!passesRLSFilter(sub.auth, event.data)) continue;

    try {
      sub.callback(event);
    } catch {
      // Subscriber errored, will be cleaned up
    }
  }
}

function matchesFilters(
  data: Record<string, unknown>,
  filters: Record<string, string>
): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (String(data[key]) !== value) return false;
  }
  return true;
}

/**
 * Check if event data passes RLS filter for this subscriber
 * Mirrors the PostgreSQL RLS policy logic
 */
function passesRLSFilter(auth: AuthContext, data: Record<string, unknown>): boolean {
  // API key requests get all events (no RLS filtering)
  if (auth.authType === 'api_key') {
    return true;
  }

  // JWT requests: check if user has access to this row
  const userId = auth.userId || '';
  const scopes = auth.tokenScopes || {};

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
