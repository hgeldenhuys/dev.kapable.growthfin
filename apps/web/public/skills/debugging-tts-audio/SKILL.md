---
name: debugging-tts-audio
description: Systematic troubleshooting protocol for TTS/audio narration when sounds stop playing or generation fails. Covers database connections, worker registration, job queue health, and ElectricSQL streaming. Use when audio stops working, CLI listen command gets no audio, or generate-audio jobs fail.
---

# Debugging TTS/Audio System

## When to Use This Skill

Use this skill when:

- ✅ Audio narration stops playing in CLI `listen` command
- ✅ TTS generation requests hang or timeout
- ✅ "generate-audio" worker not processing jobs
- ✅ Audio API endpoints return errors
- ✅ ElectricSQL audio streams disconnect

**DON'T use for:**
- Audio quality issues (use audio config instead)
- PA announcement sounds (those are local files in CLI)
- Voice selection problems (check voice configuration)

---

## 🚀 Complete Integration Test Suite (Run This First!)

**Copy-paste this entire script to diagnose all TTS issues in one go:**

```bash
#!/bin/bash
# TTS System Integration Test Suite
# Run this first when TTS stops working

set -e
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

echo "======================================"
echo "TTS System Integration Test Suite"
echo "======================================"
echo ""

# Test 1: API Health
echo "Test 1/5: API Server Health..."
if [ "$(curl -s http://localhost:3000/health | jq -r '.status')" = "ok" ]; then
  echo "✅ API server healthy"
else
  echo "❌ API server down or unhealthy"
  exit 1
fi
echo ""

# Test 2: ElectricSQL SSE Streaming (MOST IMPORTANT)
echo "Test 2/5: ElectricSQL SSE Streaming (Most Common Failure)..."
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-test.log 2>&1 &
SSE_PID=$!
sleep 2

TEST_SESSION="sse-test-$(date +%s)"
curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}" \
  > /dev/null 2>&1

sleep 3
kill $SSE_PID 2>/dev/null || true

if grep -q "$TEST_SESSION" /tmp/sse-test.log; then
  echo "✅ SSE streaming events correctly"
  rm /tmp/sse-test.log
else
  echo "❌ SSE NOT streaming - ElectricSQL stream stalled"
  echo "   SOLUTION: docker compose restart electric"
  rm /tmp/sse-test.log
  exit 1
fi
echo ""

# Test 3: Database Connections
echo "Test 3/5: Database Connection Health..."
TOTAL_CONNS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';" | tr -d ' ')
if [ "$TOTAL_CONNS" -lt 80 ]; then
  echo "✅ Database connections healthy ($TOTAL_CONNS total)"
else
  echo "❌ Too many connections: $TOTAL_CONNS (threshold: 80)"
  exit 1
fi
echo ""

# Test 4: Voice Settings Configuration
echo "Test 4/6: Voice Settings Configuration..."
SETTINGS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM global_voice_settings;" | tr -d ' ')
if [ "$SETTINGS_COUNT" -gt 0 ]; then
  echo "✅ Voice settings configured"
else
  echo "❌ No voice settings found - audio generation will fail"
  echo "   SOLUTION: Run the following to create default settings:"
  echo "   psql \"\$DATABASE_URL\" -c \"INSERT INTO global_voice_settings (user_voice_id, assistant_voice_id) VALUES ((SELECT id FROM voices WHERE name = 'Sarah' LIMIT 1), (SELECT id FROM voices WHERE name = 'Brian' LIMIT 1));\""
  exit 1
fi
echo ""

# Test 5: Worker Registration
echo "Test 5/6: Audio Worker Registration..."
WORKER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pgboss.subscription WHERE name = 'generate-audio';" | tr -d ' ')
if [ "$WORKER_COUNT" -gt 0 ]; then
  echo "✅ Audio worker registered"
else
  echo "⚠️  Audio worker NOT registered (may not be critical if API just started)"
  echo "   Check API logs for: '✅ Worker registered for job: generate-audio'"
fi
echo ""

# Test 6: Audio Generation
echo "Test 6/6: Audio Generation Endpoint..."
EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')
if [ -n "$EVENT_ID" ]; then
  STATUS=$(curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq -r '.status // .error')
  if [ "$STATUS" = "generating" ] || [ "$STATUS" = "cached" ]; then
    echo "✅ Audio generation working"
  else
    echo "⚠️  Audio endpoint responded with: $STATUS"
  fi
else
  echo "⚠️  No Stop events in database to test with"
fi
echo ""

echo "======================================"
echo "✅ All TTS Integration Tests Passed!"
echo "======================================"
```

**Location:** `test/integration/test-tts.sh`

**Run with:** `bash test/integration/test-tts.sh`

**If Test 2 fails (SSE streaming):**
```bash
docker compose restart electric
sleep 10
bash test-tts.sh  # Re-run tests
```

---

## Quick Diagnosis (5 Minutes)

Run these checks first to identify the problem. Each check includes an integration test.

### 1. Check API Server Health

```bash
curl -s http://localhost:3000/health | jq
```

**Expected:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-07T...",
  "uptime": 32.8
}
```

**If fails:** API server is down or not responding → Jump to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#restart-services)

---

### 2. Test ElectricSQL SSE Stream (MOST COMMON ISSUE)

**⚠️ This is the #1 cause of TTS failures.** ElectricSQL stops streaming events.

```bash
# Test SSE stream delivers events in real-time
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-test.log 2>&1 &
SSE_PID=$!
sleep 2

# Create a test event
curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test", "sessionId": "test-sse", "eventName": "UserPromptSubmit", "payload": {}}' > /dev/null 2>&1

sleep 3
kill $SSE_PID 2>/dev/null

# Check if event was received via SSE
if grep -q "UserPromptSubmit" /tmp/sse-test.log; then
  echo "✅ SSE streaming working"
  rm /tmp/sse-test.log
else
  echo "❌ SSE stream NOT delivering events - ElectricSQL needs restart"
  cat /tmp/sse-test.log
  rm /tmp/sse-test.log
  exit 1
fi
```

**Expected:** Test event appears in SSE stream within 3 seconds

**If fails:** ElectricSQL stopped streaming → **SOLUTION: `docker compose restart electric`**

---

### 3. Check Database Connection Count

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT count(*), state FROM pg_stat_activity WHERE datname = 'agios_dev' GROUP BY state;"
```

**Expected:**
```
 count | state
-------+--------
     2 | active
    28 | idle
```

**Problem indicators:**
- `psql: FATAL: sorry, too many clients already` → **Connection exhaustion**
- More than 80 connections → **Connection leak**

---

### 4. Verify Worker Registration

```bash
# Check API server logs for worker registration
# Look for this output on API startup:
# ✅ Worker registered for job: generate-audio
# ✅ Generate Audio worker registered
```

**If missing:** Worker not registered → See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#problem-2-worker-not-registered)

---

### 5. Check Voice Settings Configuration

```bash
# Check if global voice settings exist
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as settings_count FROM global_voice_settings;"
```

**Expected:**
```
 settings_count
----------------
              1
```

**If fails (0 rows):** No voice settings → See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#problem-6-missing-voice-settings-globalproject)

---

### 6. Test Audio Generation End-to-End

```bash
# Get a recent hook event ID
EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

if [ -n "$EVENT_ID" ]; then
  echo "Testing with event: $EVENT_ID"

  # Request audio generation
  RESPONSE=$(curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID")
  echo "$RESPONSE"

  # Check for success (202 = queued, 200 = cached)
  STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
  if [ "$STATUS" = "generating" ] || [ "$STATUS" = "cached" ]; then
    echo "✅ Audio generation working"
  else
    echo "❌ Audio generation failed"
    echo "$RESPONSE" | jq
    exit 1
  fi
else
  echo "⚠️  No Stop events found in database to test with"
fi
```

**Expected:**
- Status 202: `{"status": "generating", "jobId": "..."}`
- Status 200: `{"status": "cached", "url": "/cdn/audio/..."}`

**If error:** API route broken or database issue

---

## Common Problems Overview

For detailed solutions, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md):

1. **Connection Exhaustion** - Too many database connections
2. **Worker Not Registered** - Audio worker not running
3. **Job Queue Stuck** - Jobs not processing
4. **ElectricSQL Stream Disconnected** - SSE not delivering events (PRIMARY ROOT CAUSE)
5. **Audio Files Not Generated** - Files missing from filesystem
6. **Missing Voice Settings** - No default voices configured

---

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture and component interaction.

### Audio Generation Flow (Summary)

```
User Request → API Endpoint → Cache Check → Queue Job → Worker → ElevenLabs API
→ Save File → Update Cache → NOTIFY → ElectricSQL → CLI → Audio Plays
```

---

## Debugging Steps

For step-by-step debugging workflow, see [DEBUGGING-STEPS.md](./DEBUGGING-STEPS.md).

---

## Monitoring & Prevention

### Check Connection Count Regularly

```bash
# Add to your shell profile for quick access
alias pgconns='psql "$DATABASE_URL" -c "SELECT count(*), state FROM pg_stat_activity WHERE datname = '\''agios_dev'\'' GROUP BY state;"'
```

### Monitor Worker Queue

```bash
# Check pending jobs
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT name, state, count(*) FROM pgboss.job WHERE name = 'generate-audio' AND state != 'completed' GROUP BY name, state;"
```

### Watch API Logs

```bash
# Keep an eye on worker activity
tail -f apps/api/logs/app.log | grep -E "generate-audio|Worker registered"
```

---

## Success Criteria

✅ Audio system is working when:

1. **API health check passes**
   ```bash
   curl -s http://localhost:3000/health | jq '.status'
   # Output: "ok"
   ```

2. **Database connections healthy**
   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';"
   # Output: < 50
   ```

3. **Worker registered**
   ```bash
   # API logs show:
   # ✅ Worker registered for job: generate-audio
   ```

4. **Jobs processing**
   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM pgboss.job WHERE name = 'generate-audio' AND state = 'active';"
   # Output: 0-2 (low number)
   ```

5. **Audio playing in CLI**
   ```bash
   cd apps/cli && bun src/index.ts listen
   # Should hear audio when events trigger
   ```

---

## Related Skills

- **queuing-jobs** - pg-boss job queue patterns
- **health-monitor** - System health checks
- **debugging-realtime-streaming** - ElectricSQL issues

---

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and data flow
- [DEBUGGING-STEPS.md](./DEBUGGING-STEPS.md) - Step-by-step debugging workflow
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Problem-specific solutions
- [EXAMPLES.md](./EXAMPLES.md) - Real debugging sessions
