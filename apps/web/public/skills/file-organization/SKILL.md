---
name: file-organization
description: Code execution workspace organization - where to place AI-generated files, scripts, reports, and findings
tags: [organization, workspace, code-execution, files, best-practices]
---

# File Organization

Guides Claude on where to place all AI-generated files following the code execution pattern - treating `.claude/work/` as the execution environment.

## Core Principle: Code Execution Workspace

Following Anthropic's code execution with MCP pattern, **`.claude/work/`** serves as the isolated execution environment where ALL AI-generated outputs live. This keeps the repository clean and separates AI workspace from product code.

## Directory Structure

```
.claude/work/
├── scripts/         # Reusable test/debug scripts (TypeScript, bash, SQL)
├── reports/         # All markdown reports & findings
│   ├── features/    # Feature implementation summaries
│   ├── tests/       # Test reports & audit findings
│   └── sprints/     # Sprint/phase completion reports
└── temp/            # Temporary scratch files & experiments
```

## File Placement Rules

### Test & Debug Scripts
**Location**: `.claude/work/scripts/`

When writing test scripts, debugging utilities, or one-off execution code:

```typescript
// ✅ CORRECT
//.claude/work/scripts/test-context-sse.ts
//.claude/work/scripts/debug-usage-graph.ts
//.claude/work/scripts/verify-sse-implementation.ts

// ❌ WRONG
//test/scripts/test-context-sse.ts
//scripts/debug-usage-graph.ts
//test-context-sse.ts (root)
```

### Reports & Findings
**Location**: `.claude/work/reports/{category}/`

When writing completion summaries, test reports, or findings:

```markdown
// ✅ CORRECT - Feature reports
.claude/work/reports/features/CONTEXT-USAGE-IMPLEMENTATION.md
.claude/work/reports/features/SSE-STREAMING-COMPLETE.md

// ✅ CORRECT - Test reports
.claude/work/reports/tests/E2E-TEST-AUDIT-REPORT.md
.claude/work/reports/tests/QA-VISUAL-EVIDENCE.md

// ✅ CORRECT - Sprint reports
.claude/work/reports/sprints/SPRINT-2-COMPLETION.md

// ❌ WRONG
CONTEXT-USAGE-IMPLEMENTATION.md (root)
docs/reports/E2E-TEST-AUDIT-REPORT.md
```

### Temporary Files
**Location**: `.claude/work/temp/`

When creating scratch files, experiments, or temporary outputs:

```
// ✅ CORRECT
.claude/work/temp/test-output.json
.claude/work/temp/debug-session-2025-11-07.log

// ❌ WRONG
tmp/test-output.json
temp/debug.log
```

## What STAYS in Product Directories

### `/test/` - Actual Product Tests
Only tests that are **part of the product codebase**:

```
test/
├── unit/           # Unit tests (Jest/Vitest)
├── integration/    # Integration tests
├── e2e/            # E2E tests (Playwright)
└── utils/          # Test utilities & helpers
```

### Product Code
All actual product code stays in standard locations:

```
apps/
├── api/            # Backend code
├── web/            # Frontend code
└── cli/            # CLI code

packages/           # Shared packages
```

## Benefits of This Pattern

1. **Clean Root**: Only essential docs (README, CHANGELOG, ARCHITECTURE)
2. **Clear Separation**: AI workspace vs. product code
3. **Version Control**: `.claude/work/` is gitignored
4. **Code Execution**: Scripts can reference each other within `.claude/work/scripts/`
5. **Discoverability**: All AI outputs in one predictable location

## Decision Flow

When creating a file, ask:

```
Is this AI-generated? ────YES───> .claude/work/{scripts,reports,temp}/
         │
         NO
         ↓
Is this a product test? ──YES───> test/{unit,integration,e2e}/
         │
         NO
         ↓
Is this product code? ────YES───> apps/ or packages/
```

## Examples

### Creating a Test Script

```typescript
// WRONG: Writing to product test directory
// ❌ Write: test/scripts/test-new-feature.ts

// CORRECT: Writing to AI workspace
// ✅ Write: .claude/work/scripts/test-new-feature.ts
```

### Writing a Completion Report

```markdown
// WRONG: Dumping in root
// ❌ Write: FEATURE-COMPLETE-2025-11-07.md

// CORRECT: Organized report
// ✅ Write: .claude/work/reports/features/FEATURE-COMPLETE-2025-11-07.md
```

### Debugging with Temp Files

```typescript
// WRONG: Random location
// ❌ Write: /tmp/debug.json

// CORRECT: In AI workspace
// ✅ Write: .claude/work/temp/debug-2025-11-07.json
```

## Related Patterns

- **Code Execution with MCP**: https://www.anthropic.com/engineering/code-execution-with-mcp
- **Progressive Disclosure**: Load only what you need from `.claude/work/scripts/`
- **Data Filtering**: Process large datasets in execution environment before showing results

## Last Updated

2025-11-07
