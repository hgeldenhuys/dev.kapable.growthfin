# Hooks SDK Architecture

**Package**: `@agios/hooks-sdk`
**Purpose**: Intercept Claude Code tool uses and send to API
**Critical**: This is what broke for a full day - understand this flow!

---

## 🚨 Most Important Thing to Know

**Source code** (`src/*.ts`) is NOT what runs!
**Bundled code** (`node_modules/@agios/hooks-sdk/index.js`) is what runs!

After ANY change:
```bash
cd packages/hooks-sdk
bun run build
cp dist/bundle/index.js ../../node_modules/@agios/hooks-sdk/index.js
```

---

## 📁 File Structure

```
packages/hooks-sdk/
├── src/
│   ├── manager.ts          # Orchestrates everything
│   ├── use-hooks.ts        # Entry point (Phase 1: logging)
│   ├── index.ts            # Public API exports
│   └── utils/
│       ├── api-client.ts   # Sends events to API
│       ├── config.ts       # Reads .agent/config.json
│       ├── logger.ts       # Logs to .agent/hook-events.log
│       └── error-queue.ts  # Queues failed events
├── dist/
│   └── bundle/
│       └── index.js        # Built bundle (what gets copied)
└── package.json            # Build scripts
```

---

## 🔄 Execution Flow

```mermaid
graph LR
    CC[Claude Code] -->|executes| CH[.claude/hooks.ts]
    CH -->|imports| NM[node_modules/@agios/hooks-sdk]
    NM -->|runs| MG[HookManager]
    MG -->|1. logs| LOG[.agent/hook-events.log]
    MG -->|2. sends| API[localhost:3000/api/v1/hook-events]
    API -->|stores| DB[(PostgreSQL)]
```

---

## 🏗️ Build Process

### Source → Bundle → Deploy

1. **Source files** are TypeScript in `src/`
2. **Build command** creates bundle:
   ```bash
   bun run build  # Runs: bun build src/index.ts --outfile=dist/bundle/index.js --target=node --format=esm
   ```
3. **Deploy** to node_modules:
   ```bash
   cp dist/bundle/index.js ../../node_modules/@agios/hooks-sdk/index.js
   ```

### Why Bundle?
- Claude Code imports from node_modules, not source
- Bundle includes all dependencies
- Single file is easier to distribute via CLI install

---

## 🔑 Critical Code Sections

### manager.ts - Line 368 (The Bug That Broke Everything)

```typescript
// CORRECT (allows localhost without auth):
const accessToken = this.options.accessToken || getAccessToken() || '';

// WRONG (blocked all localhost requests):
const accessToken = this.options.accessToken || getAccessToken();
if (!accessToken) return null;  // This killed everything!
```

### api-client.ts - Line 50 (Conditional Auth Header)

```typescript
// Only add Authorization header if token exists
if (options.accessToken) {
  headers['Authorization'] = `Bearer ${options.accessToken}`;
}
```

---

## 📊 Enriched Logging Format

**Added**: November 2025

The SDK now logs events in an enriched format that includes conversation context and execution results.

### Log Structure

```json
{
  "input": {
    "hook": {
      "session_id": "...",
      "hook_event_name": "PreToolUse",
      "tool_name": "Bash",
      "tool_input": { /* ... */ }
    },
    "conversation": {
      "sessionId": "...",
      "version": "2.0.50",
      "gitBranch": "main",
      "message": {
        "model": "claude-sonnet-4-5-20250929",
        "usage": { /* token usage */ },
        /* full message context */
      }
    },
    "context": null,  // Reserved for future context tracking
    "timestamp": "2025-11-21T23:15:20.157Z"
  },
  "output": {
    "exitCode": 0,
    "success": true,
    "hasOutput": false
  }
}
```

### Log Locations

- **Local SDK** (`.claude/hooks.ts`): `.agent/hook-events.log`
- **Standalone** (`.agent/hooks.ts`): `.agent/hook-events.log`

Both use the same enriched format for consistency.

### Monitoring

```bash
# Watch all events
tail -f .agent/hook-events.log | jq

# Filter by event type
tail -f .agent/hook-events.log | jq 'select(.input.hook.hook_event_name == "PostToolUse")'

# Show only tool names
tail -f .agent/hook-events.log | jq -r '.input.hook.tool_name'

# Check conversation context
tail -f .agent/hook-events.log | jq '.input.conversation.message.usage'
```

### Why Enriched Format?

1. **Conversation Context**: Captures message metadata, token usage, git branch
2. **Execution Results**: Records exit codes and success status
3. **Debugging**: Full context for troubleshooting hook issues
4. **Analytics**: Rich data for session analysis and metrics

### Implementation Files

- `packages/hooks-sdk/src/utils/logger.ts` - `logEnriched()` method
- `packages/hooks-sdk/src/manager.ts` - Calls `logEnriched()` after execution
- `.agent/hooks.ts` - Standalone implementation with same format

---

## 🔧 Configuration

### `.agent/config.json`
```json
{
  "projectId": "0ebfac28-1680-4ec1-a587-836660140055",
  "apiUrl": "http://localhost:3000",
  "debugHooks": true,
  "apiTimeout": 2000
}
```

### `.claude/hooks.ts` (User's hook file)
```typescript
#!/usr/bin/env bun
import { HookManager } from '@agios/hooks-sdk';

const manager = new HookManager({
  projectId: '0ebfac28-1680-4ec1-a587-836660140055',
  apiUrl: 'http://localhost:3000',
});

// User's custom hooks here...

manager.run();
```

---

## 🐛 Troubleshooting

### "Events not reaching API"

1. Check if logging locally:
   ```bash
   tail -f .agent/hook-events.log
   ```

2. Check if accessToken required (line 368 in manager.ts)

3. Verify bundle is current:
   ```bash
   diff packages/hooks-sdk/dist/bundle/index.js \
        node_modules/@agios/hooks-sdk/index.js
   ```

4. Rebuild if needed:
   ```bash
   cd packages/hooks-sdk && bun run build
   cp dist/bundle/index.js ../../node_modules/@agios/hooks-sdk/index.js
   ```

### "Module not found: @agios/hooks-sdk"

Run installation:
```bash
bun apps/cli/src/index.ts hooks install
```

---

## 📋 Testing

### Manual Test
```bash
echo '{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Bash"}' | \
  bun packages/hooks-sdk/src/use-hooks.ts
```

Should see:
1. Entry in `.agent/hook-events.log`
2. Event in API (if configured)

### End-to-End Test
1. Execute any command in Claude Code
2. Check `.agent/hook-events.log` for event
3. Check watch CLI: `bun apps/cli/src/index.ts watch hooks`

---

## ⚠️ Common Mistakes

1. **Editing src/ without rebuilding** - Changes won't take effect
2. **Not copying to node_modules** - Claude Code uses old version
3. **Assuming auth required for localhost** - It's optional!
4. **Thinking "Phase 1" means incomplete** - It's intentionally minimal

---

## 📚 Related Documentation

- Installation process: [`apps/cli/src/commands/hooks.ts`](../../apps/cli/src/commands/hooks.ts)
- API endpoint: [`apps/api/src/modules/hook-events/routes.ts`](../../apps/api/src/modules/hook-events/routes.ts)
- Watch command: [`apps/cli/src/commands/watch.ts`](../../apps/cli/src/commands/watch.ts)