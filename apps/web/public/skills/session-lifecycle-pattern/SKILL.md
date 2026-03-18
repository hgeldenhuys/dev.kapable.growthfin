---
name: session-lifecycle-pattern
title: Queue-Based Session Lifecycle Pattern
category: architecture
trigger: "session boundaries" OR "start/end events" OR "batch processing"
severity: low
reusability: high
created: 2025-10-30
---

# Queue-Based Session Lifecycle Pattern

## When to Use

Use this pattern for features that need session boundaries with sequential processing.

**Common scenarios**:
- Audio/video with intro/outro (PA announcements, podcast intro/outro)
- Email digest batching (start digest → emails → summary footer)
- File batch operations (start report → process files → completion summary)
- API request batching (begin transaction → requests → commit/rollback)
- Logging sessions (session start → log entries → session end)

## The Problem

Many features need "session lifecycle" behavior:
1. **Start event**: Play intro, send header, log session start
2. **Processing**: Handle queue of items sequentially
3. **End event**: Play outro, send footer, log session end

Complex state machines (Redux, XState) are overkill for simple use cases.

## The Solution

**Use simple queue + boolean flags for state management.**

### Basic Pattern

```typescript
interface SessionState {
  isActive: boolean;       // Currently processing items
  hasStarted: boolean;     // One-time session init completed
  queue: WorkItem[];       // Pending work items
  config: Config;          // User preferences
}
```

## Complete Example: Audio Player with PA Announcements

```typescript
import { execSync } from 'child_process';
import * as path from 'path';

// Session state
let hasPlayedStart = false;
let isPlaying = false;
const audioQueue: Buffer[] = [];

// Config
const PA_START = path.join(__dirname, '../resources/pa-start.m4a');
const PA_END = path.join(__dirname, '../resources/pa-end.m4a');

// User preference
let announcementsEnabled = true;

// Helper: Play audio file
async function playAudioFile(filePath: string): Promise<void> {
  const platform = process.platform;
  if (platform === 'darwin') {
    execSync(`afplay "${filePath}"`, { stdio: 'inherit' });
  } else if (platform === 'linux') {
    execSync(`mpg123 -q "${filePath}"`, { stdio: 'inherit' });
  }
}

// Public API: Queue audio for playback
export async function playAudio(audioBuffer: Buffer): Promise<void> {
  // Add to queue
  audioQueue.push(audioBuffer);

  // Start session (once)
  if (!hasPlayedStart && announcementsEnabled) {
    await playAudioFile(PA_START);
    hasPlayedStart = true;
  }

  // Process queue if not already processing
  if (!isPlaying) {
    await processQueue();
  }
}

// Internal: Process queue sequentially
async function processQueue(): Promise<void> {
  isPlaying = true;

  while (audioQueue.length > 0) {
    const buffer = audioQueue.shift()!;

    // Write to temp file
    const tempFile = `/tmp/audio-${Date.now()}.mp3`;
    await fs.writeFile(tempFile, buffer);

    // Play
    await playAudioFile(tempFile);

    // Cleanup
    await fs.unlink(tempFile);
  }

  isPlaying = false;

  // End session when queue empty
  if (announcementsEnabled) {
    await playAudioFile(PA_END);
  }
}

// Public API: Configure announcements
export function setAnnouncementsEnabled(enabled: boolean): void {
  announcementsEnabled = enabled;
}
```

## State Transitions

```
Initial State:
  hasStarted = false
  isActive = false
  queue = []

User adds first item:
  queue = [item1]
  → Trigger start event (play PA_START)
  → Set hasStarted = true
  → Set isActive = true
  → Process item1
  → Set isActive = false
  → Trigger end event (play PA_END)

User adds second item (before queue empty):
  queue = [item2]
  → Skip start event (hasStarted = true)
  → Process item2 (isActive already true)
  → Continue...

Queue becomes empty:
  → Trigger end event
  → Reset for next session (optional)
```

## Pattern Variations

See [VARIATIONS.md](./VARIATIONS.md) for:
- Email digest batching
- File batch processing
- API request batching
- Resettable sessions

## Testing

```typescript
import { expect, test, beforeEach } from 'bun:test';

let playedSounds: string[] = [];

beforeEach(() => {
  playedSounds = [];
  resetSession(); // Reset state between tests
});

// Mock audio playback
function mockPlayAudioFile(filePath: string) {
  playedSounds.push(path.basename(filePath));
}

test('plays start sound only once', async () => {
  await playAudio(Buffer.from('audio1'));
  await playAudio(Buffer.from('audio2'));
  await playAudio(Buffer.from('audio3'));

  const startCount = playedSounds.filter(s => s === 'pa-start.m4a').length;
  expect(startCount).toBe(1);
});

test('plays end sound after queue empties', async () => {
  await playAudio(Buffer.from('audio1'));
  // Wait for queue to empty
  await waitForQueueEmpty();

  expect(playedSounds).toContain('pa-end.m4a');
  expect(playedSounds[playedSounds.length - 1]).toBe('pa-end.m4a');
});

test('respects announcement disable flag', async () => {
  setAnnouncementsEnabled(false);

  await playAudio(Buffer.from('audio1'));

  expect(playedSounds).not.toContain('pa-start.m4a');
  expect(playedSounds).not.toContain('pa-end.m4a');
});

test('processes queue sequentially', async () => {
  const order: number[] = [];

  // Mock processing to track order
  async function mockProcess(id: number) {
    order.push(id);
  }

  await addWork({ id: 1, process: () => mockProcess(1) });
  await addWork({ id: 2, process: () => mockProcess(2) });
  await addWork({ id: 3, process: () => mockProcess(3) });

  await waitForQueueEmpty();

  expect(order).toEqual([1, 2, 3]);
});
```

## When NOT to Use

**Don't use this pattern if:**
- You need concurrent processing (use Promise.all instead)
- You have complex state transitions (consider state machine library)
- You need to pause/resume sessions (add pause/resume methods or use more complex state)
- Session can be interrupted by errors (add error handling and recovery)

## Related Patterns

- **Producer-Consumer**: Similar queue pattern but with separate threads
- **Command Pattern**: Queue of commands to execute
- **State Machine**: More complex state management (XState, Redux)

## References

- Source: PA Announcement Sounds feature (2025-10-30)
- Found by: Backend-Dev during audio playback implementation
- Use Case: Playing intro/outro sounds around audio narration
- Complexity: Simple boolean flags sufficient, no complex FSM needed

## Checklist

When implementing session lifecycle:

- [ ] Define state interface (isActive, hasStarted, queue, config)
- [ ] Implement start event (play intro, send header, log start)
- [ ] Implement queue processing (sequential, one at a time)
- [ ] Implement end event (play outro, send footer, log end)
- [ ] Add config for enabling/disabling session events
- [ ] Test start event only fires once
- [ ] Test end event only fires when queue empty
- [ ] Test sequential processing (items don't overlap)
- [ ] Test session can be disabled via config

---

**Key Insight**: Most "session lifecycle" needs are simple. Start with boolean flags before reaching for complex state machines.
