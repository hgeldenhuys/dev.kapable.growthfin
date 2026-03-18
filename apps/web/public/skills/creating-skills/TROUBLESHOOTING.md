# Troubleshooting Skills

This guide covers common issues when creating, loading, and using Claude Code skills.

---

## Common Issues and Solutions

### Issue 1: Skill Not Activating

**Problem:** Claude doesn't use your skill even when it seems relevant.

**Symptoms:**
- Skill appears in file system
- No loading errors
- Claude doesn't activate it when expected

**Debugging Steps:**

1. **Check description keywords**
   ```yaml
   # Before (too generic)
   description: Helps process data

   # After (specific triggers)
   description: Transform CSV data into JSON format with schema validation. Parse large datasets, handle encoding issues, and generate structured output. Use when converting CSV to JSON, processing bulk data, or handling malformed CSV files.
   ```

2. **Verify skill location**
   ```bash
   # Personal skills
   ls -la ~/.claude/skills/your-skill/

   # Project skills
   ls -la .claude/skills/your-skill/
   ```

3. **Test with debug mode**
   ```bash
   claude --debug
   # Shows skill discovery matching
   ```

4. **Ask matching question**
   Test with a question that includes keywords from your description:
   ```
   "I need to convert CSV data to JSON format"
   ```

**Solutions:**

- **Add specific use-case keywords** to description
- **Include domain-specific terms** users would naturally mention
- **Avoid generic language** like "helps" or "processes"
- **Mention concrete scenarios** in description

**Example improvement:**
```yaml
# Before
description: Helps with API issues

# After
description: Debug API endpoint failures systematically. Guides through clean restarts, log analysis, and layer-by-layer debugging from routes to service to database. Use when endpoints fail despite code appearing correct, returning unexpected errors (404, 500, validation), or experiencing timeout issues.
```

---

### Issue 2: Skill Won't Load

**Problem:** Skill doesn't appear or causes errors on startup.

**Symptoms:**
- Error messages on Claude startup
- Skill not listed in available skills
- Claude fails to start

**Debugging Steps:**

1. **Run debug mode**
   ```bash
   claude --debug
   ```

   Look for:
   - Skill loading errors
   - YAML syntax problems
   - File path issues
   - Tool permission conflicts

2. **Check YAML syntax**
   Common errors:

   **Wrong: Opening `---` not on line 1**
   ```yaml
   # Comment here
   ---
   name: my-skill
   ---
   ```

   **Correct:**
   ```yaml
   ---
   name: my-skill
   ---
   # Comment after frontmatter
   ```

3. **Validate YAML**
   ```bash
   # Use yamllint or similar
   yamllint .claude/skills/your-skill/SKILL.md
   ```

4. **Check file paths**
   - Use forward slashes (/) not backslashes (\)
   - Verify correct directory location
   - Ensure proper file naming

**Common YAML Errors:**

**Error: Tabs instead of spaces**
```yaml
# Wrong (uses tabs)
allowed-tools:
	- Read
	- Write

# Correct (uses spaces)
allowed-tools:
  - Read
  - Write
```

**Error: Missing closing `---`**
```yaml
# Wrong
---
name: my-skill
description: Does things

# Correct
---
name: my-skill
description: Does things
---
```

**Error: Invalid array syntax**
```yaml
# Wrong
allowed-tools: [Read, Write, Bash]

# Correct
allowed-tools:
  - Read
  - Write
  - Bash
```

**Solutions:**

1. **Fix YAML frontmatter:**
   - Ensure `---` on line 1
   - Add closing `---`
   - Use spaces, not tabs
   - Validate array syntax

2. **Fix file path issues:**
   - Use Unix-style paths (/)
   - Check directory exists
   - Verify file permissions

3. **Fix frontmatter field errors:**
   - Name matches file/directory
   - Description under 1024 chars
   - Valid allowed-tools list

**Example debugging session:**
```bash
$ claude --debug

Loading skills...
✗ Error in skill 'my-skill': YAML frontmatter invalid (line 3: unexpected character)
✓ Loaded skill 'other-skill'

# Fix line 3 in SKILL.md, restart Claude Code
```

---

### Issue 3: Tool Permission Issues

**Problem:** Skill can't perform needed operations.

**Symptoms:**
- "Permission denied" errors
- Tool calls failing unexpectedly
- Skill appears to work but doesn't perform actions

**Cause:** `allowed-tools` restricts operations.

**Debugging Steps:**

1. **Check frontmatter**
   ```yaml
   ---
   name: my-skill
   description: Does things
   allowed-tools:
     - Read
     - Grep
   ---
   ```

2. **Review skill operations**
   - Does skill need to write files? (needs Write or Edit)
   - Does skill need to run commands? (needs Bash)
   - Does skill need to search? (needs Grep/Glob)

3. **Match tools to operations**

   **Operation → Required Tool:**
   - Read files → `Read`
   - Write files → `Write`
   - Edit files → `Edit`
   - Search content → `Grep`
   - Find files → `Glob`
   - Run commands → `Bash`
   - Check command output → `BashOutput`

**Solutions:**

**Option 1: Expand allowed-tools**
```yaml
# Before (too restrictive)
allowed-tools:
  - Read

# After (allows writing)
allowed-tools:
  - Read
  - Write
  - Edit
```

**Option 2: Remove allowed-tools**
```yaml
# Omit field for full access
---
name: my-skill
description: Does things
---
```

**Option 3: Adjust skill workflow**
Change skill to work within restrictions (e.g., read-only analysis instead of file modification).

**Decision matrix:**

| Skill Type | Recommended allowed-tools |
|------------|---------------------------|
| Code reviewer | `Read, Grep, Glob` |
| Data analyzer | `Read, Bash` |
| Code generator | Omit (full access) |
| Debugger | `Read, Grep, Bash, BashOutput` |
| File processor | Omit (full access) |

---

### Issue 4: Skill Too Large (Over 500 Lines)

**Problem:** SKILL.md is becoming unwieldy.

**Symptoms:**
- File exceeds 500 lines
- Hard to navigate
- Slow to load

**Solution:** Progressive disclosure - split into supporting files.

**Steps:**

1. **Identify heavy sections**
   - Large tables/reference data
   - Multiple detailed examples
   - Extensive troubleshooting
   - Step-by-step checklists

2. **Create supporting files**
   ```bash
   # In skill directory
   touch REFERENCE.md
   touch EXAMPLES.md
   touch TROUBLESHOOTING.md
   ```

3. **Extract content**
   Cut heavy sections from SKILL.md and paste into appropriate files.

4. **Add links**
   ```markdown
   ## Detailed Configuration

   See [REFERENCE.md](./REFERENCE.md) for all configuration options.

   ## Examples

   See [EXAMPLES.md](./EXAMPLES.md) for real-world use cases.
   ```

5. **Verify line count**
   ```bash
   wc -l SKILL.md
   # Should be under 500
   ```

**Example extraction:**

**Before (SKILL.md - 800 lines):**
```markdown
## All Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | string | "default" | Does X |
| option2 | number | 100 | Does Y |
[... 50 more rows ...]

## Examples

### Example 1: Basic Usage
[100 lines of code]

### Example 2: Advanced Usage
[150 lines of code]

[... 5 more examples ...]
```

**After (SKILL.md - 350 lines):**
```markdown
## Configuration

See [REFERENCE.md](./REFERENCE.md#configuration-options) for all available options.

## Examples

See [EXAMPLES.md](./EXAMPLES.md) for detailed usage examples.
```

**REFERENCE.md (300 lines):**
```markdown
# Configuration Options

[Full configuration table]
```

**EXAMPLES.md (400 lines):**
```markdown
# Examples

## Example 1: Basic Usage
[Full example]

## Example 2: Advanced Usage
[Full example]
```

---

### Issue 5: Name/File Mismatch

**Problem:** Skill won't load due to name mismatch.

**Symptoms:**
- Error: "Skill name doesn't match file name"
- Skill appears but doesn't activate

**Cause:** Frontmatter `name` doesn't match file/directory name.

**Examples:**

**Wrong:**
```
File: .claude/skills/my-skill.md
Frontmatter: name: myskill
```

**Wrong:**
```
Directory: .claude/skills/my-skill/
Frontmatter: name: my_skill
```

**Wrong:**
```
File: .claude/skills/MySkill.md
Frontmatter: name: my-skill
```

**Correct:**
```
File: .claude/skills/my-skill.md
Frontmatter: name: my-skill
```

**Correct:**
```
Directory: .claude/skills/my-skill/
File: .claude/skills/my-skill/SKILL.md
Frontmatter: name: my-skill
```

**Solution:**

1. Check file/directory name:
   ```bash
   ls -la .claude/skills/
   ```

2. Check frontmatter:
   ```bash
   head -n 5 .claude/skills/my-skill/SKILL.md
   ```

3. Make them match exactly (including hyphens and case).

---

### Issue 6: Skill Not Shareable

**Problem:** Team members don't have your skill.

**Cause:** Skill is in personal directory, not project directory.

**Locations:**

**Personal (not shared):**
```
~/.claude/skills/my-skill/
```

**Project (shared via git):**
```
.claude/skills/my-skill/
```

**Solution:**

**To share with team:**
```bash
# Move to project directory
mv ~/.claude/skills/my-skill .claude/skills/

# Commit to git
git add .claude/skills/my-skill/
git commit -m "Add shared skill: my-skill"
git push
```

**To keep personal:**
```bash
# Keep in ~/.claude/skills/
# Or copy to personal if currently in project:
cp -r .claude/skills/my-skill ~/.claude/skills/
```

---

### Issue 7: Skill Conflicts

**Problem:** Multiple skills activating for same query.

**Symptoms:**
- Claude uses wrong skill
- Unexpected behavior
- Confusing results

**Cause:** Overlapping skill descriptions.

**Example conflict:**

**Skill 1:**
```yaml
name: debugging-api
description: Debug API issues and errors
```

**Skill 2:**
```yaml
name: debugging-endpoints
description: Debug endpoint problems
```

**Solution: Make descriptions more specific**

**Skill 1 (improved):**
```yaml
name: debugging-api
description: Debug API-level issues like authentication, rate limiting, and API gateway errors. Use when troubleshooting API keys, OAuth flows, or API service outages.
```

**Skill 2 (improved):**
```yaml
name: debugging-endpoints
description: Debug individual endpoint logic errors. Trace through route handlers, service layer, and database queries. Use when endpoints return wrong data, validation errors, or business logic bugs.
```

Now they have distinct triggers:
- API-level issues → debugging-api
- Endpoint logic → debugging-endpoints

---

### Issue 8: Description Too Long

**Problem:** Description exceeds 1024 character limit.

**Symptoms:**
- Skill won't load
- Truncation errors
- YAML parse errors

**Solution: Condense description**

**Before (1200 characters):**
```yaml
description: This skill helps you debug API endpoints by providing systematic troubleshooting steps. It guides you through checking logs, testing endpoints, examining database queries, and analyzing error responses. You should use this when you have endpoints that are failing, returning incorrect data, timing out, or producing validation errors. It works for REST APIs, GraphQL endpoints, and webhooks. The skill provides detailed instructions for using curl, checking server logs, inspecting database queries, and more.
```

**After (350 characters):**
```yaml
description: Debug API endpoint failures systematically. Guides through log analysis, endpoint testing, and database inspection. Use when endpoints fail, return incorrect data, timeout, or have validation errors. Works for REST, GraphQL, and webhooks.
```

**Tips:**
- Remove filler words ("helps you", "should use when")
- Use sentence fragments
- Focus on keywords
- Remove redundant information
- Keep core functionality and triggers

---

### Issue 9: Examples Don't Work

**Problem:** Copy-paste examples fail when used.

**Cause:**
- Hardcoded paths
- Missing dependencies
- Outdated code
- Wrong environment assumptions

**Solutions:**

1. **Use relative paths**
   ```bash
   # Bad
   cd /Users/john/project

   # Good
   cd ./project
   # Or use current directory
   ```

2. **Document dependencies**
   ```markdown
   ## Prerequisites

   - Node.js 18+
   - Bun installed: `npm install -g bun`
   - Project dependencies: `bun install`
   ```

3. **Test examples**
   Before adding to skill, verify examples work in clean environment.

4. **Use placeholders**
   ```bash
   # Bad (assumes specific values)
   curl http://localhost:3000/api/users

   # Good (shows it's customizable)
   curl http://localhost:PORT/api/ENDPOINT
   ```

---

### Issue 10: Skill Not Working Across Models

**Problem:** Skill works on Opus but not Haiku.

**Cause:** Different models have different capabilities:
- Opus: Most capable, handles abstraction
- Sonnet: Balanced
- Haiku: Fastest, needs concrete examples

**Solution: Add more concrete examples for Haiku**

**Too abstract (fails on Haiku):**
```markdown
## How to Debug
1. Examine the system state
2. Identify the problem
3. Apply appropriate fixes
```

**Concrete (works on all models):**
```markdown
## How to Debug
1. Check logs: `tail -f logs/api.log`
2. Test endpoint: `curl -X POST http://localhost:3000/api/endpoint -d '{"test":"data"}'`
3. Verify database: `psql -d mydb -c "SELECT * FROM users LIMIT 10"`
```

**Testing checklist:**
- [ ] Works on Claude Opus
- [ ] Works on Claude Sonnet
- [ ] Works on Claude Haiku

If Haiku struggles:
- Add more examples
- Make instructions more specific
- Include exact commands
- Show expected output

---

## Debug Checklist

When a skill isn't working, check these in order:

### Phase 1: Loading
- [ ] YAML frontmatter valid
- [ ] Opening `---` on line 1
- [ ] Closing `---` present
- [ ] No tabs in YAML (use spaces)
- [ ] File in correct directory
- [ ] Run `claude --debug` to check loading

### Phase 2: Discovery
- [ ] Description includes "when to use"
- [ ] Description has domain keywords
- [ ] Description is specific (not vague)
- [ ] Under 1024 characters
- [ ] Test with matching question

### Phase 3: Naming
- [ ] Name uses gerund form (verb + -ing)
- [ ] Name matches file/directory
- [ ] No "claude" or "anthropic" in name
- [ ] Lowercase with hyphens only
- [ ] Under 64 characters

### Phase 4: Permissions
- [ ] allowed-tools includes needed tools
- [ ] Or allowed-tools omitted for full access
- [ ] Operations match available tools

### Phase 5: Content
- [ ] SKILL.md under 500 lines
- [ ] Examples are concrete
- [ ] No hardcoded paths
- [ ] Dependencies documented
- [ ] Works across models

### Phase 6: Structure
- [ ] Supporting files linked correctly
- [ ] No broken internal links
- [ ] No deep nesting
- [ ] File names follow conventions

---

## Getting Help

### Self-Diagnosis

1. **Run debug mode:**
   ```bash
   claude --debug
   ```

2. **Check recent changes:**
   ```bash
   git diff .claude/skills/
   ```

3. **Validate YAML:**
   ```bash
   yamllint .claude/skills/your-skill/SKILL.md
   ```

4. **Test discovery:**
   Ask a question matching the skill description.

### Common Error Messages

**Error: "YAML frontmatter invalid"**
- Check opening `---` on line 1
- Verify closing `---` present
- Look for tabs (should be spaces)
- Validate YAML syntax

**Error: "Skill name mismatch"**
- Ensure frontmatter `name` matches file/directory name
- Check for case sensitivity
- Verify hyphen vs underscore

**Error: "Description too long"**
- Shorten to under 1024 characters
- Remove filler words
- Focus on core functionality

**Error: "Invalid tool in allowed-tools"**
- Check spelling of tool names
- Verify tool exists in Claude Code
- Use correct case (Read, not read)

---

## See Also

- Main skill: [SKILL.md](./SKILL.md)
- Detailed reference: [REFERENCE.md](./REFERENCE.md)
- Examples: [EXAMPLES.md](./EXAMPLES.md)
- Official troubleshooting: https://code.claude.com/docs/en/skills.md#troubleshooting
