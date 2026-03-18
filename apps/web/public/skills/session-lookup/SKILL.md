---
name: Analyzing Claude Code Sessions by ID
description: Query and analyze past Claude Code sessions from the database to learn from previous work, avoid duplicate efforts, and understand what was implemented. Use when user provides a session ID (UUID format), when investigating "what did we do before", or when needing to understand previous implementation decisions.
allowed-tools: Read, Bash, Grep
---

# Analyzing Claude Code Sessions by ID

Learn from past Claude Code sessions by querying the Agios database. Extract conversation context, implementation decisions, files modified, and outcomes to build institutional memory across sessions.

## Core Principle

**Sessions are queryable knowledge stores.** Every Claude Code session is captured in the database with full hook events, conversation context, tool usage, and outcomes. This enables cross-session learning and prevents duplicate work.

## When to Use This Skill

- User mentions a session ID: "check session 22f90cdb-26e7-4f3d-a32f-2dc737ae7ba2"
- Investigating previous work: "what did we implement last week"
- Understanding implementation decisions: "why did we choose that approach"
- Avoiding duplicate work: "has this been tried before"
- Learning from failures: "what went wrong in that session"
- Continuing previous work: "pick up where we left off"

## Database Schema

### Key Tables

**claude_sessions**:
- `id` (UUID) - Session identifier
- `project_id` (UUID) - Which project
- `current_agent_type` (text) - Agent type (main, backend-dev, frontend-dev, etc.)
- `created_at` (timestamp) - When session started

**hook_events**:
- `id` (UUID) - Event identifier
- `session_id` (UUID) - Links to claude_sessions
- `event_name` (text) - SessionStart, Stop, UserPromptSubmit, PreToolUse, PostToolUse, etc.
- `tool_name` (text) - Which tool was used (Read, Write, Edit, Bash, etc.)
- `payload` (JSONB) - Full event data including conversation context
- `created_at` (timestamp) - When event occurred

**projects**:
- `id` (UUID) - Project identifier
- `name` (text) - Project name (from git repo)
- `git_repo` (text) - Git repository name
- `machine_host` (text) - Machine hostname
- `git_user` (text) - Git username
- `git_branch` (text) - Git branch

## Protocol

### 1. Get Session Overview

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT
  cs.id as session_id,
  p.name as project_name,
  cs.current_agent_type,
  cs.created_at as session_start,
  COUNT(he.id) as event_count,
  COUNT(DISTINCT he.event_name) as unique_events,
  json_agg(DISTINCT he.event_name) as event_types
FROM claude_sessions cs
LEFT JOIN projects p ON cs.project_id = p.id
LEFT JOIN hook_events he ON he.session_id = cs.id
WHERE cs.id = 'SESSION_ID_HERE'
GROUP BY cs.id, p.name, cs.current_agent_type, cs.created_at;
"
```

**Tells you**:
- Which project
- Agent type (main orchestrator vs specialized agent)
- When it started
- How many events recorded
- What types of events (SessionStart, Stop, SubagentStop, etc.)

### 2. Get Recent Conversation Messages

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT
  created_at,
  event_name,
  payload->'conversation'->>'content' as message
FROM hook_events
WHERE session_id = 'SESSION_ID_HERE'
  AND payload->'conversation'->>'content' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
"
```

**Extracts**:
- Recent user messages
- Conversation flow
- What the user was asking about

### 3. Get Tool Usage Summary

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT
  tool_name,
  COUNT(*) as usage_count,
  json_agg(DISTINCT event_name) as event_types
FROM hook_events
WHERE session_id = 'SESSION_ID_HERE'
  AND tool_name IS NOT NULL
GROUP BY tool_name
ORDER BY usage_count DESC;
"
```

**Shows**:
- Which tools were used most
- Read/Write/Edit/Bash patterns
- Implementation vs research focus

### 4. Get Files Modified

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT DISTINCT
  payload->'event'->'tool_input'->>'file_path' as file_path,
  tool_name,
  COUNT(*) as times_accessed
FROM hook_events
WHERE session_id = 'SESSION_ID_HERE'
  AND tool_name IN ('Read', 'Write', 'Edit')
  AND payload->'event'->'tool_input'->>'file_path' IS NOT NULL
GROUP BY file_path, tool_name
ORDER BY times_accessed DESC
LIMIT 20;
"
```

**Reveals**:
- Which files were worked on
- Read vs Write vs Edit patterns
- Focus areas of implementation

### 5. Get Subagent Activity

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT
  payload->'event'->>'agent_name' as agent_name,
  COUNT(*) as invocations,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM hook_events
WHERE session_id = 'SESSION_ID_HERE'
  AND event_name = 'SubagentStop'
GROUP BY agent_name
ORDER BY invocations DESC;
"
```

**Shows**:
- Which specialized agents were used
- How many times each was invoked
- Duration of agent work (first to last call)

### 6. Get Full Event Timeline

```bash
psql postgresql://postgres:postgres@localhost:5439/agios_dev -c "
SELECT
  created_at,
  event_name,
  tool_name,
  CASE
    WHEN payload->'conversation'->>'content' IS NOT NULL
    THEN LEFT(payload->'conversation'->>'content', 100)
    ELSE NULL
  END as context
FROM hook_events
WHERE session_id = 'SESSION_ID_HERE'
ORDER BY created_at
LIMIT 50;
"
```

**Provides**:
- Chronological event flow
- When user interacted (UserPromptSubmit)
- When AI responded (Stop)
- Tool usage patterns

## Example Usage

### Scenario: User mentions "check session 22f90cdb-26e7-4f3d-a32f-2dc737ae7ba2"

**Step 1**: Get overview
```sql
-- Returns:
-- session_id: 22f90cdb-26e7-4f3d-a32f-2dc737ae7ba2
-- project_name: agios
-- current_agent_type: main
-- session_start: 2025-11-09 05:39 AM
-- event_count: 232
-- event_types: [SessionStart, Stop, SubagentStop, UserPromptSubmit, ...]
```

**Step 2**: Get recent messages
```sql
-- Returns:
-- "also, the select is not scrollable"
-- [Earlier conversation context]
```

**Step 3**: Synthesize findings
```markdown
Session 22f90cdb-26e7-4f3d-a32f-2dc737ae7ba2:
- **Project**: agios
- **Agent**: main (orchestrator)
- **Started**: Nov 9, 2025 at 5:39 AM
- **Activity**: 232 hook events recorded
- **Subagents**: Yes (SubagentStop events present)
- **Focus**: Working on scrollable select UI issue
- **Status**: Session had conversation about database query scrollability
```

## Success Metrics

After using this skill, you should be able to:
- ✅ Identify which project the session worked on
- ✅ Understand what the user was trying to accomplish
- ✅ See which files were modified
- ✅ Know if specialized agents were used
- ✅ Extract key conversation points
- ✅ Determine session outcomes (success/failure/incomplete)

## Common Patterns

### Pattern 1: Main Orchestrator Session
```
event_types: [SessionStart, UserPromptSubmit, Stop]
agent_type: main
tool_usage: Mostly Read, some Edit
```
**Interpretation**: User working directly with main Claude, making edits

### Pattern 2: Delegated Work Session
```
event_types: [SessionStart, SubagentStop, UserPromptSubmit, Stop]
agent_type: main
subagents: backend-dev, frontend-dev
```
**Interpretation**: Orchestrator delegating work to specialized agents

### Pattern 3: Implementation Session
```
tool_usage: Heavy Write, Edit, Bash
files: Multiple new files created
event_count: 100+
```
**Interpretation**: Significant implementation work done

### Pattern 4: Research Session
```
tool_usage: Heavy Read, Grep
files: Many files read, few modified
event_count: 50-100
```
**Interpretation**: Investigating codebase, gathering context

## Common Pitfalls

1. **Session ID not found** - Verify the UUID is correct, check if session exists
2. **No conversation context** - Early sessions may not have conversation data in payload
3. **Too many events** - Use LIMIT and focus on key event types (UserPromptSubmit, Stop)
4. **JSONB path errors** - Some events may not have expected payload structure

## Database Connection Details

**Default connection**:
```bash
postgresql://postgres:postgres@localhost:5439/agios_dev
```

**Port**: 5439 (NOT 5432!)
**Database**: agios_dev
**User**: postgres
**Password**: postgres

## Integration with Workflow

```bash
# User asks about previous session
User: "What did we do in session 22f90cdb-26e7-4f3d-a32f-2dc737ae7ba2?"

# Use this skill
1. Query session overview → Get project, agent type, event count
2. Query recent messages → Understand user intent
3. Query tool usage → See what was implemented
4. Query files modified → Identify changes
5. Synthesize → Provide clear summary

# Response to user
"In that session, you were working on [X] in the [project] project.
The main focus was [Y], and you modified [files].
The session used [agents] and completed [outcome]."
```

## Files Affected

This skill only reads data, no files are modified:
- Queries `claude_sessions` table
- Queries `hook_events` table
- Queries `projects` table
- Extracts JSONB payload data

## Future Enhancements

Potential additions to this skill:
- CLI command: `agios session show <id>`
- Web UI: Session detail page
- Export session summary to markdown
- Compare two sessions
- Find similar sessions by topic
- Session search by date/project/agent

## References

- Database schema: `packages/db/src/schema/`
- Hook event processing: `apps/api/src/modules/hook-events/service.ts`
- Session creation: Lines 70-182 in hook-events/service.ts
