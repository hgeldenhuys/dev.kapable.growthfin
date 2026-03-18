# TTS/Audio Debugging Examples

This document provides real-world examples of debugging TTS/audio issues.

---

## Example 1: Audio Stopped Working After System Restart

### Initial Symptoms

```bash
$ cd apps/cli && bun src/index.ts listen
✅ Connected to SSE stream
✅ Listening for events from all projects...

# Events appear but no audio plays
New event: UserPromptSubmit
New event: Stop
# ... silence ...
```

### Investigation

**Step 1: Check API health**

```bash
$ curl -s http://localhost:3000/health | jq
{
  "status": "ok",
  "timestamp": "2025-11-07T10:30:00Z",
  "uptime": 45.2
}
```

✅ API is healthy

**Step 2: Test audio generation**

```bash
$ export DATABASE_URL="postgresql://postgres:postgres@localhost:5439/agios_dev"
$ EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq

{
  "status": "generating",
  "jobId": "abc-123-def"
}
```

Job was queued... but does it complete?

**Step 3: Check job queue**

```bash
$ psql "$DATABASE_URL" -c "SELECT name, state, count(*) FROM pgboss.job WHERE name = 'generate-audio' GROUP BY name, state;"

      name       | state  | count
-----------------+--------+-------
 generate-audio  | active |    15
```

❌ 15 jobs stuck in "active" state! Worker is not processing them.

**Step 4: Check worker registration**

```bash
$ grep "Worker registered" apps/api/logs/app.log | tail -5
# ... nothing recent ...
```

❌ Worker not registered after restart

### Root Cause

Worker registration code was not called on API startup after system restart.

### Solution

```bash
# Check if worker registration is in index.ts
$ grep "registerGenerateAudioWorker" apps/api/src/index.ts
# ... not found ...

# Add worker registration
# Edit apps/api/src/index.ts and add:
import { registerGenerateAudioWorker } from './workers/generate-audio';
// ...
await jobQueue.start();
await registerGenerateAudioWorker(); // Add this line

# Restart API
$ pkill -f "bun.*api"
$ cd apps/api && bun --hot src/index.ts

# Wait for logs
# ✅ Worker registered for job: generate-audio
# ✅ Generate Audio worker registered
```

**Verify fix:**

```bash
$ psql "$DATABASE_URL" -c "SELECT name, state, count(*) FROM pgboss.job WHERE name = 'generate-audio' GROUP BY name, state;"

      name       |   state   | count
-----------------+-----------+-------
 generate-audio  | completed |    12
 generate-audio  | active    |     3
```

✅ Jobs are now processing!

**Test CLI again:**

```bash
$ cd apps/cli && bun src/index.ts listen
✅ Connected to SSE stream
✅ Listening for events from all projects...
New event: UserPromptSubmit
🔊 Playing audio: /cdn/audio/abc123.mp3
```

✅ Audio working!

---

## Example 2: Hundreds of Failed Jobs

### Initial Symptoms

```bash
$ psql "$DATABASE_URL" -c "SELECT state, count(*) FROM pgboss.job WHERE name = 'generate-audio' GROUP BY state;"

  state  | count
---------+-------
 failed  |   430
 active  |     2
```

430 failed jobs! What's going on?

### Investigation

**Step 1: Check error messages**

```bash
$ psql "$DATABASE_URL" -c "
SELECT output
FROM pgboss.job
WHERE name = 'generate-audio' AND state = 'failed'
ORDER BY created_on DESC
LIMIT 3;
" | grep error

error: Voice not found: 54a09240-2ace-40ea-9c1c-860e47a73f73
error: Voice not found: 54a09240-2ace-40ea-9c1c-860e47a73f73
error: Voice not found: 54a09240-2ace-40ea-9c1c-860e47a73f73
```

❌ Voice not found errors - all the same voice ID!

**Step 2: Check voice settings**

```bash
$ psql "$DATABASE_URL" -c "SELECT * FROM global_voice_settings;"
 id | user_voice_id | assistant_voice_id | created_at | updated_at
----+---------------+--------------------+------------+------------
(0 rows)
```

❌ No global voice settings!

**Step 3: Check available voices**

```bash
$ psql "$DATABASE_URL" -c "SELECT id, name, provider FROM voices ORDER BY name LIMIT 5;"

                  id                  |  name  |  provider
--------------------------------------+--------+------------
 d88961c3-a58d-4ef5-8cf8-2daba063ceb3 | Brian  | elevenlabs
 3f11e33e-ebba-4196-9bd0-cee4634093e3 | Daniel | elevenlabs
 83006c95-dc5a-4b62-93d8-09d516b6b514 | Sarah  | elevenlabs
```

✅ Voices exist in database

### Root Cause

Global voice settings were never configured. Audio service was falling back to a hardcoded voice ID that doesn't exist.

### Solution

**Step 1: Create global voice settings**

```bash
$ psql "$DATABASE_URL" -c "
INSERT INTO global_voice_settings (user_voice_id, assistant_voice_id)
VALUES (
  (SELECT id FROM voices WHERE name = 'Sarah' LIMIT 1),
  (SELECT id FROM voices WHERE name = 'Brian' LIMIT 1)
)
RETURNING id, user_voice_id, assistant_voice_id;
"

                  id                  |            user_voice_id             |         assistant_voice_id
--------------------------------------+--------------------------------------+--------------------------------------
 7e3f8d9a-1234-5678-9012-3456789abcde | 83006c95-dc5a-4b62-93d8-09d516b6b514 | d88961c3-a58d-4ef5-8cf8-2daba063ceb3
```

✅ Settings created

**Step 2: Clear failed jobs**

```bash
$ psql "$DATABASE_URL" -c "
WITH deleted AS (
  DELETE FROM pgboss.job
  WHERE name = 'generate-audio' AND state = 'failed'
  RETURNING id
)
SELECT COUNT(*) as deleted_count FROM deleted;
"

 deleted_count
---------------
           430
```

✅ Failed jobs cleared

**Step 3: Test audio generation**

```bash
$ EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM hook_events WHERE event_name = 'Stop' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq

{
  "status": "generating",
  "jobId": "new-job-id"
}
```

**Step 4: Wait and check job completion**

```bash
$ sleep 5
$ psql "$DATABASE_URL" -c "SELECT state, count(*) FROM pgboss.job WHERE name = 'generate-audio' GROUP BY state;"

   state   | count
-----------+-------
 completed |     1
```

✅ Job completed successfully!

**Step 5: Verify audio file created**

```bash
$ ls -lh public/cdn/audio/ | tail -1
-rw-r--r--  1 user  staff   187K Nov  7 10:45 a1b2c3d4e5f6.mp3
```

✅ Audio file generated!

---

## Example 3: CLI Not Receiving Events

### Initial Symptoms

```bash
$ cd apps/cli && bun src/index.ts listen
✅ Connected to SSE stream
✅ Listening for events from all projects...

# ... nothing happens, no events ...
```

CLI says it's connected but no events appear, even though API is receiving events.

### Investigation

**Step 1: Test SSE stream directly**

```bash
$ curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-test.log 2>&1 &
$ SSE_PID=$!
$ sleep 2

$ TEST_SESSION="sse-test-$(date +%s)"
$ curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}"

$ sleep 3
$ kill $SSE_PID 2>/dev/null

$ grep "$TEST_SESSION" /tmp/sse-test.log
# ... no results ...
```

❌ SSE stream is NOT delivering events!

**Step 2: Check ElectricSQL status**

```bash
$ docker ps | grep electric
agios-electric   Up 2 days   3001/tcp
```

✅ Container is running

**Step 3: Check ElectricSQL logs**

```bash
$ docker logs agios-electric --tail 20
2025-11-07T10:30:15Z [error] Shape consumer crashed for table: hook_events
2025-11-07T10:30:15Z [warn] Replication stream disconnected
2025-11-07T10:30:16Z [info] Attempting to reconnect...
2025-11-07T10:30:16Z [error] Failed to reconnect: connection timeout
```

❌ ElectricSQL shape consumer crashed and can't reconnect!

### Root Cause

ElectricSQL shape stream crashed after running for 2 days. This is a known issue with long-running streams.

### Solution

**Step 1: Restart ElectricSQL**

```bash
$ docker compose restart electric
Restarting agios-electric ... done

$ sleep 10

$ docker logs agios-electric --tail 10
2025-11-07T10:32:01Z [info] Starting ElectricSQL...
2025-11-07T10:32:01Z [info] Connected to Postgres 7561314229015740450 and timeline 1
2025-11-07T10:32:02Z [info] Consumers ready in 12ms (9 shapes, 0 failed to recover)
2025-11-07T10:32:02Z [info] Starting replication from postgres
2025-11-07T10:32:02Z [info] Replication started successfully
```

✅ ElectricSQL reconnected

**Step 2: Re-test SSE stream**

```bash
$ curl -N "http://localhost:3000/api/v1/stream?table=hook_events" > /tmp/sse-test2.log 2>&1 &
$ SSE_PID=$!
$ sleep 2

$ TEST_SESSION="sse-test-$(date +%s)"
$ curl -X POST http://localhost:3000/api/v1/hook-events \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"test\", \"sessionId\": \"$TEST_SESSION\", \"eventName\": \"UserPromptSubmit\", \"payload\": {}}"

$ sleep 3
$ kill $SSE_PID 2>/dev/null

$ grep "$TEST_SESSION" /tmp/sse-test2.log
data: {"id":"...","sessionId":"sse-test-1699363945",...}
```

✅ SSE stream now working!

**Step 3: Test CLI**

```bash
$ cd apps/cli && bun src/index.ts listen
✅ Connected to SSE stream
✅ Listening for events from all projects...
New event: UserPromptSubmit
🔊 Playing audio: /cdn/audio/abc123.mp3
```

✅ CLI now receiving events and playing audio!

---

## Example 4: Database Connection Exhaustion

### Initial Symptoms

```bash
$ curl -s http://localhost:3000/health
curl: (52) Empty reply from server

$ psql "$DATABASE_URL" -c "SELECT 1;"
psql: FATAL: sorry, too many clients already
```

Both API and database connections are failing!

### Investigation

**Step 1: Check PostgreSQL connection count**

```bash
# Connect using postgres superuser to bypass limit
$ psql "postgresql://postgres:postgres@localhost:5439/postgres" -c "
SELECT count(*) as total_connections, datname
FROM pg_stat_activity
GROUP BY datname
ORDER BY count DESC;
"

 total_connections | datname
-------------------+----------
               102 | agios_dev
                 3 | postgres
```

❌ 102 connections to agios_dev! (Max is 100)

**Step 2: Identify connection sources**

```bash
$ psql "postgresql://postgres:postgres@localhost:5439/postgres" -c "
SELECT application_name, count(*), state
FROM pg_stat_activity
WHERE datname = 'agios_dev'
GROUP BY application_name, state
ORDER BY count DESC;
"

 application_name | count | state
------------------+-------+--------
 drizzle          |    45 | idle
 drizzle          |    38 | idle
 pg-boss          |    12 | idle
 psql             |     5 | active
 electric         |     2 | active
```

❌ Two groups of "drizzle" connections! Multiple API servers running!

**Step 3: Check running processes**

```bash
$ lsof -i :3000 | grep LISTEN
node    12345 user   23u  IPv4 0x1234567890      0t0  TCP *:3000 (LISTEN)
node    23456 user   23u  IPv4 0x2345678901      0t0  TCP *:3000 (LISTEN)
```

❌ Two API servers on port 3000!

### Root Cause

Two API server processes were running (possibly from a failed restart), each holding 40+ database connections. Combined with other services, this exhausted the connection pool.

### Solution

**Step 1: Kill all API servers**

```bash
$ pkill -f "bun.*api"
```

**Step 2: Wait for connections to close**

```bash
$ sleep 5

$ psql "postgresql://postgres:postgres@localhost:5439/postgres" -c "
SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';
"

 count
-------
    14
```

✅ Connections dropped to 14 (just ElectricSQL + pg-boss)

**Step 3: Restart Docker services**

```bash
$ docker compose restart postgres electric
```

**Step 4: Start single API server**

```bash
$ cd apps/api && bun --hot src/index.ts &
$ sleep 5
```

**Step 5: Verify connection count**

```bash
$ psql "$DATABASE_URL" -c "
SELECT application_name, count(*), state
FROM pg_stat_activity
WHERE datname = 'agios_dev'
GROUP BY application_name, state;
"

 application_name | count | state
------------------+-------+--------
 drizzle          |    12 | idle
 drizzle          |     2 | active
 pg-boss          |     5 | idle
 electric         |     2 | active
```

✅ Connection count healthy (21 total)

**Step 6: Test API**

```bash
$ curl -s http://localhost:3000/health | jq
{
  "status": "ok",
  "timestamp": "2025-11-07T11:00:00Z",
  "uptime": 5.2
}
```

✅ API working!

---

## Example 5: Audio Files Not Appearing

### Initial Symptoms

```bash
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq
{
  "status": "generating",
  "jobId": "abc-123"
}

$ sleep 5

$ psql "$DATABASE_URL" -c "SELECT state FROM pgboss.job WHERE id = 'abc-123';"
  state
-----------
 completed
```

Job completed but no audio file!

### Investigation

**Step 1: Check audio cache**

```bash
$ psql "$DATABASE_URL" -c "
SELECT audio_url FROM audio_cache WHERE hook_event_id = '$EVENT_ID';
"

     audio_url
--------------------
 /cdn/audio/xyz789.mp3
```

✅ Database has the URL

**Step 2: Check if file exists**

```bash
$ ls -lh public/cdn/audio/xyz789.mp3
ls: public/cdn/audio/xyz789.mp3: No such file or directory
```

❌ File doesn't exist!

**Step 3: Check worker logs**

```bash
$ grep "xyz789" apps/api/logs/app.log
2025-11-07T11:05:00Z [info] 🔨 Processing job generate-audio:abc-123
2025-11-07T11:05:02Z [info] Received audio from ElevenLabs (187KB)
2025-11-07T11:05:02Z [error] Error writing audio file: EACCES: permission denied, open 'public/cdn/audio/xyz789.mp3'
2025-11-07T11:05:02Z [info] ✅ Completed job generate-audio:abc-123
```

❌ Permission denied writing file! (But job marked as completed anyway - bug!)

**Step 4: Check directory permissions**

```bash
$ ls -ld public/cdn/audio
drwxr-x---  2 root  staff  64 Nov  7 11:00 public/cdn/audio
```

❌ Directory owned by root, not writable by current user

### Root Cause

The `public/cdn/audio/` directory was created by a Docker volume or previous process running as root. Worker can't write files.

### Solution

**Step 1: Fix directory permissions**

```bash
$ sudo chown -R $USER:staff public/cdn/audio
$ chmod 755 public/cdn/audio
```

**Step 2: Verify permissions**

```bash
$ ls -ld public/cdn/audio
drwxr-xr-x  2 user  staff  64 Nov  7 11:10 public/cdn/audio
```

✅ Directory now writable

**Step 3: Requeue the job**

Since the job is marked "completed" but failed, we need to regenerate:

```bash
# Delete the broken cache entry
$ psql "$DATABASE_URL" -c "DELETE FROM audio_cache WHERE hook_event_id = '$EVENT_ID';"

# Request audio again
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID" | jq
{
  "status": "generating",
  "jobId": "new-job-id"
}

$ sleep 5

# Check file
$ ls -lh public/cdn/audio/ | tail -1
-rw-r--r--  1 user  staff   187K Nov  7 11:12 xyz789.mp3
```

✅ File created successfully!

---

## Example 6: Gradual Performance Degradation

### Initial Symptoms

```bash
# Day 1: Everything works great
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID"
# Response in 100ms

# Day 2: Slight slowdown
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID"
# Response in 500ms

# Day 3: Very slow
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID"
# Response in 5000ms

# Day 4: Timeouts
$ curl -s "http://localhost:3000/api/v1/speak/$EVENT_ID"
curl: (52) Empty reply from server
```

System gradually slowed down over 4 days, then crashed.

### Investigation

**Step 1: Check connection count over time**

```bash
$ psql "$DATABASE_URL" -c "
SELECT count(*), state
FROM pg_stat_activity
WHERE datname = 'agios_dev'
GROUP BY state;
"

 count | state
-------+--------
     5 | active
    78 | idle
```

78 idle connections! Growing slowly over time.

**Step 2: Check connection age**

```bash
$ psql "$DATABASE_URL" -c "
SELECT application_name, count(*), MAX(NOW() - backend_start) as oldest_connection
FROM pg_stat_activity
WHERE datname = 'agios_dev' AND state = 'idle'
GROUP BY application_name;
"

 application_name | count | oldest_connection
------------------+-------+-------------------
 drizzle          |    68 | 3 days 14:23:45
 electric         |     8 | 4 days 02:15:30
 pg-boss          |     2 | 2 days 08:45:12
```

❌ Connections staying open for days! Connection leak.

### Root Cause

ElectricSQL was accumulating connections over time without releasing them. Long-running SSE connections were holding database connections open indefinitely.

### Solution

**Step 1: Restart ElectricSQL**

```bash
$ docker compose restart electric
$ sleep 10
```

**Step 2: Check connection count**

```bash
$ psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';"

 count
-------
    22
```

✅ Connections dropped dramatically

**Step 3: Monitor over time**

```bash
# Watch connection count for 5 minutes
$ for i in {1..10}; do
  psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agios_dev';"
  sleep 30
done

22
23
23
23
24
24
24
24
25
25
```

✅ Connection count stable (growing slowly but not leaking)

**Step 4: Schedule periodic restarts**

To prevent future issues, schedule ElectricSQL restarts:

```bash
# Add to crontab
# Restart ElectricSQL every night at 3 AM
0 3 * * * docker compose restart electric
```

---

## Lessons Learned

### Pattern Recognition

1. **Connection Exhaustion** → Look for duplicate processes
2. **Missing Voice Settings** → Check global settings first
3. **ElectricSQL Issues** → Restart is usually the fix
4. **Worker Not Running** → Check logs for registration
5. **Permission Issues** → Check directory ownership
6. **Gradual Degradation** → Monitor connection age

### Quick Wins

- Always check API health first
- SSE stream test reveals 90% of issues
- Connection count is a leading indicator
- Worker registration is easy to miss
- Voice settings are a common gotcha

### Prevention

- Monitor connection count regularly
- Schedule ElectricSQL restarts
- Verify worker registration on startup
- Set up voice settings in seed data
- Use proper file permissions from the start
