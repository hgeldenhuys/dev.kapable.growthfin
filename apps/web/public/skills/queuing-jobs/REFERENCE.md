# pg-boss API Reference

Complete technical reference for pg-boss configuration, methods, and troubleshooting.

---

## Queue Configuration

### JobQueue Class (apps/api/src/lib/queue.ts)

```typescript
class JobQueue {
  private boss: PgBoss;

  constructor() {
    this.boss = new PgBoss({
      max: 2,                    // Max database connections
      connectionString: env.DATABASE_URL,
      // Event-driven, no polling!
    });
  }
}
```

### Connection Settings

| Option | Default | Description |
|--------|---------|-------------|
| `max` | 10 | Maximum number of database connections |
| `connectionString` | - | PostgreSQL connection URL |
| `schema` | 'pgboss' | Database schema for pg-boss tables |
| `retentionDays` | 30 | How long to keep completed/failed jobs |

**Important:** This project uses `max: 2` to avoid exhausting database connections.

---

## Job Sending Methods

### Basic Send

```typescript
await jobQueue.send<T>(
  name: JobName,
  data: T,
  options?: SendOptions
): Promise<string | null>
```

**Returns:** Job ID (UUID) or null if singleton already exists

**Example:**
```typescript
const jobId = await jobQueue.send('send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Welcome!'
});
```

### Send Options

```typescript
interface SendOptions {
  // Priority (higher = processed first)
  priority?: number;              // Default: 0, Range: -32768 to 32767

  // Retry configuration
  retryLimit?: number;            // Default: 2
  retryDelay?: number;            // Seconds between retries, default: 0
  retryBackoff?: boolean;         // Exponential backoff, default: false

  // Scheduling
  startAfter?: Date | string;     // Delay job execution
  expireInSeconds?: number;       // Auto-expire job

  // Singleton
  singletonKey?: string;          // Prevent duplicates
  singletonSeconds?: number;      // Singleton window (default: 60)

  // Keepalive
  keepUntil?: Date | string;      // Retention override

  // Deadletter
  deadLetter?: string;            // Queue name for failed jobs

  // Metadata
  onComplete?: boolean;           // Emit completion event
}
```

### Common Option Combinations

**High Priority Urgent Job:**
```typescript
await jobQueue.send('urgent-task', data, {
  priority: 100,
  retryLimit: 0  // Don't retry urgent jobs
});
```

**Idempotent Job with Singleton:**
```typescript
await jobQueue.send('process-user', { userId: '123' }, {
  singletonKey: `user-123`,
  singletonSeconds: 300  // 5 minute window
});
```

**Scheduled Job with Retries:**
```typescript
await jobQueue.send('send-reminder', data, {
  startAfter: new Date(Date.now() + 3600000),  // 1 hour
  retryLimit: 5,
  retryBackoff: true  // Exponential backoff
});
```

---

## Worker Registration

### Basic Worker

```typescript
await jobQueue.work<T>(
  name: JobName,
  handler: (job: Job<T>) => Promise<void>
): Promise<void>

await jobQueue.work<T>(
  name: JobName,
  options: WorkOptions,
  handler: (job: Job<T>) => Promise<void>
): Promise<void>
```

### Work Options

```typescript
interface WorkOptions {
  teamSize?: number;              // Parallel workers (default: 1)
  teamConcurrency?: number;       // Jobs per worker (default: 1)
  teamRefill?: boolean;           // Refill on completion (default: true)
  newJobCheckInterval?: number;   // Polling interval in ms (not used with NOTIFY)
  newJobCheckIntervalSeconds?: number;
}
```

**Concurrency Calculation:**
```
Total parallel jobs = teamSize × teamConcurrency
```

**Examples:**

Low concurrency (careful processing):
```typescript
await jobQueue.work('process-payment', {
  teamSize: 1,        // 1 worker
  teamConcurrency: 1  // 1 job at a time
}, handler);
// Total: 1 job at a time
```

Medium concurrency (balanced):
```typescript
await jobQueue.work('send-email', {
  teamSize: 3,        // 3 workers
  teamConcurrency: 2  // 2 jobs per worker
}, handler);
// Total: 6 jobs in parallel
```

High concurrency (fast processing):
```typescript
await jobQueue.work('resize-image', {
  teamSize: 5,        // 5 workers
  teamConcurrency: 4  // 4 jobs per worker
}, handler);
// Total: 20 jobs in parallel
```

---

## Job Object

### Job Interface

```typescript
interface Job<T = object> {
  id: string;                     // UUID
  name: string;                   // Queue name
  data: T;                        // Job payload
  state: JobState;                // Current state
  priority: number;               // Job priority
  retryLimit: number;             // Max retries
  retryCount: number;             // Current retry count
  retryDelay: number;             // Delay between retries
  retryBackoff: boolean;          // Exponential backoff
  startAfter: Date;               // Scheduled start
  startedOn?: Date;               // When processing started
  singletonKey?: string;          // Singleton identifier
  singletonOn?: Date;             // Singleton timestamp
  expireIn: string;               // Expiration interval
  createdOn: Date;                // Creation timestamp
  completedOn?: Date;             // Completion timestamp
  keepUntil?: Date;               // Retention date
  output?: any;                   // Completion data
  deadLetter?: string;            // Deadletter queue
}
```

### Job States

| State | Description |
|-------|-------------|
| `created` | Job created, waiting to start |
| `retry` | Job failed, will retry |
| `active` | Job currently processing |
| `completed` | Job finished successfully |
| `expired` | Job expired before processing |
| `cancelled` | Job was cancelled |
| `failed` | Job failed after all retries |

---

## Job Lifecycle

```
                    ┌─────────┐
                    │ created │
                    └────┬────┘
                         │
                    startAfter?
                         │
                    ┌────▼────┐
           ┌────────┤ active  ├────────┐
           │        └─────────┘        │
           │                           │
      Success                        Error
           │                           │
           │                    ┌──────▼──────┐
           │                    │ retry < max?│
           │                    └──────┬──────┘
           │                           │
           │                     Yes ┌─┴─┐ No
           │                         │   │
           │                    ┌────▼───▼────┐
           │                    │    retry    │
           │                    └─────────────┘
           │                           │
      ┌────▼─────┐              retryDelay
      │completed │                    │
      └──────────┘              ┌─────▼─────┐
                                │  failed   │
                                └───────────┘
```

---

## Monitoring Methods

### Get Queue Info

```typescript
const queues = await boss.getQueues();
// Returns: Array<{ name: string, count: number }>
```

### Get Job by ID

```typescript
const job = await boss.getJobById(jobId);
// Returns: Job<T> | null
```

### Get Jobs by State

```typescript
const activeJobs = await boss.fetch('queue-name', batchSize);
// Returns: Array<Job<T>>
```

### Cancel Job

```typescript
await boss.cancel(jobId);
// Returns: Promise<void>
```

### Resume Job

```typescript
await boss.resume(jobId);
// Returns: Promise<void>
```

---

## Database Schema

pg-boss creates these tables in the `pgboss` schema:

### Tables

**pgboss.job** - Active jobs
- Stores jobs in created, retry, active states
- Indexed by name, state, priority
- LISTEN/NOTIFY triggers on insert

**pgboss.archive** - Completed jobs
- Stores completed/failed/expired jobs
- Retained for `retentionDays` (default: 30)
- Moved from job table on completion

**pgboss.version** - Schema version
- Tracks pg-boss schema migrations

**pgboss.schedule** - Recurring jobs
- Not used in this project (yet)

### Key Indexes

```sql
-- Process jobs by priority
CREATE INDEX job_name_priority_idx ON pgboss.job (name, priority DESC);

-- Singleton enforcement
CREATE UNIQUE INDEX job_singleton_idx ON pgboss.job (name, singletonKey)
WHERE state < 'completed';

-- Cleanup by expiration
CREATE INDEX job_expirein_idx ON pgboss.job (expireIn);
```

---

## Troubleshooting

### Issue: "Queue does not exist" error

**Cause:** Queue wasn't created in `createQueues()` method

**Solution:**
```typescript
// apps/api/src/lib/queue.ts
private async createQueues(): Promise<void> {
  const queueNames: JobName[] = [
    'extract-todos',
    'your-new-queue', // ← Add here
  ];

  for (const queueName of queueNames) {
    await this.boss.createQueue(queueName);
  }
}
```

### Issue: Jobs not processing

**Possible causes:**
1. Worker not registered on startup
2. Worker crashed/threw error
3. Job state is 'failed' or 'expired'

**Debug steps:**
```typescript
// 1. Check worker registered
console.log('Workers:', await boss.getQueues());

// 2. Check job state
const job = await boss.getJobById(jobId);
console.log('Job state:', job?.state);

// 3. Check database
// SELECT * FROM pgboss.job WHERE name = 'your-queue';
```

**Solution:**
```typescript
// apps/api/src/index.ts
await jobQueue.start();
await registerYourWorker(); // ← Must register!
```

### Issue: Database connection errors

**Error:** `Error: too many connections`

**Cause:** Too many pg-boss instances or high `max` setting

**Solution:**
```typescript
// apps/api/src/lib/queue.ts
this.boss = new PgBoss({
  max: 2, // ✅ Already configured
  connectionString: env.DATABASE_URL
});
```

**Verify connections:**
```sql
SELECT count(*) FROM pg_stat_activity
WHERE application_name = 'pgboss';
```

### Issue: Singleton jobs not working

**Symptom:** Duplicate jobs created despite `singletonKey`

**Cause:** Singleton window expired (`singletonSeconds`)

**Solution:**
```typescript
await jobQueue.send('job', data, {
  singletonKey: 'unique-key',
  singletonSeconds: 600  // 10 minute window (default: 60)
});
```

**Check database:**
```sql
SELECT id, singletonKey, state, createdOn
FROM pgboss.job
WHERE name = 'your-queue'
  AND singletonKey = 'unique-key';
```

### Issue: Jobs stuck in 'active' state

**Cause:** Worker crashed without completing job

**Solution 1:** pg-boss has built-in job expiration
```typescript
await jobQueue.send('job', data, {
  expireInSeconds: 300  // Job expires after 5 minutes
});
```

**Solution 2:** Manual recovery
```sql
-- Find stuck jobs (active for > 1 hour)
SELECT id, name, startedOn
FROM pgboss.job
WHERE state = 'active'
  AND startedOn < NOW() - INTERVAL '1 hour';

-- Reset to retry
UPDATE pgboss.job
SET state = 'retry',
    retryCount = retryCount + 1
WHERE id = 'stuck-job-id';
```

### Issue: Jobs failing silently

**Cause:** Worker catching errors without re-throwing

**Wrong:**
```typescript
await jobQueue.work('job', async (job) => {
  try {
    await doWork(job.data);
  } catch (error) {
    console.error(error);
    // ❌ Job appears successful!
  }
});
```

**Right:**
```typescript
await jobQueue.work('job', async (job) => {
  try {
    await doWork(job.data);
  } catch (error) {
    console.error(error);
    throw error; // ✅ pg-boss knows it failed
  }
});
```

**Verify:**
```sql
SELECT state, COUNT(*)
FROM pgboss.archive
WHERE name = 'your-queue'
GROUP BY state;
```

---

## Performance Tips

### 1. Choose Right Concurrency

**Low value operations (< 100ms):**
```typescript
teamSize: 5,
teamConcurrency: 10  // 50 jobs in parallel
```

**External API calls (1-5 seconds):**
```typescript
teamSize: 3,
teamConcurrency: 2   // 6 jobs in parallel
```

**Heavy processing (> 10 seconds):**
```typescript
teamSize: 2,
teamConcurrency: 1   // 2 jobs in parallel
```

### 2. Use Batching for Multiple Jobs

**Wrong:**
```typescript
for (const user of users) {
  await jobQueue.send('email', { userId: user.id });
}
// Each send() is a database write
```

**Right:**
```typescript
// pg-boss doesn't have built-in batch send yet
// Use Promise.all for parallel sends
await Promise.all(
  users.map(user =>
    jobQueue.send('email', { userId: user.id })
  )
);
```

### 3. Set Appropriate Retention

```typescript
// Short retention for high-volume jobs
this.boss = new PgBoss({
  retentionDays: 7  // Clean up after 1 week
});
```

**Manually clean archive:**
```sql
DELETE FROM pgboss.archive
WHERE completedOn < NOW() - INTERVAL '7 days';
```

### 4. Monitor Queue Depth

```sql
SELECT
  name,
  COUNT(*) FILTER (WHERE state = 'created') as pending,
  COUNT(*) FILTER (WHERE state = 'active') as active,
  COUNT(*) FILTER (WHERE state = 'retry') as retrying
FROM pgboss.job
GROUP BY name;
```

**Alert on queue depth:**
- Pending > 1000: Workers too slow or crashed
- Active > teamSize × teamConcurrency: Jobs taking too long
- Retrying > 100: Persistent failures

---

## See Also

- **Official pg-boss docs**: https://github.com/timgit/pg-boss/blob/master/docs/readme.md
- **PostgreSQL LISTEN/NOTIFY**: https://www.postgresql.org/docs/current/sql-notify.html
- [SKILL.md](./SKILL.md) - Quick start guide
- [PATTERNS.md](./PATTERNS.md) - Common patterns
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples
