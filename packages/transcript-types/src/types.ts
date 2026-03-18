/**
 * TypeScript types for Claude Code Transcripts (JSONL format)
 *
 * These types are reverse-engineered from actual transcript files.
 * Each line in a .jsonl transcript file represents one of these types.
 */

// ============================================================================
// Base Types
// ============================================================================

export interface BaseTranscriptLine {
  type: string;
  uuid: string;
  timestamp: string;
  sessionId: string;
  version: string;
  parentUuid?: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  gitBranch: string;
}

// ============================================================================
// Summary (Conversation summary metadata)
// ============================================================================

export interface Summary {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

// ============================================================================
// File History Snapshot
// ============================================================================

export interface FileBackupInfo {
  backupFileName: string | null;
  version: number;
  backupTime: string;
}

export interface FileHistorySnapshot {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, FileBackupInfo>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

// ============================================================================
// System Messages
// ============================================================================

export interface SystemMessage extends Partial<BaseTranscriptLine> {
  type: 'system';
  subtype: string;
  content: string;
  level: string;
  isMeta: boolean;
  toolUseID?: string;
  logicalParentUuid?: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
}

// ============================================================================
// User Messages
// ============================================================================

export interface ToolResult {
  type?: string;
  text?: string;
  content?: string | Array<{ type?: string; text?: string; source?: any }>;
  is_error?: boolean;
  tool_use_id?: string;
  // Tool-specific result fields
  [key: string]: any;
}

export interface ThinkingMetadata {
  level: string;
  disabled: boolean;
  triggers: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
}

export interface UserMessage extends Partial<BaseTranscriptLine> {
  type: 'user';
  message: {
    role: 'user';
    content: string | Array<{
      type?: string;
      text?: string;
      tool_use_id?: string;
      content?: string | ToolResult[];
      is_error?: boolean;
    }>;
  };
  isMeta: boolean;
  thinkingMetadata?: ThinkingMetadata;
  toolUseResult?: ToolResult | ToolResult[] | string;
}

// ============================================================================
// Assistant Messages
// ============================================================================

export interface ToolInput {
  // Common fields
  query?: string;
  url?: string;
  plan?: string;
  file_path?: string;
  content?: string;
  description?: string;
  prompt?: string;
  command?: string;
  pattern?: string;
  path?: string;

  // Array/object fields
  todos?: Array<{
    content: string;
    status: string;
    activeForm: string;
  }>;

  // Edit/Replace fields
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;

  // Read fields
  offset?: number;
  limit?: number;

  // Bash fields
  timeout?: number;
  run_in_background?: boolean;

  // Screenshot fields
  fullPage?: boolean;
  uid?: string;

  // Grep fields
  output_mode?: string;
  '-n'?: boolean;
  '-i'?: boolean;

  // Shell fields
  shell_id?: string;

  // Task/Agent fields
  subagent_type?: string;

  // Allow any other fields
  [key: string]: any;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: ToolInput;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = ThinkingContent | ToolUseContent | TextContent;

export interface UsageInfo {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  output_tokens: number;
  service_tier: string | null;
  server_tool_use?: {
    web_search_requests: number;
  };
}

export interface AssistantMessage extends Partial<BaseTranscriptLine> {
  type: 'assistant';
  message: {
    model: string;
    id: string;
    type: 'message';
    role: 'assistant';
    content: MessageContent[];
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: UsageInfo;
    container?: null;
  };
  requestId: string;
  isApiErrorMessage?: boolean;
}

// ============================================================================
// Union Types
// ============================================================================

export type ConversationLine =
  | Summary
  | FileHistorySnapshot
  | SystemMessage
  | UserMessage
  | AssistantMessage;

export interface Conversation {
  lines: ConversationLine[];
  sessionId?: string;
  startedAt?: string;
  endedAt?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSummary(line: ConversationLine): line is Summary {
  return line.type === 'summary';
}

export function isFileHistorySnapshot(line: ConversationLine): line is FileHistorySnapshot {
  return line.type === 'file-history-snapshot';
}

export function isSystemMessage(line: ConversationLine): line is SystemMessage {
  return line.type === 'system';
}

export function isUserMessage(line: ConversationLine): line is UserMessage {
  return line.type === 'user';
}

export function isAssistantMessage(line: ConversationLine): line is AssistantMessage {
  return line.type === 'assistant';
}

export function isThinkingContent(content: MessageContent): content is ThinkingContent {
  return content.type === 'thinking';
}

export function isToolUseContent(content: MessageContent): content is ToolUseContent {
  return content.type === 'tool_use';
}

export function isTextContent(content: MessageContent): content is TextContent {
  return content.type === 'text';
}
