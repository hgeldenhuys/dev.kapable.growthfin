# Troubleshooting Claude Code Customizations

Common issues and solutions when working with skills, hooks, MCP, and other customizations.

---

## Skills Not Activating

### Problem: Claude doesn't use your skill even when it seems relevant

**Causes**:
1. Description doesn't match user query keywords
2. Skill file not in correct location
3. YAML frontmatter syntax errors
4. Skill name doesn't match directory/file name

**Solutions**:

```bash
# 1. Check skill location
ls -la .claude/skills/your-skill/SKILL.md
ls -la ~/.claude/skills/your-skill.md

# 2. Validate YAML frontmatter
head -n 5 .claude/skills/your-skill/SKILL.md
# Should see:
# ---
# name: your-skill
# description: ...
# ---

# 3. Check for syntax errors
claude --debug
# Look for "Error loading skill: your-skill"

# 4. Test description matching
# Ask Claude a question using keywords from your description
```

**Fix: Improve description keywords**
```yaml
# Before (too generic)
description: Helps with testing

# After (specific triggers)
description: Test React components using Chrome MCP for form validation, accessibility checks, and screenshot verification. Use when testing UI, validating forms, or debugging component behavior.
```

---

## Hooks Not Running

### Problem: Hook events not executing

**Causes**:
1. `.agent/hooks.ts` has syntax errors
2. Hook returns `{ continue: false }` somewhere
3. Export statement incorrect
4. TypeScript compilation fails

**Solutions**:

```bash
# 1. Check hook file exists
ls -la .agent/hooks.ts

# 2. Validate TypeScript syntax
cd .agent && bun build hooks.ts

# 3. Check for return values
grep "return" .agent/hooks.ts
# All hooks MUST return { continue: true } or { continue: false }

# 4. Test with simple hook
cat > .agent/hooks.ts << 'EOF'
export default {
  SessionStart: async (event) => {
    console.log('🎯 Hook fired!', event.sessionId);
    return { continue: true };
  }
}
EOF

# 5. Restart Claude Code
# Hooks are loaded at startup
```

**Fix: Export format**
```typescript
// ❌ WRONG
export const hooks = {
  SessionStart: async (event) => { ... }
}

// ✅ CORRECT
export default {
  SessionStart: async (event) => { ... }
}
```

---

## MCP Server Won't Connect

### Problem: MCP server not available in Claude Code

**Causes**:
1. Server command incorrect in settings.json
2. Server not installed globally
3. Environment variables missing
4. Port conflicts

**Solutions**:

```bash
# 1. Validate settings.json syntax
cat .claude/settings.json | jq .
# Should parse without errors

# 2. Test server command manually
npx -y @modelcontextprotocol/server-filesystem /path/to/dir
# Should not error

# 3. Check server is installed
npm list -g @modelcontextprotocol/server-filesystem

# 4. Verify environment variables
echo $API_KEY

# 5. Check Claude Code logs
claude --debug
# Look for MCP connection errors
```

**Fix: Correct server config**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/absolute/path/to/directory"
      ],
      "env": {
        "VARIABLE": "value"
      }
    }
  }
}
```

---

## Slash Commands Not Expanding

### Problem: `/command` doesn't expand to prompt

**Causes**:
1. Command file not in `.claude/commands/`
2. File extension incorrect (must be `.md`)
3. Command name has uppercase/spaces
4. Command conflicts with built-in

**Solutions**:

```bash
# 1. Check command location
ls -la .claude/commands/
# Should see: command-name.md

# 2. Verify naming convention
# ✅ GOOD: /my-command → my-command.md
# ❌ BAD:  /MyCommand → MyCommand.md
# ❌ BAD:  /my command → my command.md

# 3. Test with simple command
echo "Print today's date" > .claude/commands/test-cmd.md

# Type in Claude Code:
# /test-cmd
# Should expand to: "Print today's date"

# 4. Check for conflicts with built-ins
# Built-ins: /help, /clear, /cost, etc.
# Don't override these
```

**Fix: Rename file**
```bash
# Wrong
mv .claude/commands/MyCommand.md .claude/commands/my-command.md

# Right
ls .claude/commands/
# my-command.md
# another-command.md
```

---

## Sub-Agent Not Using Skill

### Problem: Delegated agent doesn't activate expected skill

**Causes**:
1. Skill description doesn't match agent's task
2. Agent has tool restrictions preventing skill activation
3. Skill only available in parent context

**Solutions**:

```typescript
// 1. Make skill description match agent task
// If agent does backend work:
description: "Implement REST API endpoints... Use when building APIs, creating routes, or implementing backend services."

// 2. Check agent tool restrictions
await Task({
  subagent_type: "backend-dev",
  description: "Implement API",
  prompt: "Create /api/v1/contacts endpoint"
  // Agent inherits tools unless restricted
});

// 3. Explicitly reference skill in prompt
prompt: `
  Create /api/v1/contacts endpoint

  Use the 'backend-patterns' skill for guidance
  Follow CQRS architecture patterns
`
```

---

## Hook Blocking Execution

### Problem: Hook returns `continue: false` unintentionally

**Cause**: Logic error in hook validation

**Solution**:

```typescript
// ❌ BAD: Blocks on error
ToolCallComplete: async (event) => {
  try {
    await validateSomething();
  } catch (error) {
    console.error(error);
    // Forgot to return! Implicitly returns undefined
  }
  return { continue: true };
}

// ✅ GOOD: Always explicit
ToolCallComplete: async (event) => {
  try {
    await validateSomething();
    return { continue: true };
  } catch (error) {
    return {
      continue: false,
      message: `Validation failed: ${error.message}`
    };
  }
}

// ✅ BETTER: Decide when to block
ToolCallComplete: async (event) => {
  try {
    await validateSomething();
  } catch (error) {
    // Log but don't block
    console.error('Validation failed:', error);
  }
  // Always continue
  return { continue: true };
}
```

---

## Skill File Too Large

### Problem: Skill SKILL.md over 500 lines, context issues

**Solution**: Use progressive disclosure

```bash
# Before (1200 lines)
skills/debugging/SKILL.md

# After (progressive disclosure)
skills/debugging/
├── SKILL.md           # 300 lines (essentials)
├── REFERENCE.md       # 500 lines (detailed guide)
├── CHECKLIST.md       # 200 lines (step-by-step)
└── EXAMPLES.md        # 200 lines (case studies)
```

**In SKILL.md, reference other files**:
```markdown
## Quick Start

[Brief overview - 100 lines]

## Common Patterns

[Top 3 patterns - 100 lines]

## Detailed Reference

See REFERENCE.md for comprehensive debugging techniques.
See CHECKLIST.md for step-by-step workflow.
See EXAMPLES.md for real-world debugging sessions.
```

---

## Permission Errors with Hooks

### Problem: Hook can't write files or access directories

**Causes**:
1. Insufficient file permissions
2. Writing to protected directory
3. Path resolution issues

**Solutions**:

```typescript
// ❌ BAD: Relative path (unreliable)
import fs from 'fs';
fs.writeFileSync('./log.txt', data);

// ✅ GOOD: Absolute path
import fs from 'fs';
import path from 'path';

const logPath = path.join(process.cwd(), '.agent', 'hook-events.log');
fs.writeFileSync(logPath, data);

// ✅ BETTER: Check permissions first
const logDir = path.join(process.cwd(), '.agent');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
fs.writeFileSync(path.join(logDir, 'events.log'), data);
```

---

## MCP Tools Not Showing Up

### Problem: MCP server connected but tools not available

**Causes**:
1. Server hasn't declared tools in manifest
2. Tool registration failed
3. Permission issues

**Debug**:

```bash
# 1. Check MCP server logs
claude --debug
# Look for: "Registered tools: [...]"

# 2. Manually test server
# Run server command directly
npx @modelcontextprotocol/server-filesystem /tmp

# 3. Verify tool definitions
# Server should output available tools on startup
```

**Fix: Check server implementation**:
```typescript
// MCP server must declare tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Read a file",
        inputSchema: { ... }
      }
    ]
  };
});
```

---

## Debugging Checklist

When customizations don't work:

- [ ] Run `claude --debug` to see detailed logs
- [ ] Check file locations and naming
- [ ] Validate YAML frontmatter syntax
- [ ] Test customization in isolation
- [ ] Restart Claude Code after changes
- [ ] Check for typos in names/paths
- [ ] Review hook return values
- [ ] Verify MCP server connection
- [ ] Test with minimal example first
- [ ] Check official docs for updates

---

## Getting Help

1. **Check docs first**: https://code.claude.com/docs
2. **Search issues**: GitHub issues for similar problems
3. **Enable debug mode**: `claude --debug`
4. **Minimal reproduction**: Simplify to smallest failing example
5. **Share context**: Include logs, config files, error messages

---

## Common Error Messages

### "Skill failed to load: Invalid YAML"
- Check frontmatter opening `---` is on line 1
- Ensure closing `---` before content
- No tabs (use spaces)
- Valid YAML syntax

### "Hook error: Cannot find module"
- Check import paths in `.agent/hooks.ts`
- Install dependencies: `bun install`
- Use absolute imports or relative from `.agent/`

### "MCP server timeout"
- Server command takes too long to start
- Check server is installed
- Verify network/firewall not blocking

### "Command not found: /command-name"
- File must be in `.claude/commands/`
- Filename must match command name
- Extension must be `.md`

---

## Performance Issues

### Hooks Slowing Down Claude Code

**Problem**: Hooks take too long to execute

**Solution**:
```typescript
// ❌ SLOW: Synchronous blocking
ToolCallComplete: async (event) => {
  await expensiveOperation(); // Blocks Claude
  return { continue: true };
}

// ✅ FAST: Fire and forget
ToolCallComplete: async (event) => {
  // Don't await - let it run in background
  expensiveOperation().catch(console.error);

  // Return immediately
  return { continue: true };
}

// ✅ FASTER: Debounce/batch
let eventQueue = [];
setInterval(() => {
  if (eventQueue.length > 0) {
    processBatch(eventQueue);
    eventQueue = [];
  }
}, 5000);

ToolCallComplete: async (event) => {
  eventQueue.push(event);
  return { continue: true };
}
```

---

## References

- [CLI Reference](https://code.claude.com/docs/en/cli-reference.md)
- [Skills Guide](https://code.claude.com/docs/en/skills.md)
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide.md)
- [MCP Documentation](https://modelcontextprotocol.io)
