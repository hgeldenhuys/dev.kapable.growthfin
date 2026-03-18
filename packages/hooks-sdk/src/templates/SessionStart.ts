#!/usr/bin/env bun
/**
 * SessionStart Hook - Full SDLC File Sync
 *
 * Fires when session starts to sync all SDLC files to database.
 * Works in conjunction with Stop hook (which handles incremental syncs).
 *
 * This ensures:
 * - Retrospectives created in previous sessions appear in UI
 * - New sessions start with complete SDLC state
 * - Database stays in sync with filesystem
 */

import { HookManager } from '@agios/hooks-sdk';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const manager = new HookManager();

/**
 * Recursively scan SDLC directory for all files
 */
function scanSDLCDirectory(dir: string, basePath: string = ''): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = join(basePath, entry.name);

      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = scanSDLCDirectory(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Skip temp files
        if (entry.name.includes('~') || entry.name.startsWith('temp-')) {
          continue;
        }
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`[SessionStart Hook] Error scanning directory: ${dir}`, error);
  }

  return files;
}

/**
 * Sync all files to database via API
 */
async function syncAllFiles(sessionId: string, files: string[], cwd: string): Promise<number> {
  if (files.length === 0) {
    return 0;
  }

  const filesToSync = files.map(relativePath => {
    const fullPath = join(cwd, '.claude/sdlc', relativePath);

    let content = '';
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch (error) {
      console.error(`[SessionStart Hook] Failed to read file: ${relativePath}`, error);
      return null;
    }

    // API expects paths without .claude/sdlc/ prefix
    // Use relativePath directly (e.g., "logs/retrospectives/RETRO_xxx.md")
    return {
      path: relativePath,
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
      console.error(`[SessionStart Hook] API sync failed: ${response.status} ${response.statusText}`);
      return 0;
    }

    const result = await response.json();
    return result.processed || 0;
  } catch (error) {
    console.error(`[SessionStart Hook] Sync failed:`, error);
    return 0;
  }
}

/**
 * Main SessionStart Hook Handler
 */
manager.onSessionStart(async (input) => {
  const { session_id, cwd } = input;

  try {
    const sdlcDir = join(cwd, '.claude/sdlc');

    // Check if SDLC directory exists
    if (!existsSync(sdlcDir)) {
      console.log('[SessionStart Hook] No SDLC directory found, skipping sync');
      return { continue: true };
    }

    console.log('[SessionStart Hook] Scanning SDLC directory for files...');

    // Scan all files in SDLC directory
    const allFiles = scanSDLCDirectory(sdlcDir);

    if (allFiles.length === 0) {
      console.log('[SessionStart Hook] No SDLC files found');
      return { continue: true };
    }

    console.log(`[SessionStart Hook] Found ${allFiles.length} SDLC files, syncing to database...`);

    // Sync all files to database
    const synced = await syncAllFiles(session_id, allFiles, cwd);

    if (synced > 0) {
      console.log(`[SessionStart Hook] ✅ Synced ${synced} files to database`);
    }

  } catch (error) {
    console.error('[SessionStart Hook] Error during full sync:', error);
    // Don't fail the hook - just log the error
  }

  return { continue: true };
});

// Execute the hook
manager.execute();
