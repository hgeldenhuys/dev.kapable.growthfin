# Pattern Variations

## Variation 1: Email Digest Batching

```typescript
let digestStarted = false;
let isSending = false;
const emailQueue: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  emailQueue.push(email);

  if (!digestStarted) {
    await sendDigestHeader();
    digestStarted = true;
  }

  if (!isSending) {
    await processEmails();
  }
}

async function processEmails(): Promise<void> {
  isSending = true;

  while (emailQueue.length > 0) {
    const email = emailQueue.shift()!;
    await sendEmailToProvider(email);
  }

  isSending = false;

  // Send footer when digest complete
  await sendDigestFooter();
  digestStarted = false; // Reset for next digest
}
```

## Variation 2: File Batch Processing

```typescript
interface BatchState {
  hasStarted: boolean;
  isProcessing: boolean;
  queue: string[]; // File paths
  results: { success: number; failed: number };
}

const batch: BatchState = {
  hasStarted: false,
  isProcessing: false,
  queue: [],
  results: { success: 0, failed: 0 },
};

export async function processFile(filePath: string): Promise<void> {
  batch.queue.push(filePath);

  if (!batch.hasStarted) {
    console.log('📋 Starting batch processing...');
    batch.hasStarted = true;
  }

  if (!batch.isProcessing) {
    await processBatch();
  }
}

async function processBatch(): Promise<void> {
  batch.isProcessing = true;

  while (batch.queue.length > 0) {
    const file = batch.queue.shift()!;

    try {
      await processFileContent(file);
      batch.results.success++;
    } catch (error) {
      batch.results.failed++;
    }
  }

  batch.isProcessing = false;

  // Report when batch complete
  console.log(`✅ Batch complete: ${batch.results.success} succeeded, ${batch.results.failed} failed`);

  // Reset for next batch
  batch.hasStarted = false;
  batch.results = { success: 0, failed: 0 };
}
```

## Variation 3: API Request Batching

```typescript
let transactionStarted = false;
let isExecuting = false;
const requestQueue: APIRequest[] = [];

export async function addRequest(request: APIRequest): Promise<void> {
  requestQueue.push(request);

  if (!transactionStarted) {
    await beginTransaction();
    transactionStarted = true;
  }

  if (!isExecuting) {
    await executeRequests();
  }
}

async function executeRequests(): Promise<void> {
  isExecuting = true;

  try {
    while (requestQueue.length > 0) {
      const request = requestQueue.shift()!;
      await executeAPICall(request);
    }

    // Commit transaction
    await commitTransaction();
  } catch (error) {
    // Rollback on error
    await rollbackTransaction();
    throw error;
  } finally {
    isExecuting = false;
    transactionStarted = false;
  }
}
```

## Advanced: Resettable Sessions

```typescript
let sessionId: string | null = null;
let hasStarted = false;
let isActive = false;
const queue: WorkItem[] = [];

// Start new session
export function startSession(id: string): void {
  if (sessionId !== null) {
    throw new Error('Session already active');
  }

  sessionId = id;
  hasStarted = false;
  isActive = false;
  queue.length = 0; // Clear queue

  console.log(`🔵 Session ${id} started`);
}

// End current session
export function endSession(): void {
  if (sessionId === null) {
    return;
  }

  // Wait for queue to finish
  while (queue.length > 0 || isActive) {
    // Process remaining items
  }

  console.log(`⚪ Session ${sessionId} ended`);

  sessionId = null;
  hasStarted = false;
}

// Add work to current session
export async function addWork(item: WorkItem): Promise<void> {
  if (sessionId === null) {
    throw new Error('No active session');
  }

  queue.push(item);

  if (!hasStarted) {
    await triggerSessionStart();
    hasStarted = true;
  }

  if (!isActive) {
    await processQueue();
  }
}
```
