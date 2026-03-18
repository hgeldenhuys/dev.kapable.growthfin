---
name: forge-close
description: "Generate retrospective, capture learnings, and archive the story"
user-invocable: true
---

# /forge-close — Retrospective and Archive

You are executing the `/forge-close` command to finalize a completed story with retrospective and learning capture.

## Input

The user provides a story ID (e.g., `SDB-003`). The story must be in `.forge/backlog/` with status `done`.

## Process

### Step 1: Read Story

Read `.forge/backlog/{STORY-ID}.md` to gather:
- Full story context (title, WHY, requirements)
- All task completion details
- Acceptance criteria results with evidence
- Execution metadata (timestamps, session IDs)

Also read `.forge/config.md` for project context.

### Step 1b: Execute Close-Phase DoD Items

Load DoD items from `.forge/definition-of-done.yaml` using `forge dod list --json`. Filter for items with `phase: close`.

For each **close-phase** item:
- **script** items: Run `forge dod check <item-id>` (e.g., git commit)
- **check** items: Verify the condition is met (e.g., retrospective generated)

If the story has DoD overrides, check `forge dod status --story {STORY-ID} --json` to honor skipped items.

### Step 2: Generate Retrospective

Create `.forge/retrospectives/{STORY-ID}.md` using the template from `.forge/templates/retrospective.md`.

Fill in:
- **Summary**: What was accomplished and why it matters
- **What Went Well**: Effective patterns, smooth workflows
- **What Could Improve**: Obstacles, inefficiencies, surprises
- **Key Decisions**: Important choices with rationale
- **Effort Analysis**: Estimated vs actual complexity per task

### Step 3: Extract Learnings per Agent

For each agent that worked on tasks, identify tactical learnings:
- Patterns that worked well
- Gotchas and pitfalls encountered
- Project-specific knowledge gained

### Step 4: Update Agent Memory

For each agent with learnings, update `.claude/agent-memory/{agent}/MEMORY.md`:
- Append new learnings (keep the file under 200 lines)
- If approaching the limit, consolidate older entries
- Use the format:

```markdown
## {Story-ID}: {Brief Title} ({date})
- {Learning 1}
- {Learning 2}
```

### Step 5: Archive Story

Run `forge story archive {STORY-ID}` to atomically move the story to `.forge/archive/` and update its status to `archived`.

If the transition fails (e.g., status not `done`), use `forge story archive {STORY-ID} --force` to bypass validation.

### Step 6: Report

Tell the user:
- Retrospective location
- Number of learnings captured per agent
- Summary of what was accomplished

Suggest: create a git commit with all changes.

## Retrospective Quality

A good retrospective:
- Is **specific** — references actual files, decisions, and outcomes
- Is **actionable** — learnings can be applied to future stories
- Is **balanced** — celebrates successes AND identifies improvements
- Is **concise** — 1-2 pages, not a novel

## Learning Categories

**Tactical** (agent memory) — project-specific techniques:
- "Use for-loops not forEach in this project"
- "bun:sqlite requires explicit type casting for dates"
- "The auth module expects JWT tokens in Bearer format"

**Strategic** (Weave) — cross-cutting insights:
- Architectural patterns that worked
- Design decisions with broad implications
- Process improvements

Forge only manages tactical learnings. Strategic insights should be captured separately via Weave.

## Guidelines

- Don't inflate the retrospective — be honest about what happened
- Keep agent memory files lean — consolidate when approaching 200 lines
- The archive is permanent — make sure the story file is complete before moving
- Include concrete metrics: number of files, tests, tasks
- If no learnings for an agent, skip them (not every story teaches every role)
