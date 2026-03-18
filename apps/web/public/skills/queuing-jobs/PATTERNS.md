# Common Job Queue Patterns

Design patterns, best practices, and anti-patterns for pg-boss job queues.

---

## Pattern 1: Fan-Out (One Job Creates Many)

### Use Case
One trigger creates many independent jobs (e.g., send email campaign to 10,000 users).

### Implementation

```typescript
// Main job: Process campaign
await jobQueue.work<ProcessCampaignJob>(
  'process-campaign',
  async (job) => {
    const { campaignId } = job.data;

    // Get all subscribers
    const subscribers = await db.query.subscribers.findMany({
      where: eq(subscribers.campaignId, campaignId)
    });

    // Create individual email jobs
    for (const subscriber of subscribers) {
      await jobQueue.send('send-email', {
        to: subscriber.email,
        subject: campaign.subject,
        body: templateEngine.render(campaign.template, subscriber)
      });
    }

    console.log(`✅ Created ${subscribers.length} email jobs`);
  }
);
```

### Performance Optimization

**Bad:** Sequential sends
```typescript
for (const subscriber of subscribers) {
  await jobQueue.send('send-email', { /* ... */ });
}
// 10,000 subscribers = 10,000 sequential database writes
```

**Good:** Parallel sends
```typescript
await Promise.all(
  subscribers.map(subscriber =>
    jobQueue.send('send-email', { /* ... */ })
  )
);
// Much faster, but careful with memory
```

**Better:** Batched parallel sends
```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
  const batch = subscribers.slice(i, i + BATCH_SIZE);

  await Promise.all(
    batch.map(subscriber =>
      jobQueue.send('send-email', { /* ... */ })
    )
  );
}
// Balance between speed and memory
```

---

## Pattern 2: Chained Jobs (Sequential Pipeline)

### Use Case
Multi-step processing where each step depends on the previous (e.g., upload → process → notify).

### Implementation

```typescript
// Step 1: Upload completed
app.post('/upload', async ({ body }) => {
  const fileId = await saveFile(body);

  await jobQueue.send('process-file', { fileId });

  return { fileId, status: 'processing' };
});

// Step 2: Process file
await jobQueue.work<ProcessFileJob>(
  'process-file',
  async (job) => {
    const { fileId } = job.data;

    const result = await processFile(fileId);

    // Chain to next step
    await jobQueue.send('generate-thumbnail', {
      fileId,
      processedPath: result.path
    });
  }
);

// Step 3: Generate thumbnail
await jobQueue.work<GenerateThumbnailJob>(
  'generate-thumbnail',
  async (job) => {
    const { fileId, processedPath } = job.data;

    const thumbnail = await generateThumbnail(processedPath);

    // Chain to final step
    await jobQueue.send('notify-user', {
      fileId,
      thumbnailPath: thumbnail.path
    });
  }
);

// Step 4: Notify user
await jobQueue.work<NotifyUserJob>(
  'notify-user',
  async (job) => {
    const { fileId } = job.data;

    await notifyUser(fileId, 'processing_complete');
  }
);
```

### Error Handling in Chains

**Problem:** If step 3 fails, steps 1-2 already completed.

**Solution:** Store state in database, make steps idempotent.

```typescript
// Process file worker
await jobQueue.work('process-file', async (job) => {
  const { fileId } = job.data;

  // Check if already processed
  const file = await db.query.files.findFirst({
    where: eq(files.id, fileId)
  });

  if (file.status === 'processed') {
    console.log('Already processed, skipping');

    // Chain to next step (idempotent)
    await jobQueue.send('generate-thumbnail', {
      fileId,
      processedPath: file.processedPath
    });
    return;
  }

  // Process
  const result = await processFile(fileId);

  // Update state
  await db.update(files)
    .set({ status: 'processed', processedPath: result.path })
    .where(eq(files.id, fileId));

  // Chain
  await jobQueue.send('generate-thumbnail', {
    fileId,
    processedPath: result.path
  });
});
```

---

## Pattern 3: Rate Limiting External APIs

### Use Case
Prevent overwhelming external APIs (e.g., max 10 requests/second to third-party service).

### Implementation

```typescript
// Register worker with limited concurrency
await jobQueue.work<CallExternalAPIJob>(
  'call-external-api',
  {
    teamSize: 1,         // Single worker
    teamConcurrency: 10  // Max 10 concurrent requests
  },
  async (job) => {
    const { endpoint, params } = job.data;

    // Add delay between requests if needed
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms

    const result = await externalAPI.call(endpoint, params);

    return result;
  }
);
```

### Token Bucket Pattern

For more sophisticated rate limiting:

```typescript
class RateLimiter {
  private tokens = 10;
  private maxTokens = 10;
  private refillRate = 10; // tokens per second

  async acquire(): Promise<void> {
    while (this.tokens < 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.tokens--;
  }

  startRefill() {
    setInterval(() => {
      this.tokens = Math.min(this.tokens + this.refillRate, this.maxTokens);
    }, 1000);
  }
}

const limiter = new RateLimiter();
limiter.startRefill();

await jobQueue.work('api-call', async (job) => {
  await limiter.acquire();

  return await externalAPI.call(job.data.endpoint);
});
```

---

## Pattern 4: Singleton with State Machine

### Use Case
Ensure only one job per entity, with state tracking (e.g., audio generation per hook event).

### Implementation

```typescript
// Service layer
async getAudio(hookEventId: string): Promise<AudioStatus> {
  // Check cache
  const cached = await db.query.audioCache.findFirst({
    where: eq(audioCache.hookEventId, hookEventId)
  });

  if (cached) {
    return { status: 'ready', url: cached.url };
  }

  // Check if job exists
  const existingJob = await db.query.audioJobs.findFirst({
    where: eq(audioJobs.hookEventId, hookEventId)
  });

  if (existingJob) {
    return { status: 'generating', jobId: existingJob.jobId };
  }

  // Queue with singleton (prevents duplicates)
  const jobId = await jobQueue.send(
    'generate-audio',
    { hookEventId, voiceId, text },
    { singletonKey: `audio-${hookEventId}` }
  );

  // Track job in database
  await db.insert(audioJobs).values({
    hookEventId,
    jobId,
    status: 'queued'
  });

  return { status: 'generating', jobId };
}

// Worker
await jobQueue.work('generate-audio', async (job) => {
  const { hookEventId } = job.data;

  // Update state: generating
  await db.update(audioJobs)
    .set({ status: 'generating' })
    .where(eq(audioJobs.hookEventId, hookEventId));

  try {
    // Generate
    const audioBuffer = await elevenLabs.generate(job.data.text);

    // Save
    await writeFile(`public/cdn/audio/${hookEventId}.mp3`, audioBuffer);

    // Cache
    await db.insert(audioCache).values({
      hookEventId,
      url: `/cdn/audio/${hookEventId}.mp3`
    });

    // Update state: completed
    await db.update(audioJobs)
      .set({ status: 'completed' })
      .where(eq(audioJobs.hookEventId, hookEventId));

    // Notify
    await db.execute(
      sql`SELECT pg_notify('audio_generated', ${hookEventId}::text)`
    );

  } catch (error) {
    // Update state: failed
    await db.update(audioJobs)
      .set({ status: 'failed', error: error.message })
      .where(eq(audioJobs.hookEventId, hookEventId));

    throw error;
  }
});
```

---

## Pattern 5: Scheduled Jobs (Cron-like)

### Use Case
Run jobs at specific times or intervals (e.g., daily report generation).

### Implementation

**Delayed one-time job:**
```typescript
// Schedule report for tomorrow 9am
const tomorrow9am = new Date();
tomorrow9am.setDate(tomorrow9am.getDate() + 1);
tomorrow9am.setHours(9, 0, 0, 0);

await jobQueue.send('generate-daily-report', {
  reportDate: tomorrow9am.toISOString()
}, {
  startAfter: tomorrow9am
});
```

**Recurring job (manual scheduling):**
```typescript
// After each report completes, schedule next one
await jobQueue.work('generate-daily-report', async (job) => {
  // Generate report
  await generateReport(job.data.reportDate);

  // Schedule tomorrow's report
  const tomorrow = new Date(job.data.reportDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await jobQueue.send('generate-daily-report', {
    reportDate: tomorrow.toISOString()
  }, {
    startAfter: tomorrow,
    singletonKey: `report-${tomorrow.toISOString().split('T')[0]}`
  });
});
```

**Better: Use pg-boss built-in scheduling:**
```typescript
// Not currently used in this project, but available
await boss.schedule('generate-daily-report', '0 9 * * *', data);
// Cron syntax: 9am every day
```

---

## Pattern 6: Deadletter Queue (Failed Job Handling)

### Use Case
Handle jobs that fail after all retries (e.g., send to monitoring, manual review).

### Implementation

```typescript
// Queue with deadletter
await jobQueue.send('risky-operation', data, {
  retryLimit: 3,
  deadLetter: 'failed-risky-operations'
});

// Worker for deadletter queue
await jobQueue.work('failed-risky-operations', async (job) => {
  console.error('Job failed after retries:', job);

  // Log to monitoring
  await logToSentry({
    message: 'Job failed',
    context: job.data,
    retryCount: job.retryCount
  });

  // Store for manual review
  await db.insert(failedJobs).values({
    jobId: job.id,
    jobName: job.name,
    data: job.data,
    error: job.output?.error || 'Unknown error'
  });

  // Optional: notify admin
  await sendSlackNotification({
    channel: '#job-failures',
    message: `Job ${job.name} failed: ${job.id}`
  });
});
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Blocking HTTP Response

**Wrong:**
```typescript
app.post('/report', async ({ body }) => {
  // Wait for job to complete (blocks for 30+ seconds)
  const jobId = await jobQueue.send('generate-report', body);

  let completed = false;
  while (!completed) {
    const job = await boss.getJobById(jobId);
    if (job.state === 'completed') {
      completed = true;
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { report: job.output };
});
```

**Right:**
```typescript
app.post('/report', async ({ body }) => {
  const jobId = await jobQueue.send('generate-report', body);

  return { jobId, status: 'queued' };
});

// Client polls or uses SSE for updates
app.get('/report/:jobId/status', async ({ params }) => {
  const job = await boss.getJobById(params.jobId);

  return {
    status: job.state,
    result: job.state === 'completed' ? job.output : null
  };
});
```

---

### ❌ Anti-Pattern 2: Swallowing Errors

**Wrong:**
```typescript
await jobQueue.work('process', async (job) => {
  try {
    await doWork(job.data);
  } catch (error) {
    console.error('Error:', error);
    // Job marked as successful! ❌
  }
});
```

**Right:**
```typescript
await jobQueue.work('process', async (job) => {
  try {
    await doWork(job.data);
  } catch (error) {
    console.error('Error:', error);
    throw error; // Mark job as failed ✅
  }
});
```

---

### ❌ Anti-Pattern 3: Creating Queue Instances

**Wrong:**
```typescript
import PgBoss from 'pg-boss';

const myQueue = new PgBoss({
  connectionString: env.DATABASE_URL
}); // ❌ Duplicate instance, wastes connections
```

**Right:**
```typescript
import { jobQueue } from '../lib/queue';

await jobQueue.send('my-job', data); // ✅ Reuse singleton
```

---

### ❌ Anti-Pattern 4: Forgetting Worker Registration

**Wrong:**
```typescript
// apps/api/src/index.ts
await jobQueue.start();

// ❌ Worker never registered, jobs pile up
```

**Right:**
```typescript
// apps/api/src/index.ts
await jobQueue.start();
await registerProcessReportWorker(); // ✅ Worker registered
```

---

### ❌ Anti-Pattern 5: Not Using Singleton for Idempotent Jobs

**Wrong:**
```typescript
// User clicks "Generate Report" button twice
app.post('/report', async ({ body }) => {
  await jobQueue.send('generate-report', { userId: body.userId });
  // ❌ Creates 2 identical jobs
});
```

**Right:**
```typescript
app.post('/report', async ({ body }) => {
  await jobQueue.send('generate-report',
    { userId: body.userId },
    { singletonKey: `report-${body.userId}` }
  );
  // ✅ Only 1 job created, even if called twice
});
```

---

### ❌ Anti-Pattern 6: Wrong Concurrency Settings

**Wrong: Too high (overwhelms database)**
```typescript
await jobQueue.work('db-query', {
  teamSize: 50,
  teamConcurrency: 20
}, handler);
// ❌ 1000 concurrent database queries!
```

**Wrong: Too low (waste resources)**
```typescript
await jobQueue.work('send-email', {
  teamSize: 1,
  teamConcurrency: 1
}, handler);
// ❌ Only 1 email sent at a time (too slow)
```

**Right: Balanced**
```typescript
await jobQueue.work('send-email', {
  teamSize: 3,
  teamConcurrency: 5
}, handler);
// ✅ 15 concurrent emails (reasonable)
```

---

## Best Practices Summary

1. **Always re-throw errors** in workers to mark jobs as failed
2. **Use singleton keys** for idempotent operations
3. **Store job state in database** for complex workflows
4. **Set appropriate retry limits** based on operation type
5. **Choose concurrency carefully** based on resource constraints
6. **Use deadletter queues** for critical jobs
7. **Monitor queue depth** to detect worker issues
8. **Make workers idempotent** when possible
9. **Return immediately** from HTTP handlers, don't wait for jobs
10. **Test error handling** - simulate failures in development

---

## See Also

- [SKILL.md](./SKILL.md) - Quick start guide
- [REFERENCE.md](./REFERENCE.md) - pg-boss API reference
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples
