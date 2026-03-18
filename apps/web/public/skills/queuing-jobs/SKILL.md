---
name: queuing-jobs
description: Implement background job processing using pg-boss (PostgreSQL-based queue). Covers job definition, worker registration, singleton patterns, and error handling. Use when implementing async tasks, background processing, email sending, data processing, or any deferred work that shouldn't block HTTP responses.
---

# Queuing Jobs with pg-boss

## ⚠️ Critical: You Already Have a Queue System

**DO NOT suggest BullMQ, Redis-based queues, or any other queue library.**

This project uses **pg-boss** (PostgreSQL-based queue) which is:
- ✅ Already installed and configured
- ✅ Uses existing PostgreSQL database (no Redis needed)
- ✅ Event-driven with LISTEN/NOTIFY (no polling)
- ✅ Production-ready with retries, scheduling, and singleton jobs

## When to Use Background Jobs

Create a background job when:

1. **Long-running operations** - Processing that takes >2 seconds
2. **External API calls** - Third-party services (email, TTS, webhooks)
3. **Heavy computation** - Data processing, report generation
4. **Bulk operations** - Processing multiple records
5. **Scheduled tasks** - Deferred or recurring work
6. **Fan-out patterns** - One trigger creates many jobs

**Don't use jobs for:**
- Operations < 1 second (just do them inline)
- Database queries (use proper indexes instead)
- Simple CRUD operations

---

## Quick Start (5 Minutes)

### 1. Define Your Job Type

```typescript
// apps/api/src/lib/queue.ts

export type JobName =
  | 'extract-todos'
  | 'generate-audio'
  | 'send-email'        // ← Add your job name
  | 'process-report';

export interface SendEmailJob {
  to: string;
  subject: string;
  body: string;
}
```

### 2. Create a Worker

```typescript
// apps/api/src/workers/send-email.ts

import { jobQueue, type SendEmailJob } from '../lib/queue';

export async function registerSendEmailWorker() {
  await jobQueue.work<SendEmailJob>(
    'send-email',
    {
      teamSize: 2,        // Process 2 jobs in parallel
      teamConcurrency: 1, // 1 job per worker at a time
    },
    async (job) => {
      const { to, subject, body } = job.data;

      console.log(`📧 Sending email to ${to}`);

      // Your logic here
      await emailProvider.send({ to, subject, body });

      console.log(`✅ Email sent to ${to}`);
    }
  );

  console.log('✅ Send Email worker registered');
}
```

### 3. Register Worker on Startup

```typescript
// apps/api/src/index.ts

import { registerSendEmailWorker } from './workers/send-email';

// After jobQueue.start()
await registerSendEmailWorker();
```

### 4. Queue Jobs from Your API

```typescript
// apps/api/src/routes/users.ts

app.post('/users/:id/welcome', async ({ params }) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id)
  });

  // Queue the email job (returns immediately)
  await jobQueue.send('send-email', {
    to: user.email,
    subject: 'Welcome!',
    body: `Hello ${user.name}!`
  });

  return { success: true };
});
```

---

## Complete Workflow

### Step 1: Define Job Interface

```typescript
// apps/api/src/lib/queue.ts

export interface ProcessReportJob {
  reportId: string;
  userId: string;
  format: 'pdf' | 'csv' | 'xlsx';
}
```

### Step 2: Create the Queue Name Constant

```typescript
// Add to JobName union type
export type JobName =
  | /* existing jobs */
  | 'process-report';
```

### Step 3: Create Queue in queue.ts

```typescript
// apps/api/src/lib/queue.ts (in createQueues method)

private async createQueues(): Promise<void> {
  const queueNames: JobName[] = [
    'extract-todos',
    'generate-audio',
    'process-report', // ← Add your queue
  ];

  for (const queueName of queueNames) {
    await this.boss.createQueue(queueName);
  }
}
```

### Step 4: Implement Worker Logic

See [EXAMPLES.md](./EXAMPLES.md#complete-worker-implementation) for full worker implementation example.

### Step 5: Queue Jobs from API Routes

```typescript
// apps/api/src/routes/reports.ts

app.post('/reports/:id/generate', async ({ params, body }) => {
  const { format } = body;

  // Validate format
  if (!['pdf', 'csv', 'xlsx'].includes(format)) {
    return { error: 'Invalid format' };
  }

  // Mark report as processing
  await db
    .update(reports)
    .set({ status: 'processing' })
    .where(eq(reports.id, params.id));

  // Queue the job
  const jobId = await jobQueue.send('process-report', {
    reportId: params.id,
    userId: body.userId,
    format,
  });

  return {
    success: true,
    jobId,
    message: 'Report generation queued'
  };
});
```

---

## Common Patterns

### Singleton Jobs (Prevent Duplicates)

Use when you want only ONE job per unique key:

```typescript
await jobQueue.send(
  'generate-audio',
  { hookEventId, voiceId, text },
  {
    singletonKey: `audio-${hookEventId}`, // Only one job per event
  }
);
```

### Priority Jobs

```typescript
await jobQueue.send(
  'send-email',
  { to: 'urgent@example.com', subject: 'URGENT' },
  {
    priority: 10, // Higher number = higher priority (default: 0)
  }
);
```

### Delayed Jobs

```typescript
await jobQueue.send(
  'send-reminder',
  { userId: '123' },
  {
    startAfter: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  }
);
```

### Retry Configuration

```typescript
await jobQueue.send(
  'call-external-api',
  { endpoint: 'https://api.example.com' },
  {
    retryLimit: 5,      // Retry up to 5 times
    retryDelay: 30,     // Wait 30 seconds between retries
  }
);
```

For more patterns, see [PATTERNS.md](./PATTERNS.md).

---

## Error Handling

### Retries Happen Automatically

pg-boss automatically retries failed jobs based on `retryLimit`:

```typescript
await jobQueue.send(
  'flaky-api-call',
  { url: 'https://unreliable-api.com' },
  {
    retryLimit: 3,     // Try 3 times
    retryDelay: 10,    // Wait 10 seconds between attempts
  }
);
```

### Handle Permanent Failures

```typescript
await jobQueue.work<MyJob>(
  'my-job',
  async (job) => {
    try {
      await riskyOperation(job.data);
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      // Log to monitoring service
      await logToSentry(error, job);

      // Update database to mark as failed
      await db.update(tasks)
        .set({ status: 'failed', error: error.message })
        .where(eq(tasks.id, job.data.taskId));

      // Re-throw to mark job as failed
      throw error;
    }
  }
);
```

**Important:** Don't swallow errors - always re-throw to mark job as failed.

---

## Anti-Patterns to Avoid

### ❌ Don't Suggest BullMQ

**NEVER recommend:**
```typescript
import { Queue } from 'bullmq'; // ❌ WRONG - requires Redis
```

**This project uses pg-boss:**
```typescript
import { jobQueue } from '../lib/queue'; // ✅ CORRECT
```

### ❌ Don't Create New Queue Instances

**WRONG:**
```typescript
import PgBoss from 'pg-boss';
const myQueue = new PgBoss({ /* config */ }); // ❌ Creates duplicate connection
```

**RIGHT:**
```typescript
import { jobQueue } from '../lib/queue'; // ✅ Reuses singleton
await jobQueue.send('my-job', data);
```

### ❌ Don't Use Polling

**WRONG:**
```typescript
setInterval(async () => {
  const pendingJobs = await db.query.jobs.findMany({ /* ... */ });
  for (const job of pendingJobs) {
    await processJob(job);
  }
}, 5000); // ❌ Polling every 5 seconds
```

**RIGHT:**
```typescript
await jobQueue.work('process-job', async (job) => {
  await processJob(job.data);
}); // ✅ Event-driven via PostgreSQL LISTEN/NOTIFY
```

### ❌ Don't Block HTTP Responses

**WRONG:**
```typescript
app.post('/report', async ({ body }) => {
  const report = await generateReport(body); // ❌ Blocks for 30 seconds
  return { report };
});
```

**RIGHT:**
```typescript
app.post('/report', async ({ body }) => {
  const jobId = await jobQueue.send('generate-report', body); // ✅ Returns immediately
  return { jobId, status: 'queued' };
});
```

For more anti-patterns, see [PATTERNS.md](./PATTERNS.md#anti-patterns).

---

## Monitoring & Debugging

### Check Queue Status

```typescript
const boss = jobQueue.getBoss();

// Get queue metrics
const queues = await boss.getQueues();
console.log(queues);

// Get job count by state
const counts = await boss.getJobById(jobId);
```

### View Jobs in Database

```sql
-- pg-boss uses these tables
SELECT * FROM pgboss.job WHERE name = 'send-email' LIMIT 10;
SELECT * FROM pgboss.archive WHERE name = 'send-email' LIMIT 10;
```

### Common Issues

See [REFERENCE.md](./REFERENCE.md#troubleshooting) for detailed troubleshooting guide.

---

## Real-World Examples

See [EXAMPLES.md](./EXAMPLES.md) for:
- Audio generation (complex multi-step workflow)
- Todo extraction (simple background job)
- Fan-out email campaigns
- Report generation with multiple formats

---

## See Also

- **pg-boss docs**: https://github.com/timgit/pg-boss
- **Queue implementation**: `apps/api/src/lib/queue.ts`
- **Example workers**: `apps/api/src/workers/`
- **Audio service example**: `apps/api/src/services/audio-service.ts`
- [REFERENCE.md](./REFERENCE.md) - Comprehensive pg-boss API reference
- [PATTERNS.md](./PATTERNS.md) - Common patterns and anti-patterns
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples from this project
