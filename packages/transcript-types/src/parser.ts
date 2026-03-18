/**
 * Utility functions for parsing and working with Claude Code transcripts
 */

import type { Conversation, ConversationLine } from './types';
import { isSummary, isFileHistorySnapshot } from './types';

export class TranscriptParseError extends Error {
  constructor(
    message: string,
    public lineNumber: number,
    public rawLine: string
  ) {
    super(`${message} (line ${lineNumber})`);
    this.name = 'TranscriptParseError';
  }
}

/**
 * Parse a JSONL transcript file into a Conversation object
 */
export function parseTranscript(content: string): Conversation {
  const lines = content.split('\n').filter(line => line.trim());
  const conversationLines: ConversationLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);
      conversationLines.push(parsed as ConversationLine);
    } catch (error) {
      throw new TranscriptParseError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        i + 1,
        lines[i]
      );
    }
  }

  // Filter for lines that have timestamp and sessionId (exclude Summary and FileHistorySnapshot)
  const messagesWithMetadata = conversationLines.filter(l => !isSummary(l) && !isFileHistorySnapshot(l));

  return {
    lines: conversationLines,
    sessionId: messagesWithMetadata.find(l => l.sessionId)?.sessionId,
    startedAt: messagesWithMetadata[0]?.timestamp,
    endedAt: messagesWithMetadata[messagesWithMetadata.length - 1]?.timestamp,
  };
}

/**
 * Parse a single JSONL line
 */
export function parseTranscriptLine(line: string): ConversationLine {
  try {
    return JSON.parse(line) as ConversationLine;
  } catch (error) {
    throw new Error(`Failed to parse line: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Serialize a Conversation back to JSONL format
 */
export function serializeTranscript(conversation: Conversation): string {
  return conversation.lines.map(line => JSON.stringify(line)).join('\n');
}

/**
 * Serialize a single line to JSON
 */
export function serializeTranscriptLine(line: ConversationLine): string {
  return JSON.stringify(line);
}
