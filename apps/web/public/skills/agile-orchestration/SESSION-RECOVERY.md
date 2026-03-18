# Session Recovery

Complete guide to session lifecycle management, crash recovery, and heartbeat monitoring.

## Session Tracking with Heartbeat

**File**: `.claude/sdlc/kanban/sessions/session-{id}.json`
**Heartbeat**: Every 30 seconds (prevents stale sessions)
**Stale Threshold**: 5 minutes without heartbeat

## Session File Structure

```json
{
  "session_id": "session-2025-11-08-{uuid}",
  "started_at": "{ISO-8601}",
  "last_heartbeat": "{ISO-8601}",      // Updated every 30s
  "status": "active",                   // active|stale|completed
  "pid": 12345,                          // Process ID for detection
  "boards_locked": ["US-XXX-002"],      // Stories being edited

  "checkpoint": {
    "timestamp": "{ISO-8601}",
    "last_completed_story": "US-XXX-002",
    "stories_completed": ["US-XXX-001", "US-XXX-002"],
    "stories_in_progress": ["US-XXX-003"],
    "stories_blocked": [],

    "board_state_snapshot": {
      "columns": {
        "backlog": ["US-XXX-010"],
        "todo": ["US-XXX-004", "US-XXX-005"],
        "ready": ["US-XXX-003"],
        "in-progress": ["US-XXX-002"],
        "review": ["US-XXX-001"],
        "done": ["US-XXX-000"]
      },
      "metrics": {
        "total_stories": 8,
        "completed": 1,
        "in_progress": 1,
        "blocked": 0,
        "velocity": 8
      }
    },

    "agent_states": {
      "backend-dev": {
        "status": "working",
        "current_story": "US-XXX-002",
        "last_action": "implementing API endpoint"
      },
      "frontend-dev": {
        "status": "idle",
        "current_story": null,
        "last_action": null
      }
    }
  },

  "recovery_hints": {
    "last_command": "/sdlc:start PRD-CRM-MVP",
    "current_phase": 1,
    "next_action": "delegate frontend after backend completes"
  }
}
```

## Session Lifecycle

### 1. Session Initialization

```python
class SessionManager:
    """Manages session lifecycle with crash recovery"""

    def __init__(self):
        self.session_id = f"session-{date}-{uuid()}"
        self.heartbeat_interval = 30  # seconds
        self.stale_threshold = 300    # 5 minutes

    def start_session(self):
        """Initialize new session"""
        session = {
            "session_id": self.session_id,
            "started_at": now(),
            "last_heartbeat": now(),
            "status": "active",
            "pid": os.getpid(),
            "boards_locked": []
        }
        self.save_session(session)
        self.start_heartbeat()
```

### 2. Heartbeat Monitoring

```python
def heartbeat(self):
    """Update heartbeat every 30 seconds"""
    while self.active:
        session = self.load_session()
        session["last_heartbeat"] = now()
        session["checkpoint"] = self.create_checkpoint()
        self.save_session(session)
        sleep(30)
```

### 3. Checkpoint Creation

```python
def create_checkpoint(self):
    """Create recovery checkpoint"""
    return {
        "timestamp": now(),
        "last_completed_story": self.get_last_completed(),
        "stories_completed": self.list_completed_stories(),
        "stories_in_progress": self.list_in_progress(),
        "board_state_snapshot": self.snapshot_board(),
        "agent_states": self.get_agent_states()
    }

def snapshot_board(self):
    """Snapshot current board state"""
    board = read_board()
    return {
        "columns": {
            col["id"]: col["stories"]
            for col in board["columns"]
        },
        "metrics": board["metrics"]
    }

def get_agent_states(self):
    """Get current agent states"""
    board = read_board()
    states = {}

    for agent_id, agent in board["agents"].items():
        states[agent_id] = {
            "status": "working" if agent["current_story"] else "idle",
            "current_story": agent["current_story"],
            "last_action": self.get_last_agent_action(agent_id)
        }

    return states
```

### 4. Stale Session Detection

```python
def detect_stale_sessions(self):
    """Find sessions that stopped heartbeating"""
    stale = []
    for session_file in glob("sessions/session-*.json"):
        session = load_json(session_file)
        if session["status"] == "active":
            last_beat = parse_iso(session["last_heartbeat"])
            if (now() - last_beat).seconds > self.stale_threshold:
                stale.append(session)
    return stale

def is_process_alive(self, pid):
    """Check if process is still running"""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
```

### 5. Session Recovery

```python
def recover_session(self, session_id):
    """Recover from crashed session"""
    session = load_session(session_id)
    checkpoint = session["checkpoint"]

    # 1. Check if truly stale (not just slow)
    if self.is_process_alive(session["pid"]):
        return {"status": "session_still_active"}

    # 2. Mark old session as stale
    session["status"] = "stale"
    self.save_session(session)

    # 3. Create new session inheriting state
    new_session = self.start_session()

    # 4. Restore board state
    self.restore_board_state(checkpoint["board_state_snapshot"])

    # 5. Unlock any locked stories
    for story_id in session["boards_locked"]:
        self.unlock_story(story_id)

    # 6. Resume in-progress work
    recovery_report = {
        "recovered_from": session_id,
        "stories_to_resume": checkpoint["stories_in_progress"],
        "last_completed": checkpoint["last_completed_story"],
        "agent_states": checkpoint["agent_states"],
        "recovery_hints": session.get("recovery_hints", {})
    }

    # 7. Log recovery
    self.log_recovery(recovery_report)

    return recovery_report

def restore_board_state(self, snapshot):
    """Restore board state from checkpoint"""
    board = read_board()

    # Verify snapshot matches reality
    for col_id, story_ids in snapshot["columns"].items():
        actual_files = list_stories_in_column(col_id)
        missing = set(story_ids) - set(actual_files)
        extra = set(actual_files) - set(story_ids)

        if missing or extra:
            # Reconcile differences
            self.reconcile_board_state(col_id, story_ids, actual_files)

    # Refresh board.json from file system
    self.rebuild_board_from_files()

def unlock_story(self, story_id):
    """Release story lock from crashed session"""
    # Story locks prevent concurrent edits
    # Unlock allows new session to edit
    pass
```

### 6. Session Cleanup

```python
def cleanup_old_sessions(self, days=7):
    """Clean up old session files"""
    cutoff = now() - timedelta(days=days)
    for session_file in glob("sessions/session-*.json"):
        session = load_json(session_file)
        if parse_iso(session["started_at"]) < cutoff:
            # Archive or delete
            if session["status"] == "stale":
                self.archive_session(session)
            os.remove(session_file)
```

## Recovery Protocol

### Startup Recovery Check

```python
def handle_session_recovery():
    """Run at startup to check for crashed sessions"""

    # 1. Check for stale sessions
    stale_sessions = SessionManager().detect_stale_sessions()

    if not stale_sessions:
        return None

    # 2. Find most recent stale session
    latest = max(stale_sessions, key=lambda s: s["last_heartbeat"])

    # 3. Display recovery info
    print(f"Found stale session: {latest['session_id']}")
    print(f"Last active: {latest['last_heartbeat']}")
    print(f"In progress: {latest['checkpoint']['stories_in_progress']}")

    # 4. Offer recovery
    if confirm("Recover from this session?"):
        # Perform recovery
        report = SessionManager().recover_session(latest["session_id"])

        # Resume work
        for story_id in report["stories_to_resume"]:
            print(f"Resuming: {story_id}")
            story = read_story(story_id)

            # Check agent states
            for agent, state in report["agent_states"].items():
                if state["current_story"] == story_id:
                    if state["status"] == "working":
                        # Re-delegate to agent
                        delegate_to_agent(story_id, agent)

        return report

    return None

# Run at startup
recovery_report = handle_session_recovery()
if recovery_report:
    print(f"Recovered {len(recovery_report['stories_to_resume'])} stories")
```

## Story Locking

### Lock Acquisition

```python
def lock_story_for_edit(story_id):
    """Prevent concurrent edits"""
    session = load_current_session()

    # Check if already locked by another session
    for other_session in get_active_sessions():
        if story_id in other_session["boards_locked"]:
            if other_session["session_id"] != session["session_id"]:
                # Check if other session is truly active
                if is_session_active(other_session["session_id"]):
                    raise LockError(f"{story_id} locked by {other_session['session_id']}")
                else:
                    # Stale lock, forcibly unlock
                    force_unlock_story(story_id, other_session["session_id"])

    # Acquire lock
    session["boards_locked"].append(story_id)
    save_session(session)

def unlock_story(story_id):
    """Release story lock"""
    session = load_current_session()
    if story_id in session["boards_locked"]:
        session["boards_locked"].remove(story_id)
        save_session(session)

def force_unlock_story(story_id, session_id):
    """Forcibly unlock from stale session"""
    session = load_session(session_id)
    if story_id in session["boards_locked"]:
        session["boards_locked"].remove(story_id)
        save_session(session)
```

## Recovery Scenarios

### Scenario 1: Clean Shutdown

```
1. User stops session gracefully
2. Heartbeat stops
3. Session marked "completed"
4. No recovery needed
```

### Scenario 2: Process Crash

```
1. Claude Code crashes (OOM, network, etc.)
2. Heartbeat stops
3. Session becomes stale (5+ minutes)
4. Next startup:
   - Detect stale session
   - Offer recovery
   - Resume in-progress work
```

### Scenario 3: Multiple Stale Sessions

```
1. Multiple crashes over time
2. Multiple stale sessions exist
3. Startup:
   - Show all stale sessions
   - User picks which to recover from
   - OR: Auto-recover from most recent
```

### Scenario 4: Corrupted State

```
1. Session checkpoint inconsistent with files
2. Recovery detects mismatch
3. Reconcile:
   - File system is source of truth
   - Rebuild board.json from files
   - Log discrepancies
```

## Session Recovery Hints

### Adding Recovery Hints

```python
def update_recovery_hints(hints):
    """Add contextual recovery hints"""
    session = load_current_session()
    session["recovery_hints"].update(hints)
    save_session(session)

# Example usage
update_recovery_hints({
    "last_command": "/sdlc:start PRD-CRM-MVP",
    "current_phase": 1,
    "next_action": "delegate frontend after backend completes",
    "epic": "epic-crm",
    "sprint": "Sprint 2"
})
```

### Using Recovery Hints

```python
def resume_work_from_hints(recovery_report):
    """Resume work using recovery hints"""
    hints = recovery_report["recovery_hints"]

    if hints.get("next_action"):
        print(f"Next action: {hints['next_action']}")

    if hints.get("epic"):
        epic = hints["epic"]
        # Check epic phase completion
        if check_epic_phase_completion(epic):
            advance_epic_phase(epic)

    if hints.get("current_phase"):
        phase = hints["current_phase"]
        # Resume phase work
        resume_phase_work(phase)
```

## Monitoring Sessions

### List Active Sessions

```bash
# List all active sessions
ls .claude/sdlc/kanban/sessions/session-*.json

# Check specific session
cat .claude/sdlc/kanban/sessions/session-{id}.json | jq '.checkpoint'

# Find stale sessions
find .claude/sdlc/kanban/sessions -name "session-*.json" -mmin +5
```

### Session Health Check

```python
def session_health_check():
    """Check session health"""
    session = load_current_session()

    # Check heartbeat age
    last_beat = parse_iso(session["last_heartbeat"])
    age_seconds = (now() - last_beat).seconds

    if age_seconds > 60:
        print(f"⚠️ Heartbeat is {age_seconds}s old (should be <30s)")

    # Check locked stories
    if session["boards_locked"]:
        print(f"Locked stories: {session['boards_locked']}")

    # Check checkpoint age
    checkpoint_age = (now() - parse_iso(session["checkpoint"]["timestamp"])).seconds
    if checkpoint_age > 60:
        print(f"⚠️ Checkpoint is {checkpoint_age}s old")

    return {
        "healthy": age_seconds < 60,
        "heartbeat_age": age_seconds,
        "checkpoint_age": checkpoint_age,
        "locked_stories": len(session["boards_locked"])
    }
```

## Session Archiving

### Archive Structure

```
.claude/sdlc/kanban/sessions/
├── session-{id}.json          # Active sessions
└── archived/
    ├── 2025-11/
    │   ├── session-2025-11-08-{uuid}.json
    │   └── session-2025-11-09-{uuid}.json
    └── 2025-10/
        └── session-2025-10-15-{uuid}.json
```

### Archive Implementation

```python
def archive_session(session):
    """Archive completed/stale session"""
    session_id = session["session_id"]
    started = parse_iso(session["started_at"])
    month_dir = f"archived/{started.year}-{started.month:02d}"

    os.makedirs(f"sessions/{month_dir}", exist_ok=True)

    shutil.move(
        f"sessions/{session_id}.json",
        f"sessions/{month_dir}/{session_id}.json"
    )
```

## Best Practices

### DO ✅
- Update heartbeat regularly (every 30s)
- Create checkpoints frequently
- Lock stories before editing
- Add recovery hints for complex work
- Clean up old sessions regularly

### DON'T ❌
- Rely on session state without verification
- Skip heartbeat updates
- Edit stories without locking
- Ignore stale session warnings
- Keep sessions forever

## Troubleshooting

### Heartbeat Not Updating

**Symptom**: Heartbeat timestamp not changing
**Causes**:
- Heartbeat thread died
- File system write failure
- Session file locked

**Solutions**:
```python
# Restart heartbeat
self.start_heartbeat()

# Check file permissions
os.access(session_path, os.W_OK)

# Force heartbeat update
force_heartbeat_update()
```

### Session Locks Won't Release

**Symptom**: Story remains locked after session ends
**Causes**:
- Stale lock from crashed session
- Lock not released on error

**Solutions**:
```python
# Force unlock
force_unlock_story(story_id, session_id)

# Clear all locks from stale session
clear_session_locks(session_id)
```

### Recovery Fails

**Symptom**: Recovery process errors out
**Causes**:
- Corrupted checkpoint
- Missing story files
- Board state mismatch

**Solutions**:
```python
# Rebuild from file system
rebuild_board_from_files()

# Skip corrupted checkpoint
recover_without_checkpoint(session_id)

# Manual reconciliation
manually_reconcile_state()
```
