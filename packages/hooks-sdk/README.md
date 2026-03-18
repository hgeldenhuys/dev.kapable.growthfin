# @agios/hooks-sdk

Type-safe TypeScript SDK for Claude Code hooks development.

## Features

- ✅ **Type-safe** - Complete TypeScript definitions for all hook events
- ✅ **Fluent API** - Chain handlers with intuitive method names
- ✅ **File Logging** - Automatic event logging to JSON Lines format
- ✅ **Transcript Access** - Query Claude session transcripts
- ✅ **MCP Tools Support** - Helpers for working with MCP tools
- ✅ **API Integration** - Automatic event delivery with error queue
- ✅ **Smart Error Queue** - FIFO queue with opportunistic retry
- ✅ **Conversation Context** - Full transcript line context in payloads
- 🆕 **Transform Utilities** - Conversation logging, file tracking, todo monitoring, AI summaries

## Installation

### Recommended: Agios CLI

The recommended way to install the hooks SDK is via the Agios CLI:

```bash
# Install globally (future)
npm install -g @agios/cli

# Or use from development
cd apps/cli
bun link

# Then from your project directory
agios login              # Authenticate first
agios hooks install      # Installs SDK and creates sample hooks file
```

This will:
1. Authenticate you with the Agios API
2. Create `.agent/config.json` with unique projectId
3. Download hooks SDK from API
4. Extract to `node_modules/@agios/hooks-sdk/`
5. Create sample `.claude/hooks.ts` file
6. Update `.gitignore` to exclude `.agent/`

See [CLI Documentation](../../apps/cli/README.md) for complete guide.

### Development Installation

For development, you can manually copy the SDK:

```bash
# From your project root
bun run packages/hooks-sdk/src/install-hooks.ts
```

This will:
1. Copy hooks-sdk to `.agent/hooks-sdk/`
2. Make the script executable
3. Configure `.claude/settings.json`

## Quick Start

### Installation Options

```bash
# Install all hooks to project settings (default)
bun run packages/hooks-sdk/src/install-hooks.ts

# Install specific hooks only
bun run install-hooks --preToolUse --postToolUse

# Install all hooks except certain ones
bun run install-hooks --no-sessionStart --no-sessionEnd

# View help
bun run install-hooks --help

# Uninstall all hooks
bun run uninstall-hooks
```

The script automatically configures your `.claude/settings.json` file.

### Manual Installation

Alternatively, you can manually configure Claude Code by editing `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.agent/hooks-sdk/src/use-hooks.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.agent/hooks-sdk/src/use-hooks.ts"
          }
        ]
      }
    ]
  }
}
```

Note: Claude Code provides `$CLAUDE_PROJECT_DIR` which points to your project root.

## Distribution

The hooks SDK is **not published to npm**. Instead, it's distributed as a pre-built tarball:

### Build Process

```bash
# From packages/hooks-sdk
bun run build

# This creates:
# - dist/bundle/ (compiled JS + types)
# - dist/hooks-sdk.tgz (tarball)
```

The build script (`build.ts`):
1. Bundles TypeScript to JavaScript
2. Copies TypeScript definitions
3. Includes package.json and README
4. Creates tarball using `tar -czf`

### API Distribution

The tarball is served by the API:
```bash
GET /download/hooks-sdk.tgz
HEAD /download/hooks-sdk.tgz
GET /download/hooks-sdk/version
```

### CLI Installation

The CLI (`agios hooks install`):
1. Downloads tarball from API
2. Extracts to `node_modules/@agios/hooks-sdk/`
3. No npm install required
4. Works offline after first download

## Quick Start

### Custom Handlers

After installation via CLI, customize your `.claude/hooks.ts`:

```typescript
import { HookManager, success, block } from '@agios/hooks-sdk';

const manager = new HookManager({
  projectId: '0ebfac28-1680-4ec1-a587-836660140055',  // From .agent/config.json
  apiUrl: 'http://localhost:3000',
});
```

Full example:

```typescript
#!/usr/bin/env bun
import { HookManager, success, block } from '@agios/hooks-sdk';

const manager = new HookManager();

// Block dangerous bash commands
manager.onPreToolUse(async (input, context) => {
  if (input.tool_name === 'Bash') {
    const command = input.tool_input.command as string;

    if (command.includes('rm -rf /')) {
      return block('Dangerous command detected!', {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'This command could delete your entire system'
        }
      });
    }
  }

  return success();
});

// Log all file writes
manager.onPostToolUse(async (input, context) => {
  if (input.tool_name === 'Write') {
    const filePath = input.tool_input.file_path as string;
    console.log(`File written: ${filePath}`);
  }

  return success();
});

manager.run();
```

## API Reference

### HookManager

The main class for registering and executing hook handlers.

```typescript
const manager = new HookManager();

// Register handlers
manager
  .onPreToolUse(handler)
  .onPostToolUse(handler)
  .onNotification(handler)
  .onUserPromptSubmit(handler)
  .onStop(handler)
  .onSubagentStop(handler)
  .onPreCompact(handler)
  .onSessionStart(handler)
  .onSessionEnd(handler);

// Execute (reads from stdin, outputs to stdout)
await manager.run();
```

### Hook Handlers

Each handler receives `input` and `context`:

```typescript
type HookHandler<TInput, TOutput> = (
  input: TInput,
  context: HookContext
) => Promise<HookResult<TOutput>> | HookResult<TOutput>;
```

**Example**:

```typescript
manager.onPreToolUse(async (input, context) => {
  // input: PreToolUseInput (type-safe)
  // context: HookContext (transcript access)

  const tool = input.tool_name;
  const params = input.tool_input;

  // Access transcript
  const recentLines = await context.getFullTranscript();

  // Return result
  return success();
});
```

### Utility Functions

#### success(stdout?, output?)

Create a success result (exit code 0):

```typescript
return success('Operation completed');
return success(undefined, { systemMessage: 'All good!' });
```

#### block(stderr, output?)

Create a blocking error (exit code 2):

```typescript
return block('Permission denied', {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'Sensitive file access'
  }
});
```

#### error(stderr, exitCode?)

Create a non-blocking error:

```typescript
return error('Warning: Large file detected', 1);
```

### Transcript Access

Query Claude session transcripts:

```typescript
manager.onStop(async (input, context) => {
  // Get specific line
  const line = await context.getTranscriptLine(10);

  // Get all lines
  const allLines = await context.getFullTranscript();

  // Search for specific content
  const errorLines = await context.searchTranscript((line) => {
    return line.raw.toLowerCase().includes('error');
  });

  return success();
});
```

### Tool Helpers

```typescript
import { matchesTool, isMCPTool, parseMCPTool } from '@agios/hooks-sdk';

// Check if tool matches pattern
if (matchesTool('Bash', 'Bash|Read|Write')) {
  // ...
}

// Check if MCP tool
if (isMCPTool('mcp__memory__create')) {
  const parsed = parseMCPTool('mcp__memory__create');
  // parsed: { server: 'memory', tool: 'create' }
}
```

## File Logging

### Enriched Log Format (November 2025)

Events are automatically logged to `.agent/hook-events.log` in an **enriched format** that includes conversation context and execution results:

```json
{
  "input": {
    "hook": {
      "session_id": "283581bb-1f97-4aa8-afa9-d8f08588fa6a",
      "hook_event_name": "PreToolUse",
      "tool_name": "Bash",
      "tool_input": { "command": "ls -la" }
    },
    "conversation": {
      "sessionId": "283581bb-1f97-4aa8-afa9-d8f08588fa6a",
      "version": "2.0.50",
      "gitBranch": "main",
      "message": {
        "model": "claude-sonnet-4-5-20250929",
        "usage": {
          "input_tokens": 9,
          "cache_read_input_tokens": 49403,
          "output_tokens": 137
        }
      }
    },
    "context": null,
    "timestamp": "2025-11-21T23:15:20.157Z"
  },
  "output": {
    "exitCode": 0,
    "success": true,
    "hasOutput": false
  }
}
```

**Benefits:**
- 🎯 **Conversation Context**: Captures Claude model, token usage, git branch
- ✅ **Execution Results**: Records exit codes and success status
- 🔍 **Rich Debugging**: Full context for troubleshooting
- 📊 **Analytics**: Deep insights into session patterns and performance

### Monitoring Logs

```bash
# Watch all events
tail -f .agent/hook-events.log | jq

# Filter by event type
tail -f .agent/hook-events.log | jq 'select(.input.hook.hook_event_name == "PostToolUse")'

# Show tool names only
tail -f .agent/hook-events.log | jq -r '.input.hook.tool_name'

# Monitor token usage
tail -f .agent/hook-events.log | jq '.input.conversation.message.usage'
```

### Custom Log Path

```typescript
import { HookLogger } from '@agios/hooks-sdk';

const logger = new HookLogger('/custom/path/to/logs.jsonl');
logger.log(input);
```

### Legacy Format

For backward compatibility, you can still use the simple format:

```jsonl
{"timestamp":"2025-10-14T10:30:00.000Z","event":"PreToolUse","session_id":"abc123","tool_name":"Bash","payload":{...}}
```

Use `logger.log(input)` instead of `logger.logEnriched(input, result, conversation, context)`.

## Transform Utilities

**NEW**: Convenient transform utilities for common hook patterns.

The SDK now includes powerful transform utilities that make it easy to implement common logging and analytics patterns. These are production-ready and can be used in backend services.

### Available Transforms

1. **ConversationLogger** - Track conversation turns with user prompts and assistant responses
2. **FileChangeTracker** - Monitor file modifications from Write/Edit/MultiEdit tools
3. **TodoTracker** - Track todo items and progress
4. **AISummarizer** - Auto-summarize Stop events using Claude Haiku

### Quick Start with Transforms

```typescript
import {
  HookManager,
  success,
  ConversationLogger,
  FileChangeTracker,
  TodoTracker,
} from '@agios/hooks-sdk';

const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();
const todoTracker = new TodoTracker();

const manager = new HookManager();

manager
  .onUserPromptSubmit((input) => {
    conversationLogger.recordUserPrompt(input);
    return success();
  })
  .onPreToolUse((input) => {
    conversationLogger.recordToolUse(input.tool_name);
    return success();
  })
  .onPostToolUse((input) => {
    fileTracker.recordChange(input);
    todoTracker.recordTodoWrite(input);
    return success();
  })
  .onStop(async (input, context) => {
    // Get all transform data
    const turn = await conversationLogger.recordStop(input, context);
    const files = fileTracker.getBatch(input.session_id);
    const todos = todoTracker.getSnapshot(input.session_id);

    console.log('Conversation Turn:', turn.turn_number);
    console.log('Files Modified:', files.total_files);
    console.log('Todo Progress:', todoTracker.getCompletionPercentage(input.session_id) + '%');

    return success();
  });

manager.run();
```

### Example Output

**Conversation Turn:**
```json
{
  "assistant": {
    "content": "I'll help you implement that feature...",
    "timestamp": "2025-11-21T23:00:00.000Z",
    "toolsUsed": ["Read", "Edit", "TodoWrite"]
  },
  "user_prompts": [
    { "text": "Can you add error handling?", "timestamp": "..." }
  ],
  "turn_number": 5,
  "session_id": "abc123"
}
```

**File Changes:**
```json
{
  "file": "src/utils/api.ts",
  "operation": "modified",
  "tool": "Edit",
  "timestamp": "2025-11-21T23:00:00.000Z",
  "session_id": "abc123",
  "size_hint": 1234
}
```

**Todo Progress:**
```json
{
  "event_type": "todos_updated",
  "todos": [...],
  "completed": 3,
  "in_progress": 1,
  "pending": 2,
  "timestamp": "2025-11-21T23:00:00.000Z"
}
```

**AI Summary (requires ANTHROPIC_API_KEY):**
```json
{
  "summary": "Added error handling to API utility functions",
  "model": "claude-haiku-3-5-20241022",
  "input_tokens": 125,
  "output_tokens": 12,
  "timestamp": "2025-11-21T23:00:00.000Z"
}
```

### Complete Examples

See [`examples/transforms/`](./examples/transforms/) for complete working examples:

- **conversation-logger.ts** - Chat-style logging
- **file-changes-logger.ts** - File modification tracking
- **todo-logger.ts** - Todo progress monitoring
- **ai-summarizer.ts** - Automatic Stop event summaries
- **all-transforms.ts** - All transforms combined

### Transform API Reference

#### ConversationLogger

```typescript
const logger = new ConversationLogger();

// Record events
logger.recordUserPrompt(input);
logger.recordToolUse(toolName);
const turn = await logger.recordStop(input, context);

// Utilities
logger.getTurnNumber(); // Current turn number
logger.reset(); // Reset state
```

#### FileChangeTracker

```typescript
const tracker = new FileChangeTracker();

// Record changes
const change = tracker.recordChange(input);

// Get data
const batch = tracker.getBatch(sessionId);
const files = tracker.getUniqueFiles(sessionId);
const count = tracker.getFileModificationCount(sessionId, filePath);

// Cleanup
tracker.clearSession(sessionId);
```

#### TodoTracker

```typescript
const tracker = new TodoTracker();

// Record todos
const event = tracker.recordTodoWrite(input);

// Get data
const snapshot = tracker.getSnapshot(sessionId);
const inProgress = tracker.getTodosByStatus(sessionId, 'in_progress');
const pct = tracker.getCompletionPercentage(sessionId);

// Cleanup
tracker.clearSession(sessionId);
```

#### AISummarizer

```typescript
const summarizer = new AISummarizer({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-3-5-20241022',
});

// Generate summaries
const summary = await summarizer.summarizeStop(input, context);

// Custom prompts
const custom = await summarizer.summarizeWithPrompt(
  content,
  'Summarize: {content}',
  sessionId
);

// Utilities
summarizer.getTurnNumber(); // Current turn
summarizer.reset(); // Reset counter
```

### Production Usage

```typescript
manager.onStop(async (input, context) => {
  const turn = await conversationLogger.recordStop(input, context);
  const files = fileTracker.getBatch(input.session_id);
  const todos = todoTracker.getSnapshot(input.session_id);

  // Send to your analytics backend
  await fetch('https://api.example.com/sessions/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'stop',
      conversation: turn,
      files,
      todos,
      timestamp: new Date().toISOString(),
    }),
  });

  return success();
});
```

## Hook Event Types

### PreToolUse

Fired before a tool is executed. Can block execution.

```typescript
interface PreToolUseInput {
  hook_event_name: 'PreToolUse';
  session_id: string;
  transcript_path: string;
  cwd: string;
  tool_name: string;
  tool_input: Record<string, any>;
}
```

### PostToolUse

Fired after a tool completes.

```typescript
interface PostToolUseInput {
  hook_event_name: 'PostToolUse';
  session_id: string;
  transcript_path: string;
  cwd: string;
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
}
```

### UserPromptSubmit

Fired when user submits a prompt.

```typescript
interface UserPromptSubmitInput {
  hook_event_name: 'UserPromptSubmit';
  session_id: string;
  transcript_path: string;
  cwd: string;
  prompt: string;
}
```

### SessionStart

Fired when a session starts.

```typescript
interface SessionStartInput {
  hook_event_name: 'SessionStart';
  session_id: string;
  transcript_path: string;
  cwd: string;
  source: 'startup' | 'resume' | 'clear' | 'compact';
}
```

See [types.ts](./src/types.ts) for all event types.

## Development

```bash
# Type check
bun run typecheck

# Build
bun run build

# Test
bun run test
```

## Configuration

### HookManager Options

```typescript
interface HookManagerOptions {
  projectId?: string;      // Unique project identifier from .agent/config.json
  apiUrl?: string;         // API endpoint (default: http://localhost:3000)
  accessToken?: string;    // API access token (auto-read from .agent/config.json)
  apiTimeout?: number;     // API request timeout in ms (default: 2000ms)
  debugHooks?: boolean;    // Enable debug logging to .agent/hook-events.log (default: true)
  logPath?: string;        // Custom log file path
  enableApi?: boolean;     // Enable/disable API integration (default: true if authenticated)
}

const manager = new HookManager({
  projectId: '0ebfac28-...',  // Required for API integration
  apiUrl: 'http://localhost:3000',
  apiTimeout: 2000,           // 2 second timeout for API requests
  debugHooks: true,           // Enable file logging (default: true)
});
```

### Project ID

Each project gets a unique `projectId` (UUID v4) when you run `agios hooks install`. This ID is stored in `.agent/config.json` and used to identify your project in the API.

```json
{
  "projectId": "0ebfac28-1680-4ec1-a587-836660140055",
  "apiUrl": "http://localhost:3000",
  "apiTimeout": 2000,
  "debugHooks": true,
  "auth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2025-10-15T12:00:00.000Z"
  }
}
```

## API Integration

Hook events are automatically sent to the Agios API for analysis and storage. The integration is designed to never impede Claude's performance.

### How It Works

On every hook event execution:

1. **Try to Drain Queue First** (opportunistic, non-blocking)
   - Attempts to send previously queued events
   - Fast timeout (2s default, configurable via `apiTimeout`)
   - Continues immediately if API unavailable

2. **Execute User Handlers**
   - Your custom hook logic runs normally
   - Handlers execute in sequence

3. **Send Current Event to API** (or queue on failure)
   - Builds payload with conversation context (last transcript line)
   - Sends to API with timeout
   - On failure: queues event + plays beep + logs error

### Error Queue

Failed API requests are saved to `.agent/error-queue/` as individual JSON files:

```
.agent/error-queue/
  ├── 1729012345678-a7b3c9d.json
  ├── 1729012346789-e5f1g2h.json
  └── 1729012347890-i3j4k5l.json
```

**Queue Behavior:**
- **FIFO ordering**: Events are processed in the order they were queued
- **Opportunistic retry**: Queue draining is attempted on every new hook event
- **No exponential backoff**: Failed sends are skipped immediately (doesn't impede Claude)
- **Preserves sequence**: Failed events stay queued to maintain order
- **User notification**: Beeps on error + logs to `.agent/error.log`

### Configuring Timeout

The API timeout is configurable to balance reliability vs. performance:

```typescript
// In .claude/hooks.ts
const manager = new HookManager({
  apiTimeout: 2000,  // 2 seconds (default)
});
```

Or in `.agent/config.json`:
```json
{
  "apiTimeout": 3000  // 3 seconds
}
```

**Recommendations:**
- **Fast networks**: 1000-2000ms
- **Slow/unstable networks**: 3000-5000ms
- **Local development**: 500-1000ms

### Disabling File Logging

Debug logging to `.agent/hook-events.log` is enabled by default. To disable:

```typescript
const manager = new HookManager({
  debugHooks: false,  // Disable file logging
});
```

Or in `.agent/config.json`:
```json
{
  "debugHooks": false
}
```

### Disabling API Integration

```typescript
const manager = new HookManager({
  enableApi: false,  // Disable API integration entirely
});
```

## Future Enhancements

- [x] ✅ CLI-based installation (Completed)
- [x] ✅ API distribution via tarball (Completed)
- [x] ✅ HTTP client for API integration (Completed)
- [x] ✅ Automatic retry logic (Completed - Smart queue)
- [ ] Event compression
- [ ] Local database option (SQLite)
- [ ] Event batching for efficiency

## Related Documentation

- [Architecture Documentation](../../temp/ARCHITECTURE.md)
- [CLI Documentation](../../apps/cli/README.md)
- [API Documentation](../../apps/api/README.md)

## License

Proprietary - Part of the Agios project
