/**
 * SDLC Boards Route
 * Returns list of all Kanban boards with lock status
 */

import { Elysia, t } from 'elysia';
import { promises as fs } from 'fs';
import { join } from 'path';

interface LockInfo {
  session_id: string;
  board_scope: string;
  locked_at: string;
  heartbeat: string;
  stale_threshold_seconds: number;
}

interface BoardMetadata {
  board_id: string;
  project_name: string;
  sprint?: {
    number: number;
    name: string;
    start_date: string;
    end_date: string;
    goal: string;
    total_points: number;
    completed_points: number;
  };
  [key: string]: any;
}

interface BoardWithLockInfo {
  board_id: string;
  name: string;
  locked: boolean;
  lock_owner: string | null;
  locked_at: string | null;
  last_heartbeat: string | null;
  is_stale: boolean;
  sprint?: {
    number: number;
    name: string;
    start_date: string;
    end_date: string;
    goal: string;
    total_points: number;
    completed_points: number;
  };
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export const boardsRoute = new Elysia()
  .get('/boards', async ({ set }) => {
    console.log('[SDLC] Boards list requested');

    try {
      // API runs from apps/api, need to go up to project root
      const projectRoot = join(process.cwd(), '../..');
      const boardsDir = join(projectRoot, '.claude/sdlc/kanban/boards');
      const locksDir = join(projectRoot, '.claude/sdlc/kanban/locks');

      console.log('[SDLC] Reading boards from:', boardsDir);
      console.log('[SDLC] Reading locks from:', locksDir);

      // Read all board metadata files
      const boardFiles = await fs.readdir(boardsDir);
      const boards: BoardWithLockInfo[] = [];

      // Read all lock files
      let lockFiles: string[] = [];
      try {
        lockFiles = await fs.readdir(locksDir);
      } catch (error) {
        console.log('[SDLC] No locks directory found');
      }

      // Parse lock files
      const locks = new Map<string, LockInfo>();
      for (const lockFile of lockFiles) {
        if (!lockFile.endsWith('.lock')) continue;

        try {
          const lockPath = join(locksDir, lockFile);
          const lockContent = await fs.readFile(lockPath, 'utf-8');
          const lockData: LockInfo = JSON.parse(lockContent);
          locks.set(lockData.board_scope, lockData);
        } catch (error) {
          console.error(`[SDLC] Error reading lock file ${lockFile}:`, error);
        }
      }

      // Process each board
      for (const boardFile of boardFiles) {
        if (!boardFile.endsWith('.json')) continue;

        try {
          const boardPath = join(boardsDir, boardFile);
          const boardContent = await fs.readFile(boardPath, 'utf-8');
          const boardData: BoardMetadata = JSON.parse(boardContent);

          // Check if board has a lock
          const lock = locks.get(boardData.board_id);
          const now = Date.now();
          let isStale = false;

          if (lock) {
            const heartbeatTime = new Date(lock.heartbeat).getTime();
            isStale = (now - heartbeatTime) > STALE_THRESHOLD_MS;
          }

          boards.push({
            board_id: boardData.board_id,
            name: boardData.project_name,
            locked: !!lock,
            lock_owner: lock?.session_id || null,
            locked_at: lock?.locked_at || null,
            last_heartbeat: lock?.heartbeat || null,
            is_stale: isStale,
            sprint: boardData.sprint,
          });
        } catch (error) {
          console.error(`[SDLC] Error reading board file ${boardFile}:`, error);
        }
      }

      // Sort boards by name
      boards.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`[SDLC] Found ${boards.length} boards, ${Array.from(locks.values()).length} locks`);

      return {
        boards,
        total_boards: boards.length,
        locked_boards: boards.filter(b => b.locked).length,
        stale_locks: boards.filter(b => b.is_stale).length,
      };
    } catch (error) {
      console.error('[SDLC] Error getting boards:', error);
      set.status = 500;
      return {
        error: 'Failed to get boards',
        message: String(error),
      };
    }
  }, {
    detail: {
      tags: ['SDLC'],
      summary: 'Get all Kanban boards with lock status',
      description: 'Returns list of all boards from .claude/sdlc/kanban/boards/ with lock information',
    },
  })
  .get('/boards/summary', async ({ set }) => {
    console.log('[SDLC] Boards summary requested');

    try {
      // API runs from apps/api, need to go up to project root
      const projectRoot = join(process.cwd(), '../..');
      const boardsDir = join(projectRoot, '.claude/sdlc/kanban/boards');
      const locksDir = join(projectRoot, '.claude/sdlc/kanban/locks');

      // Count all board files
      const boardFiles = await fs.readdir(boardsDir);
      const totalBoards = boardFiles.filter(f => f.endsWith('.json')).length;

      // Count lock files (locked boards)
      let lockedBoards = 0;
      try {
        const lockFiles = await fs.readdir(locksDir);
        lockedBoards = lockFiles.filter(f => f.endsWith('.lock')).length;
      } catch (error) {
        console.log('[SDLC] No locks directory found');
      }

      // Count active boards (modified in last 24 hours)
      let activeBoards = 0;
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

      for (const boardFile of boardFiles) {
        if (!boardFile.endsWith('.json')) continue;

        try {
          const boardPath = join(boardsDir, boardFile);
          const stats = await fs.stat(boardPath);
          if (stats.mtimeMs > twentyFourHoursAgo) {
            activeBoards++;
          }
        } catch (error) {
          console.error(`[SDLC] Error checking board file ${boardFile}:`, error);
        }
      }

      console.log(`[SDLC] Summary: ${totalBoards} total, ${lockedBoards} locked, ${activeBoards} active`);

      return {
        total: totalBoards,
        locked: lockedBoards,
        active: activeBoards,
      };
    } catch (error) {
      console.error('[SDLC] Error getting boards summary:', error);
      set.status = 500;
      return {
        error: 'Failed to get boards summary',
        message: String(error),
      };
    }
  }, {
    detail: {
      tags: ['SDLC'],
      summary: 'Get boards summary statistics',
      description: 'Returns total, locked, and active board counts for navigation badges',
    },
  })
  .get('/boards/:boardId/sessions', async ({ params, set }) => {
    console.log(`[SDLC] Sessions for board ${params.boardId} requested`);

    try {
      const projectRoot = join(process.cwd(), '../..');
      const locksDir = join(projectRoot, '.claude/sdlc/kanban/locks');
      const sessionsDir = join(projectRoot, '.claude/sdlc/kanban/sessions');

      // Check if board has a lock
      const lockFile = join(locksDir, `${params.boardId}.lock`);
      let lockData: LockInfo | null = null;

      try {
        const lockContent = await fs.readFile(lockFile, 'utf-8');
        lockData = JSON.parse(lockContent);
      } catch (error) {
        // No lock file means no sessions working on this board
        console.log(`[SDLC] No lock file found for board ${params.boardId}`);
        return { sessions: [] };
      }

      // Read the session that owns the lock
      const sessionFile = join(sessionsDir, `session-${lockData.session_id}.json`);

      try {
        const sessionContent = await fs.readFile(sessionFile, 'utf-8');
        const sessionData = JSON.parse(sessionContent);

        // Calculate session status based on heartbeat
        const now = Date.now();
        const heartbeatTime = new Date(lockData.heartbeat).getTime();
        const diffMs = now - heartbeatTime;

        let status: 'active' | 'idle' | 'stale';
        if (diffMs < 60_000) {
          status = 'active';
        } else if (diffMs < 300_000) {
          status = 'idle';
        } else {
          status = 'stale';
        }

        // Extract current story from checkpoint
        let currentStory: string | null = null;
        if (sessionData.checkpoint) {
          if (sessionData.checkpoint.stories_in_progress && sessionData.checkpoint.stories_in_progress.length > 0) {
            currentStory = sessionData.checkpoint.stories_in_progress[0];
          } else if (sessionData.checkpoint.last_completed_story) {
            currentStory = sessionData.checkpoint.last_completed_story;
          }
        }

        console.log(`[SDLC] Found 1 session working on board ${params.boardId}`);

        return {
          sessions: [
            {
              id: lockData.session_id,
              name: lockData.session_id,
              status,
              connectedAt: lockData.locked_at,
              lastActivity: lockData.heartbeat,
              currentStory,
            }
          ]
        };
      } catch (error) {
        console.error(`[SDLC] Error reading session file for ${lockData.session_id}:`, error);
        // Return lock info even if session file is missing
        return {
          sessions: [
            {
              id: lockData.session_id,
              name: lockData.session_id,
              status: 'stale' as const,
              connectedAt: lockData.locked_at,
              lastActivity: lockData.heartbeat,
              currentStory: null,
            }
          ]
        };
      }
    } catch (error) {
      console.error(`[SDLC] Error getting sessions for board ${params.boardId}:`, error);
      set.status = 500;
      return {
        error: 'Failed to get board sessions',
        message: String(error),
      };
    }
  }, {
    params: t.Object({
      boardId: t.String(),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Get sessions working on a specific board',
      description: 'Returns list of sessions currently working on the specified board',
    },
  });
