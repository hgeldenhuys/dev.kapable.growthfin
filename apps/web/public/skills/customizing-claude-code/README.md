# Customizing Claude Code - Hub Skill

This skill serves as the **entry point** for all Claude Code customization guidance.

## Structure

```
customizing-claude-code/
├── SKILL.md              # Main hub (decision trees, quick reference)
├── EXAMPLES.md           # Real-world examples from Agios project
├── PLUGINS.md            # Packaging and distribution guide
├── TROUBLESHOOTING.md    # Common issues and debugging
└── README.md             # This file
```

## Progressive Disclosure Pattern

**SKILL.md** (main file) is ~400 lines and provides:
- Decision tree for choosing customization type
- Quick reference for each method
- Links to official docs (always current)
- Routes to specialized sub-skills

**Supporting files** load on-demand when Claude needs deeper context:
- `EXAMPLES.md` - When user asks "show me an example"
- `PLUGINS.md` - When user asks about packaging/distribution
- `TROUBLESHOOTING.md` - When things don't work

## Sub-Skills (To Be Created)

This hub routes to specialized sub-skills:

1. **`building-skills`** - Skill creation, frontmatter, discovery
2. **`building-hooks`** - Event-driven automation patterns
3. **`integrating-mcp`** - MCP server setup and tools
4. **`creating-slash-commands`** - Custom prompt shortcuts
5. **`configuring-agents`** - Sub-agent specialization

**Status**: Hub complete, sub-skills to be created as needed.

## Usage

Claude discovers this skill when users ask about:
- "How do I customize Claude Code?"
- "What are Claude Code hooks?"
- "How do I create a skill?"
- "Can I connect to my database?"
- "How do I automate workflows?"

The skill then routes them to the appropriate sub-skill or documentation.

## Design Principles

1. **Lightweight hub** - Just routing and decision trees
2. **Progressive disclosure** - Supporting files loaded on-demand
3. **Always fresh docs** - Links to official docs, not copying content
4. **Real examples** - Based on actual Agios customizations
5. **Sub-skill delegation** - Deep topics get their own skills

## Why This Approach?

- **Token efficient** - Only loads what's needed
- **Maintainable** - One file per concern
- **Discoverable** - Each sub-skill has specific triggers
- **Flexible** - Build sub-skills incrementally as needed

## Next Steps

1. Test the hub skill by asking Claude Code about customization
2. Create `building-skills` sub-skill (refactor from `creating-skills.md`)
3. Create other sub-skills as needs emerge
4. Update with new patterns as we discover them

## References

All official Claude Code docs are linked in SKILL.md, including:
- Skills, Hooks, MCP, Sub-agents, Plugins
- CLI reference, Interactive mode, Slash commands
- Regularly updated by Anthropic
