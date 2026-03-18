# TTS/Audio Debugging Steps

This document provides a step-by-step debugging workflow for TTS/audio issues.

---

## Step 1: Verify API Server Health

### Check API Status

```bash
curl -s http://localhost:3000/health | jq
```

**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-07T...",
  "uptime": 32.8
}
```

### If API is Down

```bash
# Check if API is running
lsof -i :3000 | grep LISTEN

# If not running, start it
cd apps/api && bun --hot src/index.ts

# Wait for startup
sleep 5

# Verify health
curl -s http://localhost:3000/health | jq
```

### If API Returns Error

```bash
# Check API logs for errors
tail -50 apps/api/logs/app.log

# Look for:
# - Database connection errors
# - Worker registration failures
# - Port conflicts
```

---

## Step 2: Test ElectricSQL SSE Stream

### Start SSE Listener

```bash
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-test.log 2>&1 &
SSE_PID=$!
echo "SSE listener PID: $SSE_PID"
sleep 2
```

### Create Test Event

```bash
TEST_SESSION="sse-test-$(date +%s)"
echo "Test session: $TEST_SESSION"

curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}" \
  > /dev/null 2>&1
```

### Verify Event Delivery

```bash
sleep 3
kill $SSE_PID 2>/dev/null || true

# Check if event was received
if grep -q "$TEST_SESSION" /tmp/sse-test.log; then
  echo "✅ SSE streaming working"
  cat /tmp/sse-test.log | grep "$TEST_SESSION"
else
  echo "❌ SSE NOT streaming"
  echo "Full SSE log:"
  cat /tmp/sse-test.log
fi

rm /tmp/sse-test.log
```

### If SSE Not Working

```bash
# Check ElectricSQL container status
docker ps | grep electric

# Check ElectricSQL logs
docker logs agios-electric --tail 50

# Restart ElectricSQL
docker compose restart electric
sleep 10

# Verify ElectricSQL health
curl http://localhost:3001/v1/health

# Re-test SSE stream (repeat steps above)
```

---

## Step 3: Check Database Connections

### Count Active Connections

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

psql "$DATABASE_URL" -c "SELECT count(*), state FROM pg_stat_activity WHERE datname = 'agios_dev' GROUP BY state;"
```

**Expected Output:**
```
 count | state
-------+--------
     2 | active
    28 | idle
```

**Total should be < 50 under normal load**

### If Too Many Connections (> 80)

```bash
# Identify connection sources
psql "$DATABASE_URL" -c "
SELECT application_name, count(*), state
FROM pg_stat_activity
WHERE datname = 'agios_dev'
GROUP BY application_name, state
ORDER BY count DESC;
"

# Look for:
# - Multiple API server instances
# - Stuck ElectricSQL connections
# - Orphaned worker connections
```

### Kill Duplicate API Servers

```bash
# List all processes on port 3000
lsof -i :3000 | grep LISTEN

# Kill all API servers
pkill -f "bun.*api"

# Wait for clean shutdown
sleep 3

# Verify connections dropped
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';"

# Start single API server
cd apps/api && bun --hot src/index.ts
```

---

## Step 4: Verify Worker Registration

### Check API Logs

```bash
# Look for worker registration on startup
grep "Worker registered" apps/api/logs/app.log | tail -5

# Expected output:
# ✅ Worker registered for job: generate-audio
# ✅ Generate Audio worker registered
```

### Check pg-boss Subscriptions

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

psql "$DATABASE_URL" -c "
SELECT name, COUNT(*) as worker_count
FROM pgboss.subscription
WHERE name = 'generate-audio'
GROUP BY name;
"
```

**Expected:** At least 1 worker registered

### If No Worker Registered

**Cause 1: Worker file missing or has errors**

```bash
# Check if worker file exists
ls -lh apps/api/src/workers/generate-audio.ts

# Check for syntax errors
cd apps/api
bun run build

# Look for compilation errors in generate-audio.ts
```

**Cause 2: Worker not imported in index.ts**

```bash
# Check if worker is imported
grep "registerGenerateAudioWorker" apps/api/src/index.ts

# Should see:
# import { registerGenerateAudioWorker } from './workers/generate-audio';
# await registerGenerateAudioWorker();
```

**Fix:** Add worker registration to `apps/api/src/index.ts` if missing

```typescript
import { registerGenerateAudioWorker } from './workers/generate-audio';

// After jobQueue.start()
await registerGenerateAudioWorker();
```

**Restart API server and verify logs**

---

## Step 5: Check Voice Settings

### Verify Global Voice Settings Exist

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

psql "$DATABASE_URL" -c "SELECT * FROM global_voice_settings;"
```

**Expected:** At least 1 row with `user_voice_id` and `assistant_voice_id`

### If No Settings Exist

**List available voices:**

```bash
psql "$DATABASE_URL" -c "SELECT id, name, provider FROM voices ORDER BY name LIMIT 10;"
```

**Create global settings:**

```bash
psql "$DATABASE_URL" -c "
INSERT INTO global_voice_settings (user_voice_id, assistant_voice_id)
VALUES (
  (SELECT id FROM voices WHERE name = 'Sarah' LIMIT 1),
  (SELECT id FROM voices WHERE name = 'Brian' LIMIT 1)
)
RETURNING id, user_voice_id, assistant_voice_id;
"
```

### Verify Project-Specific Settings (Optional)

```bash
PROJECT_ID="your-project-id"

psql "$DATABASE_URL" -c "
SELECT * FROM project_voice_settings WHERE project_id = '$PROJECT_ID';
"
```

**If missing and you want project-specific voices:**

```bash
psql "$DATABASE_URL" -c "
INSERT INTO project_voice_settings (project_id, user_voice_id, assistant_voice_id)
VALUES (
  '$PROJECT_ID',
  (SELECT id FROM voices WHERE name = 'Alice' LIMIT 1),
  (SELECT id FROM voices WHERE name = 'Daniel' LIMIT 1)
)
RETURNING *;
"
```

---

## Step 6: Test Audio Generation

### Get a Test Event ID

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

EVENT_ID=$(psql "$DATABASE_URL" -t -c "
SELECT id FROM hook_events
WHERE event_name = 'Stop'
ORDER BY created_at DESC
LIMIT 1;
" | tr -d ' ')

echo "Test event ID: $EVENT_ID"
```

### Request Audio Generation

```bash
if [ -n "$EVENT_ID" ]; then
  echo "Requesting audio for event: $EVENT_ID"

  RESPONSE=$(curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID")
  echo "$RESPONSE" | jq

  STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
  echo "Status: $STATUS"
else
  echo "❌ No Stop events found in database"
  echo "Create a test event to proceed"
fi
```

### Expected Responses

**Cache Hit (200 OK):**
```json
{
  "status": "cached",
  "url": "/cdn/audio/abc123.mp3"
}
```

**Cache Miss (202 Accepted):**
```json
{
  "status": "generating",
  "jobId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Error (4xx/5xx):**
```json
{
  "error": "Voice not found: {voice-id}"
}
```

### If Audio Generation Fails

**Check job queue for errors:**

```bash
psql "$DATABASE_URL" -c "
SELECT id, state, data, output
FROM pgboss.job
WHERE name = 'generate-audio'
  AND state = 'failed'
ORDER BY created_on DESC
LIMIT 5;
"
```

**Look for error patterns:**
- `Voice not found` → Missing voice settings
- `ElevenLabs API error` → API key or quota issue
- `File write error` → Permissions issue

---

## Step 7: Monitor Job Processing

### Watch Jobs in Real-Time

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

# Watch job state changes
watch -n 2 "psql \"$DATABASE_URL\" -c \"
SELECT name, state, COUNT(*) as count
FROM pgboss.job
WHERE name = 'generate-audio'
GROUP BY name, state;
\""
```

**Healthy state:**
- `created`: 0-5 (jobs waiting)
- `active`: 0-2 (jobs processing)
- `completed`: Growing over time
- `failed`: 0 (or low number)

**Unhealthy state:**
- `active`: Growing without completing → Worker stuck
- `failed`: High count → Check error messages
- `created`: Growing without being picked up → Worker not running

### Check Worker Logs

```bash
# Watch API logs for worker activity
tail -f apps/api/logs/app.log | grep -E "generate-audio|🔨|✅|❌"

# Expected output:
# 🔨 Processing job generate-audio:abc123
# ✅ Completed job generate-audio:abc123
```

---

## Step 8: Verify Audio File Creation

### Check Audio Directory

```bash
ls -lh public/cdn/audio/ | tail -10
```

**Expected:** MP3 files with recent timestamps

### If Directory Missing

```bash
mkdir -p public/cdn/audio
chmod 755 public/cdn/audio
```

### If Files Not Being Created

**Check worker logs for file write errors:**

```bash
grep "Error writing audio file" apps/api/logs/app.log

# Common issues:
# - Permission denied → chmod 755 public/cdn/audio
# - Disk full → df -h
# - Path doesn't exist → mkdir -p public/cdn/audio
```

---

## Step 9: Test CLI Audio Playback

### Start CLI Listen Command

```bash
cd apps/cli
bun src/index.ts listen --all-projects > /tmp/cli-listen-test.log 2>&1 &
CLI_PID=$!
echo "CLI PID: $CLI_PID"
sleep 5
```

### Trigger Test Event

```bash
TEST_SESSION="cli-test-$(date +%s)"
echo "Test session: $TEST_SESSION"

curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"0ebfac28-1680-4ec1-a587-836660140055\",
    \"sessionId\": \"$TEST_SESSION\",
    \"eventName\": \"UserPromptSubmit\",
    \"payload\": {\"prompt\": \"Test audio playback\"}
  }" > /dev/null 2>&1
```

### Wait for Audio Processing

```bash
echo "Waiting 10 seconds for audio processing..."
sleep 10
```

### Check CLI Output

```bash
kill $CLI_PID 2>/dev/null || true

echo "CLI output:"
cat /tmp/cli-listen-test.log

# Look for:
# - "New event: UserPromptSubmit"
# - "Playing audio: /cdn/audio/..."
# - No error messages

rm /tmp/cli-listen-test.log
```

### If CLI Not Receiving Events

1. **Verify SSE connection:** Check for connection established message
2. **Check event filtering:** Ensure project ID matches
3. **Verify ElectricSQL:** Run Step 2 again

### If CLI Not Playing Audio

1. **Check audio file exists:** Verify file in `public/cdn/audio/`
2. **Check speaker API:** Test with `speaker` package directly
3. **Check file permissions:** Ensure files are readable

---

## Step 10: End-to-End Integration Test

### Run Complete Test Suite

```bash
#!/bin/bash
# Save to test/integration/test-tts-full.sh

set -e
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

echo "Starting full TTS integration test..."
echo ""

# 1. API Health
echo "1. Testing API health..."
curl -s http://localhost:3000/health | jq
echo ""

# 2. SSE Streaming
echo "2. Testing SSE streaming..."
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-integration.log 2>&1 &
SSE_PID=$!
sleep 2

TEST_SESSION="integration-$(date +%s)"
curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}" \
  > /dev/null 2>&1

sleep 3
kill $SSE_PID 2>/dev/null || true

if grep -q "$TEST_SESSION" /tmp/sse-integration.log; then
  echo "✅ SSE streaming working"
else
  echo "❌ SSE streaming failed"
  cat /tmp/sse-integration.log
  exit 1
fi
rm /tmp/sse-integration.log
echo ""

# 3. Database Connections
echo "3. Checking database connections..."
CONN_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';" | tr -d ' ')
echo "Total connections: $CONN_COUNT"
if [ "$CONN_COUNT" -lt 80 ]; then
  echo "✅ Connection count healthy"
else
  echo "❌ Too many connections"
  exit 1
fi
echo ""

# 4. Worker Registration
echo "4. Checking worker registration..."
WORKER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pgboss.subscription WHERE name = 'generate-audio';" | tr -d ' ')
if [ "$WORKER_COUNT" -gt 0 ]; then
  echo "✅ Worker registered ($WORKER_COUNT workers)"
else
  echo "❌ Worker not registered"
  exit 1
fi
echo ""

# 5. Voice Settings
echo "5. Checking voice settings..."
SETTINGS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM global_voice_settings;" | tr -d ' ')
if [ "$SETTINGS_COUNT" -gt 0 ]; then
  echo "✅ Voice settings configured"
else
  echo "❌ No voice settings"
  exit 1
fi
echo ""

# 6. Audio Generation
echo "6. Testing audio generation..."
EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')
if [ -n "$EVENT_ID" ]; then
  RESPONSE=$(curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID")
  STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
  if [ "$STATUS" = "generating" ] || [ "$STATUS" = "cached" ]; then
    echo "✅ Audio generation working (status: $STATUS)"
  else
    echo "❌ Audio generation failed: $STATUS"
    echo "$RESPONSE" | jq
    exit 1
  fi
else
  echo "⚠️  No test events available"
fi
echo ""

echo "======================================"
echo "✅ All integration tests passed!"
echo "======================================"
```

### Run the Test

```bash
bash test/integration/test-tts-full.sh
```

---

## Common Debugging Patterns

### Pattern 1: Gradual Degradation

**Symptoms:**
- System works initially
- Gradually slows down
- Eventually stops responding

**Likely Cause:** Connection leak

**Debug Steps:**
1. Monitor connection count over time
2. Check for idle connections piling up
3. Restart services to recover
4. Investigate code for unclosed connections

---

### Pattern 2: Intermittent Failures

**Symptoms:**
- Works sometimes
- Fails randomly
- No clear pattern

**Likely Cause:** Race condition or timeout

**Debug Steps:**
1. Check job queue for timeout settings
2. Look for concurrent access issues
3. Add more logging to identify timing
4. Increase timeouts temporarily to test

---

### Pattern 3: Sudden Stop

**Symptoms:**
- Everything works fine
- Suddenly stops completely
- No gradual degradation

**Likely Cause:** Service crashed or disconnected

**Debug Steps:**
1. Check if API server is running
2. Check ElectricSQL container status
3. Review recent logs for crashes
4. Check database connection
5. Restart affected services

---

## Debugging Checklist

Use this checklist when debugging TTS issues:

- [ ] API server is running and healthy
- [ ] ElectricSQL container is running and healthy
- [ ] Database connection count < 80
- [ ] Worker is registered (check logs)
- [ ] Voice settings exist (global or project)
- [ ] SSE stream is delivering events
- [ ] Jobs are being processed (not stuck)
- [ ] Audio files are being created
- [ ] CLI can connect to SSE stream
- [ ] Audio plays in CLI

**If all checked:** TTS system is working correctly

**If any unchecked:** Focus on that area using steps above
