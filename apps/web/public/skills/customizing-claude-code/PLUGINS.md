# Plugins - Packaging Claude Code Customizations

## What Are Plugins?

Plugins are packages that bundle Claude Code customizations for distribution:
- Skills
- Hooks
- MCP servers
- Slash commands
- Configuration presets

## Plugin Structure

```
my-plugin/
├── plugin.json              # Plugin manifest
├── skills/                  # Skills to install
│   ├── skill-1/
│   │   └── SKILL.md
│   └── skill-2.md
├── commands/                # Slash commands
│   ├── command-1.md
│   └── command-2.md
├── hooks/                   # Hook templates
│   └── hooks.ts
├── mcp/                     # MCP server configs
│   └── servers.json
└── README.md               # Installation guide
```

## Plugin Manifest (plugin.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief description of plugin functionality",
  "author": "Your Name",
  "license": "MIT",
  "repository": "https://github.com/user/plugin",

  "skills": [
    "skills/skill-1/",
    "skills/skill-2.md"
  ],

  "commands": [
    "commands/command-1.md",
    "commands/command-2.md"
  ],

  "hooks": {
    "template": "hooks/hooks.ts",
    "merge": true
  },

  "mcpServers": "mcp/servers.json",

  "dependencies": {
    "node": ">=18.0.0",
    "bun": ">=1.0.0"
  }
}
```

## Installation Methods

### Method 1: Git Clone (Development)
```bash
# Clone to plugins directory
git clone https://github.com/user/plugin ~/.claude/plugins/my-plugin

# Symlink skills
ln -s ~/.claude/plugins/my-plugin/skills/* ~/.claude/skills/

# Symlink commands
ln -s ~/.claude/plugins/my-plugin/commands/* ~/.claude/commands/
```

### Method 2: NPM/Bun Package
```bash
# Install as package
bun add -g @user/claude-code-plugin

# Plugin manager auto-installs to ~/.claude/plugins/
```

### Method 3: Plugin Manager (Future)
```bash
# Via Claude Code plugin manager
claude plugins install my-plugin

# List installed
claude plugins list

# Update
claude plugins update my-plugin

# Remove
claude plugins remove my-plugin
```

## Publishing Checklist

Before publishing:
- [ ] plugin.json is valid and complete
- [ ] README.md has installation instructions
- [ ] All skills have proper frontmatter
- [ ] Hooks are well-documented
- [ ] MCP servers are tested
- [ ] Version follows semver
- [ ] License file included
- [ ] Dependencies documented
- [ ] Examples provided
- [ ] Changelog maintained

## Distribution Platforms

### GitHub
- Tag releases with version numbers
- Use GitHub Releases for changelogs
- Provide installation script

### NPM/Bun Registry
- Package as scoped module: `@user/claude-code-plugin`
- Include installation script in postinstall

### Claude Code Marketplace (Future)
- Submit to official marketplace
- Follow marketplace guidelines
- Provide screenshots/demos

## Example: Agios SDLC Plugin

Hypothetical plugin packaging Agios customizations:

```json
{
  "name": "agios-sdlc",
  "version": "1.0.0",
  "description": "SDLC orchestration, kanban management, and agent delegation",

  "skills": [
    "skills/agile-orchestration/",
    "skills/session-lookup/"
  ],

  "commands": [
    "commands/sdlc_reflect.md"
  ],

  "hooks": {
    "template": "hooks/hooks.ts",
    "merge": true
  }
}
```

## References

- [Plugins Guide](https://code.claude.com/docs/en/plugins.md)
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference.md)
