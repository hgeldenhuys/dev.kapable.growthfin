# Board Management

Complete reference for board.json structure, WIP limits, and column transitions.

## Board.json Structure

**File**: `.claude/sdlc/kanban/board.json`
**Auto-Updated By**: BoardStateManager service

```json
{
  "board_id": "main-board",
  "updated_at": "{ISO-8601}",
  "version": "2.0",

  "sprint": {
    "number": 2,
    "name": "Sprint 2 - {Goal}",
    "start_date": "{YYYY-MM-DD}",
    "end_date": "{YYYY-MM-DD}",
    "goal": "{Sprint goal}",
    "total_points": 0,
    "completed_points": 0,
    "velocity_target": 21,
    "burn_rate": 3.5            // Points per day
  },

  "columns": [
    {
      "id": "backlog",
      "name": "Backlog",
      "wip_limit": null,         // No limit
      "stories": ["US-XXX-010", "US-XXX-011"],
      "count": 2,
      "total_points": 8
    },
    {
      "id": "todo",
      "name": "To Do",
      "wip_limit": null,         // No limit
      "stories": ["US-XXX-004", "US-XXX-005"],
      "count": 2,
      "total_points": 5
    },
    {
      "id": "ready",
      "name": "Ready",
      "wip_limit": 5,            // Max 5 stories ready
      "stories": ["US-XXX-003"],
      "count": 1,
      "total_points": 3
    },
    {
      "id": "in-progress",
      "name": "In Progress",
      "wip_limit": 3,            // Max 3 stories (global)
      "stories": ["US-XXX-002"],
      "count": 1,
      "total_points": 2
    },
    {
      "id": "review",
      "name": "Review",
      "wip_limit": 2,            // Max 2 in review
      "stories": ["US-XXX-001"],
      "count": 1,
      "total_points": 3
    },
    {
      "id": "done",
      "name": "Done",
      "wip_limit": null,         // No limit
      "stories": ["US-XXX-000"],
      "count": 1,
      "total_points": 5
    }
  ],

  "agents": {
    "backend-dev": {
      "active": true,
      "wip": 1,                   // Current work in progress
      "max_wip": 1,               // Max concurrent stories
      "current_story": "US-XXX-002",
      "total_completed": 5,
      "velocity": 8,              // Points per sprint
      "availability": "full"      // full|partial|unavailable
    },
    "frontend-dev": {
      "active": true,
      "wip": 0,
      "max_wip": 1,
      "current_story": null,
      "total_completed": 3,
      "velocity": 5,
      "availability": "full"
    },
    "backend-qa": {
      "active": true,
      "wip": 1,
      "max_wip": 1,
      "current_story": "US-XXX-001",
      "total_completed": 4,
      "velocity": null,           // QA doesn't estimate
      "availability": "full"
    }
  },

  "epics": {
    "epic-crm": {
      "name": "CRM MVP",
      "phase": 1,                 // Current phase
      "total_phases": 3,
      "stories": {
        "phase_1": ["US-XXX-000", "US-XXX-001", "US-XXX-002"],
        "phase_2": ["US-XXX-003", "US-XXX-004"],
        "phase_3": ["US-XXX-005"]
      },
      "progress": {
        "phase_1": { "completed": 1, "total": 3 },
        "phase_2": { "completed": 0, "total": 2 },
        "phase_3": { "completed": 0, "total": 1 }
      }
    }
  },

  "metrics": {
    "velocity": {
      "current_sprint": 13,
      "last_sprint": 21,
      "average": 17,
      "trend": "declining"        // improving|stable|declining
    },
    "cycle_time": {
      "average_hours": 6.2,
      "median_hours": 5.5,
      "p95_hours": 12             // 95th percentile
    },
    "throughput": {
      "stories_per_week": 4.5
    },
    "quality": {
      "defect_rate": 0.05,
      "first_time_pass_rate": 0.85,
      "rework_rate": 0.10
    },
    "coherence": {
      "current_score": 0.75,
      "target_score": 0.80,
      "violations_active": 2
    }
  },

  "wip_violations": [],           // Stories violating WIP limits
  "blocked_stories": [],          // Stories with active blockers
  "at_risk_stories": []           // Stories likely to miss sprint
}
```

## Column Transitions

### Valid Transitions

```python
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

### Transition Rules

**backlog → todo**
- Story prioritized for current sprint
- Must have acceptance criteria
- Must be estimated (points assigned)

**todo → ready**
- All dependencies met
- API contract defined (if needed)
- Agent available to work on it

**ready → in-progress**
- Agent claims story
- WIP limit not exceeded
- Session checkpoint saved

**in-progress → review**
- All acceptance criteria met
- Tests passing
- Code committed

**review → done**
- QA passed
- DoD verified
- No invariant violations

**in-progress → blocked**
- Impediment encountered
- IMP file created
- Blocker documented

**blocked → in-progress**
- Impediment resolved
- IMP file closed

### Move Story Implementation

```python
def move_story(story_id, from_column, to_column):
    # 0. Validate transition
    if to_column not in VALID_TRANSITIONS[from_column]:
        raise ValueError(f"Invalid transition: {from_column} → {to_column}")

    # 1. Check WIP limits
    if to_column in ["ready", "in-progress", "review"]:
        if exceeds_wip_limit(to_column):
            raise ValueError(f"WIP limit exceeded for {to_column}")

    # 2. Move physical file
    git_mv(
        f"stories/{from_column}/{story_id}.md",
        f"stories/{to_column}/{story_id}.md"
    )

    # 3. Update story frontmatter
    story = read_story(story_id)
    story.status = to_column
    story.column = to_column

    # Update timing fields
    if to_column == "in-progress" and not story.timing.started:
        story.timing.started = now()
    elif to_column == "done":
        story.timing.completed = now()
        story.timing.cycle_time_hours = calculate_cycle_time(story)

    # Add history entry
    story.history.append({
        "timestamp": now(),
        "agent": "orchestrator",
        "action": f"moved_to_{to_column}",
        "details": reason,
        "column_from": from_column,
        "column_to": to_column
    })

    # 4. Update board.json atomically
    update_board_state({
        "remove_from": from_column,
        "add_to": to_column,
        "story_id": story_id,
        "points": story.points
    })

    # 5. Update agent assignment
    if to_column == "in-progress":
        assign_to_agent(story_id, agent_type)
    elif to_column in ["done", "blocked"]:
        unassign_from_agent(story_id)

    # 6. Commit with semantic message
    git_commit(f"move({story_id}): {from_column} → {to_column}")

    # 7. Trigger dashboard update via SSE
    notify_dashboard("story_moved", {
        "story_id": story_id,
        "from": from_column,
        "to": to_column
    })
```

## WIP Limits

### WIP Limits Configuration

**File**: `.claude/sdlc/kanban/wip-limits.json`

```yaml
{
  "global": {
    "max_in_progress": 10,       # Total stories across all agents
    "max_blocked": 5              # Escalate if exceeded
  },
  "columns": {
    "ready": 5,                   # Prevent overcommitment
    "in-progress": 3,             # Focus on completion
    "review": 2                   # Thorough review
  },
  "agents": {
    "backend-dev": 1,             # One story at a time
    "frontend-dev": 1,
    "backend-qa": 1,
    "frontend-qa": 1,
    "cli-dev": 1,
    "system-architect": 2         # Can handle 2 ADRs
  }
}
```

### Why WIP Limits?

1. **Focus**: Finish work before starting new work
2. **Flow**: Prevent bottlenecks
3. **Quality**: Less context switching = fewer defects
4. **Visibility**: WIP violations signal process issues
5. **Predictability**: Steady flow = predictable velocity

### WIP Limit Enforcement

```python
def check_wip_violations(board):
    """Identify WIP limit violations"""
    violations = []

    # Check column limits
    for column in board["columns"]:
        if column["wip_limit"] and column["count"] > column["wip_limit"]:
            violations.append({
                "type": "column",
                "column": column["id"],
                "count": column["count"],
                "limit": column["wip_limit"],
                "excess": column["count"] - column["wip_limit"]
            })

    # Check agent limits
    for agent_id, agent in board["agents"].items():
        if agent["wip"] > agent["max_wip"]:
            violations.append({
                "type": "agent",
                "agent": agent_id,
                "wip": agent["wip"],
                "limit": agent["max_wip"],
                "excess": agent["wip"] - agent["max_wip"]
            })

    return violations
```

### Responding to WIP Violations

**If "ready" column exceeds limit:**
- Stop pulling from todo
- Focus on moving ready → in-progress
- Consider if stories are truly ready

**If "in-progress" exceeds limit:**
- STOP starting new work
- Focus on completion
- Move blocked stories to blocked column
- Investigate impediments

**If "review" exceeds limit:**
- Prioritize reviews
- Delegate to QA agents
- Check if DoD is too strict

**If agent exceeds WIP:**
- Complete current work first
- Check for abandoned stories
- Reassign if agent unavailable

## Board State Management

### BoardStateManager Class

```python
class BoardStateManager:
    """Maintains board.json consistency"""

    def __init__(self):
        self.lock_file = ".claude/sdlc/kanban/.board.lock"
        self.board_path = ".claude/sdlc/kanban/board.json"

    def atomic_update(self, updates):
        """Atomic board updates with locking"""
        with file_lock(self.lock_file):
            board = self.read_board()

            # Apply updates
            for update in updates:
                self.apply_update(board, update)

            # Recalculate metrics
            board["metrics"] = self.calculate_metrics(board)

            # Check violations
            board["wip_violations"] = self.check_wip_violations(board)

            # Write atomically
            self.write_board(board)

    def apply_update(self, board, update):
        """Apply single update to board state"""
        if update["type"] == "move_story":
            # Remove from source column
            source = next(c for c in board["columns"] if c["id"] == update["from"])
            source["stories"].remove(update["story_id"])
            source["count"] -= 1
            source["total_points"] -= update["points"]

            # Add to destination column
            dest = next(c for c in board["columns"] if c["id"] == update["to"])
            dest["stories"].append(update["story_id"])
            dest["count"] += 1
            dest["total_points"] += update["points"]

    def calculate_metrics(self, board):
        """Recalculate all board metrics"""
        return {
            "velocity": self.calculate_velocity(board),
            "cycle_time": self.calculate_cycle_time(board),
            "throughput": self.calculate_throughput(board),
            "quality": self.calculate_quality_metrics(board),
            "coherence": self.get_coherence_metrics()
        }

    def check_wip_violations(self, board):
        """Check for WIP limit violations"""
        # See WIP Limit Enforcement section above
        pass
```

### Atomic Updates

**Critical**: board.json updates must be atomic to prevent race conditions.

```python
# WRONG - Race condition
board = read_board()
board["columns"][0]["count"] += 1
write_board(board)

# RIGHT - Atomic with lock
with file_lock(".claude/sdlc/kanban/.board.lock"):
    board = read_board()
    board["columns"][0]["count"] += 1
    write_board(board)
```

## Epic Management

### Epic Structure

```json
"epics": {
  "epic-crm": {
    "name": "CRM MVP",
    "phase": 1,                 // Current phase
    "total_phases": 3,
    "stories": {
      "phase_1": ["US-CRM-001", "US-CRM-002", "US-CRM-003"],
      "phase_2": ["US-CRM-004", "US-CRM-005"],
      "phase_3": ["US-CRM-006"]
    },
    "progress": {
      "phase_1": { "completed": 1, "total": 3 },
      "phase_2": { "completed": 0, "total": 2 },
      "phase_3": { "completed": 0, "total": 1 }
    }
  }
}
```

### Progressive Epic Revelation

As phases complete, reveal next phase stories:

```python
def check_epic_phase_completion(epic_id):
    """Check if epic phase is complete"""
    board = read_board()
    epic = board["epics"][epic_id]

    current_phase = f"phase_{epic['phase']}"
    stories = epic["stories"][current_phase]

    # Check if all phase stories are done
    for story_id in stories:
        story = read_story(story_id)
        if story.status != "done":
            return False

    return True

def advance_epic_phase(epic_id):
    """Move epic to next phase"""
    board = read_board()
    epic = board["epics"][epic_id]

    if epic["phase"] >= epic["total_phases"]:
        return {"status": "complete"}

    # Move to next phase
    epic["phase"] += 1

    # Reveal next phase stories
    next_phase = f"phase_{epic['phase']}"
    for story_id in epic["stories"][next_phase]:
        story = read_story(story_id)
        story.disclosure.reveal_requirements = True
        story.disclosure.phase = epic["phase"]
        write_story(story)

    write_board(board)

    return {"status": "advanced", "phase": epic["phase"]}
```

## Agent Management

### Agent State Tracking

```json
"agents": {
  "backend-dev": {
    "active": true,              // Is agent available?
    "wip": 1,                    // Current work in progress
    "max_wip": 1,                // Max concurrent stories
    "current_story": "US-XXX-002",
    "total_completed": 5,
    "velocity": 8,               // Points per sprint
    "availability": "full"       // full|partial|unavailable
  }
}
```

### Agent Assignment

```python
def assign_to_agent(story_id, agent_type):
    """Assign story to agent"""
    board = read_board()
    agent = board["agents"][agent_type]

    # Check WIP limit
    if agent["wip"] >= agent["max_wip"]:
        raise ValueError(f"{agent_type} at WIP limit")

    # Assign
    agent["wip"] += 1
    agent["current_story"] = story_id

    # Update story
    story = read_story(story_id)
    story.assigned_to = agent_type
    write_story(story)

    write_board(board)

def unassign_from_agent(story_id):
    """Unassign story from agent"""
    story = read_story(story_id)
    agent_type = story.assigned_to

    if not agent_type:
        return

    board = read_board()
    agent = board["agents"][agent_type]

    agent["wip"] -= 1
    agent["current_story"] = None

    if story.status == "done":
        agent["total_completed"] += 1

    story.assigned_to = None
    write_story(story)

    write_board(board)
```

## Dashboard Integration

### SSE Updates

When board state changes, notify dashboard via SSE:

```typescript
// After board.json update
await notifyDashboard("board_updated", {
  type: "story_moved",
  story_id: "US-XXX-001",
  from: "in-progress",
  to: "review",
  timestamp: new Date().toISOString()
});
```

Dashboard subscribes to board updates and refreshes UI in real-time.
