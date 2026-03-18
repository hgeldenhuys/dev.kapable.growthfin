# Creating Skills - Technical Reference

This file contains detailed templates, validation checklists, and comprehensive guidance for creating Claude Code skills.

---

## Skill Template - Copy and Paste

### SKILL.md Frontmatter

```yaml
---
name: your-skill-name
description: [what it does] [when to use it - be specific with use cases]
---
```

### Section Structure

```markdown
# Your Skill Name

## When to Use This Skill

Create this skill when you need to:
- [Specific use case 1]
- [Specific use case 2]
- [Specific use case 3]

**Don't use this skill for:**
- [Anti-pattern 1]
- [Anti-pattern 2]

---

## Quick Start (5 minutes)

[Minimal working example that demonstrates the core value]

---

## Full Workflow (Step-by-Step)

### Step 1: [First Step]
[Detailed guidance]

### Step 2: [Second Step]
[Detailed guidance]

### Step 3: [Third Step]
[Detailed guidance]

---

## Common Patterns

### Pattern 1: [Pattern Name]
[When to use]
[How to implement]

### Pattern 2: [Pattern Name]
[When to use]
[How to implement]

---

## Anti-Patterns to Avoid

### ❌ [Anti-Pattern 1]
**Bad:** [Example]
**Good:** [Example]

### ❌ [Anti-Pattern 2]
**Bad:** [Example]
**Good:** [Example]

---

## Troubleshooting

### Issue: [Common Problem]
**Symptoms:** [What you see]
**Cause:** [Why it happens]
**Solution:** [How to fix]

---

## See Also

- [REFERENCE.md](./REFERENCE.md) - Detailed reference
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples
- External documentation links
```

---

## Validating Your Skill

Before sharing, verify:

- [ ] Name uses gerund form (verb + -ing)
- [ ] Description includes both "what" and "when"
- [ ] SKILL.md is under 500 lines
- [ ] No deeply nested references (one level only)
- [ ] All file paths use forward slashes (Unix-style)
- [ ] Examples are concrete (not abstract)
- [ ] Tested across Opus, Sonnet, and Haiku
- [ ] No time-sensitive information
- [ ] Avoids too many equivalent options
- [ ] Includes clear anti-patterns section
- [ ] YAML frontmatter is valid
- [ ] Dependencies documented if required

---

## YAML Frontmatter Deep Dive

### Required Fields

**name** (string, max 64 characters)
- Lowercase letters, numbers, hyphens only
- Must match file/directory name
- Use gerund form (verb + -ing)
- No "anthropic" or "claude" in name

**description** (string, max 1024 characters)
- Third person voice
- Include "what" (functionality)
- Include "when to use" (triggers/context)
- Use domain-specific keywords for discovery

### Optional Fields

**allowed-tools** (array of strings)
- Restricts which tools Claude can use
- Only specify if you need to limit capabilities
- Common tools: Read, Write, Edit, Grep, Glob, Bash

---

## Description Writing Formula

### Template

```
{Verb}s {what} [with details]. {Additional capabilities}.
Guides through {key workflow steps}.
Use when {situation 1}, {situation 2}, or {situation 3}.
```

### Examples

**Good - API Debugging:**
```
Debug API endpoint failures systematically. Guides through clean restarts, log analysis, and layer-by-layer debugging from routes to service to database. Use when endpoints fail despite code appearing correct, returning unexpected errors, or experiencing timeout issues.
```

**Good - Data Processing:**
```
Transform CSV data into JSON format with schema validation. Parse large datasets, handle encoding issues, and generate structured output. Use when converting CSV to JSON, processing bulk data, or handling malformed CSV files.
```

**Good - Documentation:**
```
Generate API documentation from TypeScript code. Extract types, interfaces, function signatures, and JSDoc comments. Use when documenting APIs, creating SDK references, or syncing code with documentation.
```

**Bad - Too Vague:**
```
Helps with API issues
```

**Bad - Missing "When to Use":**
```
Debugs API endpoints and analyzes logs
```

**Bad - Too Generic:**
```
Processes data files in various formats
```

---

## Progressive Disclosure Strategy

### When to Split Files

**Threshold**: If SKILL.md exceeds 500 lines, extract content to supporting files.

**What to Extract:**

1. **Large tables/reference data** → REFERENCE.md
   - API reference tables
   - Configuration options
   - Command listings
   - Specification details

2. **Multiple examples** → EXAMPLES.md
   - Code samples
   - Real-world use cases
   - Case studies
   - Before/after comparisons

3. **Step-by-step workflows** → CHECKLIST.md
   - Detailed procedures
   - Validation steps
   - Testing protocols
   - Deployment checklists

4. **Debugging content** → TROUBLESHOOTING.md
   - Common issues
   - Error messages
   - Debug workflows
   - FAQ

5. **Executable content** → scripts/
   - Setup scripts
   - Template generators
   - Validation tools
   - Test runners

### Linking Strategy

**In SKILL.md:**
```markdown
## Detailed Configuration

For comprehensive configuration options, see [REFERENCE.md](./REFERENCE.md#configuration-options).

## Examples

See [EXAMPLES.md](./EXAMPLES.md) for real-world implementation examples.

## Troubleshooting

Having issues? Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
```

**Benefits:**
- Claude only loads supporting files when needed
- Reduces initial context cost
- Faster skill activation
- Better maintainability

---

## File Naming Conventions

### Required Files

**SKILL.md**
- Always required
- Contains YAML frontmatter
- Main entry point
- Target: 300-500 lines

### Optional Files (All Caps)

**REFERENCE.md**
- Detailed technical reference
- API documentation
- Configuration options
- No line limit

**EXAMPLES.md**
- Real-world examples
- Code samples
- Case studies
- Target: 200-500 lines

**TROUBLESHOOTING.md**
- Common issues
- Debug workflows
- Error solutions
- Target: 200-400 lines

**CHECKLIST.md**
- Step-by-step workflows
- Validation procedures
- Testing protocols
- Target: 100-300 lines

**PATTERNS.md**
- Common usage patterns
- Anti-patterns
- Best practices
- Target: 200-400 lines

**README.md**
- Skill overview
- File structure navigation
- Quick orientation
- Target: 50-100 lines

### Optional Directories

**scripts/**
- Executable scripts
- Template generators
- Setup tools
- Validation scripts

---

## allowed-tools Configuration

### When to Use

Use `allowed-tools` when your skill should:
- Be read-only (no file modifications)
- Have controlled capabilities
- Be security-sensitive
- Prevent accidental changes

### When NOT to Use

Omit `allowed-tools` when your skill needs:
- Full tool access
- File creation/modification
- Flexible operations
- Interactive workflows

### Common Configurations

**Read-Only Analysis:**
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

**Read with Commands:**
```yaml
allowed-tools:
  - Read
  - Bash
  - BashOutput
```

**Full File Access:**
```yaml
# Omit allowed-tools field entirely
```

**Restricted Writing:**
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```

---

## Content Sections in Detail

### Section 1: When to Use (Orientation)

**Purpose:** Help Claude and users quickly determine if this skill applies.

**Structure:**
```markdown
## When to Use This Skill

Use this skill when you need to:
- [Specific scenario 1 with concrete keywords]
- [Specific scenario 2 with concrete keywords]
- [Specific scenario 3 with concrete keywords]

**Don't use this skill for:**
- [Common misuse 1]
- [Common misuse 2]
```

**Example:**
```markdown
## When to Use This Skill

Use this skill when you need to:
- Debug API endpoints returning 404, 500, or validation errors
- Trace request flow through routes, services, and database
- Analyze API logs for error patterns
- Fix timeout issues in backend services

**Don't use this skill for:**
- Frontend debugging (use debugging-ui instead)
- Database schema design (use database-design instead)
- Performance optimization (use performance-tuning instead)
```

---

### Section 2: Quick Start (5-Minute Version)

**Purpose:** Get users productive immediately with minimal reading.

**Structure:**
```markdown
## Quick Start

**Goal:** [What you'll achieve in 5 minutes]

**Steps:**
1. [Minimal step 1]
2. [Minimal step 2]
3. [Minimal step 3]

**Example:**
[Copy-paste-ready code/commands]

**Next:** See full workflow below for advanced usage.
```

**Example:**
```markdown
## Quick Start

**Goal:** Create your first skill in 5 minutes

**Steps:**
1. Create file: `.claude/skills/my-skill.md`
2. Add frontmatter:
   ```yaml
   ---
   name: my-skill
   description: What it does and when to use it
   ---
   ```
3. Add content: "## When to Use This Skill..."

**Example:**
See EXAMPLES.md for a complete working skill.

**Next:** See full workflow below for best practices.
```

---

### Section 3: Full Workflow (Detailed Steps)

**Purpose:** Comprehensive step-by-step guidance for creating skills.

**Structure:**
```markdown
## Full Workflow

### Step 1: [Action Verb] [Object]
**Why:** [Reasoning]
**How:** [Detailed instructions]
**Example:** [Concrete example]

### Step 2: [Action Verb] [Object]
**Why:** [Reasoning]
**How:** [Detailed instructions]
**Example:** [Concrete example]

[Continue for all steps...]
```

---

### Section 4: Anti-Patterns (What Not to Do)

**Purpose:** Help users avoid common mistakes.

**Structure:**
```markdown
## Anti-Patterns to Avoid

### ❌ [Anti-Pattern Name]
**Bad:**
[Code/example showing wrong way]

**Good:**
[Code/example showing right way]

**Why:** [Explanation of why bad approach fails]
```

**Example:**
```markdown
## Anti-Patterns to Avoid

### ❌ Vague Skill Descriptions

**Bad:**
```yaml
description: Helps with files
```

**Good:**
```yaml
description: Extract text from PDF files using OCR. Parse tables, images, and forms. Use when converting PDFs to text, extracting invoice data, or processing scanned documents.
```

**Why:** Claude discovers skills by matching descriptions to user requests. Vague descriptions prevent skill activation.
```

---

## Testing Your Skill

### Validation Steps

1. **YAML Syntax Check**
   ```bash
   # Use a YAML validator
   yamllint .claude/skills/your-skill/SKILL.md
   ```

2. **Load Test**
   ```bash
   # Start Claude Code in debug mode
   claude --debug
   # Check for loading errors in output
   ```

3. **Discovery Test**
   Ask Claude a question that matches your skill description:
   ```
   "I need to debug an API endpoint that's returning 404 errors"
   ```

   Claude should activate your skill if description matches.

4. **Functionality Test**
   Verify the skill produces expected results when activated.

5. **Cross-Model Test**
   Test on different Claude models:
   - Claude Opus (most capable)
   - Claude Sonnet (balanced)
   - Claude Haiku (fastest)

---

## Common Mistakes to Avoid

### 1. YAML Frontmatter Errors

**Mistake:** Opening `---` not on line 1
```yaml
# This is wrong
---
name: my-skill
---
```

**Fix:**
```yaml
---
name: my-skill
---
# Now content starts
```

---

### 2. Name/File Mismatch

**Mistake:**
```
File: .claude/skills/my-skill.md
Frontmatter: name: myskill
```

**Fix:**
```
File: .claude/skills/my-skill.md
Frontmatter: name: my-skill
```

---

### 3. Missing "When to Use" in Description

**Mistake:**
```yaml
description: Debugs API endpoints and analyzes logs
```

**Fix:**
```yaml
description: Debug API endpoint failures systematically. Use when endpoints fail, return unexpected errors, or experience timeouts.
```

---

### 4. Too Abstract

**Mistake:**
```markdown
## How to Debug
1. Look at the problem
2. Find the issue
3. Fix it
```

**Fix:**
```markdown
## How to Debug
1. Check API logs: `tail -f logs/api.log`
2. Test endpoint: `curl http://localhost:3000/api/endpoint`
3. Verify database: `psql -c "SELECT * FROM table"`
```

---

### 5. No Examples

**Mistake:** Only text explanations, no code examples

**Fix:** Include copy-paste-ready examples for every major concept

---

## Skill Lifecycle

### Creation
1. Identify repeating pattern
2. Document in skill format
3. Test and validate
4. Share (if appropriate)

### Maintenance
1. Monitor usage and feedback
2. Update for new patterns
3. Add examples from real use
4. Refine based on experience

### Evolution
1. Extract new sub-skills if too complex
2. Archive if obsolete
3. Merge if overlapping with others
4. Version for breaking changes

### Archiving
When a skill becomes obsolete:
1. Move to `.claude/skills/archived/`
2. Update any referencing skills
3. Document why it's archived
4. Keep for reference/history

---

## Performance Considerations

### Token Efficiency

**Heavy content (extract to separate files):**
- Large tables (>50 rows)
- Multiple detailed examples (>5)
- Comprehensive reference docs
- Step-by-step checklists (>20 steps)

**Keep in SKILL.md (frequently accessed):**
- Core workflow (5-10 steps)
- Top 3-5 patterns
- Essential anti-patterns
- Quick start example

### Loading Time

**What affects loading:**
- File size (smaller = faster)
- Number of supporting files
- Complexity of YAML frontmatter

**Optimization tips:**
- Keep SKILL.md under 500 lines
- Use progressive disclosure
- Link to external docs instead of copying

---

## Advanced Patterns

### Skill Dependencies

**When one skill references another:**

```markdown
## Prerequisites

This skill builds on:
- [debugging-basics](../debugging-basics/SKILL.md) - Core debugging concepts
- [api-design](../api-design/SKILL.md) - API patterns

Ensure you're familiar with those skills first.
```

---

### Conditional Workflows

**When workflow varies by context:**

```markdown
## Workflow

**For REST APIs:**
1. Step A
2. Step B
3. Step C

**For GraphQL:**
1. Step X
2. Step Y
3. Step Z

**For both:**
1. Common step 1
2. Common step 2
```

---

### Executable Scripts Integration

**scripts/ directory structure:**
```
skill-name/
├── SKILL.md
└── scripts/
    ├── setup.sh           # Setup script
    ├── validate.sh        # Validation script
    └── templates/
        ├── basic.md       # Basic template
        └── advanced.md    # Advanced template
```

**Reference from SKILL.md:**
```markdown
## Quick Setup

Run the setup script:
```bash
bash .claude/skills/skill-name/scripts/setup.sh
```

This will create the initial project structure.
```

---

## Version Control Best Practices

### What to Commit

**Always commit:**
- SKILL.md (with frontmatter)
- Supporting files (REFERENCE.md, etc.)
- Scripts and templates
- README.md

**Never commit:**
- Backup files (.backup, .tmp)
- Build artifacts
- User-specific configurations
- Temporary test files

### Commit Messages

**Good:**
```
feat(skills): Add debugging-api-endpoints skill
fix(skills): Correct YAML syntax in creating-skills
docs(skills): Update examples in writing-tests
refactor(skills): Split large skill into supporting files
```

**Bad:**
```
update skill
fix
changes
```

---

## Skill Discovery Optimization

### Keywords for Description

Include terms users naturally mention:

**API Debugging skill:**
- "endpoint"
- "404", "500", "error"
- "timeout"
- "API"
- "request", "response"
- "logs"

**Data Processing skill:**
- "CSV", "JSON", "XML"
- "convert", "transform"
- "parse"
- "data"
- "file"
- "import", "export"

### Testing Discovery

**Method 1: Ask Questions**
```
User: "My API endpoint is returning 404 errors"
[Check if skill activates]
```

**Method 2: Debug Mode**
```bash
claude --debug
[Shows which skills matched and why]
```

**Method 3: Description Review**
- Does description include user's likely words?
- Is description specific enough?
- Does it mention concrete scenarios?

---

## Real-World Skill Analysis

### Example: This Skill (creating-skills)

**Name:** `creating-skills` ✅
- Gerund form
- Clear action
- No Claude/Anthropic

**Description:** ✅
- What: "Create new Claude Code skills"
- When: "when creating new skills, updating existing skills, or troubleshooting"
- Keywords: "skills", "frontmatter", "progressive disclosure"

**Structure:** ✅
- SKILL.md (core guidance)
- REFERENCE.md (detailed templates)
- TROUBLESHOOTING.md (debugging)
- EXAMPLES.md (real-world examples)

**Content:** ✅
- When to use (orientation)
- Quick start (fast path)
- Full workflow (comprehensive)
- Anti-patterns (what to avoid)
- Templates (copy-paste ready)

---

## See Also

- Main skill: [SKILL.md](./SKILL.md)
- Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Examples: [EXAMPLES.md](./EXAMPLES.md)
- Official docs: https://code.claude.com/docs/en/skills.md
