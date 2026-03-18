---
name: creating-skills
description: Create new Claude Code skills from breakthrough moments and successful implementations. Guides through identifying when skills are needed, structuring with proper YAML frontmatter and progressive disclosure, following official best practices, and debugging common issues. Use when creating new skills, updating existing skills, or troubleshooting skill loading problems.
---

# Creating Skills - The Meta-Skill

## When to Create a Skill

Create a skill when you've discovered:

1. **A reusable pattern** that appears across multiple projects or conversations
2. **Domain expertise** you want to capture and share systematically
3. **A workflow** that's non-obvious and benefits from clear documentation
4. **Specific formatting** requirements that need consistency
5. **Error patterns** where guidance prevents common mistakes
6. **A successful solution** to a complex problem worth repeating

**Don't create skills for:**
- One-off tasks (just do them directly)
- Very simple operations (overhead not worth it)
- Rapidly evolving techniques (document in notes instead)
- Tasks requiring frequent updates (too much maintenance)

---

## Skill Locations: Personal vs Project

**Personal Skills** (`~/.claude/skills/`):
- Available across **all projects** on your machine
- Individual workflows and experimental capabilities
- Personal productivity tools
- Not shared with team (unless manually copied)

**Project Skills** (`.claude/skills/`):
- Available only within **this project**
- Team workflows and project-specific expertise
- Automatically shared when checked into git
- Team members get skills on git pull

**Choose Project Skills when:**
- Team needs consistent patterns
- Project-specific knowledge
- Shared troubleshooting guides

**Choose Personal Skills when:**
- Cross-project utility
- Individual preferences
- Experimental/evolving patterns

---

## Skill Structure: The Template

### Simple Skills (Single File)
For straightforward skills under 500 lines:
```
.claude/skills/
└── skill-name.md
```

### Complex Skills (Directory)
For skills needing multiple files:
```
skill-name/
├── SKILL.md                    # Main file (required)
├── REFERENCE.md                # Optional: detailed reference
├── CHECKLIST.md                # Optional: workflow checklist
├── EXAMPLES.md                 # Optional: concrete examples
└── scripts/                    # Optional: executable scripts
    ├── setup.sh
    ├── validate.sh
    └── template.md
```

---

## Creating Your Skill: Step-by-Step

### Step 1: Name Your Skill

**Rules:**
- Max 64 characters
- Lowercase letters/numbers/hyphens only
- No "anthropic" or "claude" in the name
- Use gerund form (verb + -ing): `processing-pdfs`, `debugging-tests`, `creating-skills`

**Good names:**
- `debugging-api-endpoints` ✅
- `writing-skills` ✅
- `realtime-sse-architecture` ✅

**Bad names:**
- `helper` ❌ (vague)
- `Claude-Utils` ❌ (contains Claude, mixed case)
- `pdf` ❌ (noun, not gerund)

---

### Step 2: Write the Description

**Max 1024 characters**, third person, include both:
1. **What it does** (functionality)
2. **When to use it** (triggers/context)

**Template:**
```
{Verb}s {what} [with details]. Guides through [key steps]. Use when [situation], [another situation], or [another].
```

**Good example:**
```
Debug API endpoint failures systematically. Guides through clean restarts, log analysis, and layer-by-layer debugging from routes to service to database. Use when endpoints fail despite code appearing correct, returning unexpected errors, or experiencing timeout issues.
```

**Bad example:**
```
Helps with API debugging
```

**Why "when to use" matters:** Claude autonomously discovers skills by matching descriptions to user requests. Include keywords users would naturally mention.

---

### Step 3: Structure SKILL.md with Frontmatter

**Required frontmatter fields:**

```yaml
---
name: creating-skills
description: Create new Claude Code skills from breakthrough moments. Guides through identifying when skills are needed, structuring with proper YAML frontmatter and progressive disclosure, and following official best practices.
---
```

**Optional frontmatter field - Tool Restrictions:**

```yaml
---
name: code-reviewer
description: Reviews code for quality issues...
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

**When to use `allowed-tools`:**
- **Read-only skills** - Shouldn't modify files (Read, Grep, Glob only)
- **Data analysis** - Process without writing (Read, Bash for data tools)
- **Security-sensitive** - Limit capabilities for safety
- **Controlled operations** - Prevent accidental changes

**Example use cases:**
```yaml
# Code reviewer (read-only)
allowed-tools:
  - Read
  - Grep
  - Glob

# Data analyzer (no file writes)
allowed-tools:
  - Read
  - Bash

# Safe debugger (inspect only)
allowed-tools:
  - Read
  - Grep
  - BashOutput
```

When `allowed-tools` is specified, Claude can only use those tools without asking permission. Omit this field if your skill needs full tool access.

**YAML Syntax Rules:**
- Opening `---` must be on line 1
- Closing `---` before Markdown content
- Use spaces for indentation (not tabs)
- Arrays use `-` prefix with space
- Validate syntax before deployment

**The content after frontmatter should:**
- Be under 500 lines (use separate files for more)
- Start with "## When to Create a Skill" or similar orientation
- Include concrete workflow steps
- Provide copy-paste-ready templates
- Link to additional files (REFERENCE.md, CHECKLIST.md, etc.)

---

### Step 4: Progressive Disclosure - Split Large Content

If your skill needs more than 500 lines:

1. **SKILL.md** (150-400 lines): Core guidance + links to additional files
2. **REFERENCE.md** (500+ lines): Detailed technical reference
3. **CHECKLIST.md**: Step-by-step workflow checklist
4. **EXAMPLES.md**: Input/output examples and case studies
5. **scripts/**: Executable templates or setup scripts

**Example structure:**

```markdown
# SKILL.md (Main)

## Overview
[Brief intro]

## When to Use
[Triggers]

## Quick Start
[5-minute version]

See REFERENCE.md for detailed guidelines
See CHECKLIST.md for step-by-step workflow
See EXAMPLES.md for real-world cases
```

**Progressive disclosure benefits:**
- Claude reads supporting files only when needed
- Lower initial context cost
- Faster skill activation
- Better organization

---

## Key Content Sections

### Section 1: Orientation (Why and When)

```markdown
## When to Create a Skill

Create a skill when you've discovered:

1. **Pattern Recognition** - Appears across 2+ projects
2. **Domain Expertise** - Systematic knowledge worth capturing
3. **Non-Obvious Workflow** - Benefits from clear docs
4. **Specific Requirements** - Consistency across implementations
5. **Solution Pattern** - Worth repeating and sharing

**Don't create skills for:**
- One-off tasks
- Very simple operations
- Rapidly evolving techniques
- Tasks requiring constant updates
```

### Section 2: Core Workflow

```markdown
## Creating Your Skill: Step-by-Step

### Step 1: Name Your Skill
[Concrete rules + examples]

### Step 2: Write the Description
[Template + good/bad examples]

### Step 3: Structure the Content
[Progressive disclosure pattern]

... etc
```

### Section 3: Concrete Templates

See [REFERENCE.md](./REFERENCE.md) for copy-paste templates.

### Section 4: Validation Checklist

See [REFERENCE.md](./REFERENCE.md) for validation checklist.

---

## Anti-Patterns to Avoid

### ❌ Too Many Equivalent Options
**Bad:**
```
You can approach this with:
1. Method A (works for X)
2. Method B (works for Y)
3. Method C (works for Z)
4. Method D (works for W)
```

**Good:**
```
Recommended approach (works for most cases):
[Primary method]

Alternative approaches:
- For X: Method A
- For Y: Method B
- For specialized cases: See REFERENCE.md
```

### ❌ Deeply Nested References
Don't do this:
```
SKILL.md
  → REFERENCE.md
    → DETAILED-GUIDE.md
      → CASE-STUDY.md
```

Do this instead:
```
SKILL.md
├→ REFERENCE.md
├→ CHECKLIST.md
├→ EXAMPLES.md
└→ scripts/
```

### ❌ Time-Sensitive Information
Don't include:
- Specific dates
- Version numbers that change frequently
- Temporary tool recommendations
- Current API endpoints (link to docs instead)

### ❌ Assuming Pre-Installed Packages
Always specify dependencies:
```markdown
## Requirements

- Node.js 18+
- Bun 1.0+
- Install dependencies: `bun add package-name`

Packages must be pre-installed in the environment.
```

### ❌ Vague Descriptions
Claude discovers skills through description matching. Be specific.

**Bad:** "Helps with documents"
**Good:** "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files, document extraction, or form filling."

---

## Debugging Skills

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

---

## Sharing and Distribution

### Method 1: Git (Project Skills)

**For team sharing:**
```bash
# Add skill to project
git add .claude/skills/your-skill/
git commit -m "Add team skill: your-skill"
git push

# Team members get it automatically
git pull  # Skills now available
```

**Benefits:**
- Automatic team distribution
- Version controlled
- Part of project setup

### Method 2: Plugin Distribution (Advanced)

**For marketplace sharing:**
1. Create plugin with `skills/` directory
2. Add plugin to marketplace
3. Users install via plugin system

**Benefits:**
- Broader distribution
- Plugin ecosystem integration
- Discoverable by others

### Method 3: Manual Copy (Personal Skills)

**For individual use:**
```bash
# Copy to personal skills
cp -r project-skill ~/.claude/skills/
```

**When to use:**
- Personal preference tweaks
- Experimenting before sharing
- Cross-project personal tools

---

## Best Practices Summary

### Conciseness
- Only include info Claude doesn't already know
- Challenge each paragraph's token cost
- Use examples instead of lengthy explanations
- Link to external docs rather than copying

### Matching Specificity to Task
- **High-freedom tasks** (multiple valid approaches): Text instructions
- **Fragile operations** (consistency critical): Specific scripts/templates
- Think: "Open fields" vs "narrow bridges with cliffs"

### Testing Across Models
- Works for Claude Opus? ✅
- Works for Claude Sonnet? ✅
- Works for Claude Haiku? ✅

If Haiku struggles, add more concrete examples and reduce abstraction.

### Naming and Discovery
- **Name clarity**: Gerund form immediately tells you the action
- **Description accuracy**: Write triggers and use cases explicitly
- **Keyword richness**: Include domain terminology in description

### Example Pattern
Rather than:
```
Processes documents flexibly
```

Do:
```
Extract structured data from documents using vision APIs and
JSON schema. Parse tables, forms, and text layouts. Use when you
need to convert unstructured documents into structured data,
extract invoice details, parse scanned forms, or batch-process
document collections.
```

---

## Quick Start: Creating Your First Skill

1. **Identify the pattern**
   - What problem appears repeatedly?
   - What do you do consistently well?

2. **Choose location**
   - Team skill? → `.claude/skills/`
   - Personal? → `~/.claude/skills/`

3. **Name it** (gerund form)
   - `debugging-*`
   - `implementing-*`
   - `testing-*`
   - `documenting-*`

4. **Write the frontmatter**
   ```yaml
   ---
   name: your-skill-name
   description: [what it does] [when to use it]
   allowed-tools: [optional - Read, Write, Bash, etc.]
   ---
   ```

5. **Create SKILL.md**
   - When to use (orientation)
   - Quick start (5 min version)
   - Full workflow (step-by-step)
   - Anti-patterns (what not to do)
   - Debugging tips (common issues)
   - See Also (links)

6. **Keep it concise**
   - Under 500 lines if possible
   - Use REFERENCE.md for details
   - Progressive disclosure pattern

7. **Test and debug**
   - Run `claude --debug` to check loading
   - Test on different models (Opus, Sonnet, Haiku)
   - Ask questions matching description triggers

8. **Validate your checklist**
   - All boxes checked? You're done!

9. **Share if appropriate**
   - Team skill: Git commit and push
   - Personal: Keep in `~/.claude/skills/`

---

## Common Questions

**Q: How long should a skill be?**
A: SKILL.md under 500 lines. Larger content goes in separate files that Claude loads on-demand.

**Q: Can I update a skill?**
A: Yes. Skills improve over time as you refine the guidance based on real usage. Changes take effect on next Claude Code restart.

**Q: How do I share a skill?**
A: For teams, place in `.claude/skills/` and commit to git. For personal use, place in `~/.claude/skills/`.

**Q: What if my skill is super specialized?**
A: Still create it! Specialized skills for specific domains are valuable. Just make sure the description clearly states when to use it.

**Q: Can I have scripts in my skill?**
A: Yes! Optional `scripts/` directory can contain setup scripts, templates, validators, etc.

**Q: How do I debug a skill that won't load?**
A: Run `claude --debug` to see loading errors, YAML syntax issues, and file path problems.

**Q: When should I use allowed-tools?**
A: Use it to restrict Claude's capabilities for read-only operations, security-sensitive workflows, or controlled operations. Omit it if your skill needs full tool access.

**Q: Can I have both personal and project versions of the same skill?**
A: Yes, but the project skill (`.claude/skills/`) will take precedence when working in that project.

---

## See Also

- [REFERENCE.md](./REFERENCE.md) - Detailed templates and validation checklist
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Debugging guide for skill loading issues
- [EXAMPLES.md](./EXAMPLES.md) - Real-world skill examples
- **Official Claude Code Docs**: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/
- **Skills Documentation**: https://code.claude.com/docs/en/skills.md
- **Best Practices Guide**: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices.md
- **Cookbook Examples**: https://github.com/anthropics/claude-cookbooks/tree/main/skills
