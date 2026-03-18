---
name: forge-verify
description: "Verify all acceptance criteria are met with concrete evidence"
user-invocable: true
---

# /forge-verify — Quality Gate

You are executing the `/forge-verify` command to verify that all acceptance criteria are met.

## Input

The user provides a story ID (e.g., `SDB-003`). The story should be in `.forge/backlog/` with status `verifying` or `executing`.

## Process

### Step 1: Read Story and Config

Read `.forge/backlog/{STORY-ID}.md` to get:
- Acceptance criteria (the checklist to verify)
- Tasks and their completion status
- Product requirements (for context)

Read `.forge/config.md` to get:
- Definition of Done criteria

### Step 2: Verify Definition of Done (from YAML)

Load DoD items from `.forge/definition-of-done.yaml` using `forge dod list --json`. Filter for items with `phase: verify`.

For each **verify-phase** item:
- **check** items: Reason about whether this check passes based on story evidence and context
- **script** items: Run `forge dod check <item-id>` and capture the pass/fail result
- **prompt** items: Skip (these are for context injection, not verification)

If the story has DoD overrides, run `forge dod status --story {STORY-ID} --json` to see which items are skipped.

Example commands:
```bash
# Run all script-type DoD items
forge dod check dod-build
forge dod check dod-api-typecheck

# Check status with per-story overrides
forge dod status --story SDB-003
```

Record the output of each check as evidence.

### Step 3: Verify Each Acceptance Criterion

For each AC, determine the verification method:

**Automated verification** (preferred):
- Run specific test files that cover this AC
- Execute commands that demonstrate the behavior
- Check file existence, content, or structure

**Manual verification** (when automation isn't possible):
- Spawn a `qa-engineer` agent to investigate and verify
- The agent should run commands and provide concrete evidence

For each AC, record:
- `status`: `passing` or `failing`
- `evidence`: Actual command output, test results, or observation

### Step 4: Update Story File

Update each AC's status and evidence in the story frontmatter:

```yaml
acceptance_criteria:
  - id: AC-1
    description: "Users can register with email and password"
    status: passing
    evidence: "bun test tests/auth.test.ts — 5/5 tests passed"
```

### Step 5: Make Judgment

**All ACs passing + DoD met:**
- Set `status: done`
- Tell user: "All acceptance criteria verified. Run `/forge-close {STORY-ID}` to finalize."

**Any AC failing:**
- Keep status as `verifying`
- Report which ACs failed with details
- Suggest: fix the issues and re-run `/forge-verify`

**DoD not met (e.g., typecheck fails):**
- Keep status as `verifying`
- Report the DoD failures
- Suggest: fix compilation/lint/test issues first

### Step 6: Report

Provide a clear summary:

```
## Verification Report: {STORY-ID}

### Definition of Done
- [x] Code compiles (bun run typecheck) — PASS
- [x] Tests pass (bun test) — PASS (47/47)
- [x] Linting passes (bun run lint) — PASS
- [ ] Retrospective generated — PENDING (run /forge-close)

### Acceptance Criteria
- [x] AC-1: Users can register — PASS (evidence: test output)
- [x] AC-2: Login returns JWT — PASS (evidence: test output)
- [ ] AC-3: Password reset works — FAIL (no test coverage)

### Verdict: 2/3 ACs passing. Fix AC-3 before closing.
```

## Verification Standards

- **Trust nothing** — Run actual commands, don't rely on agent claims
- **Concrete evidence** — Every judgment must have command output or test results
- **Fail fast** — If DoD basics fail (typecheck, lint), report immediately
- **Be specific** — "Test failed" is useless. Show the actual error.

## Guidelines

- Run DoD checks first — no point verifying ACs if code doesn't compile
- Prefer automated verification over spawning agents
- If you need to spawn qa-engineer, give them specific ACs to verify
- Don't auto-fix issues — report them and let the user decide
- Keep evidence concise but complete (first 20 lines of output is usually enough)
