# Skill Examples

This file contains real-world examples of well-structured Claude Code skills.

---

## Example 1: Read-Only Analysis Skill

**Use case:** Code review skill that should never modify files.

### File Structure
```
code-reviewer/
└── SKILL.md
```

### SKILL.md
```yaml
---
name: code-reviewer
description: Review code for quality issues, security vulnerabilities, and best practice violations. Analyzes TypeScript, JavaScript, and Python code. Provides actionable feedback without modifying files. Use when reviewing pull requests, auditing code quality, or checking for security issues.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Code Reviewer

## When to Use This Skill

Use this skill when you need to:
- Review pull requests for quality issues
- Audit code for security vulnerabilities
- Check compliance with coding standards
- Identify technical debt

**Don't use this skill for:**
- Auto-fixing issues (use code-formatter instead)
- Writing new code (use code-generator instead)
- Running tests (use test-runner instead)

---

## Quick Start

**Goal:** Get a code quality report in 2 minutes

**Steps:**
1. Ask: "Review the code in src/ directory"
2. Receive report with issues categorized by severity
3. Review recommendations and prioritize fixes

---

## Review Process

### Step 1: Scan for Common Issues
- Unused imports
- Console.log statements
- TODO comments
- Hardcoded credentials

### Step 2: Check Security
- SQL injection vulnerabilities
- XSS vulnerabilities
- Unvalidated user input
- Exposed secrets

### Step 3: Verify Best Practices
- Error handling
- Type safety
- Function complexity
- Code duplication

### Step 4: Generate Report
**Format:**
```
Code Review Report
==================

Critical Issues (Fix Immediately):
- [Issue 1 with file:line]
- [Issue 2 with file:line]

Warnings (Should Fix):
- [Issue 3 with file:line]

Suggestions (Consider):
- [Suggestion 1]
- [Suggestion 2]
```

---

## Anti-Patterns

### ❌ Making Changes
**Bad:** Skill modifies files during review
**Good:** Skill only reads and reports issues

### ❌ Vague Feedback
**Bad:** "This code could be better"
**Good:** "Function calculateTotal() has cyclomatic complexity of 15. Consider extracting helper functions. Line 45."
```

**Why this works:**
- `allowed-tools` prevents file modification
- Description mentions "without modifying files"
- Clear use cases for discovery
- Concrete review process

---

## Example 2: Data Processing Skill

**Use case:** Convert CSV to JSON with validation.

### File Structure
```
csv-to-json/
├── SKILL.md
├── EXAMPLES.md
└── scripts/
    └── validate-schema.js
```

### SKILL.md
```yaml
---
name: csv-to-json
description: Transform CSV data into JSON format with schema validation. Parse large datasets, handle encoding issues, and generate structured output. Use when converting CSV to JSON, processing bulk data, or handling malformed CSV files.
---

# CSV to JSON Converter

## When to Use This Skill

Use this skill when you need to:
- Convert CSV files to JSON format
- Validate data against a schema
- Handle large CSV datasets (100K+ rows)
- Fix encoding issues (UTF-8, Latin-1, etc.)
- Clean malformed CSV data

**Don't use this skill for:**
- JSON to CSV conversion (use json-to-csv instead)
- Excel files (use excel-processor instead)
- Real-time streaming data (use stream-processor instead)

---

## Quick Start

**Goal:** Convert a CSV file to JSON in 5 minutes

**Steps:**
1. Place CSV file in input directory
2. Run: `bun run convert input.csv output.json`
3. Verify output with schema validation

**Example:**
```bash
# Basic conversion
bun run convert users.csv users.json

# With schema validation
bun run convert users.csv users.json --schema user-schema.json

# Handle encoding issues
bun run convert data.csv output.json --encoding latin1
```

---

## Full Workflow

### Step 1: Validate Input CSV
```javascript
import { readFileSync } from 'fs';

const csv = readFileSync('input.csv', 'utf-8');
const lines = csv.split('\n');
const headers = lines[0].split(',');

// Verify headers
if (headers.length === 0) {
  throw new Error('CSV has no headers');
}
```

### Step 2: Parse Rows
```javascript
const rows = lines.slice(1).map(line => {
  const values = line.split(',');
  const obj = {};

  headers.forEach((header, index) => {
    obj[header.trim()] = values[index]?.trim() || null;
  });

  return obj;
});
```

### Step 3: Validate Against Schema
```javascript
import { validateSchema } from './scripts/validate-schema.js';

for (const row of rows) {
  const errors = validateSchema(row, schema);
  if (errors.length > 0) {
    console.error(`Row validation failed:`, errors);
  }
}
```

### Step 4: Write Output
```javascript
import { writeFileSync } from 'fs';

writeFileSync('output.json', JSON.stringify(rows, null, 2));
console.log(`Converted ${rows.length} rows to JSON`);
```

---

## See Also

- [EXAMPLES.md](./EXAMPLES.md) - More conversion examples
- [scripts/validate-schema.js](./scripts/validate-schema.js) - Schema validator
```

### EXAMPLES.md
```markdown
# CSV to JSON Examples

## Example 1: Basic User Data

**Input (users.csv):**
```csv
id,name,email
1,John Doe,john@example.com
2,Jane Smith,jane@example.com
```

**Output (users.json):**
```json
[
  {
    "id": "1",
    "name": "John Doe",
    "email": "john@example.com"
  },
  {
    "id": "2",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
]
```

## Example 2: With Type Conversion

**Schema (user-schema.json):**
```json
{
  "id": "number",
  "name": "string",
  "email": "string",
  "active": "boolean"
}
```

**Input:**
```csv
id,name,email,active
1,John,john@example.com,true
2,Jane,jane@example.com,false
```

**Output:**
```json
[
  {
    "id": 1,
    "name": "John",
    "email": "john@example.com",
    "active": true
  },
  {
    "id": 2,
    "name": "Jane",
    "email": "jane@example.com",
    "active": false
  }
]
```
```

**Why this works:**
- Clear transformation pipeline
- Handles common issues (encoding, malformed data)
- Includes validation
- Provides executable examples
- Script integration for reusability

---

## Example 3: Complex Multi-File Skill

**Use case:** API debugging with comprehensive troubleshooting.

### File Structure
```
debugging-api-endpoints/
├── SKILL.md               (400 lines)
├── REFERENCE.md           (600 lines)
├── TROUBLESHOOTING.md     (400 lines)
└── EXAMPLES.md            (300 lines)
```

### SKILL.md
```yaml
---
name: debugging-api-endpoints
description: Systematically debug API endpoint failures. Guides through clean restarts, log analysis, and layer-by-layer debugging from routes to service to database. Use when endpoints fail despite code appearing correct, return unexpected errors (404, 500, validation), or experience timeout issues.
---

# Debugging API Endpoints

## When to Use This Skill

Use this skill when:
- API endpoints return 404, 500, or other HTTP errors
- Endpoints timeout or hang indefinitely
- Endpoints return incorrect or unexpected data
- New endpoints don't appear in routes
- Validation errors occur unexpectedly

**Don't use this skill for:**
- Frontend debugging (use debugging-ui instead)
- Database query optimization (use query-optimizer instead)
- Performance issues (use performance-profiler instead)
- Security audits (use security-auditor instead)

---

## Quick Start (5 Minutes)

**Goal:** Identify why an endpoint is failing

**Steps:**
1. **Check if server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Test the failing endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/endpoint \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

3. **Check logs:**
   ```bash
   tail -f logs/api.log
   ```

4. **Verify route exists:**
   ```bash
   grep -r "endpoint" src/routes/
   ```

If issue persists, see full debugging workflow below.

---

## Full Debugging Workflow

### Phase 1: Server Health
- [ ] Server running (check process)
- [ ] Port available (not already in use)
- [ ] Dependencies loaded (no import errors)
- [ ] Environment variables set

### Phase 2: Route Layer
- [ ] Route registered in router
- [ ] HTTP method correct (GET, POST, etc.)
- [ ] Path matches request
- [ ] Middleware executing

### Phase 3: Service Layer
- [ ] Service function called
- [ ] Parameters passed correctly
- [ ] Business logic executing
- [ ] No exceptions thrown

### Phase 4: Database Layer
- [ ] Database connection active
- [ ] Query syntax valid
- [ ] Query returns expected data
- [ ] Transactions commit successfully

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for issue-specific solutions.

---

## Common Patterns

### Pattern 1: Clean Restart
When in doubt, restart everything:

```bash
# Kill server
pkill -f "node.*api"

# Clear port
lsof -ti:3000 | xargs kill -9

# Restart
cd apps/api && bun dev
```

### Pattern 2: Layer-by-Layer Testing
Test each layer independently:

```bash
# Test database directly
psql -d mydb -c "SELECT * FROM users LIMIT 1"

# Test service layer
bun test src/services/user-service.test.ts

# Test route layer
curl http://localhost:3000/api/users
```

### Pattern 3: Log-Driven Debugging
Add strategic logging:

```typescript
// Route layer
app.post('/api/users', async (req, res) => {
  console.log('[ROUTE] Received request:', req.body);
  const result = await userService.create(req.body);
  console.log('[ROUTE] Service returned:', result);
  res.json(result);
});

// Service layer
async create(data) {
  console.log('[SERVICE] Creating user:', data);
  const user = await db.users.insert(data);
  console.log('[SERVICE] User created:', user);
  return user;
}
```

---

## Anti-Patterns

### ❌ Assuming Root Cause
**Bad:** "It must be the database"
**Good:** Test each layer systematically

### ❌ Making Multiple Changes
**Bad:** Change code, restart server, modify config, update schema (all at once)
**Good:** Change one thing, test, observe, repeat

### ❌ Ignoring Logs
**Bad:** Not checking logs
**Good:** Monitor logs during every test

---

## See Also

- [REFERENCE.md](./REFERENCE.md) - Detailed debugging commands
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Issue-specific solutions
- [EXAMPLES.md](./EXAMPLES.md) - Real debugging sessions
```

### TROUBLESHOOTING.md
```markdown
# API Debugging - Troubleshooting Guide

## Issue: 404 Not Found

**Symptoms:** Endpoint returns 404 error

**Causes:**
1. Route not registered
2. Path mismatch
3. Server not restarted after code change

**Solutions:**

1. **Check route registration:**
   ```bash
   grep -r "/api/endpoint" src/routes/
   ```

2. **Verify exact path:**
   ```typescript
   // Does path match exactly?
   app.post('/api/users', handler)  // ← no trailing slash
   curl http://localhost:3000/api/users/  // ← has trailing slash = 404
   ```

3. **Restart server:**
   ```bash
   # Stop
   pkill -f "bun.*dev"

   # Start
   cd apps/api && bun dev
   ```

---

## Issue: 500 Internal Server Error

**Symptoms:** Endpoint returns 500 error

**Causes:**
1. Unhandled exception
2. Database error
3. Invalid data

**Solutions:**

1. **Check logs:**
   ```bash
   tail -50 logs/api.log | grep ERROR
   ```

2. **Add error handling:**
   ```typescript
   app.post('/api/endpoint', async (req, res) => {
     try {
       const result = await service.process(req.body);
       res.json(result);
     } catch (error) {
       console.error('[ERROR]', error);
       res.status(500).json({ error: error.message });
     }
   });
   ```

3. **Test database connection:**
   ```bash
   psql -d mydb -c "SELECT 1"
   ```

---

## Issue: Timeout

**Symptoms:** Request hangs indefinitely

**Causes:**
1. Infinite loop
2. Database deadlock
3. Missing await

**Solutions:**

1. **Check for missing await:**
   ```typescript
   // Bad (missing await)
   const result = service.getData();  // ← Returns Promise, not data

   // Good
   const result = await service.getData();
   ```

2. **Add timeout:**
   ```bash
   curl --max-time 5 http://localhost:3000/api/endpoint
   ```

3. **Check database queries:**
   ```sql
   -- PostgreSQL: Check long-running queries
   SELECT pid, now() - query_start as duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC;
   ```
```

**Why this works:**
- Progressive disclosure (SKILL.md → supporting files)
- Systematic debugging approach
- Concrete examples with code
- Issue-specific troubleshooting
- Checklist format for easy following

---

## Example 4: Simple Single-File Skill

**Use case:** Quick task that doesn't need complexity.

### File Structure
```
git-commit-message/
└── SKILL.md
```

### SKILL.md
```yaml
---
name: git-commit-message
description: Generate conventional commit messages following industry standards. Creates semantic commit messages with type, scope, and description. Use when committing code, creating pull requests, or standardizing git history.
---

# Git Commit Message Generator

## When to Use This Skill

Use this skill when you need to:
- Write standardized git commit messages
- Follow conventional commits specification
- Create semantic commit history
- Generate PR titles

**Don't use this skill for:**
- Complex commit message generation requiring user stories
- Automated commit creation (use git-automation instead)

---

## Quick Start

**Goal:** Generate a commit message in 30 seconds

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Example:**
```
feat(auth): Add OAuth2 login support

Implemented Google and GitHub OAuth providers.
Added user profile sync from OAuth data.

Closes #123
```

---

## Commit Types

| Type | Use When |
|------|----------|
| `feat` | Adding new feature |
| `fix` | Fixing bug |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no feature/fix |
| `test` | Adding tests |
| `chore` | Build, dependencies, etc. |

---

## Examples

**New Feature:**
```
feat(api): Add user registration endpoint
```

**Bug Fix:**
```
fix(auth): Prevent token expiration race condition
```

**Documentation:**
```
docs(readme): Update installation instructions
```

**Refactoring:**
```
refactor(services): Extract email sending to separate service
```

---

## Anti-Patterns

### ❌ Vague Messages
**Bad:** `fix: fixed bug`
**Good:** `fix(api): Prevent null pointer in user lookup`

### ❌ Missing Type
**Bad:** `added new feature`
**Good:** `feat(ui): Add dark mode toggle`

### ❌ Too Long
**Bad:** `feat(api): Added new user registration endpoint with email validation and password strength checking and duplicate email prevention`
**Good:** `feat(api): Add user registration with validation`

---

## See Also

- Conventional Commits: https://www.conventionalcommits.org/
- Semantic Versioning: https://semver.org/
```

**Why this works:**
- Simple single file (under 200 lines)
- Clear format specification
- Quick reference table
- Concrete examples
- No supporting files needed (task is straightforward)

---

## Example 5: Skill with Scripts

**Use case:** Project setup automation.

### File Structure
```
project-setup/
├── SKILL.md
├── EXAMPLES.md
└── scripts/
    ├── init.sh
    ├── validate.sh
    └── templates/
        ├── .gitignore
        ├── package.json
        └── tsconfig.json
```

### SKILL.md
```yaml
---
name: project-setup
description: Initialize new TypeScript projects with best practices. Sets up directory structure, configuration files, git, and dependencies. Use when starting new projects, creating templates, or standardizing project structure.
---

# Project Setup

## When to Use This Skill

Use this skill when you need to:
- Create new TypeScript project from scratch
- Set up project with best practices
- Initialize git repository with hooks
- Configure build tools and linters

**Don't use this skill for:**
- Existing projects (use project-migration instead)
- Frontend-only projects (use frontend-setup instead)

---

## Quick Start

**Goal:** New project in 2 minutes

**Steps:**
1. Run setup script:
   ```bash
   bash .claude/skills/project-setup/scripts/init.sh my-project
   ```

2. Customize generated files

3. Install dependencies:
   ```bash
   cd my-project && bun install
   ```

**Result:**
```
my-project/
├── src/
│   └── index.ts
├── test/
│   └── index.test.ts
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Manual Setup

### Step 1: Create Directory Structure
```bash
mkdir -p my-project/{src,test,docs}
cd my-project
```

### Step 2: Initialize Git
```bash
git init
cp .claude/skills/project-setup/scripts/templates/.gitignore .
git add .gitignore
git commit -m "Initial commit"
```

### Step 3: Setup Node.js
```bash
cp .claude/skills/project-setup/scripts/templates/package.json .
cp .claude/skills/project-setup/scripts/templates/tsconfig.json .
bun install
```

### Step 4: Validate Setup
```bash
bash .claude/skills/project-setup/scripts/validate.sh
```

---

## See Also

- [EXAMPLES.md](./EXAMPLES.md) - Example projects
- [scripts/init.sh](./scripts/init.sh) - Automated setup script
- [scripts/validate.sh](./scripts/validate.sh) - Validation script
```

### scripts/init.sh
```bash
#!/bin/bash
set -e

PROJECT_NAME=$1

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: $0 <project-name>"
  exit 1
fi

echo "Creating project: $PROJECT_NAME"

# Create directory structure
mkdir -p "$PROJECT_NAME"/{src,test,docs}

# Copy templates
SCRIPT_DIR=$(dirname "$0")
cp "$SCRIPT_DIR/templates/.gitignore" "$PROJECT_NAME/"
cp "$SCRIPT_DIR/templates/package.json" "$PROJECT_NAME/"
cp "$SCRIPT_DIR/templates/tsconfig.json" "$PROJECT_NAME/"

# Initialize git
cd "$PROJECT_NAME"
git init
git add .
git commit -m "Initial commit"

echo "✅ Project created: $PROJECT_NAME"
echo "Next steps:"
echo "  cd $PROJECT_NAME"
echo "  bun install"
```

### scripts/validate.sh
```bash
#!/bin/bash

echo "Validating project setup..."

# Check required files
FILES=(.gitignore package.json tsconfig.json)
for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    exit 1
  fi
done

# Check directory structure
DIRS=(src test)
for dir in "${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "❌ Missing directory: $dir"
    exit 1
  fi
done

# Check git initialized
if [ ! -d ".git" ]; then
  echo "❌ Git not initialized"
  exit 1
fi

echo "✅ Project setup valid"
```

**Why this works:**
- Automation via scripts
- Template files for consistency
- Validation script catches errors
- Both automated and manual paths
- Examples show usage

---

## Key Takeaways from Examples

### Skill Complexity Spectrum

**Simple (Single File):**
- git-commit-message
- Under 200 lines
- Straightforward task
- No supporting files needed

**Medium (Multiple Files):**
- csv-to-json
- code-reviewer
- 300-500 lines total
- Examples and scripts separate

**Complex (Full Structure):**
- debugging-api-endpoints
- project-setup
- 1000+ lines total
- REFERENCE, TROUBLESHOOTING, EXAMPLES
- Scripts and templates

### Common Success Patterns

1. **Clear "When to Use" section**
   - Specific use cases
   - Explicit anti-use cases
   - Keywords for discovery

2. **Quick Start under 5 minutes**
   - Minimal steps
   - Copy-paste ready
   - Shows immediate value

3. **Concrete examples**
   - Real code, not placeholders
   - Before/after comparisons
   - Expected output shown

4. **Progressive disclosure**
   - SKILL.md: Overview + quick start
   - REFERENCE.md: Detailed docs
   - EXAMPLES.md: Real-world cases
   - TROUBLESHOOTING.md: Common issues

5. **Tool restrictions match purpose**
   - Read-only skills: `allowed-tools` specified
   - Modification skills: No `allowed-tools`
   - Clear about capabilities

### Anti-Patterns Demonstrated

**❌ Vague descriptions:**
```yaml
description: Helps with projects
```

**✅ Specific descriptions:**
```yaml
description: Initialize new TypeScript projects with best practices. Sets up directory structure, configuration files, git, and dependencies. Use when starting new projects, creating templates, or standardizing project structure.
```

**❌ Abstract examples:**
```markdown
1. Do the thing
2. Process the data
3. Get the result
```

**✅ Concrete examples:**
```bash
1. Run: curl http://localhost:3000/api/users
2. Check: tail -f logs/api.log
3. Verify: psql -c "SELECT * FROM users"
```

---

## See Also

- Main skill: [SKILL.md](./SKILL.md)
- Technical reference: [REFERENCE.md](./REFERENCE.md)
- Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
