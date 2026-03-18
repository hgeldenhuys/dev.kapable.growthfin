/**
 * @agios/transcript-types
 *
 * TypeScript types and utilities for Claude Code transcript files
 */

// Export all types
export type * from './types';

// Export type guards
export {
  isSummary,
  isFileHistorySnapshot,
  isSystemMessage,
  isUserMessage,
  isAssistantMessage,
  isThinkingContent,
  isToolUseContent,
  isTextContent,
} from './types';

// Export parser functions
export {
  parseTranscript,
  parseTranscriptLine,
  serializeTranscript,
  serializeTranscriptLine,
  TranscriptParseError,
} from './parser';

// Export utility functions
export {
  filterByType,
  getAssistantMessages,
  getUserMessages,
  getSystemMessages,
  getToolUses,
  getToolUsesByName,
  getConversationStats,
  extractAssistantText,
  extractThinking,
  extractThinkingText,
  getTimeline,
  findByUuid,
  getThread,
  getLastTranscriptLine,
  type ConversationStats,
} from './utils';
