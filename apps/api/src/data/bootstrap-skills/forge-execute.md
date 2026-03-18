---
name: forge-execute
description: "Execute planned tasks by spawning agents in dependency order"
user-invocable: true
---

# /forge-execute — Autonomous Task Execution

You are executing the `/forge-execute` command to run planned tasks by spawning specialized agents.

## Input

The user provides a story ID (e.g., `SDB-003`). The story must exist in `.forge/backlog/` with status `planned`.

## Process

### Step 1: Read and Validate Story + DoR Gate

Read `.forge/backlog/{STORY-ID}.md` and validate:
- Status is `planned`
- Tasks array is populated
- Dependencies are valid

Also read `.forge/config.md` for `max_parallel_agents`, `auto_verify`, and **`execution_mode`**.

**DoR Gate Check:** Validate the story has at least 3 ACs and no unresolved questions. If validation fails, set the story to `awaiting_input` and report what needs to be fixed.

**WoW Context:** Read `.forge/config.md` for Ways of Working items. Filter for items with `execute` in their `phases` array. These `prompt` items will be injected into agent prompts in Step 4.

**Execution Mode:** Read `execution_mode` from `ways_of_working` in config. Values:
- `subagents` (default) — fire-and-forget Task calls, phase-based execution
- `teams` — Agent Teams with TeamCreate, SendMessage, shared TaskList, self-claiming

If `execution_mode` is not set or is `subagents`, follow the **Subagents Path** below. If `teams`, follow the **Teams Path**.

### Step 2: Create Built-in Tasks

For each task in the story, create a corresponding built-in task via `TaskCreate`:
- Map story task ID to built-in task ID
- Set up `addBlockedBy` for dependencies
- Record the mapping in the story's `execution.task_list_id`

### Step 3: Update Story Status

Update the story file:
- Set `status: executing`
- Set `execution.started_at` to current timestamp
- Update `updated` timestamp

---

## Subagents Path (execution_mode: subagents)

This is the default execution mode. Agents are spawned fire-and-forget via the `Task` tool and report results back to the lead.

### Step 4a: Phase-Based Execution

Group tasks by dependency phase:
- **Phase 1**: Tasks with no dependencies (can run in parallel)
- **Phase 2**: Tasks that depend only on Phase 1 tasks
- **Phase 3**: Tasks that depend on Phase 1+2 tasks
- etc.

For each phase:

1. **Spawn agents** using the `Task` tool:
   - Use the appropriate `subagent_type` matching the task's agent field
   - Pass a detailed prompt including:
     - Story file path: `.forge/backlog/{STORY-ID}.md`
     - Task ID and title
     - What files to read for context
     - What the task's deliverables are
     - The built-in task ID for `TaskUpdate`
   - Spawn independent tasks in parallel (multiple `Task` calls in one message)
   - Respect `max_parallel_agents` from config

#### Retry Policy

- **Max retries per task: 2** — If an agent fails twice, mark the task as `blocked` in the story file and report the failure. Do NOT spawn a third attempt.
- **Before spawning, check task status** — Read the story file and verify the task's `status` is still `pending`. If it's already `done` or `blocked`, skip it.
- **Track spawn count** — Maintain a mental count of how many times each task has been spawned. Log it: "Spawning T-{id} (attempt {n}/3)"
- **Failure detection** — If a subagent returns without completing its task (no TaskUpdate to completed, story file task still pending), count it as a failed attempt.
- **Budget guard** — If a single phase has been running for more than 15 minutes, stop spawning new agents, assess what's happening, and report status.

2. **Wait for completion** — Each agent will `TaskUpdate` their task
3. **Verify phase** — Check `TaskList` that all phase tasks are completed
4. **Update story** — After each agent completes, read the story file `.forge/backlog/{STORY-ID}.md`, find the completed task in the `tasks:` array, and set its `status:` to `done` using the Edit tool. The story file is the **source of truth** for task statuses — built-in `TaskUpdate` alone is NOT sufficient.

### Step 5a: Record Session

After each agent completes:
- Record their session output (mini-retrospective)
- Add session IDs to `execution.session_ids` in story file

### Step 6a: Completion

When all tasks are done:
- If `auto_verify` is true in config: set status to `verifying` and tell user to run `/forge-verify`
- If `auto_verify` is false: set status to `done`
- Set `execution.completed_at` to current timestamp

---

## Teams Path (execution_mode: teams)

This mode uses Claude Code Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) for inter-agent coordination, shared task lists, quality gate hooks, and self-claiming.

**Prerequisite:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be set to `1` in settings.json env or shell environment.

### Step 4b: Create Team

Use `TeamCreate` to create a named team:
```
TeamCreate:
  team_name: "forge-{STORY-ID}"
  description: "Executing Forge story {STORY-ID}: {title}"
```

The team name format `forge-{STORY-ID}` is important — the TeammateIdle and TaskCompleted hooks use this pattern to identify Forge teams and extract the story ID.

### Step 5b: Spawn Teammates

For each unique agent role in the tasks, spawn a teammate:

```
Task:
  name: "{agent-role}"
  team_name: "forge-{STORY-ID}"
  subagent_type: "{agent-role}"
  mode: "default"
  prompt: |
    You are a teammate on Forge story {STORY-ID}: "{title}"

    Read the story file at `.forge/backlog/{STORY-ID}.md` for full context.

    ## Your Role
    You are a {agent-role}. Your tasks:
    {list of tasks assigned to this agent role}

    ## How to Work
    1. Check TaskList for available (pending, unblocked) tasks
    2. Claim a task by setting yourself as owner via TaskUpdate
    3. Mark it in_progress, do the work, then mark it completed
    4. CRITICAL: After completing each task, also update the story file.
       Read `.forge/backlog/{STORY-ID}.md`, find your task in the `tasks:` array,
       and change its `status:` from `pending` to `done` using the Edit tool.
       The story file is the source of truth — built-in TaskUpdate alone is NOT sufficient.
    5. After completing a task, check TaskList again for the next available task
    6. If no tasks are available, wait — new tasks may unblock as others complete

    ## Ways of Working
    {WoW prompt items filtered for execute phase, one per line}

    ## Quality Gates
    - TeammateIdle hook runs DoD script checks (typecheck, lint, tests) when you go idle
    - TaskCompleted hook checks that AC evidence exists before allowing completion
    - If a hook blocks you, fix the issue and try again

    ## AC Evidence
    When your work satisfies an AC, update the story file:
    forge story update {STORY-ID} --ac-status {AC-ID}=passing

    When done with all your tasks, include a mini-retrospective.
```

Spawn all teammates in a single message (parallel launch). Respect `max_parallel_agents` — if there are more agent roles than the limit, spawn in batches.

### Step 6b: Coordinate via Messages

The lead monitors progress:

1. **Wait for teammate messages** — Messages arrive automatically when teammates complete tasks or go idle
2. **Track progress** — Periodically check `TaskList` to see which tasks are done
3. **Update story** — After each task completes, read `.forge/backlog/{STORY-ID}.md`, find the completed task in the `tasks:` array, and set its `status:` to `done` using the Edit tool. The story file is the **source of truth** for task statuses.
4. **Handle issues** — If a teammate reports a problem, use `SendMessage` to provide guidance:
   ```
   SendMessage:
     type: "message"
     recipient: "{teammate-name}"
     content: "Guidance for the issue..."
     summary: "Help with {issue}"
   ```

### Step 7b: Self-Claiming

Teammates self-claim tasks from the shared TaskList:

1. After completing a task, the teammate checks `TaskList` for pending, unblocked tasks
2. If an available task matches their role, they claim it via `TaskUpdate` (set owner)
3. If no tasks match, they go idle (TeammateIdle hook will run DoD checks)
4. When all tasks are done, they stop naturally

This eliminates the "phase bottleneck" — fast agents immediately pick up the next unblocked task instead of waiting for all tasks in a phase to complete.

### Step 8b: Shutdown and Cleanup

When all tasks are completed:

1. Send `shutdown_request` to each teammate:
   ```
   SendMessage:
     type: "shutdown_request"
     recipient: "{teammate-name}"
     content: "All tasks complete. Thank you for your work on {STORY-ID}."
   ```
2. Wait for shutdown responses
3. Clean up the team:
   ```
   TeamDelete
   ```
4. Set `execution.completed_at` in the story file
5. If `auto_verify` is true: set status to `verifying`
6. If `auto_verify` is false: set status to `done`

---

## Agent Prompt Template (Subagents Path)

When spawning an agent in subagents mode, use this prompt structure:

```
You are working on Forge story {STORY-ID}: "{title}"

Your assigned task: {task-id} - {task-title}

Read the story file at `.forge/backlog/{STORY-ID}.md` for full context.
Read `CLAUDE.md` in the project root for file ownership rules, commands, and framework patterns.

Your built-in task ID is #{builtin-task-id}. Update it:
- TaskUpdate taskId="{builtin-task-id}" status="in_progress" when you start
- TaskUpdate taskId="{builtin-task-id}" status="completed" when you finish

CRITICAL: After completing your task, you MUST also update the story file.
Read `.forge/backlog/{STORY-ID}.md`, find your task in the `tasks:` array,
and change its `status:` from `pending` to `done`. Use the Edit tool to make
this change. The story file is the source of truth — built-in TaskUpdate alone
is NOT sufficient.

## Verification Protocol — IMPORTANT
Do NOT run `bunx tsc --noEmit`, `bun run test`, or `bun run build` during your task.
The verify phase runs all checks centrally after all tasks complete.
Only run tsc if you need to debug a specific type error during development.
When you DO need to run bun commands, ALWAYS use sudo: `sudo -u sdb_{orgSlug} bun ...`

## Ways of Working (from .forge/ways-of-working.yaml)
{WoW prompt items filtered for execute phase, one per line}

Deliverables:
{specific deliverables from task description}

AC Coverage: {list of ACs this task covers}

When done, include a mini-retrospective in your response.
```

Note: The `Read your memory` instruction has been removed — `memory: project` in agent frontmatter
handles MEMORY.md auto-injection in Claude Code 2.1.33+.

## Subagent Type Mapping

| Story Agent | subagent_type |
|-------------|---------------|
| backend-dev | backend-dev |
| frontend-dev | frontend-dev |
| qa-engineer | qa-engineer |
| architect | architect |
| tech-writer | tech-writer |
| devops | devops |

If the exact subagent_type doesn't exist, use `general-purpose`.

## Guidelines

### Both Modes
- Always spawn independent tasks in parallel for efficiency
- Never skip the `TaskUpdate` instructions in agent prompts
- If an agent fails, retry once (max 2 attempts total). After 2 failures, mark the task as `blocked` and report what went wrong
- Never spawn the same task more than 3 times total — this wastes tokens without progress
- Always check the story file task status before spawning to avoid duplicate work
- The story file is the source of truth — always update it after each phase

### Subagents Mode
- Keep the orchestration loop simple: spawn → wait → verify → next phase

### Teams Mode
- Team name must follow pattern `forge-{STORY-ID}` for hooks to work
- Teammates self-claim from the shared TaskList — don't rigidly assign by phase
- Use `SendMessage` for guidance, not for task assignment
- TeammateIdle hook gates idle with DoD script checks (typecheck, lint, tests)
- TaskCompleted hook verifies AC evidence before allowing completion
- Always send `shutdown_request` before `TeamDelete`
- Teams mode uses significantly more tokens — each teammate is a separate Claude instance
