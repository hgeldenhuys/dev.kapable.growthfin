---
name: debugging-realtime-streaming
description: Systematic troubleshooting for real-time streaming (SSE/ElectricSQL) when events aren't reaching clients. Covers service health, storage errors, and connection issues.
tags: [debugging, streaming, sse, electricsql, realtime]
scope: project
gitignored: true
---

# Debugging Real-Time Streaming

## When to Use This Skill

Use when real-time updates aren't reaching clients:
- CLI `listen` command connects but shows no events
- Web UI hooks page not updating
- SSE connections established but no data streams
- Events exist in database but clients don't receive them

**Symptoms:**
- ✅ Hooks creating database events
- ✅ SSE connection established (`: connected to...`)
- ❌ No events streaming to clients
- ❌ CLI/UI stuck with "Waiting for events..."

## 🚨 CRITICAL: Check Services FIRST

**Always start here** (< 2 minutes):

```bash
# Step 1: Check all services running
docker ps | grep -E "postgres|electric|redis"

# Step 2: Check ElectricSQL health
curl http://localhost:3001/health 2>&1

# Step 3: Check ElectricSQL logs for errors
docker logs agios-electric --tail 50 | grep -E "error|fatal|enoent"
```

**Common ElectricSQL errors:**
- `Could not open chunk index file: :enoent` → Storage corruption
- `Not found` → Table not in publication or storage corrupt
- Connection refused → Service not running

## Quick Fix: ElectricSQL Storage Corruption

**Symptom**: ElectricSQL logs show `:enoent` or "chunk index file" errors

**Fix** (< 10 seconds):
```bash
docker restart agios-electric
```

**Verify** (wait 5 seconds):
```bash
# Should return table data, not "Not found"
curl "http://localhost:3001/v1/shape?table=hook_events&offset=-1" 2>&1 | head -3
```

## Diagnostic Checklist

### 1. Service Health (< 2 minutes)

```bash
# Check docker services
docker ps | grep -E "postgres|electric"

# Expected output:
# agios-electric    Up X days (healthy)
# agios-postgres    Up X days (healthy)

# If not running:
docker compose up -d
```

### 2. ElectricSQL Status (< 1 minute)

```bash
# Check logs for errors
docker logs agios-electric --tail 100 | grep -i error

# Check if table is received
docker logs agios-electric | grep "hook_events"
# Should see: "Received relation \"public\".\"hook_events\""

# Test shape endpoint
curl "http://localhost:3001/v1/shape?table=hook_events&offset=-1" --max-time 2
```

**Expected**: JSON array of events
**If "Not found"**: Storage corruption → Restart ElectricSQL

### 3. Database Publications (< 1 minute)

```bash
# Check table is in publication
psql "$DATABASE_URL" -c "
  SELECT pubname, tablename
  FROM pg_publication_tables
  WHERE tablename = 'hook_events';
"

# Expected: electric_publication_default | hook_events
```

**If empty**: Table not published
```sql
ALTER PUBLICATION electric_publication_default
ADD TABLE hook_events;
```

### 4. API Streaming Endpoint (< 1 minute)

```bash
# Test API SSE endpoint
curl -N "http://localhost:3000/api/v1/stream?table=hook_events&where=project_id='YOUR_PROJECT_ID'" --max-time 3

# Expected: ": connected to hook_events at ..."
```

### 5. Database Events (< 30 seconds)

```bash
# Verify events are being created
psql "$DATABASE_URL" -c "
  SELECT event_name, created_at
  FROM hook_events
  ORDER BY created_at DESC
  LIMIT 5;
"
```

**If no events**: Hooks not firing (see `debugging-api-endpoints` skill)
**If events exist**: Streaming issue (continue this skill)

## Step-by-Step Resolution

### Scenario 1: ElectricSQL Storage Corruption

**Symptoms:**
- Logs: `Could not open chunk index file: :enoent`
- Curl returns: `Not found`
- Database has events but streaming fails

**Resolution:**
```bash
# 1. Restart ElectricSQL
docker restart agios-electric

# 2. Wait 5 seconds
sleep 5

# 3. Verify
curl "http://localhost:3001/v1/shape?table=hook_events&offset=-1" | head -3

# 4. Test streaming
curl -N "http://localhost:3000/api/v1/stream?table=hook_events" --max-time 3
```

**Time to fix**: < 10 seconds
**Success rate**: 95%

### Scenario 2: ElectricSQL Not Running

**Symptoms:**
- `docker ps` shows no electric container
- Curl: Connection refused

**Resolution:**
```bash
# Start services
docker compose up -d

# Wait for healthy
sleep 10

# Verify
docker ps | grep electric
curl http://localhost:3001/health
```

### Scenario 3: Wrong Table Name / Publication

**Symptoms:**
- ElectricSQL healthy
- Logs show no errors
- Curl returns valid data for some tables but not others

**Resolution:**
```bash
# Check table exists
psql "$DATABASE_URL" -c "\dt hook_events"

# Check publication
psql "$DATABASE_URL" -c "
  SELECT tablename
  FROM pg_publication_tables
  WHERE pubname = 'electric_publication_default';
"

# Add table if missing
psql "$DATABASE_URL" -c "
  ALTER PUBLICATION electric_publication_default
  ADD TABLE hook_events;
"

# Restart ElectricSQL to pick up changes
docker restart agios-electric
```

## Prevention

### Monitor ElectricSQL Health

Add to monitoring:
```bash
# Check for storage errors daily
docker logs agios-electric --since 24h | grep -i "enoent\|chunk.*error" && \
  echo "⚠️  ElectricSQL storage issues detected - restart needed"
```

### Graceful Degradation

If ElectricSQL keeps failing:
1. Check disk space: `df -h`
2. Check permissions: `docker logs agios-electric --tail 10`
3. Consider clearing storage: `docker compose down -v && docker compose up -d`
   ⚠️  **WARNING**: This clears ALL data!

## Testing After Fix

```bash
# 1. Start CLI listen in background
bun apps/cli/src/index.ts listen &
LISTEN_PID=$!

# 2. Trigger a hook event (e.g., use a tool)
# Watch for events to appear in CLI

# 3. Clean up
kill $LISTEN_PID
```

## Time Investment

| Check | Time | Value |
|-------|------|-------|
| Check services | 1 min | High |
| Check Electric logs | 1 min | High |
| Test Electric endpoint | 30 sec | High |
| Restart Electric | 10 sec | High |
| Check publications | 1 min | Medium |
| Test API endpoint | 1 min | Medium |
| **Total (fast path)** | **< 5 min** | **Very High** |

Compare to previous session: **30 minutes** with wrong approach

## Key Takeaways

1. **Services First, Code Last**
   - 90% of streaming issues = service problems
   - 5% = configuration
   - 5% = code bugs

2. **ElectricSQL Storage is Fragile**
   - Corruption happens
   - Restart is safe and fast
   - Monitor logs proactively

3. **Diagnostic Order Matters**
   ```
   1. Docker ps (10 sec)
   2. ElectricSQL logs (10 sec)
   3. Test endpoint (10 sec)
   4. Restart if needed (10 sec)
   → 40 seconds total
   ```

4. **Don't Skip Health Checks**
   - Reading code won't fix a crashed service
   - Checking database won't fix storage corruption
   - Always check infrastructure first

## Related Skills

- `debugging-api-endpoints` - For hooks not firing
- `.claude/DEBUGGING-RUNBOOK.md` - For hook configuration issues

## Success Criteria

✅ ElectricSQL logs show no errors
✅ `curl` returns JSON data (not "Not found")
✅ CLI `listen` command receives events
✅ Web UI updates in real-time

When all checked: **Problem solved!**
