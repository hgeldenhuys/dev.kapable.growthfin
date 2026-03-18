/**
 * SDLC Sessions Route
 * Returns list of active Claude Code sessions from .claude/sdlc/kanban/sessions/
 */

import { Elysia, t } from 'elysia';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface SessionCheckpoint {
  timestamp: string;
  last_completed_story?: string;
  stories_completed?: string[];
  stories_in_progress?: string[];
  board_state_snapshot?: {
    columns?: Array<{
      id: string;
      name: string;
      story_ids: string[];
    }>;
    metrics?: {
      total_stories: number;
      completed: number;
      in_progress: number;
      blocked: number;
      velocity: number;
    };
  };
}

interface SessionData {
  session_id: string;
  started_at: string;
  last_heartbeat: string;
  status: 'active' | 'warning' | 'stale' | 'archived';
  pid?: number;
  boards_locked: string[];
  checkpoint?: SessionCheckpoint;
}

interface SessionResponse {
  session_id: string;
  status: 'active' | 'warning' | 'stale' | 'archived';
  boards_locked: string[];
  last_heartbeat: string;
  current_story: string | null;
  checkpoint: SessionCheckpoint | null;
}

function calculateSessionStatus(lastHeartbeat: string): 'active' | 'warning' | 'stale' | 'archived' {
  const now = Date.now();
  const heartbeat = new Date(lastHeartbeat).getTime();
  const minutesAgo = (now - heartbeat) / 1000 / 60;

  if (minutesAgo < 1) return 'active';
  if (minutesAgo < 5) return 'warning';
  return 'stale';
}

function extractCurrentStory(checkpoint?: SessionCheckpoint): string | null {
  if (!checkpoint) return null;

  // Check stories_in_progress first
  if (checkpoint.stories_in_progress && checkpoint.stories_in_progress.length > 0) {
    return checkpoint.stories_in_progress[0];
  }

  // Fall back to last_completed_story
  if (checkpoint.last_completed_story) {
    return checkpoint.last_completed_story;
  }

  return null;
}

interface LockStatusResponse {
  locked: boolean;
  canWrite: boolean;
  lockOwner: string | null;
  lockOwnerId: string | null;
  lockOwnerHeartbeat: string | null;
  lockOwnerStatus: 'active' | 'warning' | 'stale' | null;
}

export const sessionsRoute = new Elysia()
  .get('/sessions', async ({ set }) => {
    console.log('[SDLC Sessions] /sessions endpoint called');

    // API runs from apps/api, need to go up to project root
    const projectRoot = join(process.cwd(), '../..');
    const sessionsDir = join(projectRoot, '.claude/sdlc/kanban/sessions');
    console.log('[SDLC Sessions] Reading from:', sessionsDir);

    // Read all session files (exclude archived directory)
    const files = await readdir(sessionsDir, { withFileTypes: true });
    console.log('[SDLC Sessions] Found files:', files.length);

    const sessionFiles = files.filter(file =>
      file.isFile() &&
      file.name.endsWith('.json') &&
      file.name.startsWith('session-')
    );
    console.log('[SDLC Sessions] Session files:', sessionFiles.map(f => f.name));

    // Read and parse each session file
    const sessions: SessionResponse[] = [];

    for (const file of sessionFiles) {
      const filePath = join(sessionsDir, file.name);
      const content = await readFile(filePath, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);

      // Calculate status based on last_heartbeat
      const status = calculateSessionStatus(sessionData.last_heartbeat);

      sessions.push({
        session_id: sessionData.session_id,
        status,
        boards_locked: sessionData.boards_locked || [],
        last_heartbeat: sessionData.last_heartbeat,
        current_story: extractCurrentStory(sessionData.checkpoint),
        checkpoint: sessionData.checkpoint || null,
      });
    }

    // Sort by last_heartbeat (most recent first)
    sessions.sort((a, b) =>
      new Date(b.last_heartbeat).getTime() - new Date(a.last_heartbeat).getTime()
    );

    console.log('[SDLC Sessions] Returning sessions:', sessions.length);
    set.status = 200;
    return { sessions };
  }, {
    detail: {
      tags: ['SDLC'],
      summary: 'Get all active Claude Code sessions',
      description: 'Returns list of sessions from .claude/sdlc/kanban/sessions/ with health indicators',
    }
  })
  .get('/boards/:boardId/lock-status', async ({ params, set }) => {
    console.log(`[SDLC] Checking lock status for board: ${params.boardId}`);

    try {
      const projectRoot = join(process.cwd(), '../..');
      const sessionsDir = join(projectRoot, '.claude/sdlc/kanban/sessions');

      // Read all session files to find which one has this board locked
      const files = await readdir(sessionsDir, { withFileTypes: true });
      const sessionFiles = files.filter(file =>
        file.isFile() &&
        file.name.endsWith('.json') &&
        file.name.startsWith('session-')
      );

      let lockOwnerSession: SessionData | null = null;

      for (const file of sessionFiles) {
        const filePath = join(sessionsDir, file.name);
        const content = await readFile(filePath, 'utf-8');
        const sessionData: SessionData = JSON.parse(content);

        // Check if this session has the board locked
        if (sessionData.boards_locked && sessionData.boards_locked.includes(params.boardId)) {
          lockOwnerSession = sessionData;
          break;
        }
      }

      if (!lockOwnerSession) {
        // Board is not locked
        set.status = 200;
        return {
          locked: false,
          canWrite: true,
          lockOwner: null,
          lockOwnerId: null,
          lockOwnerHeartbeat: null,
          lockOwnerStatus: null,
        } as LockStatusResponse;
      }

      // Board is locked - determine session status
      const status = calculateSessionStatus(lockOwnerSession.last_heartbeat);

      set.status = 200;
      return {
        locked: true,
        canWrite: false,
        lockOwner: lockOwnerSession.session_id,
        lockOwnerId: lockOwnerSession.session_id,
        lockOwnerHeartbeat: lockOwnerSession.last_heartbeat,
        lockOwnerStatus: status,
      } as LockStatusResponse;
    } catch (error) {
      console.error('[SDLC] Error checking lock status:', error);
      set.status = 500;
      return {
        error: 'Failed to check lock status',
        message: String(error),
      };
    }
  }, {
    params: t.Object({
      boardId: t.String(),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Check board lock status',
      description: 'Returns whether a board is locked and who locked it',
    }
  })
  .get('/sessions/:sessionId/boards', async ({ params, set }) => {
    console.log(`[SDLC] Boards for session ${params.sessionId} requested`);

    try {
      const projectRoot = join(process.cwd(), '../..');
      const locksDir = join(projectRoot, '.claude/sdlc/kanban/locks');
      const sessionsDir = join(projectRoot, '.claude/sdlc/kanban/sessions');
      const boardsDir = join(projectRoot, '.claude/sdlc/kanban/boards');

      // Find current board (check all lock files)
      let currentBoard = null;
      try {
        const lockFiles = await readdir(locksDir);
        for (const lockFileName of lockFiles) {
          if (!lockFileName.endsWith('.lock')) continue;

          const lockPath = join(locksDir, lockFileName);
          const lockContent = await readFile(lockPath, 'utf-8');
          const lockData = JSON.parse(lockContent);

          if (lockData.session_id === params.sessionId) {
            // This session owns this lock
            // Read board metadata to get the name
            const boardId = lockData.board_scope;
            try {
              const boardPath = join(boardsDir, `${boardId}.json`);
              const boardContent = await readFile(boardPath, 'utf-8');
              const boardData = JSON.parse(boardContent);

              currentBoard = {
                id: boardId,
                name: boardData.project_name || boardId,
                lockedAt: lockData.locked_at,
              };
              break;
            } catch (error) {
              console.error(`[SDLC] Error reading board metadata for ${boardId}:`, error);
              // Return basic info even if board metadata is missing
              currentBoard = {
                id: boardId,
                name: boardId,
                lockedAt: lockData.locked_at,
              };
              break;
            }
          }
        }
      } catch (error) {
        console.log(`[SDLC] Error reading locks directory:`, error);
      }

      // Get history from session checkpoint
      const history: Array<{ id: string; name: string; workedAt: string }> = [];
      try {
        const sessionPath = join(sessionsDir, `session-${params.sessionId}.json`);
        const sessionContent = await readFile(sessionPath, 'utf-8');
        const sessionData = JSON.parse(sessionContent);

        // Extract board history from checkpoint
        if (sessionData.checkpoint?.board_state_snapshot) {
          // Use the checkpoint timestamp as the workedAt time
          const workedAt = sessionData.checkpoint.timestamp;

          // Get unique board IDs from the session's board_state_snapshot
          // In this case, the board is implied from the lock, but we could expand this
          // For now, we'll use the current board if it exists
          if (currentBoard) {
            history.push({
              id: currentBoard.id,
              name: currentBoard.name,
              workedAt,
            });
          }
        }
      } catch (error) {
        console.log(`[SDLC] Error reading session file:`, error);
        // Session file not found is OK - history will be empty
      }

      console.log(`[SDLC] Session ${params.sessionId}: current=${currentBoard?.id || 'none'}, history=${history.length}`);

      return {
        current: currentBoard,
        history,
      };
    } catch (error) {
      console.error(`[SDLC] Error getting boards for session ${params.sessionId}:`, error);
      set.status = 500;
      return {
        error: 'Failed to get session boards',
        message: String(error),
      };
    }
  }, {
    params: t.Object({
      sessionId: t.String(),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Get boards a session is working on',
      description: 'Returns current board and history of boards worked on by the session',
    },
  });
