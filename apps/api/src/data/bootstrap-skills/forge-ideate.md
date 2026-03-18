---
name: forge-ideate
description: "Transform a vague idea into a well-defined story with acceptance criteria"
user-invocable: true
---

# /forge-ideate — Idea to Refined Story

You are executing the `/forge-ideate` command to transform a rough idea into a well-defined Forge story.

## Input

The user provides a rough idea — could be a sentence, a paragraph, or a feature request. Your job is to refine it into a complete story file.

## Process

### Step 1: Read Config

Read `.forge/config.md` to understand:
- Story ID prefix and current counter
- Definition of Ready requirements
- Ways of working preferences

### Step 2: Check for Headless Mode

Before asking clarification questions, determine if you are in headless mode:

1. **Check your session context** for `FORGE_MODE: headless` (injected by the Forge SessionStart hook)
2. **If FORGE_MODE is not present**, check whether the `AskUserQuestion` tool is available in your tool list. If it is not available, treat this as headless mode.

**If headless AND you need to ask questions:**

First, check if `.forge/pending-questions/{STORY-ID}.json` exists using the `Read` tool:

- **If it exists with `status: answered`**: Read the file, parse the answers, and use them as if the user had responded interactively. Each question's `answer` field contains the response. Skip to Step 5 (Generate Acceptance Criteria) using those answers as context. Do NOT re-ask the questions.
- **If it exists with `status: pending`**: Questions were already written but not yet answered. Tell the caller: "Questions are pending at `.forge/pending-questions/{STORY-ID}.json`. Answer the questions and re-run `/forge-ideate {STORY-ID}`." Then STOP — do not continue.
- **If it does NOT exist**: Write questions using the `Write` tool:
  1. Determine what you need to ask (same questions as Step 3 below)
  2. Write a JSON file to `.forge/pending-questions/{STORY-ID}.json` with this format:
     ```json
     {
       "story_id": "{STORY-ID}",
       "phase": "ideate",
       "status": "pending",
       "created": "{ISO timestamp}",
       "questions": [
         {
           "id": "q-1",
           "question": "What problem does this solve?",
           "type": "freetext",
           "header": "Problem"
         },
         {
           "id": "q-2",
           "question": "Who is affected by this problem?",
           "type": "freetext",
           "header": "Audience"
         },
         {
           "id": "q-3",
           "question": "How urgent is this?",
           "type": "choice",
           "header": "Urgency",
           "options": [
             {"label": "Critical", "description": "Blocking other work"},
             {"label": "High", "description": "Should be done this week"},
             {"label": "Medium", "description": "Can wait"},
             {"label": "Low", "description": "Nice to have"}
           ]
         },
         {
           "id": "q-4",
           "question": "What does success look like?",
           "type": "freetext",
           "header": "Success Criteria"
         }
       ]
     }
     ```
  3. Update the story status to `awaiting_input` in the story file's frontmatter
  4. Tell the caller: "Questions written to `.forge/pending-questions/{STORY-ID}.json`. Answer the questions and re-run `/forge-ideate {STORY-ID}`."
  5. STOP — do not continue with the rest of ideation.

**If interactive (FORGE_MODE: interactive or not specified):**
- Proceed to Step 3 and use `AskUserQuestion` as normal.

### Step 3: Understand the Idea

If the user's idea is clear enough, proceed. If vague, use `AskUserQuestion` to clarify:

**Round 1 — The Problem:**
- "What problem does this solve?"
- "Who is affected by this problem?"

**Round 2 — The Impact:**
- "What happens if we don't solve this?"
- "How urgent is this?"

**Round 3 — Success Criteria:**
- "What does success look like?"
- "How will we know it's working?"

You don't need all rounds — stop when you have enough context. Use your judgment.

### Step 4: Explore Context (if needed)

If the idea involves existing code:
- Use `Glob` and `Grep` to find relevant files
- Use `Read` to understand current implementation
- Note existing patterns and constraints

### Step 5: Generate Acceptance Criteria

Create 3-7 testable acceptance criteria. Each must be:
- **Specific** — No ambiguity about what "done" means
- **Testable** — Can be verified with a command, test, or observation
- **Independent** — Each AC can be validated separately

### Step 6: Estimate Complexity

Based on the scope and codebase exploration:
- `trivial` — Single file change, obvious fix
- `simple` — 2-3 files, straightforward implementation
- `moderate` — 5-10 files, some design decisions needed
- `complex` — 10+ files, significant architecture changes
- `epic` — Should be broken into multiple stories

### Step 7: Validate Against Definition of Ready

Check against DoR from config.md:
- Problem statement is clear (WHY documented)
- Acceptance criteria are testable (3-7 ACs)
- Complexity is estimated
- Technical approach is sketched (at least high-level)

### Step 8: Create Story File

1. Increment the counter in `.forge/config.md`
2. Create `.forge/backlog/{PREFIX}-{NNN}.md` with the story template

Use this format for the frontmatter:

```yaml
---
id: {PREFIX}-{NNN}
title: "{title}"
status: ideating
priority: {priority}
complexity: {complexity}
created: {ISO timestamp}
updated: {ISO timestamp}
author: {author}
tags: [{relevant, tags}]

acceptance_criteria:
  - id: AC-1
    description: "{testable criterion}"
    status: pending
    evidence: ""
  # ... more ACs

tasks: []

execution:
  started_at: null
  completed_at: null
  task_list_id: null
  session_ids: []

why:
  problem: "{problem statement}"
  root_cause: "{root cause from 5 Whys}"
  impact: "{impact if not solved}"
---

## Product Requirements

{Refined PRD content}

## Technical Approach

[To be filled during /forge-plan]

## Notes

[Freeform notes]
```

### Step 9: Report

Tell the user:
- Story ID created
- Summary of acceptance criteria
- Suggested next step: `/forge-plan {STORY-ID}`

## Guidelines

- Keep the ideation lightweight — don't over-engineer the requirements
- 3-5 ACs is ideal for most stories. 7 is the max.
- If complexity is `epic`, suggest breaking into multiple stories
- Use `AskUserQuestion` sparingly — 1-3 rounds maximum
- The PRD should be 1-3 paragraphs, not a novel
- In headless mode, questions are written to `.forge/pending-questions/` as JSON. The question schema matches the `ForgeQuestionFile` / `ForgeQuestion` interfaces from `.forge/lib/types.ts` for compatibility with `AskUserQuestion` format.
- When resuming from answered questions, treat each question's `answer` field as if the user had provided that response interactively. For `choice` type questions, the answer will be the selected option's `label` string. For `freetext` type questions, the answer will be a free-form string.
