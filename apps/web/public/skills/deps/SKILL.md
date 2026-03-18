---
name: deps
description: Analyze function dependencies - find what calls a function or what a function calls (impact analysis before refactoring)
trigger: When you need to understand code dependencies, impact of changes, or what would break if you modified a function
examples:
  - "What would break if I changed getUserById?"
  - "Show me everything that depends on useAuth"
  - "What does processHookEvent actually call?"
  - "Find all callers of this function"
---

# deps - Dependency Analyzer

## When to Use This Skill

**ALWAYS use this skill when:**
- 🔧 About to refactor a function (impact analysis)
- 🔍 Need to understand what code depends on what
- 🚨 Investigating what would break from a change
- 📊 Mapping code relationships and call graphs
- 🎯 Finding all usages of a function

**Example triggers:**
- User asks: "What uses this function?"
- Before refactoring: "Let me check dependencies first"
- Impact analysis: "What would break if I changed X?"
- Code exploration: "How is this function used?"

## How to Use

**Find what CALLS a function (reverse dependencies - most common):**
```bash
bun .claude/sdlc/scripts/deps.ts <functionName> --reverse
```

**Find what a function CALLS (forward dependencies):**
```bash
bun .claude/sdlc/scripts/deps.ts <functionName> --forward
```

**Get help:**
```bash
bun .claude/sdlc/scripts/deps.ts --help
```

## Examples

### Impact Analysis Before Refactoring
```bash
# Before changing processHookEvent, check what depends on it
bun .claude/sdlc/scripts/deps.ts processHookEvent --reverse

# Output shows all callers with file:line locations
# Now you know exactly what to update
```

### Understanding Data Flow
```bash
# See what useAuth hook depends on
bun .claude/sdlc/scripts/deps.ts useAuth --forward

# Shows: useAuth → AuthContext → API calls → Database
```

### API Impact Analysis
```bash
# Check if anyone uses an API endpoint
bun .claude/sdlc/scripts/deps.ts getUserById --reverse

# Output: 15 components, 3 hooks, 2 services depend on it
# ⚠️ Breaking change would affect 20 files!
```

## What the Tool Does

1. **Scans TypeScript files** using TypeScript Compiler API
2. **Builds call graph** of function relationships
3. **Traverses dependencies** (direct + transitive)
4. **Shows precise locations** with file:line references
5. **Fast analysis** (~0.5s for 800+ functions)

## Output Format

```
Target Function: streamHookEvents
Mode: REVERSE (what calls it)

Definitions (1):
  function streamHookEvents at apps/api/src/lib/electric-shapes.ts:139

Dependents (18):
  ← apps/api/src/modules/hook-events/routes.ts:188 (streamHookEvents)
  ← apps/web/app/hooks/useHookEventStream.ts:12
  ← apps/web/app/hooks/useSessionEvents.ts:25
  ... and 15 more

Total impact: 18 files
```

## Performance

- Analyzes 334 source files in ~0.5 seconds
- Builds complete call graph of 810 functions
- Processes 3917 call sites
- Memory usage: <100MB

## Limitations

**What it CAN do:**
- ✅ Analyze TypeScript/TSX files
- ✅ Find direct function calls
- ✅ Find transitive dependencies
- ✅ Show file:line locations
- ✅ Handle arrow functions, methods, exports

**What it CANNOT do:**
- ❌ Analyze JavaScript (only TypeScript)
- ❌ Track dynamic imports
- ❌ Follow runtime reflection
- ❌ Analyze files in node_modules
- ❌ Track usage via string references

## Workflow Integration

**Typical usage in feature development:**

```python
# 1. BEFORE refactoring
Use deps skill to check impact
  ↓
# 2. Review all dependents
Assess scope of changes needed
  ↓
# 3. Make changes
Update function + all callers
  ↓
# 4. VERIFY
Use deps skill again to confirm all updated
```

## Tips

**Finding functions:**
- Use exact camelCase name: `getUserById` not `get_user_by_id`
- For methods: `db.select` works
- For components: `UserProfile` or `<UserProfile>`
- Check function is exported (not private)

**Reading output:**
- `←` means "is called by" (reverse)
- `→` means "calls" (forward)
- Numbers show file:line for quick navigation
- `Total impact` = number of files affected

**When no results:**
- Function might be unused (dead code!)
- Check spelling and casing
- Verify function is exported
- Try searching by concept first (use find-concept skill)

## Related Skills

- **find-pattern** - Find architectural pattern examples
- **find-concept** - Locate code by high-level concept
- **rubber-duck** - Analyze complex dependency issues

## Remember

**PROACTIVELY use this skill** before making any function changes. It's 20x faster than manual grepping and gives you confidence about impact scope.

The 30 seconds spent running deps.ts can save 30 minutes of debugging broken code.
