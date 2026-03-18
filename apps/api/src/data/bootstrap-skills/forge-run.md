---
name: forge-run
description: "Run a story end-to-end from plan through close with automatic phase gating"
user-invocable: true
---

# /forge-run — Plan to Close Pipeline

You are executing the `/forge-run` command to take a story through its full lifecycle from planning to closure in a single invocation.

## Input

The user provides a story ID (e.g., `SDB-003`). The story must exist in `.forge/backlog/` with status `ideating` or `planned`.

Optional flags (passed as arguments after the story ID):
- `--from <phase>` — Start from a specific phase: `plan`, `execute`, `verify`, `close` (default: auto-detect from status)
- `--stop <phase>` — Stop after a specific phase instead of running all the way to close
- `--dry-run` — Show which phases would run without executing them
- `--skip-verify` — Skip verification and go straight from execute to close (use with caution)

Examples:
```
/forge-run SDB-003                     # Full pipeline: plan → execute → verify → close
/forge-run SDB-003 --from execute      # Resume from execute (already planned)
/forge-run SDB-003 --stop verify       # Plan + execute + verify, stop before close
/forge-run SDB-003 --from verify       # Just verify + close
```

## Process

### Step 0: Read Story and Determine Entry Point

Read `.forge/backlog/{STORY-ID}.md` and `.forge/config.md`.

Determine the starting phase based on story status and `--from` flag:

| Story Status | Default Start Phase | Valid `--from` Overrides |
|---|---|---|
| `ideating` | `plan` | `plan` only |
| `planned` | `execute` | `execute`, `plan` (re-plan) |
| `executing` | `verify` | `verify`, `execute` (re-execute) |
| `verifying` | `verify` | `verify`, `close` |
| `done` | `close` | `close` only |

If the status doesn't match any valid entry point, report the error and stop.

Build the phase pipeline (ordered list of phases to run):

```
plan → execute → verify → close
```

Trim the pipeline based on start phase and `--stop` flag.

Report the planned pipeline to the user:
```
Pipeline: plan → execute → verify → close
Story: SDB-003 — Agent Teams Execution Mode for Forge
Status: ideating → will start at plan phase
```

If `--dry-run`, stop here.

### Step 1: PLAN Phase

**Entry condition:** Story status is `ideating`
**Exit condition:** Story status is `planned`, tasks array populated

Execute the full `/forge-plan` logic:

1. Read story ACs, requirements, WHY context
2. Explore the codebase (`Glob`, `Grep`, `Read`) to ground tasks in reality
3. Design technical approach — update the "Technical Approach" section
4. Decompose into tasks (3-8 tasks, each atomic, covering all ACs)
5. Validate coverage: every AC covered, no orphan tasks, valid DAG
6. Update story: set `status: planned`, add tasks array

**Headless support:** If in headless mode and architectural decisions are needed, write questions to `.forge/pending-questions/{STORY-ID}.json`, set status to `awaiting_input`, and STOP the pipeline. Report that the pipeline is paused and will resume when questions are answered.

**Gate check before proceeding:** Verify:
- [ ] Tasks array is non-empty
- [ ] Every AC has task coverage
- [ ] Status is `planned`

If gate fails, report what's wrong and STOP.

### Step 2: EXECUTE Phase

**Entry condition:** Story status is `planned`
**Exit condition:** All tasks completed, story status is `verifying` or `done`

Execute the full `/forge-execute` logic:

1. Run DoR gate — `forge dor list --json` and validate all check items pass
2. Load WoW context — `forge wow list --json`, filter for `execute` phase items
3. Create built-in tasks via `TaskCreate` with dependencies
4. Transition story to `executing`
5. Phase-based execution:
   - Group tasks by dependency phase
   - Spawn agents using `Task` tool with appropriate `subagent_type`
   - Respect `max_parallel_agents` from config
   - Wait for each phase to complete before starting the next
6. Update task statuses in story file as agents complete
7. Set `execution.completed_at` and transition to next status

**Gate check before proceeding:** Verify:
- [ ] All tasks have status `done` or equivalent
- [ ] Story has `execution.completed_at` set

If any task failed, report failures and STOP. Do not auto-retry — let the user decide.

### Step 3: VERIFY Phase

**Entry condition:** Story status is `verifying` or `executing` (auto-transitions)
**Exit condition:** All ACs passing with evidence, DoD met, story status is `done`

Execute the full `/forge-verify` logic:

1. Transition to `verifying` if not already
2. Run DoD checks first — `forge dod check` for all script items
   - If DoD basics fail (typecheck, lint, tests), report immediately
3. Verify each AC:
   - Automated where possible (run tests, check files, execute commands)
   - Spawn `qa-engineer` for complex verification
   - Record `status` and `evidence` for each AC
4. Update story ACs with results

**Gate check before proceeding:**
- [ ] All ACs are `passing`
- [ ] All DoD script checks pass (or are skipped via overrides)

**If gate fails (any AC failing or DoD not met):**

Report the specific failures with a clear summary:
```
Verification: 5/7 ACs passing
Failing:
  AC-3: [description] — no evidence found
  AC-6: [description] — test xyz failed

DoD: 2/3 checks passing
Failing:
  dod-tests: 3 test failures in src/foo.test.ts
```

Then STOP. Do not proceed to close with failing ACs.

### Step 4: CLOSE Phase

**Entry condition:** Story status is `done`
**Exit condition:** Retrospective generated, story archived

Execute the full `/forge-close` logic:

1. Run close-phase DoD items — `forge dod list --json`, filter for `phase: close`
2. Generate retrospective at `.forge/retrospectives/{STORY-ID}.md`:
   - Summary, What Went Well, What Could Improve, Key Decisions, Effort Analysis
3. Extract learnings per agent
4. Update agent memory files (`.claude/agent-memory/{agent}/MEMORY.md`)
5. Archive story — `forge story archive {STORY-ID}`

### Step 5: Final Report

After all phases complete (or pipeline stops), provide a summary:

```
## Forge Run: {STORY-ID} — {title}

### Pipeline Result
plan ✓ → execute ✓ → verify ✓ → close ✓

### Summary
- Tasks: {N} created, {N} completed
- ACs: {N}/{N} passing
- Retrospective: .forge/retrospectives/{STORY-ID}.md
- Story archived to: .forge/archive/{STORY-ID}.md
- Agent memory updated: {list of agents}

### Suggested Next Steps
- Create a git commit with all changes
- Review retrospective for learnings
```

If the pipeline stopped early:
```
### Pipeline Result
plan ✓ → execute ✓ → verify ✗ (stopped)

### Stopped At: verify
### Reason: 2 ACs failing, DoD lint check failed
### Resume With: /forge-run {STORY-ID} --from verify
```

## Phase Gating Rules

Each phase transition has a strict gate. The pipeline NEVER proceeds past a failing gate.

| Transition | Gate |
|---|---|
| plan → execute | Tasks exist, all ACs covered, status is `planned` |
| execute → verify | All tasks completed, no failed agents |
| verify → close | All ACs passing, DoD script checks pass |

If a gate fails, the pipeline stops and reports:
1. Which gate failed
2. What specifically failed
3. How to fix it
4. The exact `/forge-run` command to resume

## Error Recovery

If the pipeline stops mid-run:
- Story status reflects the current phase (e.g., `executing`, `verifying`)
- Resume with `/forge-run {STORY-ID}` — it auto-detects the right entry point
- Or resume from a specific phase with `/forge-run {STORY-ID} --from <phase>`

If an agent crashes during execution:
- Report the failure with the agent's task ID and error
- Do NOT auto-retry
- The user can fix the issue and resume with `/forge-run {STORY-ID} --from execute`

## Guidelines

- This skill orchestrates the individual phase skills — it follows the same logic as `/forge-plan`, `/forge-execute`, `/forge-verify`, and `/forge-close` but chains them with automatic gating
- Never skip gates — they exist to prevent shipping broken work
- Never auto-fix issues — report them clearly and let the user decide
- Keep the user informed between phases — print a brief status before each transition
- If `--skip-verify` is used, still run DoD script checks (typecheck, lint, tests) during the close phase as a safety net
- Headless mode pauses on questions, just like the individual skills
- The story file is the source of truth — always update it after each phase completes
- Prefer automated verification — only spawn qa-engineer when manual investigation is needed
- When resuming a stopped pipeline, re-read the story file fresh — don't assume anything from the previous run
