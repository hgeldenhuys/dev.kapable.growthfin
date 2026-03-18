---
name: find-pattern
description: Find examples of architectural patterns in the codebase (CQRS, SSE, hooks, routes, queries) to maintain consistency
trigger: When implementing new features and need to follow existing patterns, or learning how something is done in this codebase
examples:
  - "How should I implement a CQRS endpoint?"
  - "Show me examples of React hooks"
  - "What's the pattern for ElysiaJS routes?"
  - "How do we handle SSE in this codebase?"
---

# find-pattern - Pattern Matcher

## When to Use This Skill

**ALWAYS use this skill when:**
- 🏗️ Implementing new features (follow existing patterns)
- 📚 Learning how the codebase works
- 🎯 Ensuring consistency with established patterns
- 🔍 Finding proven examples to copy
- ✅ Verifying you're following conventions

**Example triggers:**
- User asks: "How do I implement X?"
- Before coding: "Let me find pattern examples first"
- During code review: "Is this following our patterns?"
- Onboarding: "How does this codebase handle Y?"

## How to Use

**Find pattern examples:**
```bash
bun .claude/sdlc/scripts/find-pattern.ts "<pattern-name>"
```

**Available patterns:**
- `CQRS` - GET + SSE endpoint pairs
- `SSE` - Server-sent events implementation
- `hook` - React custom hooks
- `route` - ElysiaJS route definitions
- `query` - Drizzle database queries
- `service` - Service layer patterns
- `streaming` - Real-time streaming patterns

**Get help:**
```bash
bun .claude/sdlc/scripts/find-pattern.ts --help
```

## Examples

### Implementing CQRS Endpoint
```bash
# Need to add new CQRS endpoint for contacts
bun .claude/sdlc/scripts/find-pattern.ts "CQRS"

# Output shows 2 proven examples:
# 1. hook-events routes (GET /recent + GET /stream)
# 2. campaigns routes (GET + SSE pair)

# Copy the pattern, adapt for contacts
```

### Creating React Hook
```bash
# Need to create useContacts hook
bun .claude/sdlc/scripts/find-pattern.ts "hook"

# Shows examples: useAuth, useCampaigns, useHookEventStream
# Follow the established pattern
```

### Database Query Patterns
```bash
# How do we query with Drizzle?
bun .claude/sdlc/scripts/find-pattern.ts "query"

# Shows db.select() patterns with proper typing
```

## What the Tool Does

1. **Searches codebase** for architectural patterns (880 files)
2. **AST-based matching** (not regex - understands code structure)
3. **Extracts code snippets** with context (±10 lines)
4. **Ranks by relevance** (best examples first)
5. **Highlights characteristics** of each pattern

## Output Format

```
Pattern: CQRS Pattern
Description: Command Query Responsibility Segregation with GET + SSE endpoints

Found 2 matches. Showing top 5:

--------------------------------------------------------------------------------
Example 1: apps/api/src/modules/hook-events/routes.ts:85 (score: 100)
--------------------------------------------------------------------------------

Characteristics:
  ✓ GET /recent endpoint for initial state
  ✓ GET /stream endpoint for delta updates
  ✓ ElysiaJS route definitions
  ✓ CQRS pattern implementation

Code snippet:
    85 │   .get('/recent', async ({ db, query }) => {
    86 │     const seconds = query.seconds ? parseInt(query.seconds, 10) : 30;
    ...
   103 │   .get('/stream', async ({ db, query }) => {
   104 │     // SSE endpoint for delta updates
```

## Pattern Descriptions

### CQRS Pattern
**What it is:** Separate endpoints for reading (GET) and updates (SSE)

**When to use:**
- Real-time data updates needed
- Want to avoid polling
- Need efficient delta updates

**Example:** Hook events, Campaigns

### SSE Pattern
**What it is:** Server-Sent Events for real-time push

**When to use:**
- Real-time updates to frontend
- One-way server → client communication
- More efficient than polling

**Example:** Hook event streaming, Campaign updates

### Hook Pattern
**What it is:** React custom hooks for reusable logic

**When to use:**
- Shared state management
- API data fetching
- Component lifecycle logic

**Example:** useAuth, useCampaigns, useHookEventStream

### Route Pattern
**What it is:** ElysiaJS route definitions with typing

**When to use:**
- Adding new API endpoints
- Following REST conventions
- Type-safe request/response

**Example:** CRM routes, Hook event routes

### Query Pattern
**What it is:** Drizzle ORM database queries

**When to use:**
- Reading from database
- Type-safe queries
- Joins and relations

**Example:** Campaign queries, Contact queries

### Service Pattern
**What it is:** Business logic layer separation

**When to use:**
- Complex business logic
- Shared between routes
- Testable in isolation

**Example:** Campaign service, Contact service

### Streaming Pattern
**What it is:** Real-time data streaming patterns

**When to use:**
- Live updates needed
- PostgreSQL NOTIFY/LISTEN
- SSE or WebSocket

**Example:** Hook event streaming

## Performance

- Analyzes 880 files in ~0.5 seconds
- Shows top 5 best examples
- Includes code snippets for quick copying
- Relevance scoring for ranking

## Workflow Integration

**Typical usage in feature development:**

```python
# 1. BEFORE implementing new feature
Use find-pattern skill to find examples
  ↓
# 2. Study the pattern
Review characteristics and code
  ↓
# 3. Copy and adapt
Follow proven pattern exactly
  ↓
# 4. Verify consistency
Run pattern finder again to compare
```

## Tips

**Choosing the right pattern:**
- For API endpoints → Look at `CQRS` or `route`
- For React state → Look at `hook`
- For database → Look at `query` or `service`
- For real-time → Look at `SSE` or `streaming`

**Using the examples:**
- Copy the structure, not just the code
- Follow the naming conventions
- Maintain the same error handling
- Use the same typing patterns

**When no matches found:**
- Try related pattern name
- Check spelling
- Pattern might not exist yet (create it!)
- Use find-concept skill instead

## Related Skills

- **deps** - Analyze dependencies of pattern examples
- **find-concept** - Find all code related to a concept
- **rubber-duck** - Analyze complex patterns

## Remember

**ALWAYS check patterns BEFORE implementing new features.**

This ensures:
- ✅ Consistency with existing code
- ✅ Following established conventions
- ✅ Avoiding reinventing the wheel
- ✅ Learning from proven implementations

The 30 seconds spent finding patterns saves hours of refactoring later.
