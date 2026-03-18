/**
 * Utility functions for filtering and analyzing transcripts
 */

import type {
  Conversation,
  ConversationLine,
  AssistantMessage,
  UserMessage,
  SystemMessage,
  ToolUseContent,
} from './types';
import {
  isAssistantMessage,
  isUserMessage,
  isSystemMessage,
  isToolUseContent,
  isTextContent,
  isThinkingContent,
  isSummary,
  isFileHistorySnapshot,
} from './types';

/**
 * Filter conversation lines by type
 */
export function filterByType<T extends ConversationLine['type']>(
  conversation: Conversation,
  type: T
): Extract<ConversationLine, { type: T }>[] {
  return conversation.lines.filter(line => line.type === type) as Extract<ConversationLine, { type: T }>[];
}

/**
 * Get all assistant messages
 */
export function getAssistantMessages(conversation: Conversation): AssistantMessage[] {
  return conversation.lines.filter(isAssistantMessage);
}

/**
 * Get all user messages
 */
export function getUserMessages(conversation: Conversation): UserMessage[] {
  return conversation.lines.filter(isUserMessage);
}

/**
 * Get all system messages
 */
export function getSystemMessages(conversation: Conversation): SystemMessage[] {
  return conversation.lines.filter(isSystemMessage);
}

/**
 * Get all tool uses from assistant messages
 */
export function getToolUses(conversation: Conversation): Array<{
  message: AssistantMessage;
  toolUse: ToolUseContent;
}> {
  const results: Array<{ message: AssistantMessage; toolUse: ToolUseContent }> = [];

  for (const line of conversation.lines) {
    if (isAssistantMessage(line)) {
      for (const content of line.message.content) {
        if (isToolUseContent(content)) {
          results.push({ message: line, toolUse: content });
        }
      }
    }
  }

  return results;
}

/**
 * Get all tool uses by tool name
 */
export function getToolUsesByName(conversation: Conversation, toolName: string): Array<{
  message: AssistantMessage;
  toolUse: ToolUseContent;
}> {
  return getToolUses(conversation).filter(({ toolUse }) => toolUse.name === toolName);
}

/**
 * Get conversation statistics
 */
export interface ConversationStats {
  totalLines: number;
  assistantMessages: number;
  userMessages: number;
  systemMessages: number;
  totalToolUses: number;
  toolUsesByName: Record<string, number>;
  totalThinkingBlocks: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  duration?: string;
}

export function getConversationStats(conversation: Conversation): ConversationStats {
  const assistantMessages = getAssistantMessages(conversation);
  const stats: ConversationStats = {
    totalLines: conversation.lines.length,
    assistantMessages: assistantMessages.length,
    userMessages: getUserMessages(conversation).length,
    systemMessages: getSystemMessages(conversation).length,
    totalToolUses: 0,
    toolUsesByName: {},
    totalThinkingBlocks: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
  };

  for (const msg of assistantMessages) {
    // Count tokens
    stats.totalInputTokens += msg.message.usage.input_tokens;
    stats.totalOutputTokens += msg.message.usage.output_tokens;
    stats.cacheHitTokens += msg.message.usage.cache_read_input_tokens;
    stats.cacheMissTokens += msg.message.usage.cache_creation_input_tokens;

    // Count content types
    for (const content of msg.message.content) {
      if (isToolUseContent(content)) {
        stats.totalToolUses++;
        stats.toolUsesByName[content.name] = (stats.toolUsesByName[content.name] || 0) + 1;
      } else if (content.type === 'thinking') {
        stats.totalThinkingBlocks++;
      }
    }
  }

  // Calculate duration
  if (conversation.startedAt && conversation.endedAt) {
    const start = new Date(conversation.startedAt);
    const end = new Date(conversation.endedAt);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    stats.duration = `${minutes}m ${seconds}s`;
  }

  return stats;
}

/**
 * Extract all text content from assistant messages
 */
export function extractAssistantText(conversation: Conversation): string[] {
  const texts: string[] = [];

  for (const line of conversation.lines) {
    if (isAssistantMessage(line)) {
      for (const content of line.message.content) {
        if (isTextContent(content)) {
          texts.push(content.text);
        }
      }
    }
  }

  return texts;
}

/**
 * Extract all thinking blocks from assistant messages
 */
export function extractThinking(conversation: Conversation): Array<{
  thinking: string;
  signature: string;
  message: AssistantMessage;
}> {
  const thinkingBlocks: Array<{
    thinking: string;
    signature: string;
    message: AssistantMessage;
  }> = [];

  for (const line of conversation.lines) {
    if (isAssistantMessage(line)) {
      for (const content of line.message.content) {
        if (isThinkingContent(content)) {
          thinkingBlocks.push({
            thinking: content.thinking,
            signature: content.signature,
            message: line,
          });
        }
      }
    }
  }

  return thinkingBlocks;
}

/**
 * Extract just the thinking text (without signatures or message context)
 */
export function extractThinkingText(conversation: Conversation): string[] {
  return extractThinking(conversation).map(t => t.thinking);
}

/**
 * Get conversation timeline (chronological order with timestamps)
 */
export function getTimeline(conversation: Conversation): Array<{
  timestamp: string;
  type: string;
  line: ConversationLine;
}> {
  return conversation.lines
    .filter(line => !isSummary(line) && !isFileHistorySnapshot(line))
    .map(line => ({
      timestamp: line.timestamp!,
      type: line.type,
      line,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Find lines by UUID
 */
export function findByUuid(conversation: Conversation, uuid: string): ConversationLine | undefined {
  return conversation.lines.find(line => 'uuid' in line && line.uuid === uuid);
}

/**
 * Get conversation thread (follow parentUuid chain)
 */
export function getThread(conversation: Conversation, startUuid: string): ConversationLine[] {
  const thread: ConversationLine[] = [];
  let current = findByUuid(conversation, startUuid);

  while (current) {
    thread.unshift(current);
    if ('parentUuid' in current && current.parentUuid) {
      current = findByUuid(conversation, current.parentUuid);
    } else {
      break;
    }
  }

  return thread;
}

/**
 * Get the last line from a transcript file content (JSONL format)
 * Returns the parsed conversation line or null if parsing fails
 */
export function getLastTranscriptLine(content: string): ConversationLine | null {
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    return null;
  }

  const lastLine = lines[lines.length - 1];

  if (!lastLine.trim()) {
    return null;
  }

  try {
    return JSON.parse(lastLine) as ConversationLine;
  } catch (error) {
    return null;
  }
}
