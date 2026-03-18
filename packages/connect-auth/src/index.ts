/**
 * Connect Auth — Main Entry
 *
 * Re-exports types and server helpers.
 * For React hooks, import from '@signaldb-live/connect-auth/react'.
 */

export type { ConnectUser, ConnectAuthState } from './types';
export { getUser, requireUser, requireRole, hasPermission, requirePermission } from './server';
