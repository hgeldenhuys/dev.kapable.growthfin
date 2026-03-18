/**
 * SDLC Locks Route
 * Manages board lock takeover for crashed sessions
 */

import { Elysia, t } from 'elysia';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'node:crypto';

interface LockInfo {
  session_id: string;
  board_scope: string;
  locked_at: string;
  heartbeat: string;
  stale_threshold_seconds: number;
}

interface Checkpoint {
  stories_completed: string[];
  stories_in_progress: string[];
  last_updated: string;
}

interface TakeoverRequest {
  board_scope: string;
}

interface TakeoverResponse {
  success: boolean;
  message: string;
  new_session_id: string;
  archived_lock: LockInfo;
  checkpoint: Checkpoint;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const ARCHIVE_DIR_NAME = 'locks-archive';

/**
 * Read lock file for a board
 */
async function readLock(locksDir: string, boardScope: string): Promise<LockInfo | null> {
  try {
    const lockPath = join(locksDir, `${boardScope}.lock`);
    const lockContent = await fs.readFile(lockPath, 'utf-8');
    return JSON.parse(lockContent);
  } catch (error) {
    return null;
  }
}

/**
 * Archive an old lock file
 */
async function archiveLock(locksDir: string, boardScope: string, lockData: LockInfo): Promise<void> {
  const archiveDir = join(locksDir, ARCHIVE_DIR_NAME);

  // Create archive directory if it doesn't exist
  try {
    await fs.mkdir(archiveDir, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `${boardScope}-${timestamp}.archive`;
  const archivePath = join(archiveDir, archiveName);

  await fs.writeFile(archivePath, JSON.stringify({
    ...lockData,
    archived_at: new Date().toISOString(),
    archived_by: 'takeover',
  }, null, 2));

  // Delete original lock file
  const lockPath = join(locksDir, `${boardScope}.lock`);
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    console.error(`[SDLC] Error deleting old lock: ${error}`);
  }
}

/**
 * Create new lock for current session
 */
async function createNewLock(locksDir: string, boardScope: string, sessionId: string): Promise<void> {
  const lockPath = join(locksDir, `${boardScope}.lock`);
  const now = new Date().toISOString();

  const newLock: LockInfo = {
    session_id: sessionId,
    board_scope: boardScope,
    locked_at: now,
    heartbeat: now,
    stale_threshold_seconds: 300,
  };

  await fs.writeFile(lockPath, JSON.stringify(newLock, null, 2));
}

/**
 * Extract checkpoint info from board metadata
 */
async function extractCheckpoint(boardsDir: string, boardScope: string): Promise<Checkpoint> {
  try {
    // Look for a board file that matches the board scope (partial match)
    const boardFiles = await fs.readdir(boardsDir);

    for (const file of boardFiles) {
      if (!file.endsWith('.json')) continue;

      const filePath = join(boardsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const boardData = JSON.parse(content);

      // Check if this is the board we're looking for
      if (boardData.board_id === boardScope || file.includes(boardScope)) {
        // Extract completed and in-progress stories
        const completed: string[] = [];
        const inProgress: string[] = [];

        if (boardData.columns && Array.isArray(boardData.columns)) {
          for (const column of boardData.columns) {
            if (column.id === 'done' && Array.isArray(column.stories)) {
              completed.push(...column.stories);
            } else if (column.id === 'in-progress' && Array.isArray(column.stories)) {
              inProgress.push(...column.stories);
            }
          }
        }

        return {
          stories_completed: completed,
          stories_in_progress: inProgress,
          last_updated: boardData.last_updated || new Date().toISOString(),
        };
      }
    }
  } catch (error) {
    console.error(`[SDLC] Error extracting checkpoint: ${error}`);
  }

  // Return empty checkpoint if not found
  return {
    stories_completed: [],
    stories_in_progress: [],
    last_updated: new Date().toISOString(),
  };
}

/**
 * Check if lock is stale
 */
function isLockStale(lock: LockInfo): boolean {
  const heartbeatTime = new Date(lock.heartbeat).getTime();
  const now = Date.now();
  return (now - heartbeatTime) > STALE_THRESHOLD_MS;
}

/**
 * Calculate stale duration in milliseconds
 */
function calculateStaleDuration(lock: LockInfo): number {
  const heartbeatTime = new Date(lock.heartbeat).getTime();
  const now = Date.now();
  return now - heartbeatTime;
}

/**
 * Format duration as human-readable string
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export const locksRoute = new Elysia()
  .post('/locks/takeover', async ({ body, set }) => {
    console.log('[SDLC] Lock takeover requested for:', body.board_scope);

    try {
      const { board_scope } = body as TakeoverRequest;

      if (!board_scope) {
        set.status = 400;
        return {
          success: false,
          message: 'board_scope is required',
        };
      }

      // Get paths
      const projectRoot = join(process.cwd(), '../..');
      const locksDir = join(projectRoot, '.claude/sdlc/kanban/locks');
      const boardsDir = join(projectRoot, '.claude/sdlc/kanban/boards');

      // Read existing lock
      const existingLock = await readLock(locksDir, board_scope);

      if (!existingLock) {
        set.status = 404;
        return {
          success: false,
          message: `No lock found for board: ${board_scope}`,
        };
      }

      // Check if lock is actually stale
      if (!isLockStale(existingLock)) {
        set.status = 409;
        return {
          success: false,
          message: 'Lock is not stale - cannot take over active lock',
        };
      }

      // Generate new session ID
      const newSessionId = randomUUID();

      // Archive old lock
      await archiveLock(locksDir, board_scope, existingLock);

      // Create new lock
      await createNewLock(locksDir, board_scope, newSessionId);

      // Extract checkpoint information
      const checkpoint = await extractCheckpoint(boardsDir, board_scope);

      const response: TakeoverResponse = {
        success: true,
        message: `Successfully took over stale lock for board: ${board_scope}`,
        new_session_id: newSessionId,
        archived_lock: {
          ...existingLock,
          stale_duration_ms: calculateStaleDuration(existingLock),
        } as any,
        checkpoint,
      };

      console.log('[SDLC] Lock takeover successful:', {
        board_scope,
        old_session: existingLock.session_id,
        new_session: newSessionId,
        stale_duration: formatDuration(calculateStaleDuration(existingLock)),
      });

      set.status = 200;
      return response;
    } catch (error) {
      console.error('[SDLC] Error taking over lock:', error);
      set.status = 500;
      return {
        success: false,
        message: 'Failed to take over lock',
        error: String(error),
      };
    }
  }, {
    body: t.Object({
      board_scope: t.String({ description: 'The board scope ID to take over' }),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Take over a stale lock',
      description: 'Archives the stale lock and creates a new lock for the current session',
    },
  });
