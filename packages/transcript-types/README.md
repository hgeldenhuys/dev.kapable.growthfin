# @agios/transcript-types

TypeScript types and utilities for working with Claude Code transcript files (`.jsonl` format).

## Overview

Claude Code generates transcript files that log all interactions during a coding session. This package provides:

- **TypeScript types** - Fully typed definitions for all transcript line types
- **Type guards** - Runtime type checking functions
- **Parser utilities** - Functions to parse and serialize transcripts
- **Analysis utilities** - Tools to extract insights from transcripts

## Installation

```bash
bun add @agios/transcript-types
```

## Usage

### Basic Parsing

```typescript
import { parseTranscript, type Conversation } from '@agios/transcript-types';
import { readFileSync } from 'fs';

// Read and parse a transcript file
const content = readFileSync('./transcript.jsonl', 'utf-8');
const conversation = parseTranscript(content);

console.log(`Total lines: ${conversation.lines.length}`);
console.log(`Session ID: ${conversation.sessionId}`);
```

### Type Guards

```typescript
import {
  isAssistantMessage,
  isToolUseContent,
  getUserMessages,
} from '@agios/transcript-types';

// Filter to only assistant messages
for (const line of conversation.lines) {
  if (isAssistantMessage(line)) {
    // TypeScript knows this is an AssistantMessage
    console.log(`Model: ${line.message.model}`);

    // Check content types
    for (const content of line.message.content) {
      if (isToolUseContent(content)) {
        console.log(`Tool used: ${content.name}`);
      }
    }
  }
}

// Or use utility functions
const userMessages = getUserMessages(conversation);
```

### Conversation Analysis

```typescript
import {
  getConversationStats,
  getToolUses,
  extractThinking,
  extractThinkingText,
} from '@agios/transcript-types';

// Get comprehensive statistics
const stats = getConversationStats(conversation);
console.log(`Duration: ${stats.duration}`);
console.log(`Total tokens: ${stats.totalInputTokens + stats.totalOutputTokens}`);
console.log(`Tool uses:`, stats.toolUsesByName);

// Get all tool uses
const toolUses = getToolUses(conversation);
for (const { toolUse, message } of toolUses) {
  console.log(`${toolUse.name}: ${JSON.stringify(toolUse.input)}`);
}

// Extract thinking blocks
const thinkingBlocks = extractThinking(conversation);
for (const { thinking, signature, message } of thinkingBlocks) {
  console.log(`Thinking at ${message.timestamp}:`);
  console.log(thinking.slice(0, 200) + '...');
}

// Or just get the thinking text
const thinkingTexts = extractThinkingText(conversation);
console.log(`Total thinking: ${thinkingTexts.length} blocks`);
```

### Filtering and Searching

```typescript
import {
  filterByType,
  getToolUsesByName,
  findByUuid,
  getThread,
} from '@agios/transcript-types';

// Filter by type
const systemMessages = filterByType(conversation, 'system');

// Get specific tool uses
const readCalls = getToolUsesByName(conversation, 'Read');
const bashCalls = getToolUsesByName(conversation, 'Bash');

// Find by UUID
const line = findByUuid(conversation, 'some-uuid-here');

// Get conversation thread
const thread = getThread(conversation, 'some-uuid-here');
```

### Working with Timestamps

```typescript
import { getTimeline } from '@agios/transcript-types';

// Get chronological timeline
const timeline = getTimeline(conversation);

for (const { timestamp, type, line } of timeline) {
  console.log(`${timestamp} - ${type}`);
}
```

## Types

### Core Types

- `Conversation` - The main conversation object containing all lines
- `ConversationLine` - Union type of all possible line types
- `Summary` - Conversation summary metadata
- `FileHistorySnapshot` - File backup information
- `SystemMessage` - System-generated messages
- `UserMessage` - Messages from the user (including tool results)
- `AssistantMessage` - Messages from Claude (including tool uses and thinking)

### Message Content

- `MessageContent` - Union of content types
- `ThinkingContent` - Claude's thinking blocks
- `ToolUseContent` - Tool invocations
- `TextContent` - Plain text responses

### Utility Types

- `ToolInput` - Input parameters for tool uses
- `ToolResult` - Results from tool executions
- `UsageInfo` - Token usage information
- `ConversationStats` - Conversation statistics

## Type Guards

All types come with corresponding type guard functions:

- `isSummary(line)`
- `isFileHistorySnapshot(line)`
- `isSystemMessage(line)`
- `isUserMessage(line)`
- `isAssistantMessage(line)`
- `isThinkingContent(content)`
- `isToolUseContent(content)`
- `isTextContent(content)`

## API Reference

### Parser Functions

#### `parseTranscript(content: string): Conversation`

Parse a complete JSONL transcript file.

#### `parseTranscriptLine(line: string): ConversationLine`

Parse a single JSONL line.

#### `serializeTranscript(conversation: Conversation): string`

Convert a Conversation back to JSONL format.

#### `serializeTranscriptLine(line: ConversationLine): string`

Convert a single line to JSON.

### Analysis Functions

#### `getConversationStats(conversation: Conversation): ConversationStats`

Get comprehensive statistics about the conversation.

#### `getToolUses(conversation: Conversation)`

Get all tool uses with their associated messages.

#### `getToolUsesByName(conversation: Conversation, toolName: string)`

Filter tool uses by tool name.

#### `extractAssistantText(conversation: Conversation): string[]`

Extract all text content from assistant messages.

#### `extractThinking(conversation: Conversation)`

Extract all thinking blocks with their signatures and associated messages.

Returns an array of objects containing:
- `thinking`: The thinking content
- `signature`: The cryptographic signature
- `message`: The full AssistantMessage

#### `extractThinkingText(conversation: Conversation): string[]`

Extract just the thinking text content (without signatures or message context).

### Filter Functions

#### `filterByType<T>(conversation: Conversation, type: T)`

Filter lines by type with proper TypeScript narrowing.

#### `getAssistantMessages(conversation: Conversation): AssistantMessage[]`

Get all assistant messages.

#### `getUserMessages(conversation: Conversation): UserMessage[]`

Get all user messages.

#### `getSystemMessages(conversation: Conversation): SystemMessage[]`

Get all system messages.

### Navigation Functions

#### `getTimeline(conversation: Conversation)`

Get chronologically ordered conversation events.

#### `findByUuid(conversation: Conversation, uuid: string)`

Find a specific line by UUID.

#### `getThread(conversation: Conversation, startUuid: string)`

Get the conversation thread starting from a UUID (follows parentUuid chain).

## Development

### Analyzing New Transcripts

This package includes a shape analyzer that can be used to update types when the transcript format changes:

```bash
bun run analyze [path-to-transcript.jsonl]
```

The analyzer will:
1. Parse all lines
2. Identify unique JSON structures
3. Generate TypeScript types
4. Print analysis to console

### Building

```bash
bun install
bun run build
```

### Type Checking

```bash
bun run type-check
```

## License

MIT
