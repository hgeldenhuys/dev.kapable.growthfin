/**
 * @agios/hooks-sdk
 * Type-safe TypeScript SDK for Claude Code hooks
 *
 * @example
 * ```typescript
 * import { HookManager, success, block } from '@agios/hooks-sdk';
 *
 * const manager = new HookManager();
 *
 * manager.onPreToolUse(async (input, context) => {
 *   if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf')) {
 *     return block('Dangerous command detected!');
 *   }
 *   return success();
 * });
 *
 * manager.run();
 * ```
 */

// Export all types
export type {
  // Core types
  HookEventName,
  ToolName,
  ExitCode,
  PermissionDecision,
  CompactTrigger,
  SessionStartSource,
  SessionEndReason,

  // Input types
  BaseHookInput,
  PreToolUseInput,
  PostToolUseInput,
  NotificationInput,
  UserPromptSubmitInput,
  StopInput,
  SubagentStopInput,
  PreCompactInput,
  SessionStartInput,
  SessionEndInput,
  AnyHookInput,

  // Output types
  PreToolUseOutput,
  PostToolUseOutput,
  NotificationOutput,
  UserPromptSubmitOutput,
  StopOutput,
  SubagentStopOutput,
  PreCompactOutput,
  SessionStartOutput,
  SessionEndOutput,
  AnyHookOutput,

  // Handler types
  HookHandler,
  HookResult,
  HookContext,
  TranscriptLine,
} from './types';

// Export type guards
export {
  isPreToolUse,
  isPostToolUse,
  isNotification,
  isUserPromptSubmit,
  isStop,
  isSubagentStop,
  isPreCompact,
  isSessionStart,
  isSessionEnd,
} from './types';

// Export Hook Manager
export {
  HookManager,
  createHookContext,
  getTranscriptLine,
  getFullTranscript,
  searchTranscript,
  type HookManagerOptions,
} from './manager';

// Export utilities
export { success, block, error, matchesTool, isMCPTool, parseMCPTool } from './utils';

// Export logger
export { HookLogger, defaultLogger, logHookEvent, type LogEntry } from './utils/logger';

// Export config utilities
export {
  readConfig,
  configExists,
  isAuthenticated,
  getAccessToken,
  getAgentDir,
  getConfigPath,
  type AgentConfig,
} from './utils/config';

// Export API client
export {
  sendHookEvent,
  buildHookEventPayload,
  type HookEventPayload,
  type ApiClientOptions,
  type ApiResponse,
} from './utils/api-client';

// Export error queue
export {
  enqueueEvent,
  dequeueEvent,
  getQueuedEvents,
  updateQueuedEvent,
  getQueueSize,
  clearQueue,
  getQueueDir,
  type QueuedEvent,
} from './utils/error-queue';

// Export notification utilities
export {
  beep,
  logError,
  logInfo,
  notifyApiError,
  getErrorLogPath,
} from './utils/notifications';

// Export file pattern utilities
export {
  matchesWatchedPatterns,
  getRelativePath,
  DEFAULT_WATCHED_PATTERNS,
} from './utils/file-patterns';

// Export SDLC sync utilities
export {
  sendFileChangeEvent,
  sendSDLCSnapshot,
  getSyncConfig,
  type FileChangeEvent,
  type SDLCFile,
  type SDLCSnapshot,
  type SyncConfig,
} from './utils/sdlc-sync';

// Export tags utilities
export { getCurrentTags } from './utils/tags';

// Export transform utilities
export {
  // Conversation logging
  ConversationLogger,
  createConversationTurn,
  type ConversationTurn,
  // File tracking
  FileChangeTracker,
  extractFileChange,
  isFileOperation,
  type FileChange,
  type FileChangesBatch,
  // Todo tracking
  TodoTracker,
  extractTodoEvent,
  isTodoWrite,
  formatTodos,
  type Todo,
  type TodoEvent,
  type TodoSnapshot,
  // AI summarization
  AISummarizer,
  summarizeWithClaude,
  type SummaryEvent,
  type ClaudeMessage,
  type ClaudeAPIResponse,
} from './transforms';
