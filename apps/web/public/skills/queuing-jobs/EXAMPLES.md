# Real-World Job Queue Examples

Complete, production-ready examples from the Agios project.

---

## Example 1: Audio Generation (Complex Multi-Step)

### Overview
Generates audio from text using ElevenLabs API with caching, state tracking, and notifications.

### Files Involved
- `apps/api/src/workers/generate-audio.ts` - Worker
- `apps/api/src/services/audio-service.ts` - Service layer
- `apps/api/src/routes/audio-routes.ts` - API routes
- Database tables: `audio_cache`, `audio_jobs`

### Complete Worker Implementation

```typescript
// apps/api/src/workers/generate-audio.ts

import { jobQueue, type GenerateAudioJob } from '../lib/queue';
import { db } from '@agios/db/client';
import { audioCache, voices } from '@agios/db/schema';
import { eq, sql } from 'drizzle-orm';
import { writeFile } from 'node:fs/promises';
import { elevenLabsProvider } from '../providers/elevenlabs';

export async function registerGenerateAudioWorker() {
  await jobQueue.work<GenerateAudioJob>(
    'generate-audio',
    {
      teamSize: 2,        // 2 parallel audio generations
      teamConcurrency: 1, // 1 at a time per worker
    },
    async (job) => {
      const { hookEventId, voiceId, text } = job.data;

      console.log(`🎵 Generating audio for event ${hookEventId}`);

      try {
        // 1. Get voice settings from database
        const voice = await db.query.voices.findFirst({
          where: eq(voices.id, voiceId)
        });

        if (!voice) {
          throw new Error(`Voice not found: ${voiceId}`);
        }

        // 2. Generate audio via ElevenLabs API
        const audioBuffer = await elevenLabsProvider.generateSpeech(
          text,
          voice.externalId,
          {
            stability: voice.stability,
            similarityBoost: voice.similarityBoost,
            style: voice.style,
            speakerBoost: voice.speakerBoost
          }
        );

        // 3. Save to filesystem
        const audioPath = `public/cdn/audio/${hookEventId}.mp3`;
        await writeFile(audioPath, audioBuffer);

        // 4. Cache in database
        await db.insert(audioCache).values({
          hookEventId,
          voiceId,
          url: `/cdn/audio/${hookEventId}.mp3`,
          generatedAt: new Date()
        }).onConflictDoNothing(); // Idempotent

        // 5. Notify clients via PostgreSQL NOTIFY
        await db.execute(
          sql`SELECT pg_notify('audio_generated', json_build_object(
            'hookEventId', ${hookEventId},
            'url', ${`/cdn/audio/${hookEventId}.mp3`}
          )::text)`
        );

        console.log(`✅ Audio generated for event ${hookEventId}`);

      } catch (error) {
        console.error(`❌ Audio generation failed for ${hookEventId}:`, error);

        // Re-throw to mark job as failed
        throw error;
      }
    }
  );

  console.log('✅ Generate Audio worker registered');
}
```

### Service Layer (with Singleton Pattern)

```typescript
// apps/api/src/services/audio-service.ts

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db/client';
import { audioCache } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export class AudioService {
  async getAudio(hookEventId: string, voiceId: string, text: string) {
    // Check cache first
    const cached = await db.query.audioCache.findFirst({
      where: eq(audioCache.hookEventId, hookEventId)
    });

    if (cached) {
      return {
        status: 'ready',
        url: cached.url
      };
    }

    // Queue generation with singleton key (prevents duplicates)
    const jobId = await jobQueue.send(
      'generate-audio',
      { hookEventId, voiceId, text },
      {
        singletonKey: `audio-${hookEventId}`,
        retryLimit: 3,
        retryDelay: 5  // 5 seconds between retries
      }
    );

    return {
      status: 'generating',
      jobId
    };
  }
}
```

### API Route

```typescript
// apps/api/src/routes/audio-routes.ts

import { Elysia, t } from 'elysia';
import { audioService } from '../services/audio-service';

export const audioRoutes = new Elysia({ prefix: '/audio' })
  .get('/:hookEventId', async ({ params, query }) => {
    const { hookEventId } = params;
    const { voiceId, text } = query;

    const result = await audioService.getAudio(
      hookEventId,
      voiceId,
      text
    );

    return result;
  }, {
    params: t.Object({
      hookEventId: t.String()
    }),
    query: t.Object({
      voiceId: t.String(),
      text: t.String()
    })
  });
```

### Frontend Integration (React)

```typescript
// apps/web/app/components/AudioPlayer.tsx

import { useQuery } from '@tanstack/react-query';

export function AudioPlayer({ hookEventId, voiceId, text }) {
  const { data, refetch } = useQuery({
    queryKey: ['audio', hookEventId],
    queryFn: async () => {
      const res = await fetch(
        `/api/audio/${hookEventId}?voiceId=${voiceId}&text=${text}`
      );
      return res.json();
    },
    refetchInterval: (data) =>
      data?.status === 'generating' ? 2000 : false  // Poll while generating
  });

  if (data?.status === 'generating') {
    return <div>Generating audio...</div>;
  }

  if (data?.status === 'ready') {
    return <audio src={data.url} controls />;
  }

  return null;
}
```

---

## Example 2: Todo Extraction (Simple Background Job)

### Overview
Extract todos from hook events in the background after event insertion.

### Implementation

```typescript
// apps/api/src/workers/extract-todos.ts

import { jobQueue, type ExtractTodosJob } from '../lib/queue';
import { db } from '@agios/db/client';
import { hookEvents, todos } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export async function registerExtractTodosWorker() {
  await jobQueue.work<ExtractTodosJob>(
    'extract-todos',
    {
      teamSize: 2,
      teamConcurrency: 2,  // Can process 4 events in parallel
    },
    async (job) => {
      const { hookEventId, sessionId, projectId } = job.data;

      console.log(`📝 Extracting todos from event ${hookEventId}`);

      // Get hook event
      const event = await db.query.hookEvents.findFirst({
        where: eq(hookEvents.id, hookEventId)
      });

      if (!event) {
        console.log(`Event not found: ${hookEventId}`);
        return;
      }

      // Extract todos from event payload
      const extractedTodos = await extractTodosFromPayload(event.payload);

      if (extractedTodos.length === 0) {
        console.log(`No todos found in event ${hookEventId}`);
        return;
      }

      // Insert todos
      await db.insert(todos).values(
        extractedTodos.map(todo => ({
          sessionId,
          projectId,
          hookEventId,
          content: todo.content,
          status: todo.status,
          createdAt: new Date()
        }))
      );

      console.log(`✅ Extracted ${extractedTodos.length} todos from event ${hookEventId}`);
    }
  );

  console.log('✅ Extract Todos worker registered');
}

// Helper function
function extractTodosFromPayload(payload: any): Array<{ content: string; status: string }> {
  // Implementation depends on payload structure
  // This is simplified
  const todos = [];

  if (payload.todos && Array.isArray(payload.todos)) {
    for (const todo of payload.todos) {
      todos.push({
        content: todo.content,
        status: todo.status || 'pending'
      });
    }
  }

  return todos;
}
```

### Triggering from Insert

```typescript
// apps/api/src/routes/hook-events.ts

app.post('/hook-events', async ({ body }) => {
  // Insert event
  const [event] = await db.insert(hookEvents).values({
    sessionId: body.sessionId,
    projectId: body.projectId,
    eventType: body.eventType,
    payload: body.payload,
    createdAt: new Date()
  }).returning();

  // Queue background job for todo extraction
  await jobQueue.send('extract-todos', {
    hookEventId: event.id,
    sessionId: event.sessionId,
    projectId: event.projectId
  });

  return { success: true, eventId: event.id };
});
```

---

## Example 3: Report Generation with Multiple Formats

### Overview
Generate reports in different formats (PDF, CSV, XLSX) with format-specific processing.

### Complete Implementation

```typescript
// apps/api/src/workers/process-report.ts

import { jobQueue, type ProcessReportJob } from '../lib/queue';
import { db } from '@agios/db/client';
import { reports } from '@agios/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generatePDF } from '../lib/pdf-generator';
import { generateCSV } from '../lib/csv-generator';
import { generateXLSX } from '../lib/xlsx-generator';

export async function registerProcessReportWorker() {
  await jobQueue.work<ProcessReportJob>(
    'process-report',
    {
      teamSize: 3,        // 3 parallel workers
      teamConcurrency: 1, // Each processes 1 at a time
    },
    async (job) => {
      const { reportId, userId, format } = job.data;

      console.log(`📊 Processing report ${reportId} (${format})`);

      try {
        // 1. Load report data
        const report = await db.query.reports.findFirst({
          where: eq(reports.id, reportId),
          with: {
            data: true  // Include related data
          }
        });

        if (!report) {
          throw new Error(`Report not found: ${reportId}`);
        }

        // 2. Generate file based on format
        let fileUrl: string;
        let fileSize: number;

        switch (format) {
          case 'pdf':
            const pdfResult = await generatePDF(report);
            fileUrl = pdfResult.url;
            fileSize = pdfResult.size;
            break;

          case 'csv':
            const csvResult = await generateCSV(report);
            fileUrl = csvResult.url;
            fileSize = csvResult.size;
            break;

          case 'xlsx':
            const xlsxResult = await generateXLSX(report);
            fileUrl = xlsxResult.url;
            fileSize = xlsxResult.size;
            break;

          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        // 3. Update database with result
        await db
          .update(reports)
          .set({
            status: 'completed',
            fileUrl,
            fileSize,
            format,
            completedAt: new Date(),
          })
          .where(eq(reports.id, reportId));

        // 4. Notify user via PostgreSQL NOTIFY
        await db.execute(
          sql`SELECT pg_notify('report_ready', json_build_object(
            'reportId', ${reportId},
            'userId', ${userId},
            'fileUrl', ${fileUrl},
            'format', ${format}
          )::text)`
        );

        console.log(`✅ Report ${reportId} completed: ${fileUrl}`);

      } catch (error) {
        console.error(`❌ Report generation failed for ${reportId}:`, error);

        // Mark report as failed in database
        await db
          .update(reports)
          .set({
            status: 'failed',
            error: error.message,
            failedAt: new Date()
          })
          .where(eq(reports.id, reportId));

        // Re-throw to mark job as failed
        throw error;
      }
    }
  );

  console.log('✅ Process Report worker registered');
}
```

### API Route with Validation

```typescript
// apps/api/src/routes/reports.ts

import { Elysia, t } from 'elysia';
import { jobQueue } from '../lib/queue';

export const reportRoutes = new Elysia({ prefix: '/reports' })
  .post('/:id/generate', async ({ params, body, user }) => {
    const { format } = body;

    // Check if report exists and user has access
    const report = await db.query.reports.findFirst({
      where: and(
        eq(reports.id, params.id),
        eq(reports.userId, user.id)
      )
    });

    if (!report) {
      return { error: 'Report not found', status: 404 };
    }

    // Check if already processing
    if (report.status === 'processing') {
      return {
        error: 'Report already being processed',
        status: 409
      };
    }

    // Mark report as processing
    await db
      .update(reports)
      .set({
        status: 'processing',
        startedAt: new Date()
      })
      .where(eq(reports.id, params.id));

    // Queue the job with singleton to prevent duplicates
    const jobId = await jobQueue.send('process-report', {
      reportId: params.id,
      userId: user.id,
      format,
    }, {
      singletonKey: `report-${params.id}-${format}`,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true
    });

    return {
      success: true,
      jobId,
      reportId: params.id,
      message: 'Report generation queued'
    };
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      format: t.Union([
        t.Literal('pdf'),
        t.Literal('csv'),
        t.Literal('xlsx')
      ])
    })
  });
```

---

## Example 4: Email Campaign (Fan-Out Pattern)

### Overview
Send emails to thousands of subscribers in batches.

### Implementation

```typescript
// apps/api/src/workers/send-campaign.ts

import { jobQueue, type SendCampaignJob, type SendEmailJob } from '../lib/queue';
import { db } from '@agios/db/client';
import { campaigns, subscribers } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export async function registerSendCampaignWorker() {
  await jobQueue.work<SendCampaignJob>(
    'send-campaign',
    async (job) => {
      const { campaignId } = job.data;

      console.log(`📧 Processing campaign ${campaignId}`);

      // Get campaign
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, campaignId)
      });

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get all subscribers
      const subs = await db.query.subscribers.findMany({
        where: eq(subscribers.campaignId, campaignId)
      });

      console.log(`Found ${subs.length} subscribers`);

      // Create email jobs in batches
      const BATCH_SIZE = 100;

      for (let i = 0; i < subs.length; i += BATCH_SIZE) {
        const batch = subs.slice(i, i + BATCH_SIZE);

        // Send batch in parallel
        await Promise.all(
          batch.map(subscriber =>
            jobQueue.send<SendEmailJob>('send-email', {
              to: subscriber.email,
              subject: campaign.subject,
              body: renderTemplate(campaign.template, {
                name: subscriber.name,
                unsubscribeLink: `https://example.com/unsubscribe/${subscriber.id}`
              })
            }, {
              priority: 5,  // Lower priority for bulk emails
              retryLimit: 2
            })
          )
        );

        console.log(`Queued batch ${i / BATCH_SIZE + 1} (${batch.length} emails)`);
      }

      // Update campaign status
      await db
        .update(campaigns)
        .set({
          status: 'sent',
          sentAt: new Date(),
          totalRecipients: subs.length
        })
        .where(eq(campaigns.id, campaignId));

      console.log(`✅ Campaign ${campaignId} queued (${subs.length} emails)`);
    }
  );

  console.log('✅ Send Campaign worker registered');
}

// Email sender worker
export async function registerSendEmailWorker() {
  await jobQueue.work<SendEmailJob>(
    'send-email',
    {
      teamSize: 5,        // 5 workers
      teamConcurrency: 3  // 15 concurrent emails
    },
    async (job) => {
      const { to, subject, body } = job.data;

      console.log(`📧 Sending email to ${to}`);

      // Send via email provider
      await emailProvider.send({
        to,
        subject,
        html: body
      });

      console.log(`✅ Email sent to ${to}`);
    }
  );

  console.log('✅ Send Email worker registered');
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}
```

---

## Testing Examples

### Unit Test: Worker Logic

```typescript
// apps/api/src/workers/__tests__/send-email.test.ts

import { describe, it, expect, mock } from 'bun:test';
import { registerSendEmailWorker } from '../send-email';

describe('Send Email Worker', () => {
  it('sends email with correct data', async () => {
    const mockSend = mock(() => Promise.resolve());

    const job = {
      id: '123',
      name: 'send-email',
      data: {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Hello'
      }
    };

    // Test just the handler logic
    await sendEmailHandler(job);

    expect(mockSend).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello'
    });
  });

  it('throws error on failure', async () => {
    const mockSend = mock(() => Promise.reject(new Error('API error')));

    const job = {
      id: '123',
      name: 'send-email',
      data: {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Hello'
      }
    };

    expect(sendEmailHandler(job)).rejects.toThrow('API error');
  });
});
```

### Integration Test: Full Queue

```typescript
// test/integration/queue.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { jobQueue } from '../apps/api/src/lib/queue';

describe('Job Queue Integration', () => {
  beforeAll(async () => {
    await jobQueue.start();
  });

  afterAll(async () => {
    await jobQueue.stop();
  });

  it('processes job end-to-end', async () => {
    let processed = false;

    // Register test worker
    await jobQueue.work('test-job', async (job) => {
      processed = true;
      expect(job.data.value).toBe(42);
    });

    // Send job
    const jobId = await jobQueue.send('test-job', { value: 42 });
    expect(jobId).toBeTruthy();

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(processed).toBe(true);
  });

  it('respects singleton key', async () => {
    let count = 0;

    await jobQueue.work('singleton-test', async (job) => {
      count++;
    });

    // Send same job twice
    await jobQueue.send('singleton-test', { id: 1 }, {
      singletonKey: 'test-key'
    });

    await jobQueue.send('singleton-test', { id: 1 }, {
      singletonKey: 'test-key'
    });

    // Wait
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should only process once
    expect(count).toBe(1);
  });
});
```

---

## See Also

- [SKILL.md](./SKILL.md) - Quick start guide
- [REFERENCE.md](./REFERENCE.md) - pg-boss API reference
- [PATTERNS.md](./PATTERNS.md) - Common patterns
