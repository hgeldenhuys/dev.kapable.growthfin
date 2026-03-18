/**
 * SDLC Sync Utility
 * Sends file change events and snapshots to the API for real-time dashboard updates
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { AgentConfig } from './config';
import { matchesWatchedPatterns, DEFAULT_WATCHED_PATTERNS, isBinaryFile } from './file-patterns';

// ============================================================================
// Types
// ============================================================================

export interface FileChangeEvent {
  sessionId: string;
  tool: string;
  filePath: string;
  operation: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

export interface SDLCFile {
  path: string;
  content: string;
  timestamp?: string; // Last modified time
  operation?: 'created' | 'updated' | 'deleted';
}

export interface SDLCSnapshot {
  sessionId: string;
  files: SDLCFile[];
  timestamp: string;
  totalFiles: number;
  totalSize: number;
}

export interface SyncConfig {
  enabled: boolean;
  patterns: string[];
  apiUrl: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get SDLC sync configuration from agent config
 */
export function getSyncConfig(agentConfig: AgentConfig | null): SyncConfig {
  // Default configuration (uses Web proxy at :5173, not API at :3000)
  const defaultConfig: SyncConfig = {
    enabled: true,
    patterns: DEFAULT_WATCHED_PATTERNS,
    apiUrl: 'http://localhost:5173/api/v1/sdlc/sync',
  };

  if (!agentConfig) {
    return defaultConfig;
  }

  // Use baseUrl from config (now points to Web, not API)
  const baseUrl = (agentConfig as any).baseUrl || 'http://localhost:5173';

  // Check for sdlc.sync configuration
  const sdlcConfig = (agentConfig as any).sdlc;
  if (!sdlcConfig || !sdlcConfig.sync) {
    return {
      ...defaultConfig,
      apiUrl: `${baseUrl}/api/v1/sdlc/sync`,
    };
  }

  return {
    enabled: sdlcConfig.sync.enabled ?? defaultConfig.enabled,
    patterns: sdlcConfig.sync.patterns ?? defaultConfig.patterns,
    apiUrl: sdlcConfig.sync.apiUrl ?? `${baseUrl}/api/v1/sdlc/sync`,
  };
}

// ============================================================================
// File Change Events
// ============================================================================

/**
 * Send a file change event to the API
 *
 * @param event - File change event details
 * @param config - Agent configuration for API URL
 * @returns Promise that resolves when sent (non-blocking)
 */
export async function sendFileChangeEvent(
  event: FileChangeEvent,
  config: AgentConfig | null
): Promise<void> {
  const syncConfig = getSyncConfig(config);

  // Check if sync is enabled
  if (!syncConfig.enabled) {
    return;
  }

  // Skip binary files - they cannot be stored as UTF-8 text
  if (isBinaryFile(event.filePath)) {
    console.log(`[sdlc-sync] Skipping binary file: ${event.filePath}`);
    return;
  }

  // Read file content if file exists
  let content: string | null = null;
  let fileSize = 0;

  if (event.operation !== 'deleted' && existsSync(event.filePath)) {
    try {
      content = readFileSync(event.filePath, 'utf-8');
      fileSize = Buffer.byteLength(content, 'utf-8');
    } catch (error) {
      // File may have been deleted between check and read
      console.error(`[sdlc-sync] Failed to read file ${event.filePath}:`, error);
      return;
    }
  }

  // Build payload
  const payload = {
    sessionId: event.sessionId,
    tool: event.tool,
    filePath: event.filePath,
    operation: event.operation,
    timestamp: event.timestamp,
    content,
    fileSize,
  };

  // Send to API (non-blocking, with timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

  try {
    const response = await fetch(syncConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[sdlc-sync] API error (${response.status}): ${errorText}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Log but don't fail the hook
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[sdlc-sync] Request timeout after 2s');
    } else if (error instanceof Error) {
      console.error('[sdlc-sync] Failed to send file change:', error.message);
    }

    // Future: Queue event for retry
    // For now, just log and continue
  }
}

// ============================================================================
// SDLC Snapshot
// ============================================================================

/**
 * Recursively scan directory for matching files
 */
function scanDirectory(
  dir: string,
  patterns: string[],
  baseDir: string = dir
): SDLCFile[] {
  const files: SDLCFile[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(baseDir, fullPath);

      // Skip node_modules and hidden directories (except .claude)
      if (
        entry === 'node_modules' ||
        (entry.startsWith('.') && entry !== '.claude')
      ) {
        continue;
      }

      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Recursively scan subdirectory
        const subFiles = scanDirectory(fullPath, patterns, baseDir);
        files.push(...subFiles);
      } else if (stats.isFile()) {
        // Check if file matches watched patterns
        if (matchesWatchedPatterns(relativePath, patterns)) {
          // Skip binary files - they cannot be stored as UTF-8 text
          if (isBinaryFile(relativePath)) {
            console.log(`[sdlc-sync] Skipping binary file: ${relativePath}`);
            continue;
          }

          try {
            const content = readFileSync(fullPath, 'utf-8');
            files.push({
              path: relativePath,
              content,
              timestamp: stats.mtime.toISOString(),
              operation: 'updated', // All snapshot files are considered 'updated'
            });
          } catch (error) {
            console.error(`[sdlc-sync] Failed to read ${relativePath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[sdlc-sync] Failed to scan directory ${dir}:`, error);
  }

  return files;
}

/**
 * Send a full SDLC snapshot to the API
 *
 * @param sessionId - Current session ID
 * @param config - Agent configuration
 * @param cwd - Current working directory
 * @returns Promise that resolves when sent (non-blocking)
 */
export async function sendSDLCSnapshot(
  sessionId: string,
  config: AgentConfig | null,
  cwd: string
): Promise<void> {
  const syncConfig = getSyncConfig(config);

  // Check if sync is enabled
  if (!syncConfig.enabled) {
    return;
  }

  console.log('[sdlc-sync] Building SDLC snapshot...');

  // Scan for matching files
  const files = scanDirectory(cwd, syncConfig.patterns, cwd);

  const snapshot: SDLCSnapshot = {
    sessionId,
    files,
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    totalSize: 0, // Size tracking removed for API compatibility
  };

  console.log(
    `[sdlc-sync] Snapshot ready: ${snapshot.totalFiles} files, ${(
      snapshot.totalSize / 1024
    ).toFixed(2)} KB`
  );

  // Send to API (with longer timeout for snapshot)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for snapshot

  try {
    const response = await fetch(`${syncConfig.apiUrl}/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[sdlc-sync] Snapshot API error (${response.status}): ${errorText}`);
    } else {
      console.log('[sdlc-sync] Snapshot sent successfully');
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Log but don't fail the hook
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[sdlc-sync] Snapshot request timeout after 10s');
    } else if (error instanceof Error) {
      console.error('[sdlc-sync] Failed to send snapshot:', error.message);
    }
  }
}
