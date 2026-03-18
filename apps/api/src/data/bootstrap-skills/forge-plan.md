---
name: forge-plan
description: "Break a story into tasks, assign agents, and establish dependencies"
user-invocable: true
---

# /forge-plan — Story to Task Breakdown

You are executing the `/forge-plan` command to decompose a story into actionable tasks with agent assignments.

## Input

The user provides a story ID (e.g., `SDB-003`). The story must exist in `.forge/backlog/` with status `ideating`.

## Process

### Step 1: Read Story

Read `.forge/backlog/{STORY-ID}.md` and extract:
- Acceptance criteria
- Product requirements
- WHY context
- Any existing notes

Also read `.forge/config.md` for ways of working.

### Step 2: Explore Codebase

Use `Glob`, `Grep`, and `Read` to understand:
- Which files need to change
- Existing patterns and conventions
- Dependencies between modules
- Test infrastructure available

This exploration is critical — tasks must be grounded in the actual codebase, not hypothetical.

### Step 3: Design Technical Approach

Write the "Technical Approach" section of the story file:
- Architecture decisions (with rationale)
- File-level change plan
- API contracts (if applicable)
- Schema changes (if applicable)

### Step 4: Decompose into Tasks

Create tasks following these rules:
- Each task is **atomic** — one agent, one responsibility
- Each task maps to **at least one AC** (ac_coverage)
- Every AC must be covered by **at least one task**
- Dependencies form a **DAG** (no cycles)
- Tasks are **ordered by dependency** (T-1 before T-2 if T-2 depends on T-1)

Task format:
```yaml
tasks:
  - id: T-1
    title: "{clear, actionable title}"
    agent: {backend-dev|frontend-dev|qa-engineer|architect|tech-writer|devops}
    status: pending
    depends_on: []
    effort_estimate: {trivial|simple|moderate|complex}
    ac_coverage: [AC-1, AC-2]
```

### Step 5: Check for Headless Mode

Before asking architectural decision questions, determine if you are in headless mode:

1. **Check your session context** for `FORGE_MODE: headless` (injected by the Forge SessionStart hook)
2. **If FORGE_MODE is not present**, check whether the `AskUserQuestion` tool is available in your tool list. If it is not available, treat this as headless mode.

**If headless AND you need to ask architectural decisions:**

First, check if `.forge/pending-questions/{STORY-ID}.json` exists using the `Read` tool:

- **If it exists with `status: answered`**: Read the file, parse the answers, and use them as if the user had responded interactively. Each question's `answer` field contains the response. Apply those decisions to the technical approach and task breakdown from Step 3 and Step 4. Continue to Step 7 (Validate Coverage). Do NOT re-ask the questions.
- **If it exists with `status: pending`**: Questions were already written but not yet answered. Tell the caller: "Questions are pending at `.forge/pending-questions/{STORY-ID}.json`. Answer the questions and re-run `/forge-plan {STORY-ID}`." Then STOP — do not continue.
- **If it does NOT exist**: Write questions using the `Write` tool:
  1. Determine what architectural decisions are needed (same decisions as Step 6 below)
  2. Write a JSON file to `.forge/pending-questions/{STORY-ID}.json` with this format:
     ```json
     {
       "story_id": "{STORY-ID}",
       "phase": "plan",
       "status": "pending",
       "created": "{ISO timestamp}",
       "questions": [
         {
           "id": "q-1",
           "question": "Should we use a file-based or database-backed approach?",
           "type": "choice",
           "header": "Architecture",
           "options": [
             {"label": "File-based", "description": "Simple, no dependencies"},
             {"label": "Database", "description": "Better for querying"}
           ]
         },
         {
           "id": "q-2",
           "question": "Should this be a separate module or integrated into the existing one?",
           "type": "choice",
           "header": "Module Structure",
           "options": [
             {"label": "Separate module", "description": "Clean separation, new directory"},
             {"label": "Integrated", "description": "Extend existing module"}
           ]
         },
         {
           "id": "q-3",
           "question": "Any additional constraints or preferences for the implementation?",
           "type": "freetext",
           "header": "Constraints"
         }
       ]
     }
     ```
  3. Update the story status to `awaiting_input` in the story file's frontmatter
  4. Tell the caller: "Questions written to `.forge/pending-questions/{STORY-ID}.json`. Answer the questions and re-run `/forge-plan {STORY-ID}`."
  5. STOP — do not continue with the rest of planning.

**If interactive (FORGE_MODE: interactive or not specified):**
- Proceed to Step 6 and use `AskUserQuestion` as normal.

### Step 6: Ask for Decisions (if needed)

Use `AskUserQuestion` for architectural decisions:
- "Should we use X or Y for this?"
- "Do you want tests written before or after implementation?"
- "Should this be a separate module or integrated into existing?"

### Step 7: Validate Coverage

Check:
- Every AC is covered by at least one task
- No task is orphaned (every task covers at least one AC)
- Dependencies are valid (no circular deps)
- Agent assignments make sense for the task type

### Step 8: Update Story File

Update the story file frontmatter:
- Set `status: planned`
- Update `updated` timestamp
- Add `tasks` array
- Fill in "Technical Approach" section

### Step 9: Report

Tell the user:
- Number of tasks created
- Task dependency graph (text diagram)
- Agent assignments summary
- Suggested next step: `/forge-execute {STORY-ID}`

## Task Assignment Guidelines

| Task Type | Agent |
|-----------|-------|
| API design, schema design, ADRs | architect |
| Backend implementation, services, APIs | backend-dev |
| Frontend UI, components, styling | frontend-dev |
| Test writing, AC verification | qa-engineer |
| Documentation, retrospectives | tech-writer |
| CI/CD, deployment, infrastructure | devops |

## Effort Estimates

- `trivial` — < 30 min, single file
- `simple` — 30 min - 1 hour, 2-3 files
- `moderate` — 1-3 hours, 5-10 files
- `complex` — 3+ hours, 10+ files

## Guidelines

- Prefer fewer, larger tasks over many tiny ones (3-5 tasks is ideal for simple stories)
- **MERGE tasks assigned to the same agent** when they are sequential dependencies. For example, if backend-dev has T-1 "Create store" and T-2 "Create route" where T-2 depends on T-1, merge them into a single task "Create store and route". This reduces agent spawns.
- **Do NOT create a separate "final verification" task** — the verify phase handles `tsc`, `test`, and `build` centrally. Only create a QA task for writing tests, not for running them.
- QA tasks should run AFTER implementation tasks complete (but IN PARALLEL with frontend tasks if tests only cover backend code)
- Architect tasks (if needed) should run FIRST
- Group independent tasks that can run in parallel
- Don't create tasks for trivial changes — fold them into larger tasks
- In headless mode, questions are written to `.forge/pending-questions/` as JSON. The question schema matches the `ForgeQuestionFile` / `ForgeQuestion` interfaces from `.forge/lib/types.ts` for compatibility with `AskUserQuestion` format.
- When resuming from answered questions, treat each question's `answer` field as if the user had provided that response interactively. For `choice` type questions, the answer will be the selected option's `label` string. For `freetext` type questions, the answer will be a free-form string.
