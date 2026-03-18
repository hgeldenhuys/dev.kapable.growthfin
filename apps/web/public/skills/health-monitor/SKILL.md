---
name: health-monitor
description: |
  Lightweight background health monitoring. Watches API/DB/Queue logs for
  error patterns without interfering with agent work. Creates impediments
  only when thresholds met. Runs every 30 seconds during active sprints.
type: background
frequency: 30
triggers:
  - sdlc_sprint_active
  - agents_working
---

# Health Monitor Skill

## Purpose

Proactively detect environment health issues (API errors, DB problems, queue failures) before they block agent work. Creates impediments only when error patterns meet escalation thresholds.

## How It Works

### 1. Log Monitoring (Non-blocking)
```bash
# Check recent API logs for errors (last 30 seconds)
tail -n 1000 apps/api/logs/error.log 2>/dev/null | \
  grep -E "(❌|Error:|ECONNREFUSED)" | \
  tail -n 50
```

### 2. Error Pattern Detection
- Normalize errors (remove timestamps, worker IDs, etc.)
- Group by signature (error type + resource)
- Count occurrences and calculate frequency
- Compare against thresholds

### 3. Threshold Checking
Load thresholds from `.claude/sdlc/health/threshold-config.json`:
- **Low severity**: 50 occurrences in 10 minutes
- **Medium severity**: 10 occurrences in 5 minutes
- **High severity**: 3 occurrences in 2 minutes
- **Critical severity**: 1 occurrence (immediate)

### 4. Impediment Creation (If Warranted)
Only create impediment if:
- Threshold exceeded
- Not in cooldown period (already escalated recently)
- No agent currently working on related issue

### 5. Auto-Fix Attempt (If Safe)
For known patterns with safe auto-fixes:
- Queue doesn't exist → Create queue
- Port in use → Kill stale process
- DB connection refused → Check/start database

## What This Skill Does

```typescript
interface HealthMonitorResult {
  status: "healthy" | "degraded" | "critical";
  timestamp: string;

  services: {
    api: ServiceHealth;
    database: ServiceHealth;
    queue: ServiceHealth;
    frontend: ServiceHealth;
  };

  error_patterns: ErrorPattern[];
  new_impediments: Impediment[];
  auto_fixes_attempted: AutoFixResult[];

  recommendations: string[];
  requires_intervention: boolean;
}
```

## Execution Steps

See [EXECUTION.md](./EXECUTION.md) for detailed step-by-step process.

## Integration with Orchestrator

The orchestrator checks health status between agent tasks:

```python
def execute_sprint():
    while stories_remaining():
        # Agents work on stories
        work_on_current_stories()

        # Health check point (between tasks)
        health = invoke_skill("health-monitor")

        if health.requires_intervention:
            handle_health_issues(health)

        # Continue
```

## Avoiding "Stepping on Toes"

Before creating impediment or auto-fixing:

1. **Check if agent is working on related issue**
   ```python
   related_stories = find_stories_by_keywords(pattern.signature)
   if any(s.status == "in_progress" for s in related_stories):
       log("Agent already working on this, backing off")
       return
   ```

2. **Check cooldown period**
   ```python
   if pattern.last_escalated + cooldown > now:
       log("Already escalated recently, not re-escalating")
       return
   ```

3. **Verify safe to auto-fix**
   ```python
   if not strategy.safe:
       log("Not safe for auto-fix, creating impediment for human")
       create_impediment(pattern)
       return
   ```

## Output Examples

See [OUTPUT-EXAMPLES.md](./OUTPUT-EXAMPLES.md) for:
- Healthy status format
- Degraded status (auto-fixed)
- Critical status (needs intervention)
- Error pattern examples

## Configuration

Loads from: `.claude/sdlc/health/threshold-config.json`

Key settings:
- Escalation thresholds per severity
- Auto-fix strategies
- Cooldown periods
- Deduplication rules
- Service monitoring configuration

## Files Created

- `.claude/sdlc/health/monitors/{service}.json` - Service health state
- `.claude/sdlc/health/error-patterns/active/{pattern-id}.json` - Active patterns
- `.claude/sdlc/health/impediments/auto-detected/{imp-id}.json` - Auto-detected impediments
- `.claude/sdlc/health/logs/health-checks/{timestamp}.jsonl` - Audit log

## Metrics Tracked

```json
{
  "health_monitoring": {
    "checks_performed": 120,
    "patterns_detected": 15,
    "impediments_created": 3,
    "auto_fixes_attempted": 5,
    "auto_fixes_successful": 4,
    "false_positives": 1,
    "average_detection_time_seconds": 138,
    "average_resolution_time_seconds": 45
  }
}
```

## When NOT to Use

This skill is automatically invoked during sprints. You should NOT manually invoke it for:
- One-time error checks (use direct inspection)
- Debugging specific issues (use debug-analyze skill)
- Historical error analysis (use log files directly)

## Related

- **HEALTH-MONITORING.md**: Full system documentation
- **threshold-config.json**: Configuration file
- **debug-analyze skill**: For one-time error analysis
- **CLAUDE.md**: Orchestrator integration points

---

**Remember**: This skill is proactive defense, not reactive firefighting. It detects patterns before they cascade into bigger problems.
