# @agios/transcript-types Package

## Summary

This package provides TypeScript types and utilities for working with Claude Code transcript files (`.jsonl` format). It was created by analyzing actual transcript files to reverse-engineer the schema.

## Package Structure

```
temp/transcript-types/
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript type definitions
│   ├── parser.ts          # Parsing utilities
│   ├── utils.ts           # Analysis and filtering utilities
│   └── test-example.ts    # Example usage and test
├── analyze-shapes.ts      # Shape analyzer tool
├── generated-types.ts     # Raw generated types (reference)
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
└── README.md             # Full documentation

```

## Key Features

### 1. Complete Type Safety
- **5 Main Types**: Summary, FileHistorySnapshot, SystemMessage, UserMessage, AssistantMessage
- **Type Guards**: Runtime type checking for all types
- **Union Types**: ConversationLine, MessageContent

### 2. Parsing & Serialization
- Parse complete transcript files
- Parse individual lines
- Serialize back to JSONL format
- Error handling with detailed error messages

### 3. Analysis Tools
- **Conversation Statistics**: token usage, tool usage, duration, message counts
- **Tool Usage Tracking**: filter by tool name, get all tool uses
- **Timeline Analysis**: chronological event ordering
- **Thread Navigation**: follow parentUuid chains

### 4. Filtering & Search
- Filter by type with TypeScript narrowing
- Find lines by UUID
- Extract assistant text responses
- Get conversation threads

## Test Results

✅ **All tests passed successfully!**

Tested on transcript file with:
- 2,061 total lines
- 755 assistant messages
- 457 user messages
- 750 system messages
- 346 tool uses across 10 different tools
- 54M+ cache hit tokens
- 8M+ cache miss tokens

## Usage Examples

### Basic Parsing
```typescript
import { parseTranscript } from '@agios/transcript-types';
const conversation = parseTranscript(fileContent);
```

### Type Guards
```typescript
import { isAssistantMessage, isToolUseContent } from '@agios/transcript-types';

for (const line of conversation.lines) {
  if (isAssistantMessage(line)) {
    for (const content of line.message.content) {
      if (isToolUseContent(content)) {
        console.log(`Tool: ${content.name}`);
      }
    }
  }
}
```

### Analysis
```typescript
import { getConversationStats, getToolUsesByName } from '@agios/transcript-types';

const stats = getConversationStats(conversation);
console.log(`Total tokens: ${stats.totalInputTokens + stats.totalOutputTokens}`);

const readCalls = getToolUsesByName(conversation, 'Read');
console.log(`Read tool used ${readCalls.length} times`);
```

## Shape Analyzer

The package includes a powerful shape analyzer (`analyze-shapes.ts`) that can:
- Parse JSONL files line by line
- Identify unique JSON structures
- Analyze field types and optionality
- Generate TypeScript types automatically
- Print detailed analysis reports

Run it with:
```bash
bun run analyze-shapes.ts [path-to-transcript.jsonl]
```

## Installation

Once moved to the packages folder:
```bash
bun add @agios/transcript-types
```

## Building

```bash
cd temp/transcript-types
bun install
bun run build
```

## Next Steps

To integrate into the main monorepo:

1. **Move to packages folder**:
   ```bash
   mv temp/transcript-types packages/transcript-types
   ```

2. **Update root package.json**:
   ```json
   {
     "workspaces": [
       "packages/*",
       "apps/*"
     ]
   }
   ```

3. **Add to other packages**:
   ```json
   {
     "dependencies": {
       "@agios/transcript-types": "workspace:*"
     }
   }
   ```

4. **Use in hook-events module**:
   ```typescript
   import { parseTranscript, getToolUses } from '@agios/transcript-types';
   ```

## Files Created

1. **src/types.ts** - All TypeScript type definitions (350+ lines)
2. **src/parser.ts** - Parsing utilities (70+ lines)
3. **src/utils.ts** - Analysis and filtering utilities (250+ lines)
4. **src/index.ts** - Main export file
5. **src/test-example.ts** - Example usage and tests
6. **analyze-shapes.ts** - Shape analyzer tool (300+ lines)
7. **package.json** - Package configuration
8. **tsconfig.json** - TypeScript configuration
9. **README.md** - Comprehensive documentation
10. **generated-types.ts** - Raw generated types (reference)

## Development Tools

### Type Checking
```bash
bun run type-check
```

### Run Tests
```bash
bun run src/test-example.ts [path-to-transcript]
```

### Analyze New Transcripts
```bash
bun run analyze-shapes.ts [path-to-transcript]
```

## Notes

- All types are inferred from actual transcript data
- The analyzer can be re-run when transcript format changes
- Type guards provide runtime safety
- Utilities cover common analysis patterns
- Well-documented with JSDoc comments
- Zero runtime dependencies
- Built for Bun but works with Node.js too
