---
name: recall
description: Deep search across all past Claude Code sessions for decisions, solutions, and discussions
version: 0.6.0
triggers:
  - "I forgot"
  - "do you remember"
  - "what did we decide"
  - "we discussed this before"
  - "I need to recall"
  - "search my memory"
  - "/recall"
tools:
  - Bash
  - Read
---

# Recall: Self-Memory Retrieval

> **STOP. READ THIS FIRST.**
>
> **THE ONLY COMMAND YOU MAY USE IS:**
> ```
> .claude/bin/transcript recall "your query"
> ```
>
> **YOU MUST NOT USE:**
> - `rg` - FORBIDDEN
> - `grep` - FORBIDDEN
> - `find` - FORBIDDEN
> - `cat ~/.claude/` - FORBIDDEN
> - Any direct file access to `~/.claude/projects/` - FORBIDDEN
>
> If you use any forbidden command, you are violating this skill's requirements.

## Why This Matters

The `transcript` CLI:
- Handles JSONL parsing correctly
- Groups results by session
- Shows timestamps and context
- Finds related skills automatically
- Auto-synthesizes complex queries with LLM

Raw tools like `rg` return unreadable JSON blobs and miss context. **Using them is a failure mode.**

## The Command

```bash
.claude/bin/transcript recall "your query"
```

That's it. Run this command. Read the output. Done.

## Tiered Retrieval

Recall uses intelligent tiering to match retrieval strategy to query complexity:

### Fast Path (default)
- SQLite FTS search
- Returns in 1-2 seconds
- Best for simple keyword lookups

### Deep Path (auto or --deep)
- Fast path + LLM synthesis
- Returns in 5-10 seconds
- Best for complex questions requiring cross-session analysis

### Auto-Escalation

The command automatically escalates to deep path when:
- **Match count > 50** - Too many results to scan manually
- **Results span > 7 days** - Long time range suggests complex topic
- **Query is a question** - Starts with what/why/how/did/do/etc.
- **Session count > 5** - Information spread across many sessions

### Controlling Escalation

```bash
# Force deep path (LLM synthesis) even for simple queries
.claude/bin/transcript recall "caching" --deep
.claude/bin/transcript recall "caching" -D

# Force fast path (skip synthesis) even when criteria would trigger escalation
.claude/bin/transcript recall "why did we choose redis" --fast
.claude/bin/transcript recall "why did we choose redis" -F
```

**Note:** `--fast` takes precedence over `--deep` if both are specified.

### Options

```bash
.claude/bin/transcript recall "query" --max-sessions 5    # Limit sessions shown (default: 5)
.claude/bin/transcript recall "query" --context 3         # Matches per session (default: 3)
.claude/bin/transcript recall "query" --limit 100         # Total matches to search (default: 100)
.claude/bin/transcript recall "query" --deep              # Force LLM synthesis
.claude/bin/transcript recall "query" --fast              # Skip LLM synthesis
.claude/bin/transcript recall "query" --json              # Output as JSON (includes synthesis if applicable)
```

## Examples

### Simple keyword lookup (fast path)
```bash
.claude/bin/transcript recall "caching"
```
Returns grouped results in 1-2 seconds.

### Question query (auto-escalates to deep path)
```bash
.claude/bin/transcript recall "why did we decide to use Redis?"
```
Auto-detects question pattern, runs synthesis, returns synthesized answer with citations.

### Force deep analysis
```bash
.claude/bin/transcript recall "authentication patterns" --deep
```
Forces LLM synthesis even if auto-escalation criteria not met.

### Skip synthesis for speed
```bash
.claude/bin/transcript recall "how does the login flow work" --fast
```
Skips synthesis despite question pattern, returns fast path results only.

## Workflow

```
User asks about past discussion
         |
.claude/bin/transcript recall "topic"     <- START HERE, ALWAYS
         |
Check path indicator (Fast or Deep)
         |
Read the grouped output (and synthesis if deep)
         |
Need more detail? -> Use drill-down command from output
         |
Respond to user with findings
```

## Common Mistakes (DO NOT DO THESE)

```bash
# WRONG - Do not use rg
rg "sandbox" ~/.claude/projects/

# WRONG - Do not use grep
grep -r "sandbox" ~/.claude/

# WRONG - Do not use find
find ~/.claude -name "*.jsonl" | xargs grep sandbox

# WRONG - Do not cat jsonl files directly
cat ~/.claude/projects/*/abc123.jsonl | grep sandbox
```

```bash
# CORRECT - Use .claude/bin/transcript recall
.claude/bin/transcript recall "sandbox"
```

## Summary

1. **USE:** `.claude/bin/transcript recall "query"`
2. **DO NOT USE:** `rg`, `grep`, `find`, `cat` on transcript files
3. Let auto-escalation work - it detects when synthesis is needed
4. Use `--deep` to force synthesis, `--fast` to skip it
5. Read the grouped output (and synthesis if provided)
6. Drill down if needed using commands from the output
