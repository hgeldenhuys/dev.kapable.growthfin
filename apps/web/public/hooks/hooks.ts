#!/usr/bin/env bun
/**
 * Universal Agios Hooks Script (Standalone)
 * Handles all Claude Code hook events for Agios SDLC observability
 *
 * This single script handles all 9 hook types:
 * - SessionStart: Full snapshot of SDLC files on session start
 * - SessionEnd: Session metadata when session ends
 * - Stop: Incremental sync of changed SDLC files after each response
 * - SubagentStop: Subagent completion metrics
 * - PreToolUse: Before tool execution (tracking what AI is about to do)
 * - PostToolUse: After tool execution (tracking SDLC file changes)
 * - Notification: System notifications
 * - UserPromptSubmit: User input tracking
 * - PreCompact: Before context compaction
 *
 * Configuration:
 * - Reads baseUrl from .agent/config.json
 * - Sends events to baseUrl/api/v1/* (proxied through Web)
 * - Falls back to AGIOS_BASE_URL env var or http://localhost:5173
 *
 * Usage:
 * This script is called automatically by Claude Code via hooks.json
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

interface HookInput {
  hook_event: string;
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
  };
  agent_name?: string;
  [key: string]: any;
}

interface AgentConfig {
  projectId?: string;
  apiUrl?: string;
  debugHooks?: boolean;
  auth?: {
    accessToken: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Read config from .agent/config.json
 */
function readConfig(cwd: string): AgentConfig | null {
  const configPath = join(cwd, '.agent', 'config.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get base URL from config or environment
 */
function getBaseUrl(config: AgentConfig | null): string {
  if (config?.apiUrl) {
    return config.apiUrl;
  }
  return process.env.AGIOS_BASE_URL || 'http://localhost:5173';
}

/**
 * Log hook event to .agent/hook-events.log
 */
function logHookEvent(input: HookInput, cwd: string): void {
  try {
    const logPath = join(cwd, '.agent', 'hook-events.log');
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, ...input }) + '\n';
    appendFileSync(logPath, logEntry, 'utf-8');
  } catch (error) {
    // Silently fail logging errors
  }
}

// ============================================================================
// SDLC File Sync Utilities
// ============================================================================

/**
 * Timestamp file to track last SDLC sync (used by Stop hook)
 */
const LAST_SYNC_FILE = '.agent/.last-sdlc-sync';

/**
 * Get last sync timestamp
 */
function getLastSyncTime(cwd: string): Date {
  const timestampPath = join(cwd, LAST_SYNC_FILE);

  if (!existsSync(timestampPath)) {
    return new Date(0); // First run - sync everything
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
    console.error(`[Agios Hooks] Error scanning directory: ${dir}`, error);
  }

  return files;
}

/**
 * Find SDLC files changed since last sync using git
 */
function findChangedSDLCFiles(cwd: string, since: Date): string[] {
  const sdlcDir = join(cwd, '.claude/sdlc');

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
      const entries = readdirSync(currentDir, { withFileTypes: true });

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
 * Sync files to database via API
 */
async function syncFilesToAPI(
  sessionId: string,
  files: string[],
  cwd: string,
  baseUrl: string,
  sdlcDir?: string
): Promise<number> {
  if (files.length === 0) {
    return 0;
  }

  const filesToSync = files.map(filePath => {
    // Ensure filePath is relative, not absolute
    const relativePath = filePath.startsWith(cwd)
      ? filePath.slice(cwd.length + 1)
      : filePath;

    // Determine full path: if sdlcDir provided and path doesn't start with .claude/sdlc/, use sdlcDir as base
    const fullPath = sdlcDir && !relativePath.startsWith('.claude/sdlc')
      ? join(sdlcDir, relativePath)
      : join(cwd, relativePath);

    let content = '';
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch (error) {
      console.error(`[Agios Hooks] Failed to read file: ${relativePath}`, error);
      return null;
    }

    // Strip .claude/sdlc/ prefix to match API expected format
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

    const response = await fetch(`${baseUrl}/api/v1/sdlc/sync/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Agios Hooks] API sync failed: ${response.status} ${response.statusText}`);
      return 0;
    }

    const result = await response.json();
    return result.processed || 0;
  } catch (error) {
    console.error(`[Agios Hooks] Sync failed:`, error);
    return 0;
  }
}

/**
 * Check if file path matches SDLC watched patterns
 */
function matchesWatchedPatterns(filePath: string): boolean {
  const watchedPatterns = [
    '.claude/sdlc/',
    '.claude/stories/',
    '.claude/epics/',
    '.claude/prds/',
  ];

  return watchedPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Get relative path from cwd
 */
function getRelativePath(filePath: string, cwd: string): string {
  if (filePath.startsWith(cwd)) {
    return filePath.slice(cwd.length + 1);
  }
  return filePath;
}

/**
 * Send file change event to API (non-blocking)
 */
async function sendFileChangeEvent(
  data: {
    sessionId: string;
    tool: string;
    filePath: string;
    operation: string;
    timestamp: string;
  },
  baseUrl: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/v1/sdlc/sync/file-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Silently fail - this is non-blocking
  }
}

// ============================================================================
// API Integration
// ============================================================================

/**
 * Read last line from transcript file to get conversation context
 */
function getConversationContext(transcriptPath: string): any | null {
  try {
    if (!existsSync(transcriptPath)) {
      return null;
    }

    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];

    if (!lastLine.trim()) {
      return null;
    }

    return JSON.parse(lastLine);
  } catch (error) {
    return null;
  }
}

/**
 * Get git repository details
 */
function getGitDetails(cwd: string): { gitRepo: string | null; machineHost: string | null; gitUser: string | null; gitBranch: string | null } {
  try {
    // Get the git remote origin URL
    const remoteUrl = execSync('git remote get-url origin 2>/dev/null', {
      cwd,
      encoding: 'utf-8'
    }).trim();

    if (!remoteUrl) {
      return { gitRepo: null, machineHost: null, gitUser: null, gitBranch: null };
    }

    // Parse git URL to extract user and repo name
    let gitUser: string | null = null;
    let gitRepo: string | null = null;

    if (remoteUrl.startsWith('git@')) {
      // SSH format: git@github.com:username/repo.git
      const match = remoteUrl.match(/git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        gitUser = match[2];
        gitRepo = match[3].replace(/\.git$/, '');
      }
    } else if (remoteUrl.startsWith('https://') || remoteUrl.startsWith('http://')) {
      // HTTPS format: https://github.com/username/repo.git
      const match = remoteUrl.match(/https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        gitUser = match[2];
        gitRepo = match[3].replace(/\.git$/, '');
      }
    }

    // Get machine hostname
    let machineHost: string | null = null;
    try {
      machineHost = execSync('hostname 2>/dev/null', {
        encoding: 'utf-8'
      }).trim();
    } catch (e) {
      // Ignore hostname errors
    }

    // Get current branch
    let gitBranch: string | null = null;
    try {
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
        cwd,
        encoding: 'utf-8'
      }).trim();
    } catch (e) {
      // Ignore branch errors
    }

    return { gitRepo, machineHost, gitUser, gitBranch };
  } catch (error) {
    // Not a git repository or git not available
    return { gitRepo: null, machineHost: null, gitUser: null, gitBranch: null };
  }
}

/**
 * Send hook event to API
 */
async function sendHookEvent(
  input: HookInput,
  baseUrl: string,
  config: AgentConfig | null
): Promise<void> {
  try {
    const projectId = config?.projectId;
    if (!projectId) {
      // No project ID, skip API submission
      return;
    }

    // Read conversation context from transcript (if available)
    const transcriptPath = (input as any).transcript_path;
    const conversation = transcriptPath ? getConversationContext(transcriptPath) : null;

    // For SessionStart events, include git details in the payload
    const eventName = input.hook_event_name || input.hook_event;
    let gitDetails = null;
    if (eventName === 'SessionStart') {
      gitDetails = getGitDetails(input.cwd);
    }

    const payload = {
      projectId,
      sessionId: input.session_id,
      eventName: eventName,
      toolName: input.tool_name,
      payload: {
        event: input,
        conversation,
        timestamp: new Date().toISOString(),
        // Include git details for SessionStart so API can create/update project
        ...(gitDetails && {
          gitRepo: gitDetails.gitRepo,
          machineHost: gitDetails.machineHost,
          gitUser: gitDetails.gitUser,
          gitBranch: gitDetails.gitBranch,
        }),
      },
    };

    const response = await fetch(`${baseUrl}/api/v1/hook-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Agios Hooks] Failed to send event: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Silently fail - don't block hook execution
    console.error('[Agios Hooks] Error sending event to API:', error);
  }
}

// ============================================================================
// Hook Handlers
// ============================================================================

/**
 * Main hook handler - routes to specific handlers based on event type
 */
async function handleHookEvent(input: HookInput): Promise<void> {
  const { session_id, cwd } = input;
  // Claude Code sends hook_event_name, old format used hook_event
  const hook_event = (input as any).hook_event_name || input.hook_event;

  // Load configuration
  const config = readConfig(cwd);
  const baseUrl = getBaseUrl(config);

  // Log all events
  if (config?.debugHooks !== false) {
    logHookEvent(input, cwd);
  }

  // Send event to API (non-blocking)
  await sendHookEvent(input, baseUrl, config);

  try {
    switch (hook_event) {
      case 'SessionStart':
        await handleSessionStart(input, cwd, baseUrl);
        break;

      case 'SessionEnd':
        await handleSessionEnd(input);
        break;

      case 'Stop':
        await handleStop(input, cwd, baseUrl);
        break;

      case 'SubagentStop':
        await handleSubagentStop(input);
        break;

      case 'PreToolUse':
        await handlePreToolUse(input);
        break;

      case 'PostToolUse':
        await handlePostToolUse(input, cwd, baseUrl, config);
        break;

      case 'Notification':
        await handleNotification(input);
        break;

      case 'UserPromptSubmit':
        await handleUserPromptSubmit(input);
        break;

      case 'PreCompact':
        await handlePreCompact(input);
        break;

      default:
        console.log(`[Agios Hooks] Unknown event: ${hook_event}`);
    }
  } catch (error) {
    console.error(`[Agios Hooks] Error handling ${hook_event}:`, error);
  }
}

/**
 * SessionStart Hook
 * Fires when session starts - sends full snapshot of all SDLC files
 */
async function handleSessionStart(input: HookInput, cwd: string, baseUrl: string): Promise<void> {
  const { session_id } = input;

  try {
    const sdlcDir = join(cwd, '.claude/sdlc');

    if (!existsSync(sdlcDir)) {
      console.log('[Agios Hooks] No SDLC directory found, skipping snapshot sync');
      return;
    }

    console.log('[Agios Hooks] SessionStart - Scanning SDLC directory...');

    // Scan all files in SDLC directory
    const allFiles = scanSDLCDirectory(sdlcDir);

    if (allFiles.length === 0) {
      console.log('[Agios Hooks] No SDLC files found');
      return;
    }

    console.log(`[Agios Hooks] Found ${allFiles.length} SDLC files, syncing snapshot...`);

    // Sync all files to database (pass sdlcDir for correct path resolution)
    const synced = await syncFilesToAPI(session_id, allFiles, cwd, baseUrl, sdlcDir);

    if (synced > 0) {
      console.log(`[Agios Hooks] ✅ SessionStart snapshot: synced ${synced} files`);
    }
  } catch (error) {
    console.error('[Agios Hooks] SessionStart error:', error);
  }
}

/**
 * SessionEnd Hook
 * Fires when session ends - logs session metadata
 */
async function handleSessionEnd(input: HookInput): Promise<void> {
  console.log('[Agios Hooks] SessionEnd - Session completed');
}

/**
 * Stop Hook
 * Fires after each AI response - sends incremental sync of changed files
 */
async function handleStop(input: HookInput, cwd: string, baseUrl: string): Promise<void> {
  const { session_id } = input;

  try {
    // Get last sync time
    const lastSync = getLastSyncTime(cwd);

    // Find files changed since last sync
    const changedFiles = findChangedSDLCFiles(cwd, lastSync);

    if (changedFiles.length === 0) {
      return;
    }

    console.log(`[Agios Hooks] Stop - Found ${changedFiles.length} changed SDLC files, syncing...`);

    // Sync to database
    const synced = await syncFilesToAPI(session_id, changedFiles, cwd, baseUrl);

    if (synced > 0) {
      // Update last sync timestamp on success
      updateLastSyncTime(cwd);
      console.log(`[Agios Hooks] ✅ Stop incremental sync: ${synced} files`);
    }
  } catch (error) {
    console.error('[Agios Hooks] Stop error:', error);
  }
}

/**
 * SubagentStop Hook
 * Fires when a subagent completes - logs subagent metrics
 */
async function handleSubagentStop(input: HookInput): Promise<void> {
  const agentName = input.agent_name || 'Unknown agent';
  console.log(`[Agios Hooks] SubagentStop - ${agentName} completed`);
}

/**
 * PreToolUse Hook
 * Fires before tool execution - tracks what AI is about to do
 */
async function handlePreToolUse(input: HookInput): Promise<void> {
  // Just log - no special handling needed
}

/**
 * PostToolUse Hook
 * Fires after tool execution - tracks SDLC file changes in real-time
 */
async function handlePostToolUse(
  input: HookInput,
  cwd: string,
  baseUrl: string,
  config: AgentConfig | null
): Promise<void> {
  // Check for file changes that should be synced immediately
  if (['Write', 'Edit', 'MultiEdit'].includes(input.tool_name || '')) {
    const filePath = input.tool_input?.file_path;

    if (!filePath) {
      return;
    }

    // Get relative path from cwd
    const relativePath = getRelativePath(filePath, cwd);

    // Check if file matches watched patterns (.claude/sdlc/*)
    if (matchesWatchedPatterns(relativePath)) {
      // Determine operation type
      const operation = input.tool_name === 'Write' ? 'created' : 'updated';

      // Send file change event (non-blocking)
      await sendFileChangeEvent(
        {
          sessionId: input.session_id,
          tool: input.tool_name!,
          filePath: relativePath,
          operation,
          timestamp: new Date().toISOString(),
        },
        baseUrl
      ).catch((error) => {
        console.error('[Agios Hooks] PostToolUse file change sync error:', error);
      });
    }
  }
}

/**
 * Notification Hook
 * Fires on system notifications - logs notification events
 */
async function handleNotification(input: HookInput): Promise<void> {
  // Just log - no special handling needed
}

/**
 * UserPromptSubmit Hook
 * Fires when user submits a prompt - tracks user input
 */
async function handleUserPromptSubmit(input: HookInput): Promise<void> {
  // Just log - no special handling needed
}

/**
 * PreCompact Hook
 * Fires before context compaction - logs compaction events
 */
async function handlePreCompact(input: HookInput): Promise<void> {
  console.log('[Agios Hooks] PreCompact - Context compaction triggered');
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Read JSON from stdin and handle the hook event
 */
async function main(): Promise<void> {
  try {
    // Read JSON input from stdin
    const stdinData: string[] = [];

    for await (const chunk of Bun.stdin.stream()) {
      stdinData.push(Buffer.from(chunk).toString('utf-8'));
    }

    const inputJson = stdinData.join('');

    if (!inputJson.trim()) {
      console.error('[Agios Hooks] No input received from stdin');
      process.exit(1);
    }

    const input: HookInput = JSON.parse(inputJson);

    // Handle the hook event
    await handleHookEvent(input);

    // Output success to stdout
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch (error) {
    console.error('[Agios Hooks] Fatal error:', error);
    process.exit(1);
  }
}

// Execute main function
main();
