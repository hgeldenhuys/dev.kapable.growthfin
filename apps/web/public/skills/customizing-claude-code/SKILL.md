---
name: customizing-claude-code
description: Comprehensive guide to customizing Claude Code through skills, hooks, MCP servers, slash commands, and agent configuration. Routes to specialized sub-skills and provides decision trees for choosing the right customization approach. Use when learning Claude Code features, implementing advanced workflows, building plugins, or extending functionality.
---

# Customizing Claude Code

## When to Use This Skill

Use this skill when you need to:
- ✅ Understand what Claude Code can be customized
- ✅ Choose the right customization method for your needs
- ✅ Get oriented before diving into implementation
- ✅ Route to specialized sub-skills for deep work
- ✅ Reference official docs and best practices

**DON'T use for:**
- Simple questions (answer directly)
- Project-specific implementation (use domain skills)
- General coding help (not Claude Code-specific)

---

## 🧭 Customization Decision Tree

```
What do you want to achieve?

├─ 📚 Capture reusable expertise/workflows
│   → Use Skills (.claude/skills/)
│   → Sub-skill: building-skills
│   → Docs: https://code.claude.com/docs/en/skills.md
│
├─ ⚡ React to Claude Code events automatically
│   → Use Hooks (.agent/hooks.ts)
│   → Sub-skill: building-hooks
│   → Docs: https://code.claude.com/docs/en/hooks-guide.md
│
├─ 🔌 Connect external tools, databases, APIs
│   → Use MCP Servers (settings.json)
│   → Sub-skill: integrating-mcp
│   → Docs: https://modelcontextprotocol.io
│
├─ ⌨️ Create prompt shortcuts for team
│   → Use Slash Commands (.claude/commands/)
│   → Sub-skill: creating-slash-commands
│   → Docs: https://code.claude.com/docs/en/slash-commands.md
│
├─ 🤖 Configure specialized agents
│   → Use Sub-agents (Task tool)
│   → Sub-skill: configuring-agents
│   → Docs: https://code.claude.com/docs/en/sub-agents.md
│
└─ 📦 Package customizations for distribution
    → Use Plugins
    → See: PLUGINS.md
    → Docs: https://code.claude.com/docs/en/plugins.md
```

---

## 🎯 Quick Reference by Use Case

### Capture Knowledge & Patterns
**Scenario**: You solved a complex problem and want to reuse the solution.

**Solution**: Create a Skill
- **File**: `.claude/skills/your-skill-name/SKILL.md`
- **How**: YAML frontmatter + Markdown content
- **Discovery**: Claude matches description to user queries
- **Sub-skill**: `building-skills` (detailed guidance)
- **Example**: debugging-api-endpoints, writing-tests, session-lookup

### Automate Workflows
**Scenario**: Log every session, validate commits, sync with external systems.

**Solution**: Use Hooks
- **File**: `.agent/hooks.ts`
- **Events**: SessionStart, ToolCallComplete, UserPromptSubmit, etc.
- **Language**: TypeScript
- **Sub-skill**: `building-hooks`
- **Example**: Session tracking, SDLC sync, git commit validation

### Extend with External Tools
**Scenario**: Access database, call APIs, use custom CLIs.

**Solution**: Integrate MCP Server
- **Config**: `.claude/settings.json` (mcpServers section)
- **Protocol**: Model Context Protocol
- **Capabilities**: Tools, Resources, Prompts
- **Sub-skill**: `integrating-mcp`
- **Example**: Chrome automation, database queries, file watchers

### Create Team Shortcuts
**Scenario**: Frequently-used prompts for sprint planning, PRD review.

**Solution**: Slash Commands
- **File**: `.claude/commands/command-name.md`
- **Usage**: `/command-name` expands to prompt
- **Scope**: Project or global
- **Sub-skill**: `creating-slash-commands`
- **Example**: `/sdlc_reflect`, `/prd_review`, `/commit`

### Specialize Agent Behavior
**Scenario**: Create backend-dev, frontend-qa, spec-writer agents.

**Solution**: Configure Sub-agents
- **Method**: Task tool with subagent_type
- **Config**: Prompts, tool restrictions, model selection
- **Sub-skill**: `configuring-agents`
- **Example**: backend-dev, frontend-qa, cli-dev

---

## 📚 Customization Methods Deep Dive

### 1. Skills (Reusable Expertise)

**What**: Prompt templates with YAML frontmatter that Claude can discover and activate.

**Structure**:
```
.claude/skills/
├── simple-skill.md                    # Single file (< 500 lines)
└── complex-skill/                     # Directory (> 500 lines)
    ├── SKILL.md                       # Main content
    ├── REFERENCE.md                   # Detailed docs
    ├── CHECKLIST.md                   # Step-by-step guide
    └── EXAMPLES.md                    # Real-world examples
```

**When to Use**:
- Pattern appears across 2+ projects
- Non-obvious workflow needs documentation
- Domain expertise worth capturing
- Specific requirements need consistency

**Sub-skill**: `building-skills` - Complete guide to skill creation

**Docs**:
- [Skills Guide](https://code.claude.com/docs/en/skills.md)
- [Interactive Mode](https://code.claude.com/docs/en/interactive-mode.md)

---

### 2. Hooks (Event-Driven Automation)

**What**: TypeScript functions that execute in response to Claude Code events.

**Structure**:
```typescript
// .agent/hooks.ts
export default {
  SessionStart: async (event) => {
    // Runs when session starts
  },
  ToolCallComplete: async (event) => {
    // Runs after every tool execution
  }
}
```

**Available Events**:
- `SessionStart`, `SessionEnd`
- `UserPromptSubmit`, `AssistantResponseComplete`
- `ToolCallStart`, `ToolCallComplete`
- `ConversationMessage`

**When to Use**:
- Automated logging/tracking
- Validation workflows
- External system sync
- Custom notifications

**Sub-skill**: `building-hooks` - Hook implementation patterns

**Docs**:
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide.md)
- [Hooks Reference](https://code.claude.com/docs/en/hooks.md)

---

### 3. MCP Servers (External Integration)

**What**: Model Context Protocol servers that provide tools, resources, and prompts.

**Configuration**:
```json
// .claude/settings.json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

**Capabilities**:
- **Tools**: Function calls Claude can invoke
- **Resources**: Data sources Claude can read
- **Prompts**: Templates Claude can use

**When to Use**:
- Database access (PostgreSQL, SQLite)
- API integration (REST, GraphQL)
- File system operations
- Browser automation

**Sub-skill**: `integrating-mcp` - MCP server setup and tools

**Docs**:
- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Servers List](https://github.com/modelcontextprotocol/servers)

---

### 4. Slash Commands (Prompt Shortcuts)

**What**: Custom `/commands` that expand to full prompts.

**Structure**:
```markdown
<!-- .claude/commands/prd-review.md -->
Review the PRD in the current directory.
Check for completeness, clarity, and testability.
Provide feedback on acceptance criteria.
```

**Usage**:
```bash
# User types:
/prd-review

# Claude receives:
"Review the PRD in the current directory..."
```

**When to Use**:
- Frequently-used prompts
- Team workflow standardization
- Complex multi-step instructions
- Onboarding shortcuts

**Sub-skill**: `creating-slash-commands`

**Docs**:
- [Slash Commands](https://code.claude.com/docs/en/slash-commands.md)
- [CLI Reference](https://code.claude.com/docs/en/cli-reference.md)

---

### 5. Sub-Agents (Specialized Agents)

**What**: Specialized agent personas with custom prompts and tool access.

**Usage**:
```typescript
await Task({
  subagent_type: "backend-dev",
  description: "Implement API endpoint",
  prompt: `
    Create REST endpoint for /api/v1/contacts
    Follow existing patterns in routes/ directory
  `
});
```

**Configuration**:
- Custom system prompts
- Tool restrictions (allowed-tools)
- Model selection (haiku, sonnet, opus)

**When to Use**:
- Role-based workflows (dev, qa, architect)
- Specialized expertise needed
- Tool access restrictions
- Context preservation (delegation)

**Sub-skill**: `configuring-agents`

**Docs**:
- [Sub-Agents Guide](https://code.claude.com/docs/en/sub-agents.md)
- [Output Styles](https://code.claude.com/docs/en/output-styles.md)

---

## 🔗 Official Documentation Quick Links

### Core Guides
- [CLI Reference](https://code.claude.com/docs/en/cli-reference.md) - Command-line options and usage
- [Interactive Mode](https://code.claude.com/docs/en/interactive-mode.md) - Chat session features
- [Headless Mode](https://code.claude.com/docs/en/headless.md) - Automation and CI/CD

### Customization
- [Skills Guide](https://code.claude.com/docs/en/skills.md) - Creating reusable expertise
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide.md) - Event-driven automation
- [Hooks Reference](https://code.claude.com/docs/en/hooks.md) - All available hook events
- [Slash Commands](https://code.claude.com/docs/en/slash-commands.md) - Custom prompt shortcuts
- [Sub-Agents](https://code.claude.com/docs/en/sub-agents.md) - Specialized agent configuration
- [Plugins](https://code.claude.com/docs/en/plugins.md) - Packaging and distribution
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference.md) - Plugin API details

### Advanced
- [Output Styles](https://code.claude.com/docs/en/output-styles.md) - Customize Claude's responses
- [MCP Documentation](https://modelcontextprotocol.io) - Model Context Protocol

**Note**: Anthropic updates docs regularly. Use WebFetch to get latest content when needed.

---

## 🎓 Learning Path

### Beginner: Start with Skills
1. Read existing skills in `.claude/skills/`
2. Create simple single-file skill
3. Test discovery with targeted questions
4. Iterate on description for better matching

**Sub-skill**: `building-skills`

### Intermediate: Add Hooks
1. Examine `.agent/hooks.ts` (if exists)
2. Start with SessionStart hook
3. Log events to understand payloads
4. Build automated workflows

**Sub-skill**: `building-hooks`

### Advanced: Integrate MCP
1. Find relevant MCP server (GitHub, npm)
2. Configure in `.claude/settings.json`
3. Test tools in interactive mode
4. Build custom MCP server if needed

**Sub-skill**: `integrating-mcp`

### Expert: Build Plugins
1. Combine skills + hooks + MCP
2. Package for distribution
3. Document installation
4. Publish to marketplace

**See**: PLUGINS.md

---

## 🛠️ Supporting Files

This skill uses progressive disclosure:

- **PLUGINS.md** - Guide to packaging and distributing customizations
- **EXAMPLES.md** - Real-world customization examples from Agios project
- **TROUBLESHOOTING.md** - Common issues and debugging techniques

---

## 🚀 Quick Start Examples

### Create Your First Skill
```bash
# Create skill directory
mkdir -p .claude/skills/my-first-skill

# Create SKILL.md
cat > .claude/skills/my-first-skill/SKILL.md << 'EOF'
---
name: my-first-skill
description: Brief description of what this skill does and when to use it.
---

# My First Skill

## When to Use
[Describe triggers and use cases]

## How to Use
[Step-by-step instructions]
EOF

# Test it
# Ask Claude a question matching your description
```

**Next**: See `building-skills` sub-skill for complete guidance.

---

### Add Your First Hook
```typescript
// .agent/hooks.ts
export default {
  SessionStart: async (event) => {
    console.log('Session started:', event.sessionId);
    return { continue: true };
  }
}
```

**Next**: See `building-hooks` sub-skill for all events and patterns.

---

### Configure Your First MCP Server
```json
// .claude/settings.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    }
  }
}
```

**Next**: See `integrating-mcp` sub-skill for server setup.

---

## 🎯 Best Practices

### DO ✅
- Start simple (single-file skill or basic hook)
- Test customizations in isolation first
- Document why you created each customization
- Use progressive disclosure for complex skills
- Keep frontmatter accurate for discovery
- Version control all customizations

### DON'T ❌
- Create skills for one-off tasks
- Build mega-skills that do everything
- Hard-code sensitive data in hooks
- Skip testing before committing
- Forget to update descriptions when behavior changes
- Mix multiple concerns in one skill

---

## 🔍 Related Sub-Skills

- `building-skills` - Create and debug skills
- `building-hooks` - Implement event-driven automation
- `integrating-mcp` - Connect external tools and data
- `creating-slash-commands` - Build team prompt shortcuts
- `configuring-agents` - Specialize agent behavior

---

## 💡 Common Patterns

### Pattern 1: Skills + Hooks
**Use case**: Capture expertise AND automate tracking

```
Skill: debugging-api-endpoints
  → Provides debugging workflow
Hook: ToolCallComplete
  → Logs when Read/Grep used during debugging
  → Tracks success patterns
```

### Pattern 2: MCP + Slash Commands
**Use case**: External tool with easy invocation

```
MCP Server: database-query
  → Exposes SQL query tool
Slash Command: /db-stats
  → Runs common queries via MCP
  → Formats results nicely
```

### Pattern 3: Sub-agents + Skills
**Use case**: Specialized agent with expertise

```
Sub-agent: backend-qa
  → Tools: Read, Bash, Grep
Skill: testing-api-endpoints
  → Activated when backend-qa runs
  → Provides testing patterns
```

---

## 📝 Next Steps

1. **Identify your need** using the decision tree above
2. **Read the relevant sub-skill**:
   - `building-skills` for expertise capture
   - `building-hooks` for automation
   - `integrating-mcp` for external integration
   - `creating-slash-commands` for shortcuts
   - `configuring-agents` for specialization
3. **Start with simplest approach** (usually a skill)
4. **Test and iterate** based on usage
5. **Share with team** via git or plugin

---

## 🤔 Still Not Sure?

Ask yourself:
- **Is it repeatable?** → Skill
- **Does it need to happen automatically?** → Hook
- **Does it need external data/tools?** → MCP
- **Is it a frequently-used prompt?** → Slash Command
- **Does it need specialized expertise?** → Sub-agent

If still unclear, start with a **skill** - it's the most flexible and easiest to test.

---

## 📚 Further Reading

- [Claude Code Documentation](https://code.claude.com/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)

**Remember**: Customizations should make your workflow **faster and more consistent**, not more complex. Start simple and grow as needs emerge.
