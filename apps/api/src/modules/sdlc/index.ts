/**
 * SDLC Module
 * Real-time synchronization of .claude/sdlc/ files to web dashboard
 */

import { Elysia } from 'elysia';
import { snapshotRoute } from './routes/snapshot';
import { syncRoute } from './routes/sync';
import { streamRoute } from './routes/stream';
import { coherenceCheckRoutes } from './routes/coherence-check';
import { sessionsRoute } from './routes/sessions';
import { boardsRoute } from './routes/boards';
import { locksRoute } from './routes/locks';

export const sdlcModule = new Elysia({ prefix: '/sdlc' })
  .use(snapshotRoute)
  .use(syncRoute)
  .use(streamRoute) // ✅ RE-ENABLED - now using ElectricSQL (no connection pool issues)
  .use(coherenceCheckRoutes) // ✅ Coherence check endpoint
  .use(sessionsRoute) // ✅ Sessions endpoint
  .use(boardsRoute) // ✅ Boards endpoint
  .use(locksRoute); // ✅ Lock takeover endpoint
