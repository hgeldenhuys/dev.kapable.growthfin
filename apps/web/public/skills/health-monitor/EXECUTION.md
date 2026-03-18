# Execution Steps

## Step 1: Check Process Health

```bash
# API Server
if lsof -ti:3000 > /dev/null 2>&1; then
  api_status="running"
else
  api_status="stopped"
  # Create impediment: API server not running
fi

# Database
if lsof -ti:5439 > /dev/null 2>&1; then
  db_status="running"
else
  db_status="stopped"
  # Create impediment: Database not running
fi
```

## Step 2: Parse Recent Logs

```bash
# Look for error patterns in last 30 seconds
# API logs typically in console output when running `bun dev`

# Parse errors from process output
ps aux | grep "bun.*api" | grep -v grep
# If process exists, errors would be in terminal output
# For file-based logging, check:
# - apps/api/logs/error.log
# - Console output captured by orchestrator
```

## Step 3: Pattern Analysis

```python
# Pseudocode for pattern detection
patterns = {}

for error in recent_errors:
    # Normalize
    signature = normalize_error(error)

    # Group
    if signature not in patterns:
        patterns[signature] = {
            "first_seen": now,
            "occurrences": 0,
            "last_seen": now
        }

    patterns[signature]["occurrences"] += 1
    patterns[signature]["last_seen"] = now

# Check thresholds
for pattern in patterns:
    if meets_threshold(pattern):
        if not in_cooldown(pattern):
            create_impediment(pattern)
```

## Step 4: Auto-Fix Attempt

```python
# For known fixable patterns
for pattern in patterns:
    if pattern.signature in AUTO_FIX_STRATEGIES:
        strategy = AUTO_FIX_STRATEGIES[pattern.signature]

        if strategy.safe:
            result = attempt_auto_fix(strategy)

            if result.success:
                mark_pattern_resolved(pattern)
                log_auto_fix_success(pattern, result)
            else:
                create_impediment(pattern)
```

## Step 5: Report Summary

```
🏥 Health Status (2025-10-22 10:17:30)

Services:
  ✅ Database: Healthy (connection OK, latency 2ms)
  ✅ Frontend: Healthy (port 5173 responding)
  ⚠️  API Server: Degraded (1 active pattern)
  ❌ Queue System: Critical (queue missing)

Active Patterns:
  [MEDIUM] Queue calculate-ab-test does not exist
    - Occurrences: 15 (last 5 minutes)
    - Frequency: 7.5/minute
    - Impact: Blocks queue-based features
    - Action: Attempting auto-fix...

Auto-Fixes Attempted:
  ✅ Created missing queue: calculate-ab-test
  ⏱  Verifying fix (waiting 30s for errors to stop)

New Impediments: 0 (auto-fixed)

Recommendations:
  1. Monitor queue errors for next 5 minutes
  2. Add queue creation to setup docs
  3. No immediate action required

Sprint Impact: None (resolved automatically)
```
