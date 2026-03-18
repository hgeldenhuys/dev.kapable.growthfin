#!/usr/bin/env bun

/**
 * Claude Code Hooks Entry Point
 * This script is called by Claude Code for every hook event
 *
 * Features:
 * - Logs events to a file
 * - Sends SDLC file changes to API for real-time dashboard sync
 *
 * Usage in settings.json:
 * {
 *   "hooks": {
 *     "preToolUse": "bun /path/to/.agent/hooks-sdk/src/use-hooks.ts",
 *     "postToolUse": "bun /path/to/.agent/hooks-sdk/src/use-hooks.ts"
 *   }
 * }
 */

import { HookManager } from './manager';
import { logHookEvent } from './utils/logger';
import { success } from './utils';
import { readConfig } from './utils/config';
import { matchesWatchedPatterns, getRelativePath } from './utils/file-patterns';
import { sendFileChangeEvent, sendSDLCSnapshot, getSyncConfig } from './utils/sdlc-sync';

// Create the hook manager
const manager = new HookManager();

// Load configuration once
const agentConfig = readConfig();

// ============================================================================
// Hook Handlers
// ============================================================================

// Log all PreToolUse events
manager.onPreToolUse(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all PostToolUse events + SDLC file sync
manager.onPostToolUse(async (input, _context) => {
  logHookEvent(input);

  // Check for file changes that should be synced
  if (['Write', 'Edit', 'MultiEdit'].includes(input.tool_name)) {
    const filePath = input.tool_input.file_path;

    if (!filePath) {
      return success();
    }

    // Get relative path from cwd
    const relativePath = getRelativePath(filePath, input.cwd);

    // Check if file matches watched patterns
    if (matchesWatchedPatterns(relativePath)) {
      // Determine operation type
      const operation = input.tool_name === 'Write' ? 'created' : 'updated';

      // Send file change event (non-blocking)
      sendFileChangeEvent(
        {
          sessionId: input.session_id,
          tool: input.tool_name,
          filePath: relativePath,
          operation,
          timestamp: new Date().toISOString(),
        },
        agentConfig
      ).catch((error) => {
        // Log errors but don't fail the hook
        console.error('[sdlc-sync] Error sending file change:', error);
      });
    }
  }

  return success();
});

// Log all Notification events
manager.onNotification(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all UserPromptSubmit events
manager.onUserPromptSubmit(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all Stop events
manager.onStop(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all SubagentStop events
manager.onSubagentStop(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all PreCompact events
manager.onPreCompact(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// Log all SessionStart events + send SDLC snapshot
manager.onSessionStart(async (input, _context) => {
  logHookEvent(input);

  // DISABLED: SDLC snapshot upload (replaced by new system)
  // Send full SDLC snapshot on session start (non-blocking)
  // sendSDLCSnapshot(input.session_id, agentConfig, input.cwd).catch((error) => {
  //   // Log errors but don't fail the hook
  //   console.error('[sdlc-sync] Error sending snapshot:', error);
  // });

  return success();
});

// Log all SessionEnd events
manager.onSessionEnd(async (input, _context) => {
  logHookEvent(input);
  return success();
});

// ============================================================================
// Run the hook manager
// ============================================================================

// This will:
// 1. Read JSON input from stdin
// 2. Execute all registered handlers
// 3. Output result to stdout (if any)
// 4. Exit with the appropriate code
manager.run().catch((error) => {
  console.error(`Hook execution failed: ${error.message}`);
  process.exit(1);
});
