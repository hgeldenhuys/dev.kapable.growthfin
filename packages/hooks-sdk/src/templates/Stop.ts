#!/usr/bin/env bun
/**
 * Stop Hook - Incremental SDLC File Sync
 *
 * Fires after each AI response to sync changed SDLC files to database.
 * This makes retrospectives and other SDLC files immediately visible in the UI.
 *
 * Performance: ~100-300ms per response (only scans changed files)
 */

import { HookManager } from '@agios/hooks-sdk';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const manager = new HookManager();

// Timestamp file to track last sync
const LAST_SYNC_FILE = '.agent/.last-sdlc-sync';

/**
 * Get last sync timestamp
 */
function getLastSyncTime(cwd: string): Date {
  const timestampPath = join(cwd, LAST_SYNC_FILE);

  if (!existsSync(timestampPath)) {
    // First run - return epoch to sync everything
    return new Date(0);
  }

  try {
    const timestamp = readFileSync(timestampPath, 'utf-8').trim();
    return new Date(timestamp);
  } catch {
    return new Date(0);
  }
}

/**
 * Update last sync timestamp
 */
function updateLastSyncTime(cwd: string): void {
  const timestampPath = join(cwd, LAST_SYNC_FILE);
  writeFileSync(timestampPath, new Date().toISOString(), 'utf-8');
}

/**
 * Find SDLC files changed since last sync using git
 */
function findChangedSDLCFiles(cwd: string, since: Date): string[] {
  const sdlcDir = join(cwd, '.claude/sdlc');

  // Check if SDLC directory exists
  if (!existsSync(sdlcDir)) {
    return [];
  }

  try {
    // Use git diff to find changed files (very fast!)
    const sinceISO = since.toISOString();
    const gitCmd = `git diff --name-only --diff-filter=AM "$(git log --since="${sinceISO}" --format=%H | tail -1)" HEAD -- ".claude/sdlc/"`;

    const output = execSync(gitCmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();

    if (!output) {
      return [];
    }

    return output.split('\n').filter(Boolean);
  } catch (error) {
    // Fallback: Use filesystem mtime if git fails
    return findChangedFilesByMtime(sdlcDir, since);
  }
}

/**
 * Fallback: Find changed files by modification time
 */
function findChangedFilesByMtime(dir: string, since: Date): string[] {
  const changedFiles: string[] = [];

  function scanDirectory(currentDir: string, relativePath: string = '') {
    try {
      const entries = require('fs').readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relPath = join(relativePath, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, relPath);
        } else if (entry.isFile()) {
          const stats = statSync(fullPath);
          if (stats.mtime > since) {
            changedFiles.push(join('.claude/sdlc', relPath));
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  scanDirectory(dir);
  return changedFiles;
}

/**
 * Categorize file based on path
 */
function categorizeFilePath(filePath: string): string {
  const cleanPath = filePath.replace(/^\.claude\/sdlc\//, '');

  if (cleanPath.startsWith('stories/')) return 'stories';
  if (cleanPath.startsWith('epics/')) return 'epics';
  if (cleanPath.startsWith('kanban/')) return 'kanban';
  if (cleanPath.startsWith('knowledge/graph/')) return 'knowledgeGraph';
  if (cleanPath.startsWith('coherence/') || cleanPath.includes('coherence-check') || cleanPath.startsWith('audits/')) return 'coherence';
  if (cleanPath.startsWith('logs/retrospectives/')) return 'retrospectives';
  if (cleanPath.startsWith('backlog/')) return 'backlog';
  if (cleanPath.startsWith('prds/') || cleanPath.startsWith('prd/')) return 'prds';

  return 'unknown';
}

/**
 * Sync files to database via API
 */
async function syncFilesToDatabase(sessionId: string, files: string[], cwd: string): Promise<number> {
  if (files.length === 0) {
    return 0;
  }

  const filesToSync = files.map(filePath => {
    // Ensure filePath is relative, not absolute
    const relativePath = filePath.startsWith(cwd)
      ? filePath.slice(cwd.length + 1)  // Strip cwd prefix if present
      : filePath;

    const fullPath = join(cwd, relativePath);

    let content = '';
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch (error) {
      console.error(`[Stop Hook] Failed to read file: ${relativePath}`, error);
      return null;
    }

    // Strip .claude/sdlc/ prefix to match API expected format
    // API expects: "logs/retrospectives/RETRO_xxx.md"
    // Not: ".claude/sdlc/logs/retrospectives/RETRO_xxx.md"
    const apiPath = relativePath.replace(/^\.claude\/sdlc\//, '');

    return {
      path: apiPath,
      operation: 'updated',
      content,
      timestamp: new Date().toISOString(),
    };
  }).filter(Boolean);

  if (filesToSync.length === 0) {
    return 0;
  }

  try {
    const payload = {
      sessionId,
      files: filesToSync,
    };

    // Use Web proxy (baseUrl) instead of direct API access
    const baseUrl = process.env.AGIOS_BASE_URL || 'http://localhost:5173';
    const response = await fetch(`${baseUrl}/api/v1/sdlc/sync/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Stop Hook] API sync failed: ${response.status} ${response.statusText}`);
      return 0;
    }

    const result = await response.json();
    return result.processed || 0;
  } catch (error) {
    console.error(`[Stop Hook] Sync failed:`, error);
    return 0;
  }
}

/**
 * Main Stop Hook Handler
 */
manager.onStop(async (input) => {
  const { session_id, cwd } = input;

  try {
    // Get last sync time
    const lastSync = getLastSyncTime(cwd);

    // Find files changed since last sync
    const changedFiles = findChangedSDLCFiles(cwd, lastSync);

    if (changedFiles.length === 0) {
      // No changes - skip sync
      return { continue: true };
    }

    console.log(`[Stop Hook] Found ${changedFiles.length} changed SDLC files, syncing...`);

    // Sync to database
    const synced = await syncFilesToDatabase(session_id, changedFiles, cwd);

    if (synced > 0) {
      // Update last sync timestamp on success
      updateLastSyncTime(cwd);
      console.log(`[Stop Hook] ✅ Synced ${synced} files to database`);
    }

  } catch (error) {
    console.error('[Stop Hook] Error during incremental sync:', error);
    // Don't fail the hook - just log the error
  }

  return { continue: true };
});

// Execute the hook
manager.execute();
