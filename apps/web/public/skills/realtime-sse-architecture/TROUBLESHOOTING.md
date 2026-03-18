# Troubleshooting Real-Time SSE Routes

Detailed troubleshooting guide for common issues with SSE real-time architecture.

## Problem: Both tabs becoming leaders

**Symptom**: Console logs show multiple tabs announcing leadership

**Root Cause**: Election timeout using time-based check instead of zero check

**Debug Steps**:
```typescript
// Add logging to see what's happening
const electionTimeout = setTimeout(() => {
  console.log('[DEBUG] Election check:', {
    isLeader: isLeaderRef.current,
    heartbeat: leaderHeartbeatRef.current,
    timeDiff: Date.now() - leaderHeartbeatRef.current,
  });

  if (!isLeaderRef.current && leaderHeartbeatRef.current === 0) {
    becomeLeader();
  }
}, 300);
```

**Fix**:
```typescript
// ❌ WRONG - Time-based check
if (Date.now() - leaderHeartbeatRef.current > 250) {
  becomeLeader(); // Triggers even when leader exists!
}

// ✅ CORRECT - Zero check
if (leaderHeartbeatRef.current === 0) {
  becomeLeader(); // Only when no leader announced
}
```

**Verification**:
1. Open 2 tabs
2. Check console logs
3. Should see: Tab 1 "Became leader", Tab 2 "Leader announced, staying as follower"
4. Network tab: Only 1 EventSource connection total

---

## Problem: Infinite "becoming leader" loop

**Symptom**: Tab repeatedly logs "Leader heartbeat timeout, becoming leader" every second

**Root Cause**: Using state instead of ref in interval causes stale closure

**Debug Steps**:
```typescript
// Add logging in interval
const heartbeatMonitor = setInterval(() => {
  console.log('[DEBUG] Heartbeat check:', {
    isLeader: isLeader,           // State - STALE!
    isLeaderRef: isLeaderRef.current, // Ref - CURRENT!
    heartbeat: leaderHeartbeatRef.current,
  });
}, 1000);
```

**Fix**:
```typescript
// ❌ WRONG - State in interval
const [isLeader, setIsLeader] = useState(false);

setInterval(() => {
  if (!isLeader) { // Stale closure! Always old value
    becomeLeader();
  }
}, 1000);

// ✅ CORRECT - Ref for synchronous access
const isLeaderRef = useRef(false);
const [isLeader, setIsLeader] = useState(false);

setInterval(() => {
  if (!isLeaderRef.current) { // Always current value
    becomeLeader();
  }
}, 1000);

// In becomeLeader:
function becomeLeader() {
  isLeaderRef.current = true; // Update ref
  setIsLeader(true);           // Update state for UI
}
```

**Verification**:
1. Open 1 tab
2. Should see "Became leader" once
3. Should NOT see repeated "becoming leader" messages
4. Leader should send heartbeats every 2s

---

## Problem: Multiple SSE connections in React Strict Mode

**Symptom**: Dev console shows duplicate "Setting up connection" logs and 2 EventSource connections in same tab

**Root Cause**: React Strict Mode mounts components twice in development

**Debug Steps**:
```typescript
// Add logging to see double mounting
function setupSharedConnection() {
  console.log('[DEBUG] Setup called:', {
    isSettingUp: isSettingUpRef.current,
    callStack: new Error().stack, // See where called from
  });
  // ...
}
```

**Fix**:
```typescript
// ❌ WRONG - No guard
useEffect(() => {
  setupConnection(); // Runs twice in Strict Mode
}, []);

// ✅ CORRECT - Guard against double setup
const isSettingUpRef = useRef(false);

useEffect(() => {
  if (isSettingUpRef.current) {
    console.log('[DEBUG] Already setting up, skipping');
    return;
  }
  isSettingUpRef.current = true;
  setupConnection();

  return () => {
    cleanup();
    isSettingUpRef.current = false; // Reset for remounting
  };
}, []);
```

**Verification**:
1. Check React version supports Strict Mode (18+)
2. Look for `<React.StrictMode>` in app root
3. Console should show "Already setting up, skipping" on second mount
4. Network tab should show only 1 EventSource connection

---

## Problem: SSE connection closes immediately

**Symptom**: EventSource connection opens then closes within seconds

**Root Cause**: Usually a backend error or CORS issue

**Debug Steps**:
```typescript
eventSource.onerror = (error) => {
  console.error('[DEBUG] SSE error:', {
    error,
    readyState: eventSource.readyState,
    url: eventSource.url,
  });

  // Check readyState
  // 0 = CONNECTING
  // 1 = OPEN
  // 2 = CLOSED
};
```

**Common Causes**:

### 1. Backend not running
```bash
# Check if backend is running
curl http://localhost:3001/api/v1/stream?table=workspaces

# Should NOT get connection refused
```

### 2. CORS configuration
```typescript
// Check backend CORS config allows EventSource
// apps/api/src/config/cors.ts
const corsConfig = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
};
```

### 3. Table not whitelisted
```typescript
// Check ALLOWED_TABLES includes your table
// apps/api/src/routes/stream.ts
const ALLOWED_TABLES = ['workspaces', 'personas', 'claude_sessions'];

// If missing, add your table and restart backend
```

### 4. Invalid WHERE clause
```typescript
// Check WHERE clause is valid SQL
const where = "status='active'"; // ✅ Valid

// Not:
const where = "status=active"; // ❌ Missing quotes
const where = "invalid syntax"; // ❌ Not valid SQL
```

**Fix**: Check backend logs for specific error:
```bash
# Terminal where backend is running
bun dev

# Look for errors like:
# - "Invalid or missing table parameter"
# - "PostgresError: syntax error at..."
# - "CORS error"
```

---

## Problem: Changes don't appear in real-time

**Symptom**: Make a database change but UI doesn't update

**Debug Steps**:
```typescript
// Add logging to see if events arrive
eventSource.onmessage = (event) => {
  console.log('[DEBUG] SSE event received:', event.data);
  queryClient.invalidateQueries({ queryKey });
};

// Check React Query invalidation
queryClient.setQueryDefaults(['projects'], {
  onSuccess: () => console.log('[DEBUG] Query refetched'),
});
```

**Common Causes**:

### 1. ElectricSQL not connected
```bash
# Check ElectricSQL is running and syncing
# Backend logs should show:
# "ElectricSQL shape ready"
```

### 2. Change made before SSE connected
```typescript
// ElectricSQL offset=now means only changes AFTER connection
// If you make a change BEFORE SSE connects, it won't stream

// Workaround: Trigger manual refetch
queryClient.invalidateQueries({ queryKey: ['projects'] });
```

### 3. QueryKey mismatch
```typescript
// ❌ WRONG - Different query keys
// Hook:
useSharedSSE({ queryKey: ['projects'] });

// Component:
useQuery({ queryKey: ['workspaces'] }); // Different!

// ✅ CORRECT - Same query key
useSharedSSE({ queryKey: ['projects'] });
useQuery({ queryKey: ['projects'] }); // Same!
```

### 4. BroadcastChannel not propagating
```typescript
// Check BroadcastChannel is working
channelRef.current?.postMessage({
  type: 'sse-event',
  signature,
});

// In followers, check onmessage fires
channel.onmessage = (event) => {
  console.log('[DEBUG] Follower received:', event.data);
  queryClient.invalidateQueries({ queryKey });
};
```

**Fix**: Verify the full chain:
1. Database change happens
2. ElectricSQL detects change
3. Backend streams SSE event
4. Leader receives event
5. Leader broadcasts to followers
6. All tabs invalidate query
7. React Query refetches
8. UI updates

---

## Problem: MIME type errors

**Symptom**: Console error "Failed to load resource: the server responded with a status of 415 (Unsupported Media Type)" or "EventSource's response has a MIME type that is not text/event-stream"

**Root Cause**: Not using RR7 proxy, trying to connect directly to backend

**Debug Steps**:
```typescript
// Check EventSource URL
console.log('[DEBUG] EventSource URL:', eventSource.url);

// Should be:
// http://localhost:5173/api/stream?table=workspaces

// NOT:
// http://localhost:3001/api/v1/stream?table=workspaces
```

**Fix**:
```typescript
// ❌ WRONG - Direct to backend
const eventSource = new EventSource(
  'http://localhost:3001/api/v1/stream?table=workspaces'
);

// ✅ CORRECT - Through RR7 proxy
const eventSource = new EventSource(
  '/api/stream?table=workspaces'
);

// The proxy at /api/stream ensures proper headers
```

**Verification**:
1. Check `apps/web/app/routes/api.stream.ts` exists
2. Check it returns `Content-Type: text/event-stream` header
3. EventSource URL should be relative (`/api/stream`), not absolute

---

## Problem: Leader doesn't close when tab closes

**Symptom**: Close leader tab, but no new leader is elected

**Root Cause**: `beforeunload` event not firing or BroadcastChannel cleanup not happening

**Debug Steps**:
```typescript
// Add logging to cleanup
function cleanup() {
  console.log('[DEBUG] Cleanup called:', {
    isLeader: isLeaderRef.current,
    hasEventSource: !!eventSourceRef.current,
    hasChannel: !!channelRef.current,
  });

  if (isLeaderRef.current) {
    console.log('[DEBUG] Leader closing, broadcasting');
    channelRef.current?.postMessage({ type: 'leader-closing' });
  }

  // ... rest of cleanup
}
```

**Fix**:
```typescript
// Ensure cleanup runs on unmount
useEffect(() => {
  setupSharedConnection();

  return () => {
    console.log('[DEBUG] Component unmounting');
    cleanup();
  };
}, [signature]);

// For browser close, cleanup happens automatically
// when BroadcastChannel is closed by browser
```

**Verification**:
1. Open 3 tabs
2. Tab 1 is leader
3. Close Tab 1
4. Within 3 seconds, Tab 2 should log "Leader heartbeat timeout, becoming leader"
5. Network tab in Tab 2 should show new EventSource connection

---

## Problem: Performance degradation with many tabs

**Symptom**: Opening 10+ tabs causes UI slowdown

**Root Cause**: Too many BroadcastChannel messages or React Query invalidations

**Debug Steps**:
```typescript
// Measure invalidation frequency
let invalidationCount = 0;
let lastReset = Date.now();

eventSource.onmessage = (event) => {
  invalidationCount++;

  if (Date.now() - lastReset > 10000) {
    console.log('[DEBUG] Invalidations per 10s:', invalidationCount);
    invalidationCount = 0;
    lastReset = Date.now();
  }

  queryClient.invalidateQueries({ queryKey });
};
```

**Optimization**:
```typescript
// Add debouncing to reduce invalidation spam
import { debounce } from 'lodash-es';

const debouncedInvalidate = debounce(() => {
  queryClient.invalidateQueries({ queryKey });
}, 100); // 100ms debounce

eventSource.onmessage = (event) => {
  debouncedInvalidate();
};
```

**Verification**:
- Before: 10 SSE events in 1 second = 10 invalidations
- After: 10 SSE events in 1 second = 1 invalidation (debounced)

---

## Problem: Connection pooling not working

**Symptom**: Multiple tabs show multiple SSE connections instead of 1 shared connection

**Root Cause**: Subscription signatures don't match between tabs

**Debug Steps**:
```typescript
// Log subscription signature in each tab
function getSubscriptionSignature(): string {
  const sig = [
    table,
    where || 'none',
    ids?.sort().join(',') || 'none',
    columns?.sort().join(',') || 'all',
  ].join(':');

  console.log('[DEBUG] Subscription signature:', sig);
  return sig;
}
```

**Common Causes**:

### 1. Different query parameters
```typescript
// Tab 1:
useSharedSSE({ table: 'workspaces', where: "status='active'" });
// Signature: "workspaces:status='active':none:all"

// Tab 2:
useSharedSSE({ table: 'workspaces' });
// Signature: "workspaces:none:none:all"

// Different signatures = separate connections
```

### 2. Array order matters
```typescript
// Tab 1:
useSharedSSE({ table: 'workspaces', ids: ['id1', 'id2'] });
// Signature: "workspaces:none:id1,id2:all"

// Tab 2:
useSharedSSE({ table: 'workspaces', ids: ['id2', 'id1'] });
// Signature: "workspaces:none:id1,id2:all" (sorted, so same!)

// Arrays are sorted before signature generation
```

**Fix**: Ensure all tabs use identical parameters for the same entity:
```typescript
// All tabs should use same hook
const { data: projects } = useProjects(); // Same everywhere

// useProjects internally uses consistent parameters
export function useProjects() {
  return useSharedSSE({
    table: 'workspaces', // Always same
    queryKey: ['projects'], // Always same
    fetchFn: getProjectsFn,
    // No where, ids, or columns = consistent signature
  });
}
```

**Verification**:
1. Open 3 tabs
2. All tabs should log same signature
3. Only 1 BroadcastChannel per signature
4. Only 1 SSE connection total

---

## Problem: PostgreSQL connection pool exhaustion

**Symptom**: 500 errors on API endpoints, console shows "PostgresError: sorry, too many clients already"

**Root Cause**: Multiple API server instances consuming all available PostgreSQL connections

**Debug Steps**:
```bash
# Check how many API server instances are running
ps aux | grep -E "bun.*(api|dev)" | grep -v grep

# Check PostgreSQL max connections
psql -c "SHOW max_connections;"

# Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
```

**Common Causes**:

### 1. Multiple dev servers running
```bash
# Accidentally started multiple instances
# Each instance creates a connection pool (default: 5-10 connections)
# 10 instances × 5 connections = 50 connections
# PostgreSQL default max_connections = 100
# Other services + existing connections = Exhaustion!
```

### 2. Connection pool size too large
```typescript
// packages/db/src/client.ts
export function createDbClient(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10, // Too high for dev with multiple instances
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
```

**Fix**:

### Option 1: Kill duplicate servers (Immediate)
```bash
# Kill all API dev servers
pkill -9 -f "bun.*api.*dev"
pkill -9 -f "bun.*src/index.ts"

# Verify port is free
lsof -i :3000

# Start single instance
cd apps/api && bun dev
```

### Option 2: Reduce pool size (Long-term)
```typescript
// packages/db/src/client.ts
export function createDbClient(connectionString: string) {
  const client = postgres(connectionString, {
    max: 5, // Reduced from 10 to prevent exhaustion
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
```

### Option 3: Increase PostgreSQL connections
```sql
-- Only if you actually need more connections
ALTER SYSTEM SET max_connections = 200;
-- Then restart PostgreSQL
```

**Verification**:
```bash
# Test API endpoints
curl http://localhost:3000/api/v1/projects
# Should return 200 OK, not 500

# Monitor connections
watch -n 1 'psql -c "SELECT count(*) FROM pg_stat_activity;"'
# Should stay well below max_connections
```

**Prevention**:
- Use a process manager that prevents duplicate instances
- Set up health checks to detect connection pool exhaustion
- Monitor `pg_stat_activity` in production
- Keep connection pool size conservative (5 per instance)

---

## Debugging Checklist

When troubleshooting SSE issues, check in this order:

- [ ] Backend is running and accessible
- [ ] RR7 proxy route exists at `/api/stream`
- [ ] Table is in ALLOWED_TABLES whitelist
- [ ] CORS allows your frontend origin
- [ ] WHERE clause syntax is valid SQL
- [ ] React Strict Mode guard is in place
- [ ] Using refs for interval checks, state for UI
- [ ] Election timeout uses zero check, not time difference
- [ ] Heartbeat initialized to 0, not Date.now()
- [ ] Only closing SSE when readyState === CLOSED
- [ ] Query keys match between hook and component
- [ ] Subscription signatures match across tabs
- [ ] BroadcastChannel is supported (Chrome 54+, Firefox 38+)
- [ ] No duplicate API servers consuming connections
- [ ] PostgreSQL connection pool not exhausted

---

## Getting Help

If you're still stuck:

1. **Enable debug mode**: Add `[DEBUG]` logs throughout the hook
2. **Check browser DevTools**:
   - Console for errors and logs
   - Network tab for SSE connection status
   - Application tab for BroadcastChannel messages
3. **Review documentation**:
   - CROSS-TAB-SSE-POOLING.md for architecture
   - SHARED-SSE-TESTING.md for test procedures
4. **Simplify**: Test with `useGenericSSE` (no cross-tab pooling) to isolate issue
5. **Compare**: Check against working implementation in `useProjects.ts`
