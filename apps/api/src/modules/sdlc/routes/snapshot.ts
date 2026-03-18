/**
 * SDLC Snapshot Route
 * Returns complete SDLC state from database (production) or filesystem (fallback)
 */

import { Elysia, t } from 'elysia';
import { scanSDLCDirectory } from '../services/file-scanner';
import { getSnapshotFromDatabase } from '../services/snapshot-builder';
import { getCachedSnapshot, setCachedSnapshot } from '../services/cache';
import { db } from '@agios/db/client';
import { claudeSessions } from '@agios/db/schema';
import { desc } from 'drizzle-orm';

export const snapshotRoute = new Elysia()
  .get('/snapshot', async ({ query, set }) => {
    console.log('[SDLC] Snapshot requested');

    try {
      // Get sessionId from query param
      let sessionId = query.sessionId as string | undefined;

      if (!sessionId) {
        // NO SESSION ID PROVIDED - Return merged snapshot from ALL sessions
        // This gives a unified view of the entire SDLC state across all sessions
        console.log('[SDLC] No sessionId provided, building merged snapshot from ALL sessions');
        const snapshot = await getSnapshotFromDatabase(undefined as any); // Will be updated to handle null
        return snapshot;
      }

      // Build snapshot from specific session
      console.log('[SDLC] Building snapshot from database for session:', sessionId);
      const snapshot = await getSnapshotFromDatabase(sessionId);

      return snapshot;
    } catch (error) {
      console.error('[SDLC] Error getting snapshot:', error);
      set.status = 500;
      return {
        error: 'Failed to get SDLC snapshot',
        message: String(error)
      };
    }
  }, {
    query: t.Optional(t.Object({
      sessionId: t.Optional(t.String()),
    })),
    detail: {
      tags: ['SDLC'],
      summary: 'Get complete SDLC snapshot',
      description: 'Returns categorized structure of all SDLC files from database. Optionally accepts sessionId query param (defaults to latest session).',
    },
  });
