# TTS/Audio Troubleshooting Guide

This document provides solutions for specific TTS/audio problems.

---

## Problem 1: Connection Exhaustion

### Symptoms

- `psql: FATAL: sorry, too many clients already`
- API server can't process requests
- Audio generation hangs
- CLI commands timeout

### Root Cause

- Database connection pool exhausted (typically > 100 connections)
- Long-running SSE streams not releasing connections
- ElectricSQL replication holding connections
- Duplicate API servers running

### Solution

#### Step 1: Restart Services

```bash
# 1. Restart Docker services (postgres + electric)
docker compose restart postgres electric

# 2. Kill duplicate API servers
lsof -i :3000 2>/dev/null | grep LISTEN | awk '{print $2}' | xargs kill

# 3. Start fresh API server
cd apps/api && bun --hot src/index.ts
```

#### Step 2: Verify Fix

```bash
# Check connection count is back to normal
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';"
```

**Expected:** < 50 connections

#### Step 3: Monitor for Leaks

```bash
# Watch connection count over time
watch -n 5 "psql \"$DATABASE_URL\" -c \"SELECT count(*), state FROM pg_stat_activity WHERE datname = 'agios_dev' GROUP BY state;\""
```

**If connections keep growing:** Connection leak in code (check ElectricSQL streams, Drizzle pool config)

---

## Problem 2: Worker Not Registered

### Symptoms

- Jobs queued but never processed
- No audio files generated
- No "✅ Worker registered for job: generate-audio" in logs

### Root Cause

- Worker registration code not called on startup
- Worker file has syntax error
- Worker import missing from `index.ts`

### Solution

#### Step 1: Verify Worker File Exists

```bash
ls -lh apps/api/src/workers/generate-audio.ts
```

**Expected:** File exists with `registerGenerateAudioWorker()` function

#### Step 2: Check API Startup Code

```bash
grep -n "registerGenerateAudioWorker" apps/api/src/index.ts
```

**Expected:** Import and call present:
```typescript
import { registerGenerateAudioWorker } from './workers/generate-audio';
// ...
await jobQueue.start();
await registerGenerateAudioWorker(); // ← This line must exist
```

**If missing:** Add worker registration to `apps/api/src/index.ts`

#### Step 3: Restart API Server

```bash
cd apps/api && bun --hot src/index.ts
```

**Verify in logs:**
```
✅ Worker registered for job: generate-audio
✅ Generate Audio worker registered
```

---

## Problem 3: Job Queue Stuck

### Symptoms

- Jobs stay in "active" or "created" state
- No progress on audio generation
- Queue appears frozen

### Root Cause

- pg-boss not polling for jobs
- Database connection issues
- Worker crashed but job still locked

### Solution

#### Step 1: Check Queue Status

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT name, state, count(*) FROM pgboss.job WHERE name = 'generate-audio' GROUP BY name, state;"
```

**Problem indicators:**
- Many jobs in "active" state for > 5 minutes → Worker crashed
- Jobs stuck in "created" → Worker not picking them up

#### Step 2: Clear Stuck Jobs

```bash
# Mark stuck jobs as failed (they'll retry)
psql "$DATABASE_URL" -c "UPDATE pgboss.job SET state = 'failed', completed_on = NOW() WHERE name = 'generate-audio' AND state = 'active' AND started_on < NOW() - INTERVAL '5 minutes';"
```

#### Step 3: Restart API Server

```bash
pkill -f "bun.*api"
cd apps/api && bun --hot src/index.ts
```

---

## Problem 3.5: Failed Jobs Accumulating

**Important:** Failed jobs do **NOT** block the queue. pg-boss continues processing new jobs even when there are failed jobs. However, failed jobs accumulate in the database and should be cleaned up periodically.

### Symptoms

- Hundreds or thousands of failed jobs in database
- Database bloat from old job records
- Difficulty monitoring recent job failures

### Understanding pg-boss Retry Behavior

- Each job has `retryLimit: 3` (configured in `queue.ts:181`)
- Failed jobs are automatically retried up to 3 times with 5-second delays
- After 3 failed attempts, jobs move to permanent 'failed' state
- Failed jobs stay in database until manually cleaned or auto-archived (after 7 days)

### Check Failed Job Count

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"

# Count failed jobs by retry attempts
psql "$DATABASE_URL" -c "SELECT state, retry_count, COUNT(*) FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed' GROUP BY state, retry_count ORDER BY retry_count;"
```

**Expected output when jobs have exhausted retries:**
```
state  | retry_count | count
-------+-------------+-------
failed |           3 |   430
```

### Flush Failed Jobs

```bash
# Option 1: Delete all failed audio jobs
psql "$DATABASE_URL" -c "WITH deleted AS (DELETE FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed' RETURNING id) SELECT COUNT(*) FROM deleted;"

# Option 2: Delete failed jobs older than 1 day
psql "$DATABASE_URL" -c "WITH deleted AS (DELETE FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed' AND created_on < NOW() - INTERVAL '1 day' RETURNING id) SELECT COUNT(*) FROM deleted;"

# Option 3: Delete only jobs that exhausted all retries
psql "$DATABASE_URL" -c "WITH deleted AS (DELETE FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed' AND retry_count >= 3 RETURNING id) SELECT COUNT(*) FROM deleted;"
```

### When to Flush Failed Jobs

- After fixing the root cause (e.g., missing voice settings)
- When investigating recent failures (old failures add noise)
- Database cleanup/maintenance

### Important Notes

- **Do NOT delete failed jobs if you're still investigating the root cause** - you'll lose error messages
- Failed jobs don't prevent new jobs from processing - the queue works fine
- pg-boss auto-archives completed/failed jobs after 7 days (`archiveCompletedAfterSeconds` in `queue.ts:88`)

---

## Problem 4: ElectricSQL Stream Disconnected (PRIMARY ROOT CAUSE)

**⚠️ This is the most common TTS failure mode.** SSE stops delivering events.

### Symptoms

- Audio events not reaching CLI
- SSE connection drops
- No real-time updates
- `listen` command shows "connected" but no events appear

### Root Cause

- ElectricSQL shape stream stalls after long runtime
- Database replication lag causes stream disconnects
- Connection pool exhaustion in ElectricSQL
- Network timeouts

### Solution

#### Step 1: Check ElectricSQL Container Status

```bash
docker ps | grep electric
```

**Expected:** `Up X hours (healthy)`

**If unhealthy/missing:**
```bash
docker compose restart electric
sleep 10  # Wait for reconnection to Postgres
```

#### Step 2: Test SSE Stream Delivery (Critical Test)

```bash
echo "Testing SSE event delivery..."

# Start SSE listener
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-integration-test.log 2>&1 &
SSE_PID=$!
sleep 2

# Create test event in database
TEST_SESSION="sse-test-$(date +%s)"
curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}" \
  > /dev/null 2>&1

echo "Waiting 3 seconds for event to stream..."
sleep 3

# Kill SSE listener
kill $SSE_PID 2>/dev/null || true

# Check if event was delivered via SSE
if grep -q "$TEST_SESSION" /tmp/sse-integration-test.log; then
  echo "✅ SSE streaming events correctly"
  rm /tmp/sse-integration-test.log
  exit 0
else
  echo "❌ SSE NOT streaming events - ElectricSQL stream is stalled"
  echo ""
  echo "SSE log contents:"
  cat /tmp/sse-integration-test.log
  echo ""
  echo "🔧 SOLUTION: Restart ElectricSQL"
  echo "   docker compose restart electric"
  rm /tmp/sse-integration-test.log
  exit 1
fi
```

**Expected:** Test event appears in SSE stream within 3 seconds

**If fails:**
```bash
# Restart ElectricSQL
docker compose restart electric
sleep 10

# Verify ElectricSQL reconnected to Postgres
docker logs agios-electric --tail 10 | grep "Connected to Postgres"
# Should show: "Connected to Postgres <id> and timeline 1"

# Re-run the SSE test above to confirm fix
```

#### Step 3: Test CLI Listen Command

```bash
echo "Testing CLI listen command..."

# Start listen in background
cd apps/cli
bun src/index.ts listen --all-projects > /tmp/cli-listen-test.log 2>&1 &
CLI_PID=$!
sleep 5

# Trigger a test event
TEST_SESSION="cli-test-$(date +%s)"
curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"0ebfac28-1680-4ec1-a587-836660140055\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {\"prompt\": \"test\"}}" \
  > /dev/null 2>&1

echo "Waiting 5 seconds for CLI to process..."
sleep 5

# Kill CLI
kill $CLI_PID 2>/dev/null || true

# Check if CLI received the event
if grep -q "New event: UserPromptSubmit" /tmp/cli-listen-test.log; then
  echo "✅ CLI listen command receiving events"
  rm /tmp/cli-listen-test.log
else
  echo "❌ CLI NOT receiving events"
  echo ""
  echo "CLI log:"
  cat /tmp/cli-listen-test.log
  rm /tmp/cli-listen-test.log
  exit 1
fi
```

#### Step 4: Check ElectricSQL Logs for Errors

```bash
docker logs agios-electric --tail 50 | grep -E "error|ERROR|warn|WARN"
```

**Look for:**
- Connection errors to Postgres
- Database replication lag messages
- Shape stream errors
- Timeout warnings

**Common log patterns:**

**✅ Healthy startup:**
```
Connected to Postgres 7561314229015740450 and timeline 1
Consumers ready in 12ms (9 shapes, 0 failed to recover)
Starting replication from postgres
```

**❌ Unhealthy - needs restart:**
```
Failed to connect to the database
Replication stream disconnected
Shape consumer crashed
```

---

## Problem 5: Audio Files Not Generated

### Symptoms

- Jobs complete successfully
- No audio files in `public/cdn/audio/`
- Database shows cached URL but file missing

### Root Cause

- Filesystem permissions
- ElevenLabs API failure
- Invalid voice configuration

### Solution

#### Step 1: Check Directory Permissions

```bash
ls -ld public/cdn/audio
```

**Expected:** `drwxr-xr-x` (readable/writable)

**If missing:**
```bash
mkdir -p public/cdn/audio
chmod 755 public/cdn/audio
```

#### Step 2: Test ElevenLabs API

```bash
# Check if API key is set
grep ELEVENLABS_API_KEY .env
```

**Expected:** Key present and valid

#### Step 3: Check Worker Logs

```bash
# Look for error messages in API logs
# Worker should log:
# 🔨 Processing job generate-audio:...
# ✅ Completed job generate-audio:...
```

**If errors:** Check ElevenLabs API quota, voice ID validity

---

## Problem 6: Missing Voice Settings (Global/Project)

### Symptoms

- Audio generation jobs fail with error: `Voice not found: {voice-id}`
- Hundreds of failed jobs in pg-boss queue
- Worker logs show voice lookup failing at `generate-audio.ts:73`
- Error pattern: `error: Voice not found: 54a09240-2ace-40ea-9c1c-860e47a73f73`

### Root Cause

- `global_voice_settings` table is empty - no default voices configured
- Audio service falls back to non-existent voice IDs when settings missing
- Jobs get queued with invalid voice IDs that don't exist in `voices` table

### Solution

#### Step 1: Check Global Voice Settings

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
psql "$DATABASE_URL" -c "SELECT * FROM global_voice_settings;"
```

**Expected:** At least one row with `user_voice_id` and `assistant_voice_id`

**If empty (0 rows):** No default voices configured → Continue to Step 2

#### Step 2: List Available Voices

```bash
psql "$DATABASE_URL" -c "SELECT id, name, provider FROM voices ORDER BY name LIMIT 10;"
```

**Expected:** List of available voices from ElevenLabs or other providers

**Example output:**
```
                  id                  |  name   |  provider
--------------------------------------+---------+------------
 d88961c3-a58d-4ef5-8cf8-2daba063ceb3 | Brian   | elevenlabs
 3f11e33e-ebba-4196-9bd0-cee4634093e3 | Daniel  | elevenlabs
 83006c95-dc5a-4b62-93d8-09d516b6b514 | Sarah   | elevenlabs
```

#### Step 3: Create Global Voice Settings

```bash
# Insert default voice settings (Sarah for user, Brian for assistant)
psql "$DATABASE_URL" -c "
INSERT INTO global_voice_settings (user_voice_id, assistant_voice_id)
VALUES (
  (SELECT id FROM voices WHERE name = 'Sarah' LIMIT 1),
  (SELECT id FROM voices WHERE name = 'Brian' LIMIT 1)
)
RETURNING id, user_voice_id, assistant_voice_id;"
```

**Expected:** Returns the created settings with IDs

**Note:** Choose voices that match your preferences. Common choices:
- User voice: Sarah, Alice, Emily (female voices)
- Assistant voice: Brian, Daniel, Liam (male voices)

#### Step 4: Clear Failed Jobs

```bash
# Check how many failed jobs exist
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed';"

# Delete all failed audio jobs (they'll be regenerated with correct voices)
psql "$DATABASE_URL" -c "DELETE FROM pgboss.job WHERE name = 'generate-audio' AND state = 'failed';"
```

**Expected:** Shows count of deleted jobs (could be hundreds if issue persisted)

#### Step 5: Verify Fix

```bash
# Test audio generation with a recent event
EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

if [ -n "$EVENT_ID" ]; then
  curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq
fi
```

**Expected:**
- Status 202: `{"status": "generating", "jobId": "..."}` (first time)
- Status 200: `{"status": "ready", "url": "/cdn/audio/..."}` (if cached)

**If still fails:** Check that the selected voices exist in the `voices` table and have valid `external_id` values for the TTS provider

#### Optional: Set Project-Specific Voices

If you want different voices for specific projects:

```bash
# Get project ID
PROJECT_ID="your-project-id"

# Set project voices (overrides global settings for this project)
psql "$DATABASE_URL" -c "
INSERT INTO project_voice_settings (project_id, user_voice_id, assistant_voice_id)
VALUES (
  '$PROJECT_ID',
  (SELECT id FROM voices WHERE name = 'Alice' LIMIT 1),
  (SELECT id FROM voices WHERE name = 'Daniel' LIMIT 1)
)
RETURNING *;"
```

**Priority order:** Project settings > Global settings

---

## Restart Services

<a name="restart-services"></a>

### Full System Restart (Nuclear Option)

If nothing else works, do a complete restart:

```bash
# 1. Stop everything
pkill -f "bun.*api"
pkill -f "bun.*cli"
docker compose down

# 2. Wait for clean shutdown
sleep 5

# 3. Start Docker services
docker compose up -d

# 4. Wait for healthy status
sleep 10
docker compose ps

# 5. Start API server
cd apps/api && bun --hot src/index.ts &

# 6. Wait for startup
sleep 5

# 7. Verify health
curl -s http://localhost:3000/health | jq

# 8. Test audio generation
cd apps/cli && bun src/index.ts listen
```

---

## Common Gotchas

### Multiple API Servers Running

**Problem:** Multiple `bun --hot src/index.ts` processes on port 3000

**How to detect:**
```bash
lsof -i :3000 | grep LISTEN
```

**Fix:** Kill all and start one:
```bash
pkill -f "bun.*api"
cd apps/api && bun --hot src/index.ts
```

---

### Wrong Database URL

**Problem:** Connecting to wrong database (port 5432 vs 5439)

**How to detect:**
```bash
grep DATABASE_URL .env
```

**Expected:** `postgresql://postgres:postgres@localhost:5439/agios_dev`

---

### ElectricSQL Using Wrong Port

**Problem:** ElectricSQL configured for wrong PostgreSQL port

**How to detect:**
```bash
docker compose config | grep ELECTRIC
```

**Fix:** Check `docker-compose.yml` matches `.env` port

---

### File Permissions on public/cdn/audio/

**Problem:** API can't write audio files

**How to detect:**
```bash
ls -ld public/cdn/audio
```

**Fix:**
```bash
mkdir -p public/cdn/audio
chmod 755 public/cdn/audio
```

---

## Escalation Path

If you've tried everything and audio still doesn't work:

### 1. Check Recent Changes

```bash
git log --oneline -10 -- apps/api/src/workers/generate-audio.ts
```

### 2. Review Recent Migrations

```bash
ls -lt packages/db/migrations/ | head -5
```

### 3. Check ElevenLabs Status

- Visit https://status.elevenlabs.io
- Check API quota in ElevenLabs dashboard

### 4. Check System Resources

```bash
df -h  # Disk space
free -h  # Memory (Linux)
```

### 5. Create Support Issue

Collect and provide:
- API logs
- CLI logs
- Docker logs (postgres, electric)
- Connection counts
- Job queue states
- Error messages
