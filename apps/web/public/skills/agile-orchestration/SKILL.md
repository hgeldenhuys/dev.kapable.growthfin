---
name: agile-orchestration
description: Comprehensive guide for SDLC orchestration, user story writing, kanban management, sprint execution, and agent delegation. Integrates with dashboard monitoring through complete metadata fields and board.json updates.
tags: [sdlc, kanban, sprint, agile, delegation, orchestration, story-writing, dashboard, monitoring]
version: 2.0.0
created: 2025-11-08
updated: 2025-11-08
coherence_score: 0.97
priority: critical
dashboard_integration: true
---

# Agile Orchestration Skill

## When to Use This Skill

Use this skill when:
- ✅ Starting a new feature (create user stories)
- ✅ Managing sprint work (kanban board)
- ✅ Delegating to specialized agents
- ✅ Tracking story progress
- ✅ Coordinating between agents
- ✅ Managing impediments

**DON'T use for:**
- Direct implementation (delegate instead)
- Simple questions (answer directly)
- Non-development tasks

---

## 🎯 Way of Working (WoW) - Delegation First

**CRITICAL**: You are the Scrum Master/Product Owner. Preserve context by delegating implementation.

### Decision Tree: Do vs. Delegate

```
User Request
    ↓
Is it implementation work?
    ├─ Yes → DELEGATE to specialized agent
    │         └─ cli-dev, backend-dev, frontend-dev, etc.
    └─ No → Is it planning/coordination?
              ├─ Yes → YOU handle it
              └─ No → Is it a simple query?
                        ├─ Yes → Answer directly
                        └─ No → Create story & delegate
```

### Why Delegate?

1. **Context Preservation**: Implementation details burn tokens
2. **Parallel Work**: Multiple agents can work simultaneously
3. **Specialized Expertise**: Agents optimized for their domains
4. **Audit Trail**: Stories track all decisions and work
5. **Resumability**: Sessions can be recovered from stories

---

## 📝 User Story Writing

### Story File Structure (Dashboard-Ready)

**Location**: `.claude/sdlc/stories/{status}/US-{MODULE}-{NUMBER}.md`
**Status Directories**: `backlog/`, `todo/`, `ready/`, `in-progress/`, `review/`, `done/`

**For complete story template**, see [STORY-TEMPLATE.md](./STORY-TEMPLATE.md)

### Quick Story Structure

```yaml
---
# Identification
id: US-{MODULE}-{NUMBER}
title: "{Clear, actionable title}"
type: story                     # story|bug|task|spike
epic: "{Epic name}"
feature: "{Feature area}"
labels: ["api", "frontend"]

# Management
status: todo                    # backlog|todo|ready|in-progress|review|done
priority: P1                    # P0 (critical) → P3 (nice-to-have)
points: 3                       # Fibonacci: 1,2,3,5,8,13

# User Story (INVEST Principles)
as_a: "{role}"
i_want: "{feature/capability}"
so_that: "{business value}"

# Acceptance Criteria
acceptance_criteria:
  - id: AC-001
    description: "{Specific, testable criterion}"
    status: pending
---
```

### INVEST Principles for Good Stories

- **I**ndependent: Can be developed/tested alone
- **N**egotiable: Details can be discussed
- **V**aluable: Delivers business value
- **E**stimable: Can assign story points
- **S**mall: Fits in one sprint
- **T**estable: Has clear acceptance criteria

### Story Point Estimation

```
1 point:  < 2 hours (trivial change)
2 points: 2-4 hours (simple feature)
3 points: 4-8 hours (standard feature)
5 points: 1-2 days (complex feature)
8 points: 2-3 days (very complex)
13 points: 3-5 days (epic-sized, should split)
```

---

## 📋 Kanban Board Management (6-Column System)

### Board Structure Overview

**File**: `.claude/sdlc/kanban/board.json`
**Auto-Updated By**: BoardStateManager service

**Columns**:
1. **Backlog** - All future work
2. **To Do** - Sprint-committed work
3. **Ready** - Dependencies met, ready to start (WIP limit: 5)
4. **In Progress** - Active work (WIP limit: 3)
5. **Review** - Testing/review (WIP limit: 2)
6. **Done** - Completed this sprint

**For detailed board.json structure**, see [BOARD-MANAGEMENT.md](./BOARD-MANAGEMENT.md)

### Column Transitions

```python
# Valid transitions
VALID_TRANSITIONS = {
    "backlog": ["todo"],
    "todo": ["ready", "backlog"],
    "ready": ["in-progress", "todo"],
    "in-progress": ["review", "blocked", "ready"],
    "review": ["done", "in-progress"],
    "blocked": ["in-progress", "todo"],
    "done": []  # Terminal state
}
```

### Moving Stories

When moving a story:
1. Validate transition is allowed
2. Check WIP limits
3. Move physical file with `git mv`
4. Update story frontmatter (status, timing, history)
5. Update board.json atomically
6. Update agent assignment
7. Commit with semantic message
8. Trigger dashboard SSE update

---

## 🏃 Sprint Execution

### Sprint Workflow

```
1. Sprint Planning
   └─ Create stories from PRD
   └─ Estimate points
   └─ Assign to sprint
   └─ Update board.json

2. Sprint Execution (YOU ARE HERE)
   ├─ Daily Standup (check progress)
   ├─ Delegate Work
   │  ├─ backend-dev: API implementation
   │  ├─ frontend-dev: UI implementation
   │  ├─ cli-dev: CLI features
   │  └─ *-qa: Testing
   ├─ Track Progress (update board)
   ├─ Remove Impediments
   └─ Coordinate Agents

3. Sprint Review
   ├─ Demo completed stories
   ├─ Verify acceptance criteria
   └─ Update metrics

4. Sprint Retrospective
   ├─ What went well?
   ├─ What could improve?
   ├─ Action items
   └─ Update LESSONS-LEARNED.md
```

### Daily Standup Format

```yaml
date: "{YYYY-MM-DD}"
sprint: "Sprint {N}"

yesterday:
  completed:
    - story: "US-XXX-001"
      agent: "backend-dev"
      status: "Done, all ACs met"

today:
  planned:
    - story: "US-XXX-002"
      agent: "frontend-dev"
      action: "Implement UI components"

blockers:
  - story: "US-XXX-003"
    blocker: "Waiting for API endpoint"
    action: "Escalate to backend-dev"
```

---

## 🤝 Agent Delegation

### Available Agents & Their Roles

| Agent | Role | When to Use | Tools |
|-------|------|-------------|-------|
| `backend-dev` | API implementation | REST endpoints, database, business logic | Read, Write, Edit, Bash |
| `frontend-dev` | UI implementation | React components, state, styling | Read, Write, Edit, Bash |
| `backend-qa` | API testing | Integration tests, contracts, performance | Read, Bash, Test tools |
| `frontend-qa` | UI testing | Browser testing, accessibility, UX | Chrome MCP, Test tools |
| `cli-dev` | CLI implementation | Commands, utilities, terminal UI | Read, Write, Edit, Bash |
| `cli-qa` | CLI testing | Command testing, output validation | Read, Bash |
| `system-architect` | Design decisions | Architecture, patterns, ADRs | Read, Write |
| `spec-writer` | Requirements | Clarify specs, acceptance criteria | Read, Write |

**For detailed delegation patterns**, see [DELEGATION.md](./DELEGATION.md)

### Quick Delegation Pattern

```typescript
async function delegateToAgent(story_id: string, agent_type: string) {
  // 1. Read story file
  const story = readStory(story_id);

  // 2. Move story to in-progress
  moveStory(story_id, "todo", "in-progress");

  // 3. Delegate via Task tool
  const result = await Task({
    subagent_type: agent_type,
    description: `Implement ${story.id}`,
    prompt: formatDelegationPrompt(story)
  });

  // 4. Update story with results
  updateStoryFromAgentReport(story_id, result);

  // 5. Check if ready for next phase
  if (allAcceptanceCriteriaMet(story_id)) {
    moveStory(story_id, "in-progress", "review");
  }
}
```

---

## 📊 Session Management (Crash Recovery)

### Session Tracking with Heartbeat

**File**: `.claude/sdlc/kanban/sessions/session-{id}.json`
**Heartbeat**: Every 30 seconds (prevents stale sessions)

**For detailed session lifecycle**, see [SESSION-RECOVERY.md](./SESSION-RECOVERY.md)

### Quick Recovery Check

```bash
# Check for stale sessions at startup
ls .claude/sdlc/kanban/sessions/session-*.json

# Review session checkpoint
cat .claude/sdlc/kanban/sessions/session-latest.json | jq '.checkpoint'
```

### Recovery Protocol

1. Detect stale sessions (no heartbeat for 5+ minutes)
2. Verify process truly dead (not just slow)
3. Mark old session as stale
4. Create new session inheriting state
5. Restore board state
6. Unlock locked stories
7. Resume in-progress work

---

## 🚧 Impediment Management

### Creating Impediments

**File**: `.claude/sdlc/impediments/active/IMP-{NUMBER}.json`

```json
{
  "id": "IMP-001",
  "story_id": "US-XXX-003",
  "type": "technical|requirement|dependency|external",
  "severity": "critical|high|medium|low",
  "title": "Cannot access external API",
  "description": "API key not provided for service X",
  "reported_by": "backend-dev",
  "reported_at": "{ISO-8601}",
  "needs": "API key from user",
  "resolution": null
}
```

### Impediment Resolution Flow

```
Impediment Reported
    ↓
Can I resolve it? (reflection, research)
    ├─ Yes → Document resolution → Continue
    └─ No → Create IMP file
              ↓
          Is it critical?
              ├─ Yes → Escalate to user
              └─ No → Work on other stories
                       ↓
                   Park story in blocked/
```

---

## 📈 Metrics & Reporting

**For detailed metrics tracking**, see [METRICS.md](./METRICS.md)

### Key Metrics

- **Velocity**: Points completed per sprint
- **Cycle Time**: Hours from in-progress to done
- **Throughput**: Stories completed per week
- **First-Pass QA Rate**: Stories passing QA without rework
- **Defect Rate**: Bugs per story
- **Coherence Score**: Platform consistency (target: 0.80+)

---

## ✅ Coherence & DoD Enforcement

### The 5 Critical Invariants

**MUST be checked before marking ANY story done:**

```yaml
invariants:
  INV_001_port_5439: ✓         # Using correct DB port (not 5432)
  INV_002_no_soft_assertions: ✓ # No soft assertions in tests
  INV_003_env_loaded: ✓         # Tests load .env properly
  INV_004_api_contracts_tested: ✓ # API contracts verified
  INV_005_workspace_params: ✓   # Workspace routes include params
```

### Definition of Done Verification

```bash
# Run before moving story to done
.claude/sdlc/scripts/verify-dod.sh US-XXX-001

# Script checks:
# 1. All acceptance criteria marked done
# 2. No invariant violations
# 3. Coherence score maintained/improved
# 4. Tests passing
# 5. Documentation updated
```

### Common Violations & Fixes

| Invariant | Violation | Fix |
|-----------|-----------|-----|
| INV-001 | `localhost:5432` | Change to `localhost:5439` |
| INV-002 | `.catch(() => false)` | Remove soft assertion |
| INV-003 | Hardcoded values | Load from `.env` |
| INV-004 | Missing contract test | Add API response validation |
| INV-005 | `/workspace/settings` | `/workspace/:workspaceId/settings` |

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Check board state
cat .claude/sdlc/kanban/board.json | jq '.columns[] | {id, count}'

# Find stories by status
ls .claude/sdlc/stories/in-progress/

# Check session
cat .claude/sdlc/kanban/sessions/session-*.json | jq '.checkpoint'

# Move story
git mv stories/todo/US-XXX-001.md stories/in-progress/

# Verify DoD
.claude/sdlc/scripts/verify-dod.sh US-XXX-001
```

### Delegation Checklist

Before delegating:
- [ ] Story has clear acceptance criteria
- [ ] Dependencies are met
- [ ] API contract defined (if needed)
- [ ] Story file in todo/ directory
- [ ] Board.json updated
- [ ] Session checkpoint saved

After delegation:
- [ ] Story moved to in-progress/
- [ ] Agent assignment in board.json
- [ ] History entry added
- [ ] WIP limits checked
- [ ] Git commit made

### Common Patterns

**Pattern 1: Backend → Frontend → QA**
```
1. Delegate backend-dev (API implementation)
2. Wait for completion
3. Delegate frontend-dev (UI using API)
4. Wait for completion
5. Delegate frontend-qa (full testing)
```

**Pattern 2: Parallel Development**
```
1. Delegate backend-dev (API)
   + Delegate cli-dev (CLI commands)
   + Delegate frontend-dev (mock first)
2. All work in parallel
3. Converge for integration testing
```

**Pattern 3: Blocked Story**
```
1. Agent reports blocker
2. Create IMP file
3. Move story to blocked/
4. Work on other stories
5. When resolved → move back to in-progress/
```

---

## 🚀 Best Practices

### DO ✅
- Create stories before delegating
- Update board.json after every move
- Save session checkpoints frequently
- Track all decisions in history
- Use WIP limits to prevent overload
- Document impediments immediately
- Review acceptance criteria before moving to done

### DON'T ❌
- Implement everything yourself
- Skip story creation "just this once"
- Ignore WIP limits
- Forget to update board.json
- Leave stories in wrong directories
- Skip DoD verification
- Burn context on implementation details

---

## 📚 Supporting Documentation

- [STORY-TEMPLATE.md](./STORY-TEMPLATE.md) - Complete story YAML structure with all fields
- [BOARD-MANAGEMENT.md](./BOARD-MANAGEMENT.md) - board.json structure, WIP limits, transitions
- [SESSION-RECOVERY.md](./SESSION-RECOVERY.md) - Session lifecycle, crash recovery, heartbeat
- [DELEGATION.md](./DELEGATION.md) - Agent delegation patterns, parallel work
- [METRICS.md](./METRICS.md) - Velocity, cycle time, reporting formulas
- [EXAMPLES.md](./EXAMPLES.md) - Real delegation examples, common patterns

---

## 📚 Related Skills

- `quick-research` - For requirements gathering
- `find-pattern` - Find similar implementations
- `review-checklist` - Before marking done
- `cli-patterns` - CLI implementation patterns
- `debugging-tts-audio` - For audio issues

---

## 🔄 Continuous Improvement

After each sprint:
1. Run retrospective
2. Update LESSONS-LEARNED.md
3. Adjust estimates based on actual velocity
4. Refine delegation patterns
5. Update this skill with learnings

Remember: The SDLC system is your **execution memory**. Stories preserve context across sessions, enable parallel work, and create an audit trail of all decisions. Use it consistently!
