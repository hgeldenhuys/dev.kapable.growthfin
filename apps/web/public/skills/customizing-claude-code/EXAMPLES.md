# Real-World Customization Examples

Examples from the Agios project showing how different customizations work together.

## Example 1: Session Tracking System

**Goal**: Track all Claude Code sessions with metadata for analysis.

**Customizations Used**:
- Hook (SessionStart, SessionEnd)
- MCP Server (database access)
- Skill (session-lookup)

### Implementation

**1. Hook captures session events** (`.agent/hooks.ts`):
```typescript
export default {
  SessionStart: async (event) => {
    const projectId = await getProjectId();
    const sessionData = {
      session_id: event.sessionId,
      project_id: projectId,
      started_at: new Date().toISOString(),
      cwd: process.cwd()
    };

    // Store via API
    await fetch('http://localhost:3000/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });

    return { continue: true };
  }
}
```

**2. Skill provides analysis** (`skills/session-lookup/SKILL.md`):
```markdown
---
name: session-lookup
description: Query and analyze previous Claude Code sessions by ID. Use when referencing past work or investigating previous sessions.
---

# Session Lookup

Query the observability database for session details...
```

**3. Result**: Automatic session tracking + easy query interface

---

## Example 2: SDLC Kanban System

**Goal**: Manage user stories, track progress, delegate to agents.

**Customizations Used**:
- Skill (agile-orchestration)
- Hooks (file tracking)
- Slash Command (/sdlc_reflect)

### Implementation

**1. Skill provides workflow** (`skills/agile-orchestration/SKILL.md`):
```yaml
---
name: agile-orchestration
description: SDLC orchestration, user story writing, kanban management, sprint execution, and agent delegation.
---
```

**2. Slash command triggers reflection** (`.claude/commands/sdlc_reflect.md`):
```markdown
Reflect on SDLC system effectiveness and generate improvement recommendations.

Review:
- Story quality and completeness
- Agent delegation patterns
- Cycle time and velocity
- Coherence maintenance
```

**3. Hook tracks file changes**:
```typescript
ToolCallComplete: async (event) => {
  if (event.toolName === 'Write' || event.toolName === 'Edit') {
    // Log file modifications for story tracking
    await logFileModification({
      session_id: event.sessionId,
      file_path: event.params.file_path,
      tool: event.toolName
    });
  }
  return { continue: true };
}
```

**4. Result**: Complete SDLC workflow with audit trail

---

## Example 3: Chrome Testing Integration

**Goal**: Test web UI changes automatically using browser automation.

**Customizations Used**:
- MCP Server (Chrome)
- Sub-agent (frontend-qa)
- Skill (component-testing)

### Implementation

**1. MCP provides Chrome tools** (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-chrome"]
    }
  }
}
```

**2. Sub-agent configured for QA**:
```typescript
await Task({
  subagent_type: "frontend-qa",
  description: "Test contact form",
  prompt: `
    Test the contact form UI at http://localhost:5173

    Using Chrome MCP:
    1. Navigate to /contacts/new
    2. Fill form fields
    3. Submit and verify
    4. Take screenshot of results
  `
});
```

**3. Skill provides testing patterns** (`skills/component-testing/SKILL.md`):
```markdown
Test React components using Chrome MCP...
- Navigation patterns
- Form interaction
- Screenshot verification
- Accessibility checks
```

**4. Result**: Automated browser testing with agent delegation

---

## Example 4: API Contract Testing

**Goal**: Ensure frontend and backend stay in sync via contract tests.

**Customizations Used**:
- Hook (ToolCallComplete validation)
- Skill (debugging-api-endpoints)

### Implementation

**1. Hook validates API contracts**:
```typescript
ToolCallComplete: async (event) => {
  // If Write/Edit touched a route file
  if (event.params.file_path?.includes('/routes/')) {
    // Check for contract test
    const routeName = extractRouteName(event.params.file_path);
    const hasTest = await fileExists(
      `test/integration/${routeName}.contract.test.ts`
    );

    if (!hasTest) {
      return {
        continue: false,
        message: `⚠️ Missing contract test for ${routeName}\n` +
                 `Create test/integration/${routeName}.contract.test.ts`
      };
    }
  }
  return { continue: true };
}
```

**2. Skill provides debugging workflow**:
```markdown
# Debugging API Endpoints

When API calls fail:
1. Check route definition
2. Verify request/response types
3. Test with curl
4. Check contract test
```

**3. Result**: Enforced API contract testing

---

## Example 5: Git Commit Validation

**Goal**: Enforce commit message conventions and prevent bad commits.

**Customizations Used**:
- Hook (pre-commit validation)
- Slash Command (/commit)

### Implementation

**1. Hook validates before commit**:
```typescript
ToolCallComplete: async (event) => {
  if (event.toolName === 'Bash' &&
      event.params.command.includes('git commit')) {

    const message = extractCommitMessage(event.params.command);

    // Validate format: type(scope): description
    const isValid = /^(feat|fix|docs|style|refactor|test|chore)\([^)]+\): .+/.test(message);

    if (!isValid) {
      return {
        continue: false,
        message: `❌ Invalid commit message format\n` +
                 `Expected: type(scope): description\n` +
                 `Example: feat(auth): add login form`
      };
    }
  }
  return { continue: true };
}
```

**2. Slash command helps with commits** (`.claude/commands/commit.md`):
```markdown
Create a semantic commit message following the project's conventions.

Format: type(scope): description

Types: feat, fix, docs, style, refactor, test, chore

Analyze staged changes and suggest an appropriate commit message.
```

**3. Result**: Consistent commit history

---

## Example 6: Real-time Dashboard Updates

**Goal**: Push session activity to web dashboard in real-time.

**Customizations Used**:
- Hooks (all events)
- MCP Server (database)
- Backend API (SSE)

### Implementation

**1. Hooks log everything**:
```typescript
export default {
  async SessionStart(event) {
    await logEvent('SessionStart', event);
    return { continue: true };
  },

  async ToolCallComplete(event) {
    await logEvent('ToolCallComplete', {
      tool: event.toolName,
      duration: event.duration
    });
    return { continue: true };
  },

  async UserPromptSubmit(event) {
    await logEvent('UserPromptSubmit', {
      length: event.prompt.length
    });
    return { continue: true };
  }
}
```

**2. Backend streams to frontend**:
```typescript
// SSE endpoint
app.get('/api/v1/sessions/:id/stream', async (c) => {
  return stream(c, async (stream) => {
    // Push updates when hook events arrive
  });
});
```

**3. Result**: Live dashboard showing Claude's activity

---

## Patterns Summary

### Pattern: Hook → API → Dashboard
1. Hook captures event
2. POSTs to API endpoint
3. Backend processes and stores
4. SSE pushes to dashboard
5. UI updates in real-time

**Use for**: Observability, monitoring, analytics

---

### Pattern: Skill → Sub-agent → Skill
1. Main skill provides strategy
2. Delegates to specialized agent
3. Agent has its own skill
4. Results bubble back up

**Use for**: Complex multi-agent workflows

---

### Pattern: Slash Command → Hook Validation
1. User runs slash command
2. Command expands to prompt
3. Claude executes tools
4. Hook validates results
5. Blocks if validation fails

**Use for**: Enforcing quality gates

---

## Tips for Combining Customizations

1. **Start simple**: One customization at a time
2. **Test in isolation**: Verify each piece works alone
3. **Layer gradually**: Add integrations once basics work
4. **Document interactions**: Note dependencies between customizations
5. **Version together**: Related customizations should version in sync

## Next Steps

- See SKILL.md for choosing the right customization type
- See individual sub-skills for implementation details
- See TROUBLESHOOTING.md if things don't work
