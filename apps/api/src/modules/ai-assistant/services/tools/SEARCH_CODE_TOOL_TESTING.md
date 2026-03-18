# Search Code Tool Integration - Testing Guide

## Overview

The `search_code` tool has been integrated into the AI assistant to use the event-driven code search API with SSE streaming.

## Implementation Details

### Tool Definition (OpenRouter)
- **Name**: `search_code`
- **Parameters**:
  - `pattern` (required): Search pattern
  - `fileTypes` (optional): Array of file extensions
  - `maxResults` (optional): Max results (default 50, max 100)

### Architecture
```
AI Tool Call → Tool Executor → Code Search API → pg-boss → CLI Worker → ripgrep
                                      ↓
                                   SSE Stream ← PostgreSQL NOTIFY
                                      ↓
                                 Tool Executor (collects results)
                                      ↓
                                 Formatted Response → AI
```

### Key Features
1. **Real-time streaming**: Results collected via SSE
2. **CLI requirement**: Returns error if CLI not connected
3. **Timeout handling**: 15-second timeout with partial results
4. **Result limiting**: Max 50 matches sent to AI to prevent context overflow
5. **Smart formatting**: Groups by file and provides summary

## Testing Checklist

### Prerequisites
- [ ] PostgreSQL running (port 5439)
- [ ] API server running (`cd apps/api && bun dev`)
- [ ] CLI connected to workspace (`cd apps/cli && bun run dev`)
- [ ] Workspace configured in database

### Manual Test Steps

#### 1. Test via AI Chat

```bash
# Start API server
cd apps/api && bun dev

# In another terminal, use the AI chat endpoint
curl -X POST "http://localhost:3000/api/v1/ai-assistant/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "YOUR_WORKSPACE_ID",
    "conversationId": "test-conv-id",
    "message": "Search the codebase for AuthService"
  }'
```

The AI should invoke the `search_code` tool automatically when you ask about code.

#### 2. Test Tool Executor Directly

```typescript
import { ToolExecutor } from './tool-executor.service';

const toolCall = {
  id: 'test-1',
  name: 'search_code',
  parameters: {
    pattern: 'AuthService',
    fileTypes: ['ts', 'tsx'],
    maxResults: 20,
  },
};

const context = {
  workspaceId: 'YOUR_WORKSPACE_ID',
  conversationId: 'test-conv-id',
};

const results = await ToolExecutor.executeTools([toolCall], context);
console.log(JSON.parse(results[0].content));
```

Expected output:
```json
{
  "success": true,
  "pattern": "AuthService",
  "matches": [
    {
      "file": "apps/api/src/modules/auth/service.ts",
      "line": 23,
      "content": "export class AuthService {"
    }
  ],
  "totalMatches": 42,
  "truncated": false,
  "durationMs": 234,
  "summary": "Found 42 matches in 12 files (234ms)"
}
```

#### 3. Test Error Cases

**No CLI Connected:**
```typescript
// Stop CLI, then call search_code
// Expected: Error with code 'NO_CLI_CONNECTED'
```

**Timeout:**
```typescript
// Search for very common pattern in large codebase
// Expected: Partial results with timedOut: true
```

**Invalid Parameters:**
```typescript
// Call with missing pattern
const toolCall = {
  id: 'test-2',
  name: 'search_code',
  parameters: {}, // Missing pattern
};
// Expected: Error with code 'INVALID_PARAMS'
```

### Automated Test (Future)

Create test file: `apps/api/src/modules/ai-assistant/services/tools/__tests__/search-code-tool.test.ts`

```typescript
import { describe, expect, test, beforeAll } from 'bun:test';
import { ToolExecutor } from '../tool-executor.service';

describe('search_code Tool Integration', () => {
  test('should search code via SSE', async () => {
    // Requires CLI to be running
    // Test implementation here
  });

  test('should handle CLI not connected', async () => {
    // Test error case
  });

  test('should limit results for AI', async () => {
    // Test result truncation
  });
});
```

## Verification Checklist

After implementation, verify:

- [ ] Tool is registered in OpenRouter.TOOLS
- [ ] Tool executor can call code search API
- [ ] SSE stream is collected correctly
- [ ] Results are formatted for AI consumption
- [ ] Timeout handling works
- [ ] CLI connection check works
- [ ] Error messages are helpful
- [ ] Results are truncated at 50 matches
- [ ] Summary includes file count and timing
- [ ] Tool invocations are logged to database

## Known Limitations

1. **CLI Required**: Tool only works when CLI is connected to workspace
2. **No Caching**: Every search executes fresh (per PRD requirements)
3. **Result Limit**: Hard limit of 50 matches sent to AI (configurable)
4. **Case Insensitive**: AI searches are always case-insensitive
5. **No Context**: Context lines set to 0 for AI searches (keeps results concise)

## Future Improvements

1. Add automated tests with mock CLI
2. Support regex patterns (currently substring only)
3. Add result caching for repeated queries
4. Support multiple concurrent searches per conversation
5. Add search history/analytics

## Troubleshooting

### "No CLI connected" error
- Ensure CLI is running: `cd apps/cli && bun run dev`
- Check CLI status in database: `SELECT * FROM cli_sessions WHERE project_id = 'WORKSPACE_ID'`

### Timeout errors
- Check pg-boss is processing jobs: `SELECT * FROM pgboss.job WHERE name = 'code-search-requested'`
- Check CLI logs for errors
- Verify workspace path is correct

### No results
- Test ripgrep directly in CLI: `rg "pattern" /workspace/path`
- Check file pattern matches files in workspace
- Verify workspace_root is set in workspace settings

## Example AI Conversation

**User**: "Where is the authentication logic implemented?"

**AI** (using search_code tool):
```
Let me search for authentication-related code...

[Calls search_code with pattern="authentication"]

Found 23 matches in 8 files (187ms):

1. apps/api/src/modules/auth/service.ts:15
   export class AuthenticationService {

2. apps/api/src/modules/auth/middleware.ts:42
   async function authenticate(req, res, next) {

3. apps/web/app/components/auth/LoginForm.tsx:8
   import { useAuthentication } from './hooks';

The main authentication logic is in `apps/api/src/modules/auth/service.ts`.
Would you like me to read that file for more details?
```

## References

- [CODE-SEARCH-PRD.md](/docs/CODE-SEARCH-PRD.md) - Original requirements
- [code-search.service.ts](../code-search.service.ts) - API service
- [tool-executor.service.ts](./tool-executor.service.ts) - Tool implementation
